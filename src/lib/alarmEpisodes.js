/**
 * src/lib/alarmEpisodes.js — Logika episode alarm (FUNGSI MURNI, tanpa DB/PLC).
 *
 * Bit alarm PLC berupa DENYUT (M8.0–M8.2 ±5 dtk; M10.2/M10.3 ±120 dtk, mati 1 scan lalu
 * menyala lagi bila kondisi masih ada). Tanpa debounce, satu kejadian tercatat berkali-kali.
 * Aturan: satu episode dibuka saat bit pertama kali ON, dan baru ditutup bila bit
 * MATI terus-menerus >= RECOVERY_DEBOUNCE_MS.
 */

export const RECOVERY_DEBOUNCE_MS = 10_000;

export function createBitState() {
    return { active: false, episodeId: null, offSince: null, onset: null };
}

/**
 * Evaluasi satu bit pada satu tick. Memutasi hanya `offSince` pada state;
 * perubahan active/episodeId dilakukan pemanggil SETELAH INSERT berhasil.
 *
 * @param {object} st       state bit (createBitState)
 * @param {boolean|null} bit nilai bit; null/undefined = tidak terbaca
 * @param {number} nowMs
 * @returns {{action: 'open'|'close'|null, eventAt?: number}}
 */
export function evaluateBit(st, bit, nowMs, debounceMs = RECOVERY_DEBOUNCE_MS) {
    // Tidak tahu: jangan membuka/menutup apa pun, dan jangan menghitung "mati" dari data kosong.
    if (bit === null || bit === undefined) {
        st.offSince = null;
        return { action: null };
    }
    if (bit === true) {
        st.offSince = null;
        return st.active ? { action: null } : { action: "open" };
    }
    // bit === false
    if (!st.active) return { action: null };
    if (st.offSince === null) st.offSince = nowMs;
    if (nowMs - st.offSince >= debounceMs) {
        return { action: "close", eventAt: st.offSince }; // waktu pemulihan = saat pertama teramati mati
    }
    return { action: null };
}

const fix1 = (v) =>
    v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v).toFixed(1);

// Hati-hati: Number(null) = 0. Buang null/undefined SEBELUM konversi, supaya sensor
// yang tidak terbaca tidak dianggap 0 °C.
function sensorValues(snap) {
    return [snap.t1, snap.t2, snap.t3, snap.t4, snap.t5, snap.t6, snap.tm]
        .filter((v) => v !== null && v !== undefined)
        .map(Number)
        .filter(Number.isFinite);
}

/**
 * Nilai yang disimpan saat alarm dibuka (alarm_value, limit_value), sebagai teks.
 */
export function onsetValues(key, snap) {
    switch (key) {
        case "m8_0":
            return { alarmValue: fix1(snap.p1), limitValue: fix1(snap.limits?.safetyPress) };
        case "m10_2": {
            const v = sensorValues(snap);
            return { alarmValue: v.length ? fix1(Math.min(...v)) : null, limitValue: fix1(snap.setpoints?.sterSet) };
        }
        case "m10_3": {
            const v = sensorValues(snap);
            return { alarmValue: v.length ? fix1(Math.max(...v)) : null, limitValue: fix1(snap.limits?.overTemp) };
        }
        default: // alarm bit murni (m8_1, m8_2)
            return { alarmValue: "1", limitValue: "1" };
    }
}
