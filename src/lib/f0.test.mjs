// Jalankan: node --test src/lib/f0.test.mjs   (atau: npm test, bila skripnya ditambahkan)
import test from "node:test";
import assert from "node:assert/strict";
import { calcF0, computeBatchF0, toTemp, F0_MAX_GAP_SEC } from "./f0.js";
import { PRINTOUT_ROWS, PRINTOUT_F0 } from "./__fixtures__/printout_2026-10-03.js";

const TOL = 0.15;
// FOH (sensor TH) dikecualikan: deviasi diketahui (+2,7 s/d +3,2) dan penyebabnya belum jelas
// (roadmap, pertanyaan terbuka #1). Jangan dimasukkan ke daftar ini tanpa jawaban dari pabrik.
const CHECKED = ["fo1", "fo2", "fo3", "fo4", "fo5", "fo6", "fom", "fol"];

const T0 = Date.UTC(2026, 9, 3, 8, 0, 0); // titik awal sembarang
const pt = (sec, temp) => ({ ts: new Date(T0 + sec * 1000), temp });

// ── Fixture printout 2026/10/3 ────────────────────────────────────────────────
test("fixture printout: F0 cocok dengan SCADA lama (±0,15)", () => {
    const { values } = computeBatchF0(PRINTOUT_ROWS);
    for (const k of CHECKED) {
        assert.ok(
            Math.abs(values[k] - PRINTOUT_F0[k]) <= TOL,
            `${k}: hitung ${values[k].toFixed(3)} vs printout ${PRINTOUT_F0[k]}`
        );
    }
});

test("fixture printout: FOH terhitung (bukan null) tapi tidak dibandingkan", () => {
    const { values } = computeBatchF0(PRINTOUT_ROWS);
    assert.ok(Number.isFinite(values.foh));
});

test("fixture printout: data lengkap, tanpa gap, dan fo_min = nilai terkecil", () => {
    const r = computeBatchF0(PRINTOUT_ROWS);
    assert.equal(r.complete, true);
    for (const s of Object.values(r.meta.perSensor)) {
        assert.equal(s.gapCount, 0);
        assert.equal(s.invalidCount, 0);
    }
    assert.equal(r.foMin, Math.min(...Object.values(r.values)));
    assert.equal(r.meta.method, "trapezoid");
    assert.equal(r.meta.rowCount, PRINTOUT_ROWS.length);
});

// ── Rumus dasar ───────────────────────────────────────────────────────────────
test("suhu 121,0 konstan selama 10 menit → F0 = 10", () => {
    const pts = [pt(0, 121), pt(60, 121), pt(120, 121)];
    // 120 detik = 2 menit → 2.0
    assert.ok(Math.abs(calcF0(pts).value - 2) < 1e-9);
    const long = Array.from({ length: 11 }, (_, i) => pt(i * 60, 121));
    assert.ok(Math.abs(calcF0(long).value - 10) < 1e-9);
});

test("suhu 131 (z=10 di atas referensi) → laju 10× lebih besar", () => {
    const pts = [pt(0, 131), pt(60, 131)];
    assert.ok(Math.abs(calcF0(pts).value - 10) < 1e-9);
});

test("trapesium: dua ujung berbeda dirata-ratakan lajunya", () => {
    const pts = [pt(0, 121), pt(60, 131)]; // laju 1 dan 10, 1 menit → (1+10)/2
    assert.ok(Math.abs(calcF0(pts).value - 5.5) < 1e-9);
});

test("suhu string numeric dari pg dikonversi ke angka", () => {
    const a = calcF0([pt(0, "121.0"), pt(60, "121.0")]).value;
    const b = calcF0([pt(0, 121), pt(60, 121)]).value;
    assert.equal(a, b);
});

// ── Gap ───────────────────────────────────────────────────────────────────────
test(`interval > ${F0_MAX_GAP_SEC} detik tidak diintegrasikan dan ditandai gap`, () => {
    const pts = [pt(0, 121), pt(60, 121), pt(60 + 151, 121), pt(60 + 151 + 60, 121)];
    const r = calcF0(pts);
    assert.equal(r.gapCount, 1);
    assert.equal(r.gaps[0].sec, 151);
    assert.ok(Math.abs(r.value - 2) < 1e-9); // hanya dua interval 60 detik
    assert.ok(Math.abs(r.integratedMin - 2) < 1e-9);
});

test("interval tepat di ambang (150 detik) masih diintegrasikan", () => {
    const r = calcF0([pt(0, 121), pt(150, 121)]);
    assert.equal(r.gapCount, 0);
    assert.ok(Math.abs(r.value - 2.5) < 1e-9);
});

test("gap pada satu batch menurunkan complete menjadi false", () => {
    const rows = [
        { ts: new Date(T0), t1: 121, t2: 121, t3: 121, t4: 121, t5: 121, t6: 121, th: 121, tm: 121, tl: 121 },
        { ts: new Date(T0 + 60_000), t1: 121, t2: 121, t3: 121, t4: 121, t5: 121, t6: 121, th: 121, tm: 121, tl: 121 },
        { ts: new Date(T0 + 600_000), t1: 121, t2: 121, t3: 121, t4: 121, t5: 121, t6: 121, th: 121, tm: 121, tl: 121 },
    ];
    const r = computeBatchF0(rows);
    assert.equal(r.complete, false);
    assert.equal(r.meta.perSensor.fo1.gapCount, 1);
});

// ── Data tidak valid ──────────────────────────────────────────────────────────
test("suhu null tidak dihitung sebagai 0 dan ditandai invalid", () => {
    const r = calcF0([pt(0, 121), pt(60, null), pt(120, 121)]);
    assert.equal(r.invalidCount, 2); // dua interval yang menyentuh titik null
    assert.equal(r.value, null);     // tidak ada interval yang valid
});

test("suhu di luar rentang (mis. 999 atau -50) dilewati dan ditandai", () => {
    const r = calcF0([pt(0, 121), pt(60, 121), pt(120, 999), pt(180, 121), pt(240, 121)]);
    assert.equal(r.invalidCount, 2);
    assert.ok(Math.abs(r.value - 2) < 1e-9); // interval 0–60 dan 180–240
    assert.equal(calcF0([pt(0, -50), pt(60, 121)]).invalidCount, 1);
});

test("toTemp: null, string kosong, NaN, dan di luar rentang → null", () => {
    assert.equal(toTemp(null), null);
    assert.equal(toTemp(undefined), null);
    assert.equal(toTemp(""), null);
    assert.equal(toTemp("  "), null);
    assert.equal(toTemp("abc"), null);
    assert.equal(toTemp(NaN), null);
    assert.equal(toTemp(250), null);
    assert.equal(toTemp("123.4"), 123.4);
    assert.equal(toTemp(0), 0);
});

test("timestamp tidak valid ditandai, tidak melempar error", () => {
    const r = calcF0([{ ts: "bukan-tanggal", temp: 121 }, pt(60, 121)]);
    assert.equal(r.invalidCount, 1);
    assert.equal(r.value, null);
});

test("timestamp duplikat (baris peristiwa) dilewati tanpa dianggap masalah", () => {
    const r = calcF0([pt(0, 121), pt(60, 121), pt(60, 121), pt(120, 121)]);
    assert.equal(r.gapCount, 0);
    assert.equal(r.invalidCount, 0);
    assert.ok(Math.abs(r.value - 2) < 1e-9);
});

// ── Kasus tepi ────────────────────────────────────────────────────────────────
test("kurang dari 2 titik → value null, fo_min null, complete false", () => {
    assert.equal(calcF0([pt(0, 121)]).value, null);
    assert.equal(calcF0([]).value, null);
    assert.equal(calcF0(undefined).value, null);
    const r = computeBatchF0([{ ts: new Date(T0), t1: 121 }]);
    assert.equal(r.foMin, null);
    assert.equal(r.complete, false);
    assert.equal(computeBatchF0([]).foMin, null);
});

test("fo_min tidak ikut terseret ke 0 oleh sensor yang null", () => {
    // t6 sepanjang batch kosong → fo6 null; fo_min harus dari 8 sensor lain, bukan 0
    const rows = [0, 60, 120].map((s) => ({
        ts: new Date(T0 + s * 1000),
        t1: 121, t2: 121, t3: 121, t4: 121, t5: 121, t6: null, th: 121, tm: 121, tl: 121,
    }));
    const r = computeBatchF0(rows);
    assert.equal(r.values.fo6, null);
    assert.ok(Math.abs(r.foMin - 2) < 1e-9);
    assert.equal(r.complete, false);
});

test("meta menyimpan parameter hitung", () => {
    const r = computeBatchF0(PRINTOUT_ROWS, { maxGapSec: 90 });
    assert.equal(r.meta.tRef, 121);
    assert.equal(r.meta.z, 10);
    assert.equal(r.meta.maxGapSec, 90);
    assert.ok(r.meta.firstTs && r.meta.lastTs);
    JSON.stringify(r.meta); // harus bisa di-serialize ke jsonb
});
