// ==============================================================================
// PERHATIAN: SERVER-ONLY (memakai plcAccess.js → pg dan env IOT_GATEWAY_*). Jangan di-import
// dari komponen "use client".
//
// Pengaman waktu untuk Door Operate:
//  - DEADMAN rantai (Forward M11.0 / Backward M11.1): bit hanya menyala selama klien terus
//    mengirim "run". Bila sinyal berhenti > DEADMAN_TIMEOUT_MS, server menulis false sendiri.
//  - AUTO-OFF Water Drain (M2.5) dan Door Unlock (M6.0) setelah AUTO_OFF_MS.
//
// Keadaan hidup di globalThis (bundle route Next bisa terduplikasi, variabel modul biasa
// akan membuat dua timer terpisah). Fabrik createDoorSafety menerima dependensi agar bisa
// dites dengan mock tanpa gateway dan tanpa database (fase1/tests/plc_door_mock.mjs).
//
// KETERBATASAN yang harus diketahui: bila proses server/PC mati saat bit true, tidak ada yang
// menulis false. Rantai jalan sampai syarat PLC memotong (seal, pintu, I2.0/I1.7). Perlindungan
// penuh butuh timeout di ladder PLC (di luar lingkup web). server.js menulis false best-effort
// saat start.
// ==============================================================================

import {
    DOOR_CMD_TAGS, ALL_STATE_TAGS, IDLE_PHASES_DOOR,
    DEADMAN_TIMEOUT_MS, AUTO_OFF_MS, buildDoorState, checkDoorCommand,
} from "./plcDoorCatalog.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CHAIN_TAG = { fwd: DOOR_CMD_TAGS.fwd, bwd: DOOR_CMD_TAGS.bwd };
const OPPOSITE = { fwd: "bwd", bwd: "fwd" };

// Dependensi nyata, dimuat malas supaya modul ini bisa di-import tanpa pg (tes).
const realDeps = {
    readRaw: async (...a) => (await import("./plcAccess.js")).readPlcRaw(...a),
    withLocks: async (...a) => (await import("./plcAccess.js")).withPlcLocks(...a),
    checkIdle: async (...a) => (await import("./plcAccess.js")).checkMachineIdle(...a),
    verify: async (...a) => (await import("./plcAccess.js")).verifyRaw(...a),
    writeTags: async (...a) => (await import("./plcWrite.js")).writePlcTags(...a),
};

/** Baca keadaan pintu lengkap dalam satu panggilan gateway. */
export async function readDoorState(deps = realDeps) {
    const { values, bad } = await deps.readRaw(ALL_STATE_TAGS);
    return buildDoorState(values, bad);
}

/**
 * @param {typeof realDeps} deps
 * @param {{deadmanTimeoutMs?: number, autoOffMs?: number, chainVerify?: object, offVerify?: object}} [opts]
 */
export function createDoorSafety(deps = realDeps, opts = {}) {
    const deadmanMs = opts.deadmanTimeoutMs ?? DEADMAN_TIMEOUT_MS;
    const autoOffMs = opts.autoOffMs ?? AUTO_OFF_MS;
    const chainVerify = opts.chainVerify ?? { timeoutMs: 1500, intervalMs: 250 }; // pendek: rantai sedang jalan
    const offVerify = opts.offVerify ?? {};

    const chain = { dir: null, timer: null, gen: 0, startedAt: 0, hooks: null, stuck: false };
    const autoOff = new Map(); // key → { timer, until, tag, hooks }

    // Semua operasi rantai/auto-OFF diserialkan: tidak ada dua penulisan bit yang saling menyalip.
    let queue = Promise.resolve();
    const serial = (fn) => {
        const p = queue.then(fn);
        queue = p.then(() => { }, () => { });
        return p;
    };

    /** Tulis false (maks 3 percobaan), lalu baca-balik. */
    async function writeFalse(tags) {
        const pairs = tags.map((tag) => ({ tag, value: false }));
        let wrote = false;
        for (let attempt = 1; attempt <= 3 && !wrote; attempt++) {
            try {
                const wr = await deps.writeTags(pairs);
                wrote = wr.ok === true;
            } catch { /* coba lagi */ }
            if (!wrote && attempt < 3) await sleep(300);
        }
        let verified = false;
        try {
            const v = await deps.verify(tags.map((tag) => ({ tag, raw: false, kind: "bool" })), offVerify);
            verified = v.ok === true;
        } catch { /* tidak terverifikasi */ }
        return { wrote, verified };
    }

    // ── Rantai ───────────────────────────────────────────────────────────────

    function armChainTimer() {
        if (chain.timer) clearTimeout(chain.timer);
        const gen = ++chain.gen;
        chain.timer = setTimeout(() => {
            // gen berubah = sudah ada "run" lebih baru: timer usang tidak boleh mematikan.
            serial(() => (chain.gen === gen ? endChain("tidak ada sinyal tahan (deadman)") : undefined)).catch(() => { });
        }, deadmanMs);
        chain.timer.unref?.();
    }

    /** Hentikan rantai: SELALU tulis false ke kedua arah, juga bila tidak ada sesi aktif. */
    async function endChain(reason) {
        if (chain.timer) clearTimeout(chain.timer);
        const { dir, startedAt, hooks } = chain;
        chain.dir = null; chain.timer = null; chain.hooks = null; chain.gen++;
        const off = await writeFalse([CHAIN_TAG.fwd, CHAIN_TAG.bwd]);
        chain.stuck = !off.verified;
        if (!off.verified) {
            console.error("[plcDeadman] ⚠ Rantai TIDAK terverifikasi mati. Cek CHAIN_FWD/CHAIN_BWD (M11.0/M11.1) di mesin.");
        }
        if (dir && hooks?.onEnd) {
            try {
                await hooks.onEnd({ dir, reason, durationMs: Date.now() - startedAt, ok: off.verified });
            } catch (err) {
                console.error("[plcDeadman] onEnd gagal:", err?.message);
            }
        }
        return off;
    }

    /**
     * Tahan rantai satu arah. Dipanggil berulang (±300 ms) selama tombol ditekan.
     * hooks.onStart() dipanggil SEBELUM menulis (lempar error = batal, fail-closed);
     * hooks.onEnd(info) dipanggil saat sesi berakhir.
     * @returns {Promise<{ok: boolean, status: number, error?: string, active?: string}>}
     */
    function chainRun(dir, hooks) {
        return serial(async () => {
            if (dir !== "fwd" && dir !== "bwd") return { ok: false, status: 400, error: "Arah tidak dikenal" };

            // Sesi searah sedang jalan: cukup validasi cepat lalu perpanjang timer.
            if (chain.dir === dir) {
                let state;
                try {
                    state = await readDoorState(deps);
                } catch {
                    await endChain("PLC tidak terbaca");
                    return { ok: false, status: 502, error: "PLC tidak terbaca. Rantai dihentikan." };
                }
                const refuse = checkDoorCommand(dir, state);
                if (refuse) {
                    await endChain(`pagar: ${refuse}`);
                    return { ok: false, status: 409, error: refuse };
                }
                armChainTimer();
                return { ok: true, status: 200, active: dir };
            }

            // Arah lawan sedang jalan: matikan dulu sebelum arah baru.
            if (chain.dir && chain.dir !== dir) await endChain("arah diganti");

            const out = await deps.withLocks(async () => {
                let state;
                try {
                    const idle = await deps.checkIdle(IDLE_PHASES_DOOR);
                    if (!idle.ok) return { ok: false, status: 409, error: `${idle.reason} Rantai hanya saat mesin idle.` };
                    state = await readDoorState(deps);
                } catch {
                    return { ok: false, status: 502, error: "PLC tidak terbaca. Periksa KEPServerEX dan PLC." };
                }
                const refuse = checkDoorCommand(dir, state);
                if (refuse) return { ok: false, status: 409, error: refuse };

                try {
                    await hooks?.onStart?.();
                } catch (err) {
                    console.error("[plcDeadman] Gagal catat audit, rantai dibatalkan:", err?.message);
                    return { ok: false, status: 500, error: "Gagal mencatat audit sehingga rantai tidak dijalankan. Hubungi admin." };
                }

                const tag = CHAIN_TAG[dir];
                const opp = CHAIN_TAG[OPPOSITE[dir]];
                let wrote = false;
                try {
                    const wr = await deps.writeTags([{ tag: opp, value: false }, { tag, value: true }]);
                    wrote = wr.ok === true;
                } catch { /* dianggap gagal */ }
                let verified = false;
                if (wrote) {
                    try {
                        const v = await deps.verify(
                            [{ tag: opp, raw: false, kind: "bool" }, { tag, raw: true, kind: "bool" }], chainVerify);
                        verified = v.ok === true;
                    } catch { /* tidak terverifikasi */ }
                }
                if (!verified) {
                    // Tulis ON mungkin sudah masuk: pastikan mati.
                    await writeFalse([CHAIN_TAG.fwd, CHAIN_TAG.bwd]);
                    return { ok: false, status: 502, error: "Perintah rantai tidak terverifikasi di PLC. Rantai dimatikan; periksa mesin." };
                }

                chain.dir = dir; chain.startedAt = Date.now(); chain.hooks = hooks ?? null; chain.stuck = false;
                armChainTimer();
                return { ok: true, status: 200, active: dir };
            });

            if (!out.locked) {
                return { ok: false, status: 409, error: "Ada penulisan PLC lain atau proses START yang sedang berjalan. Coba lagi sebentar." };
            }
            return out.result;
        });
    }

    /** Hentikan rantai (tombol dilepas / halaman ditutup). Selalu menulis false ke kedua arah. */
    function chainStop(reason = "tombol dilepas") {
        return serial(async () => {
            const off = await endChain(reason);
            return off.verified
                ? { ok: true, status: 200 }
                : { ok: false, status: 502, error: "Rantai tidak terverifikasi mati. Periksa mesin; matikan dari HMI bila perlu." };
        });
    }

    // ── Auto-OFF (Water Drain, Door Unlock) ───────────────────────────────────

    function disarmAutoOff(key) {
        const entry = autoOff.get(key);
        if (entry) { clearTimeout(entry.timer); autoOff.delete(key); }
    }

    /** Matikan `tag` otomatis setelah autoOffMs. hooks.onEnd({key, tag, ok}) dipanggil sesudahnya. */
    function armAutoOff(key, tag, hooks) {
        disarmAutoOff(key);
        const entry = { tag, hooks, until: Date.now() + autoOffMs, timer: null };
        entry.timer = setTimeout(() => {
            serial(async () => {
                if (autoOff.get(key) !== entry) return; // sudah dimatikan/diganti
                autoOff.delete(key);
                const off = await writeFalse([tag]);
                if (!off.verified) console.error(`[plcDeadman] ⚠ Auto-OFF ${tag} tidak terverifikasi. Cek di mesin.`);
                try { await hooks?.onEnd?.({ key, tag, ok: off.verified }); } catch { /* audit best-effort */ }
            }).catch(() => { });
        }, autoOffMs);
        entry.timer.unref?.();
        autoOff.set(key, entry);
    }

    function status() {
        const now = Date.now();
        const left = (key) => (autoOff.has(key) ? Math.max(0, autoOff.get(key).until - now) : null);
        return { chainDir: chain.dir, chainStuck: chain.stuck, autoOff: { drain: left("drain"), unlock: left("unlock") } };
    }

    return { chainRun, chainStop, armAutoOff, disarmAutoOff, status };
}

/** Singleton produksi (satu per proses, tahan duplikasi bundle). */
export function getDoorSafety() {
    if (!globalThis.__plcDoorSafety) globalThis.__plcDoorSafety = createDoorSafety();
    return globalThis.__plcDoorSafety;
}
