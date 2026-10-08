import test from "node:test";
import assert from "node:assert/strict";
import { createBitState, evaluateBit, onsetValues, RECOVERY_DEBOUNCE_MS } from "./alarmEpisodes.js";

// Simulasi tick 1 detik. Mengembalikan daftar aksi {t, action}.
function run(bitsPerSecond) {
    const st = createBitState();
    const out = [];
    bitsPerSecond.forEach((bit, t) => {
        const r = evaluateBit(st, bit, t * 1000);
        if (r.action === "open") { st.active = true; st.episodeId = "e" + out.length; out.push({ t, action: "open" }); }
        if (r.action === "close") { st.active = false; st.offSince = null; out.push({ t, action: "close", eventAt: r.eventAt / 1000 }); }
    });
    return out;
}
const rep = (v, n) => Array(n).fill(v);

test("satu denyut 5 dtk = satu episode, ditutup 10 dtk setelah mati", () => {
    const a = run([...rep(false, 3), ...rep(true, 5), ...rep(false, 15)]);
    assert.deepEqual(a.map((x) => x.action), ["open", "close"]);
    assert.equal(a[0].t, 3);
    assert.equal(a[1].eventAt, 8);       // pertama teramati mati
    assert.equal(a[1].t, 18);            // 10 dtk kemudian
});

test("denyut 120 dtk dengan jeda mati 1 scan = tetap SATU episode", () => {
    const a = run([...rep(true, 120), false, ...rep(true, 120), false, ...rep(true, 120), ...rep(false, 12)]);
    assert.deepEqual(a.map((x) => x.action), ["open", "close"]);
});

test("jeda mati 9 dtk belum menutup; 10 dtk menutup", () => {
    assert.equal(run([true, ...rep(false, 9), true, ...rep(false, 9)]).filter((x) => x.action === "close").length, 0);
    assert.equal(run([true, ...rep(false, 11)]).filter((x) => x.action === "close").length, 1);
});

test("setelah ditutup, nyala lagi = episode baru", () => {
    const a = run([true, ...rep(false, 12), true, ...rep(false, 12)]);
    assert.deepEqual(a.map((x) => x.action), ["open", "close", "open", "close"]);
});

test("bit tidak terbaca (null) tidak membuka, tidak menutup, dan mengulang hitungan debounce", () => {
    assert.deepEqual(run(rep(null, 30)), []);
    // mati 6 dtk, null 1 dtk, mati 6 dtk: hitungan diulang, jadi belum tertutup
    assert.equal(run([true, ...rep(false, 6), null, ...rep(false, 6)]).filter((x) => x.action === "close").length, 0);
});

test("RECOVERY_DEBOUNCE_MS = 10 detik", () => assert.equal(RECOVERY_DEBOUNCE_MS, 10_000));

test("onsetValues: sensor null tidak dianggap 0 °C", () => {
    const snap = { t1: 120.5, t2: null, t3: 121.2, t4: 119.8, t5: null, t6: 120.0, tm: 120.1, setpoints: { sterSet: 121 }, limits: { overTemp: 125, safetyPress: 20 }, p1: 150 };
    assert.deepEqual(onsetValues("m10_2", snap), { alarmValue: "119.8", limitValue: "121.0" });
    assert.deepEqual(onsetValues("m10_3", snap), { alarmValue: "121.2", limitValue: "125.0" });
    assert.deepEqual(onsetValues("m8_0", snap), { alarmValue: "150.0", limitValue: "20.0" });
    assert.deepEqual(onsetValues("m8_1", snap), { alarmValue: "1", limitValue: "1" });
});

test("onsetValues: semua sensor null -> alarmValue null", () => {
    const snap = { t1: null, t2: null, t3: null, t4: null, t5: null, t6: null, tm: null, setpoints: {}, limits: {} };
    assert.equal(onsetValues("m10_2", snap).alarmValue, null);
});
