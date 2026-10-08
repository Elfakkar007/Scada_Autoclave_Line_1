import test from "node:test";
import assert from "node:assert/strict";
import { describeStopResponse, describeResetPulse, describeStartResponse } from "./plcCommandAlert.js";

const hasPhysical = (a) => a.lines.some((l) => l.includes("STOP fisik"));

test("STOP normal: tidak ada peringatan", () => {
    assert.equal(
        describeStopResponse({ status: 200, json: { ok: true, plcStopWritten: true, plcStuckRisk: false } }),
        null
    );
});

test("STOP: fetch gagal -> error + anjuran STOP fisik", () => {
    const a = describeStopResponse({ networkError: true });
    assert.equal(a.level, "error");
    assert.ok(hasPhysical(a));
});

test("STOP: HTTP 500 -> error + STOP fisik, teks server ikut tampil", () => {
    const a = describeStopResponse({ status: 500, json: { ok: false, error: "Terjadi kesalahan di server. Hubungi admin." } });
    assert.equal(a.level, "error");
    assert.ok(hasPhysical(a));
    assert.ok(a.lines[0].includes("Hubungi admin"));
});

test("STOP: 401 -> error + STOP fisik", () => {
    const a = describeStopResponse({ status: 401, json: { ok: false, error: "Belum login" } });
    assert.equal(a.level, "error");
    assert.ok(hasPhysical(a));
});

test("STOP: 400 tidak ada batch -> warn biasa tanpa STOP fisik", () => {
    const a = describeStopResponse({ status: 400, json: { ok: false, error: "Tidak ada batch yang sedang berjalan" } });
    assert.equal(a.level, "warn");
    assert.ok(!hasPhysical(a));
});

test("STOP: respons bukan JSON (redirect login) -> serius", () => {
    const a = describeStopResponse({ status: 200, json: null });
    assert.equal(a.level, "error");
    assert.ok(hasPhysical(a));
});

test("STOP: batch tertutup tapi STOP tidak tertulis (stuckRisk false)", () => {
    const a = describeStopResponse({
        status: 200,
        json: { ok: true, plcStopWritten: false, plcStuckRisk: false, plcPulse: { wroteOn: false, wroteOff: true } },
    });
    assert.equal(a.title, "STOP TIDAK sampai ke mesin");
    assert.ok(hasPhysical(a));
});

test("STOP: stuckRisk, ON sampai -> teks 'sampai ke PLC'", () => {
    const a = describeStopResponse({
        status: 200,
        json: { ok: true, plcStopWritten: false, plcStuckRisk: true, plcPulse: { wroteOn: true, wroteOff: false } },
    });
    assert.equal(a.title, "STOP mungkin tertahan aktif di PLC");
    assert.ok(a.lines[0].includes("sampai ke PLC"));
    assert.ok(a.lines.some((l) => l.includes("STOP = false")));
});

test("STOP: stuckRisk, ON tidak pasti -> teks 'tidak pasti'", () => {
    const a = describeStopResponse({
        status: 200,
        json: { ok: true, plcStopWritten: false, plcStuckRisk: true, plcPulse: { wroteOn: false, wroteOff: false } },
    });
    assert.ok(a.lines[0].includes("tidak pasti"));
});

test("reset: guard 409 (tanpa pulse) -> null, pemanggil pakai json.error", () => {
    assert.equal(describeResetPulse({ ok: false, error: "Masih ada batch running" }), null);
});

test("reset: sukses -> null", () => {
    assert.equal(describeResetPulse({ ok: true, pulse: { wroteOn: true, wroteOff: true, stuckRisk: false } }), null);
});

test("reset: pulsa gagal tanpa stuckRisk", () => {
    const a = describeResetPulse({ ok: false, pulse: { wroteOn: false, wroteOff: true, stuckRisk: false } });
    assert.equal(a.title, "Reset gagal: STOP tidak sampai ke mesin");
});

test("reset: stuckRisk", () => {
    const a = describeResetPulse({ ok: false, pulse: { wroteOn: true, wroteOff: false, stuckRisk: true } });
    assert.equal(a.title, "Reset: STOP mungkin tertahan aktif di PLC");
});

// ── START (halaman Prepare) ───────────────────────────────────────────────────
test("START bersih: outcome started, tanpa alert", () => {
    const r = describeStartResponse({ json: { ok: true, batchNo: "B-1" } });
    assert.equal(r.outcome, "started");
    assert.equal(r.alert, null);
});

test("START sukses dengan warning/stuckRisk: tidak boleh diam-diam", () => {
    const r = describeStartResponse({ json: { ok: true, warning: "START mungkin tertahan...", stuckRisk: true } });
    assert.equal(r.outcome, "started_warn");
    assert.equal(r.alert.level, "error");
    assert.equal(r.dismissable, false);
    assert.ok(r.alert.lines.some((l) => l.includes("START = false")));
});

test("START sukses hanya dengan teks warning (tanpa stuckRisk) tetap diperingatkan", () => {
    const r = describeStartResponse({ json: { ok: true, warning: "pulsa tidak sempurna" } });
    assert.equal(r.outcome, "started_warn");
});

test("START critical: tombol STOP web tidak berfungsi -> anjuran STOP fisik, tidak bisa ditutup", () => {
    const r = describeStartResponse({ json: { ok: false, critical: true, error: "PLC sudah mulai berjalan, tapi batch gagal dicatat di database." } });
    assert.equal(r.outcome, "critical");
    assert.equal(r.dismissable, false);
    assert.ok(r.alert.lines[0].includes("PLC sudah mulai berjalan"));
    assert.ok(r.alert.lines.some((l) => l.includes("STOP fisik")));
});

test("START 409 PLC tidak mulai + stuckRisk: peringatan, boleh ditutup", () => {
    const r = describeStartResponse({ json: { ok: false, error: "PLC tidak memulai proses.", stuckRisk: true } });
    assert.equal(r.outcome, "rejected_stuck");
    assert.equal(r.dismissable, true);
});

test("START ditolak biasa (validasi/guard/409 tanpa stuckRisk): banner error lama", () => {
    for (const json of [
        { ok: false, error: "Batch No sudah pernah dipakai" },
        { ok: false, error: "PLC tidak memulai proses.", stuckRisk: false },
        { ok: false, error: "Resep tidak valid.", invalidFields: [{ field: "x", message: "y" }] },
    ]) {
        const r = describeStartResponse({ json });
        assert.equal(r.outcome, "rejected");
        assert.equal(r.alert, null);
    }
});

test("START: koneksi putus atau respons bukan JSON -> hasil tidak diketahui", () => {
    for (const args of [{ networkError: true }, { json: null }]) {
        const r = describeStartResponse(args);
        assert.equal(r.outcome, "unknown");
        assert.equal(r.dismissable, true);
        assert.ok(r.alert.lines.some((l) => l.includes("Dashboard")));
    }
});
