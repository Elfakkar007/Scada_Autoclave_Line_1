// Tes logika Door Operate TANPA gateway, DB, ataupun mesin.
// Jalankan dari root proyek:  node fase1/tests/plc_door_mock.mjs
// Yang dites: pagar (plcDoorCatalog), deadman rantai + auto-OFF (plcDeadman via dependensi mock).
// Yang TIDAK dites: route di bawah Next, auth, audit ke DB, mesin asli.

import assert from "node:assert/strict";
import {
    buildDoorState, checkDoorCommand, REQUIRED_TAGS,
} from "../../src/lib/plcDoorCatalog.js";
import { createDoorSafety } from "../../src/lib/plcDeadman.js";

let passed = 0;
async function t(name, fn) {
    try { await fn(); passed++; console.log("  ok  ", name); }
    catch (err) { console.error("  GAGAL", name, "\n      ", err.message); process.exitCode = 1; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Keadaan dasar: idle, kedua pintu terbuka, seal lepas, P1 aman ────────────
function base(over = {}) {
    const v = {
        PROCCES_TEXT: 0, MANUAL_OPER: false,
        CLS_FRNT: false, CLS_REAR: false, OPN_FRNT: true, OPN_REAR: true, DOOR_SEAL: false,
        P1: 0, SAFETY_PRESS: 16,
        DOOR_SEAL_CMD: false, DOOR_RELEASE: false, CHAIN_FWD: false, CHAIN_BWD: false,
        MAN_WTR_DRAIN: false, DOOR_LOCK: false,
        ...over,
    };
    return buildDoorState(v, []);
}

console.log("Pagar (plcDoorCatalog)");
await t("seal: boleh bila kedua pintu tertutup dan seal belum aktif", () => {
    assert.equal(checkDoorCommand("seal", base({ CLS_FRNT: true, CLS_REAR: true, PROCCES_TEXT: 0 })), null);
});
await t("seal: ditolak bila satu pintu terbuka / seal sudah aktif / release masih aktif / rantai jalan", () => {
    assert.ok(checkDoorCommand("seal", base({ CLS_FRNT: true, CLS_REAR: false })));
    assert.ok(checkDoorCommand("seal", base({ CLS_FRNT: true, CLS_REAR: true, DOOR_SEAL: true })));
    assert.ok(checkDoorCommand("seal", base({ CLS_FRNT: true, CLS_REAR: true, DOOR_RELEASE: true })));
    assert.ok(checkDoorCommand("seal", base({ CLS_FRNT: true, CLS_REAR: true, CHAIN_FWD: true })));
});
await t("release: butuh seal aktif, P1 <= Safety Press, dan M1.2 = 0", () => {
    const ok = { CLS_FRNT: true, CLS_REAR: true, DOOR_SEAL: true, PROCCES_TEXT: 1, P1: 0 };
    assert.equal(checkDoorCommand("release", base(ok)), null);
    assert.equal(checkDoorCommand("release", base({ ...ok, P1: 16 })), null, "P1 = Safety Press masih boleh (<=)");
    assert.ok(checkDoorCommand("release", base({ ...ok, P1: 17 })), "P1 > Safety Press ditolak");
    assert.ok(checkDoorCommand("release", base({ ...ok, DOOR_SEAL: false })));
    assert.ok(checkDoorCommand("release", base({ ...ok, DOOR_SEAL_CMD: true })), "M1.2 tertahan = ditolak");
});
await t("release/unlock: P1 atau Safety Press tak terbaca = DITOLAK (fail-closed)", () => {
    const ok = { CLS_FRNT: true, CLS_REAR: true, DOOR_SEAL: true, PROCCES_TEXT: 1 };
    assert.ok(checkDoorCommand("release", base({ ...ok, P1: null })));
    assert.ok(checkDoorCommand("release", base({ ...ok, SAFETY_PRESS: null })));
    assert.ok(checkDoorCommand("unlock", base({ P1: null })));
    assert.ok(checkDoorCommand("unlock", base({ SAFETY_PRESS: undefined })));
});
await t("unlock: tolak bila P1 > Safety Press; P1 negatif boleh", () => {
    assert.equal(checkDoorCommand("unlock", base({ P1: -4 })), null);
    assert.ok(checkDoorCommand("unlock", base({ P1: 100 })));
});
await t("drain: butuh seal lepas dan kedua pintu TIDAK tertutup", () => {
    assert.equal(checkDoorCommand("drain", base()), null);
    assert.ok(checkDoorCommand("drain", base({ CLS_FRNT: true })));
    assert.ok(checkDoorCommand("drain", base({ CLS_REAR: true })));
    assert.ok(checkDoorCommand("drain", base({ DOOR_SEAL: true })));
});
await t("rantai: arah, pintu, seal, dan arah lawan", () => {
    assert.equal(checkDoorCommand("fwd", base()), null);
    assert.equal(checkDoorCommand("bwd", base()), null);
    assert.ok(checkDoorCommand("fwd", base({ CLS_REAR: true })), "maju diblokir pintu belakang tertutup");
    assert.equal(checkDoorCommand("fwd", base({ CLS_FRNT: true })), null, "maju tidak peduli pintu depan");
    assert.ok(checkDoorCommand("bwd", base({ CLS_FRNT: true })), "mundur diblokir pintu depan tertutup");
    assert.ok(checkDoorCommand("fwd", base({ DOOR_SEAL: true })));
    assert.ok(checkDoorCommand("fwd", base({ CHAIN_BWD: true })));
    assert.ok(checkDoorCommand("bwd", base({ CHAIN_FWD: true })));
});
await t("umum: fase aktif, fase tak terbaca, mode manual, nilai tak terbaca → ditolak", () => {
    for (const a of ["seal", "release", "drain", "unlock", "fwd", "bwd"]) {
        assert.ok(checkDoorCommand(a, base({ PROCCES_TEXT: 3 })), `${a} fase 3`);
        assert.ok(checkDoorCommand(a, base({ PROCCES_TEXT: 6 })), `${a} fase 6 (END)`);
        assert.ok(checkDoorCommand(a, base({ PROCCES_TEXT: null })), `${a} fase null`);
        assert.ok(checkDoorCommand(a, base({ MANUAL_OPER: true })), `${a} mode manual`);
        assert.ok(checkDoorCommand(a, base({ MANUAL_OPER: null })), `${a} mode manual null`);
    }
    assert.ok(checkDoorCommand("fwd", base({ CLS_REAR: null })));
    assert.ok(checkDoorCommand("drain", base({ DOOR_SEAL: null })));
});
await t("tag wajib hilang → semua ditolak dengan nama tag", () => {
    const s = buildDoorState({ PROCCES_TEXT: 0 }, ["CHAIN_FWD", "DOOR_SEAL_CMD"]);
    assert.deepEqual(s.missingTags, ["DOOR_SEAL_CMD", "CHAIN_FWD"].sort((a, b) => REQUIRED_TAGS.indexOf(a) - REQUIRED_TAGS.indexOf(b)));
    assert.match(checkDoorCommand("seal", s), /DOOR_SEAL_CMD/);
});

// ── PLC tiruan untuk deadman ─────────────────────────────────────────────────
function makePlc(initial = {}) {
    const mem = {
        PROCCES_TEXT: 0, MANUAL_OPER: false, CLS_FRNT: false, CLS_REAR: false, OPN_FRNT: true, OPN_REAR: true,
        DOOR_SEAL: false, P1: 0, SAFETY_PRESS: 16, DOOR_SEAL_CMD: false, DOOR_RELEASE: false,
        CHAIN_FWD: false, CHAIN_BWD: false, MAN_WTR_DRAIN: false, DOOR_LOCK: false, ...initial,
    };
    const log = []; // urutan penulisan
    const plc = {
        mem, log, failWrite: false, locked: false, idleOk: true, gatewayDown: false, ignoreWrites: false,
        deps: {
            readRaw: async (tags) => {
                if (plc.gatewayDown) throw new Error("gateway down");
                return { values: Object.fromEntries(tags.map((n) => [n, mem[n] ?? null])), bad: [] };
            },
            writeTags: async (pairs) => {
                if (plc.gatewayDown) throw new Error("gateway down");
                if (plc.failWrite) return { ok: false, results: [] };
                for (const { tag, value } of pairs) {
                    log.push(`${tag}=${value}`);
                    if (!plc.ignoreWrites) mem[tag] = value;
                }
                return { ok: true, results: [] };
            },
            verify: async (items) => {
                const mismatch = items.filter((i) => mem[i.tag] !== i.raw);
                return mismatch.length === 0 ? { ok: true } : { ok: false, mismatch };
            },
            withLocks: async (fn) => (plc.locked ? { locked: false } : { locked: true, result: await fn() }),
            checkIdle: async () => (plc.idleOk ? { ok: true, phase: 0, reason: null } : { ok: false, phase: 3, reason: "Mesin sibuk." }),
        },
    };
    return plc;
}
const fastOpts = { deadmanTimeoutMs: 80, autoOffMs: 120, chainVerify: { timeoutMs: 50 }, offVerify: { timeoutMs: 50 } };

console.log("Deadman rantai");
await t("run pertama: audit dulu, tulis arah lawan=false lalu arah=true, bit menyala", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, fastOpts);
    const events = [];
    const r = await s.chainRun("fwd", { onStart: async () => { events.push("audit"); plc.log.push("(audit)"); }, onEnd: async (i) => events.push(`end:${i.ok}`) });
    assert.equal(r.ok, true); assert.equal(plc.mem.CHAIN_FWD, true);
    assert.equal(plc.log[0], "(audit)", "audit harus SEBELUM tulis");
    assert.deepEqual(plc.log.slice(1), ["CHAIN_BWD=false", "CHAIN_FWD=true"]);
    await s.chainStop();
});
await t("run berulang memperpanjang; berhenti run → mati sendiri (deadman) + onEnd", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, fastOpts);
    const ends = [];
    const hooks = { onEnd: async (i) => ends.push(i) };
    await s.chainRun("fwd", hooks);
    for (let i = 0; i < 5; i++) { await sleep(40); const r = await s.chainRun("fwd", hooks); assert.equal(r.ok, true); }
    assert.equal(plc.mem.CHAIN_FWD, true, "masih menyala selama run terus datang (>> timeout total)");
    await sleep(200);
    assert.equal(plc.mem.CHAIN_FWD, false, "mati sendiri setelah sinyal berhenti");
    assert.equal(ends.length, 1); assert.match(ends[0].reason, /deadman/); assert.equal(ends[0].ok, true);
});
await t("stop: mematikan kedua arah, aman dipanggil tanpa sesi", async () => {
    const plc = makePlc({ CHAIN_BWD: true }); const s = createDoorSafety(plc.deps, fastOpts);
    const r = await s.chainStop();
    assert.equal(r.ok, true); assert.equal(plc.mem.CHAIN_BWD, false); assert.equal(plc.mem.CHAIN_FWD, false);
});
await t("ganti arah: arah lama dimatikan dulu, hanya satu arah menyala", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, fastOpts);
    await s.chainRun("fwd", {});
    const r = await s.chainRun("bwd", {});
    assert.equal(r.ok, true); assert.equal(plc.mem.CHAIN_FWD, false); assert.equal(plc.mem.CHAIN_BWD, true);
    await s.chainStop();
});
await t("audit gagal → rantai TIDAK dijalankan (fail-closed)", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, fastOpts);
    const r = await s.chainRun("fwd", { onStart: async () => { throw new Error("db down"); } });
    assert.equal(r.ok, false); assert.equal(r.status, 500);
    assert.deepEqual(plc.log, [], "tidak ada penulisan sama sekali");
});
await t("pagar gagal / mesin tidak idle / lock dipegang → tidak ada penulisan", async () => {
    let plc = makePlc({ DOOR_SEAL: true }); let s = createDoorSafety(plc.deps, fastOpts);
    assert.equal((await s.chainRun("fwd", {})).status, 409); assert.deepEqual(plc.log, []);
    plc = makePlc(); plc.idleOk = false; s = createDoorSafety(plc.deps, fastOpts);
    assert.equal((await s.chainRun("fwd", {})).status, 409); assert.deepEqual(plc.log, []);
    plc = makePlc(); plc.locked = true; s = createDoorSafety(plc.deps, fastOpts);
    assert.equal((await s.chainRun("fwd", {})).status, 409); assert.deepEqual(plc.log, []);
    plc = makePlc(); plc.gatewayDown = true; s = createDoorSafety(plc.deps, fastOpts);
    assert.equal((await s.chainRun("fwd", {})).status, 502); assert.deepEqual(plc.log, []);
});
await t("syarat berubah saat jalan (pintu belakang menutup) → rantai dimatikan di run berikutnya", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, { ...fastOpts, deadmanTimeoutMs: 500 });
    await s.chainRun("fwd", {});
    plc.mem.CLS_REAR = true;
    const r = await s.chainRun("fwd", {});
    assert.equal(r.ok, false); assert.equal(r.status, 409);
    assert.equal(plc.mem.CHAIN_FWD, false);
});
await t("tulis ON tidak terverifikasi → dicoba dimatikan dan gagal", async () => {
    const plc = makePlc(); plc.ignoreWrites = true; const s = createDoorSafety(plc.deps, fastOpts);
    const r = await s.chainRun("fwd", {});
    assert.equal(r.ok, false); assert.equal(r.status, 502);
    assert.ok(plc.log.includes("CHAIN_FWD=false"), "ada upaya menulis false");
});
await t("gagal mematikan → status.chainStuck = true", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, fastOpts);
    await s.chainRun("fwd", {});
    plc.ignoreWrites = true; // PLC mengabaikan tulis false
    const r = await s.chainStop();
    assert.equal(r.ok, false); assert.equal(s.status().chainStuck, true);
});
await t("dua run bersamaan tidak menyalip (diserialkan): hanya satu penulisan ON", async () => {
    const plc = makePlc(); const s = createDoorSafety(plc.deps, fastOpts);
    const [a, b] = await Promise.all([s.chainRun("fwd", {}), s.chainRun("fwd", {})]);
    assert.equal(a.ok && b.ok, true);
    assert.equal(plc.log.filter((x) => x === "CHAIN_FWD=true").length, 1);
    await s.chainStop();
});

console.log("Auto-OFF");
await t("drain: mati sendiri setelah autoOffMs + onEnd", async () => {
    const plc = makePlc({ MAN_WTR_DRAIN: true }); const s = createDoorSafety(plc.deps, fastOpts);
    const ends = [];
    s.armAutoOff("drain", "MAN_WTR_DRAIN", { onEnd: async (i) => ends.push(i) });
    assert.ok(s.status().autoOff.drain > 0);
    await sleep(250);
    assert.equal(plc.mem.MAN_WTR_DRAIN, false); assert.equal(ends.length, 1); assert.equal(ends[0].ok, true);
    assert.equal(s.status().autoOff.drain, null);
});
await t("disarm membatalkan auto-OFF; arm ulang mengganti timer lama", async () => {
    const plc = makePlc({ DOOR_LOCK: true }); const s = createDoorSafety(plc.deps, fastOpts);
    s.armAutoOff("unlock", "DOOR_LOCK", {}); s.disarmAutoOff("unlock");
    await sleep(200);
    assert.equal(plc.mem.DOOR_LOCK, true, "tidak dimatikan karena sudah dibatalkan");
    let n = 0;
    s.armAutoOff("unlock", "DOOR_LOCK", { onEnd: async () => n++ });
    s.armAutoOff("unlock", "DOOR_LOCK", { onEnd: async () => n++ });
    await sleep(250);
    assert.equal(n, 1, "hanya timer terakhir yang jalan");
    assert.equal(plc.mem.DOOR_LOCK, false);
});

console.log(`\n${process.exitCode ? "ADA YANG GAGAL" : "Semua lolos"} (${passed} lolos)`);
