// ==============================================================================
// PERHATIAN: SERVER-ONLY (memakai pg dan env IOT_GATEWAY_*). Jangan di-import dari
// komponen "use client".
//
// Akses PLC on-demand untuk halaman HMI-web (parameter, koefisien, kalibrasi, jam, manual).
// Tag di sini SENGAJA tidak masuk TAG_MAP di plc.js (TAG_MAP dibaca tiap 1 detik oleh dashboard).
//
// Pola tulis yang dipakai ulang dari alur START:
//   cek mesin idle → kunci → audit (fail-closed) → writePlcTags → BACA-BALIK → audit hasil.
// ==============================================================================

import pool from "./db.js";
import { writePlcTags } from "./plcWrite.js";
import { START_LOCK_KEY } from "./recipeGuard.js";
import { rawEqualsKind } from "./plcParamCatalog.js";

const DEVICE_PREFIX = "S7-200.SiemensS7-200.";

// Kunci advisory untuk menserialkan semua penulisan HMI-web. START_LOCK_KEY juga dipegang
// supaya tidak ada tulis yang menyelip saat alur START berjalan (dan sebaliknya).
export const PLC_WRITE_LOCK_KEY = 847291035;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function gatewayConfig() {
    const protocol = process.env.IOT_GATEWAY_PROTOCOL || "http";
    const host = process.env.IOT_GATEWAY_HOST;
    const port = process.env.IOT_GATEWAY_PORT;
    const user = process.env.IOT_GATEWAY_USER;
    const pass = process.env.IOT_GATEWAY_PASS;
    if (!host || !port || !user || !pass) {
        throw new Error("Environment variable IOT_GATEWAY_* belum lengkap (cek .env.local)");
    }
    return {
        base: `${protocol}://${host}:${port}`,
        auth: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
    };
}

/**
 * Baca sejumlah tag (nama persis di KEPServerEX, tanpa prefix device). Nilai RAW, tanpa scaling.
 * Tag bermutu buruk / tidak ada di KEPServerEX → null (dan masuk `bad`).
 * Melempar error bila gateway tidak terjangkau atau SEMUA tag bermutu buruk.
 *
 * @param {string[]} tagNames
 * @returns {Promise<{values: Record<string, number|boolean|null>, bad: string[]}>}
 */
export async function readPlcRaw(tagNames) {
    const names = [...new Set(tagNames)];
    const { base, auth } = gatewayConfig();
    const qs = names.map((n) => `ids=${encodeURIComponent(DEVICE_PREFIX + n)}`).join("&");

    const response = await fetch(`${base}/iotgateway/read?${qs}`, {
        method: "GET",
        headers: { Authorization: auth, Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
        throw new Error(`IoT Gateway read HTTP ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    const results = raw.readResults || raw.ReadResults || [];

    const values = Object.fromEntries(names.map((n) => [n, null]));
    const bad = [];
    const seen = new Set();
    for (const item of results) {
        const name = item.id?.replace(DEVICE_PREFIX, "");
        if (!name || !(name in values)) continue;
        seen.add(name);
        const good = item.s === true || item.r === "Success";
        if (!good) { bad.push(name); continue; }
        values[name] = item.v ?? null;
    }
    for (const n of names) if (!seen.has(n)) bad.push(n);

    if (bad.length === names.length) {
        throw new Error("Semua tag quality bad - Gateway kebaca, tapi PLC kemungkinan belum tersambung");
    }
    if (bad.length > 0) console.warn("[plcAccess] Tag gagal dibaca:", bad);
    return { values, bad };
}

/**
 * Pegang START_LOCK_KEY + PLC_WRITE_LOCK_KEY selama fn() berjalan.
 * @returns {Promise<{locked: false} | {locked: true, result: any}>}
 */
export async function withPlcLocks(fn) {
    const client = await pool.connect();
    const held = [];
    let destroy = false;
    try {
        for (const key of [START_LOCK_KEY, PLC_WRITE_LOCK_KEY]) {
            const r = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [key]);
            if (r.rows[0]?.ok !== true) return { locked: false };
            held.push(key);
        }
        const result = await fn();
        return { locked: true, result };
    } finally {
        // Kunci SELALU dilepas, juga bila fn() melempar error.
        for (const key of held.reverse()) {
            try {
                await client.query("SELECT pg_advisory_unlock($1)", [key]);
            } catch (err) {
                // Lock menempel di sesi koneksi: koneksi HARUS dibuang bila unlock gagal.
                console.error("[plcAccess] Gagal melepas advisory lock, koneksi dibuang:", err.message);
                destroy = true;
            }
        }
        client.release(destroy);
    }
}

/**
 * Mesin dianggap boleh disentuh bila fase VW98 termasuk allowedPhases DAN tidak ada batch
 * berstatus 'running' di database. Fase tak terbaca = ditolak (fail-closed).
 * @returns {Promise<{ok: boolean, phase: number|null, reason: string|null}>}
 */
export async function checkMachineIdle(allowedPhases) {
    const { values } = await readPlcRaw(["PROCCES_TEXT"]);
    const raw = values.PROCCES_TEXT;
    if (raw === null || raw === undefined) {
        return { ok: false, phase: null, reason: "Fase mesin tidak terbaca dari PLC." };
    }
    const phase = Number(raw);
    if (!allowedPhases.includes(phase)) {
        return {
            ok: false,
            phase,
            reason: "Mesin sedang menjalankan proses (fase aktif). Tunggu sampai selesai atau tekan STOP di mesin.",
        };
    }
    const running = await pool.query("SELECT batch_no FROM batch_records WHERE status = 'running' LIMIT 1");
    if (running.rows.length > 0) {
        return {
            ok: false,
            phase,
            reason: `Batch ${running.rows[0].batch_no} masih berstatus berjalan. Selesaikan atau hentikan batch dulu.`,
        };
    }
    return { ok: true, phase, reason: null };
}

/**
 * Tulis lalu baca-balik sampai semua nilai cocok (maks ~4,5 dtk), seperti verifikasi setpoint START.
 *
 * @param {Array<{tag: string, raw: number|boolean, kind: "int"|"float"|"bool"}>} items
 * @param {{ timeoutMs?: number, intervalMs?: number }} [verifyOpts]
 *   Opsional: override timeout/interval verifikasi. Default cocok untuk setpoint (lambat berubah).
 *   Untuk bit boolean sederhana (kontrol manual, door), pakai nilai lebih pendek, mis. {timeoutMs:1000, intervalMs:150}.
 * @returns {Promise<{ok: true, readBack: object} | {ok: false, stage: "write"|"verify", failed?: string[], mismatch?: Array, readBack?: object|null}>}
 */
export async function writeAndVerify(items, verifyOpts) {
    const wr = await writePlcTags(items.map((i) => ({ tag: i.tag, value: i.raw })));
    if (!wr.ok) {
        console.error("[plcAccess] Gagal menulis ke PLC:", wr.results);
        return { ok: false, stage: "write", failed: wr.results.filter((r) => !r.success).map((r) => r.tag) };
    }
    return verifyRaw(items, verifyOpts);
}

/** Baca-balik saja (dipakai juga setelah pulsa). */
export async function verifyRaw(items, { timeoutMs = 4500, intervalMs = 500 } = {}) {
    const tags = items.map((i) => i.tag);
    const deadline = Date.now() + timeoutMs;
    let lastValues = null;
    let mismatch = items;

    // Baca dulu SEBELUM sleep pertama: PLC ladder merespons dalam satu scan (~10 ms),
    // sehingga baca langsung sudah cukup dan tidak perlu menunggu intervalMs penuh.
    do {
        try {
            const { values } = await readPlcRaw(tags);
            lastValues = values;
            mismatch = items.filter((i) => !rawEqualsKind(i.kind, i.raw, values[i.tag]));
            if (mismatch.length === 0) return { ok: true, readBack: values };
        } catch (err) {
            console.warn("[plcAccess] Baca-balik gagal sesaat:", err.message);
        }
        if (Date.now() < deadline) await sleep(intervalMs);
    } while (Date.now() < deadline);

    return {
        ok: false,
        stage: "verify",
        mismatch: mismatch.map((i) => ({ tag: i.tag, expected: i.raw, got: lastValues?.[i.tag] ?? null })),
        readBack: lastValues,
    };
}
