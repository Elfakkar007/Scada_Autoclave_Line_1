/**
 * src/lib/f0.js — Perhitungan F0 (fungsi murni, tanpa import dan tanpa akses DB).
 *
 * Satu-satunya tempat rumus F0 di proyek ini. Dipakai oleh batchFinalize.js
 * (import relatif + ekstensi .js karena ikut dimuat dari custom server).
 *
 * Rumus : F0 = SUM( 10^((T - T_REF) / Z) * dt_menit )   per sensor
 * Metode: trapesium. Tiap interval memakai rata-rata laju letal di dua ujungnya.
 *         (Pada printout SCADA lama, right-endpoint/trapesium/left selisih <= 0,1.)
 *
 * Aturan data:
 *  - Interval lebih lama dari MAX_GAP_SEC TIDAK diintegrasikan dan dicatat sebagai gap
 *    (F0 yang dilaporkan menjadi batas bawah, karena bagian itu dianggap 0).
 *  - Titik dengan suhu null/kosong/bukan angka/di luar [TEMP_MIN, TEMP_MAX] tidak dipakai;
 *    kedua interval yang menyentuhnya tidak diintegrasikan dan dicatat di `invalid`.
 *  - Dua titik dengan timestamp sama (baris peristiwa) tidak berbobot (dt = 0),
 *    jadi dilewati tanpa dianggap masalah.
 */

export const F0_T_REF = 121.0;   // °C, suhu referensi
export const F0_Z = 10;          // °C, nilai z
export const F0_MAX_GAP_SEC = 150; // detik; usul awal, bisa diubah di sini
export const F0_TEMP_MIN = 0;    // °C; di bawah ini dianggap data rusak
export const F0_TEMP_MAX = 200;  // °C; di atas ini dianggap data rusak
export const F0_METHOD = "trapezoid";

// Pemetaan kolom F0 batch_records ← kolom suhu batch_trend
export const F0_SENSORS = {
    fo1: "t1", fo2: "t2", fo3: "t3", fo4: "t4", fo5: "t5", fo6: "t6",
    foh: "th", fom: "tm", fol: "tl",
};

const MAX_LISTED = 20; // batasi panjang daftar gap/invalid yang disimpan di meta

/** Konversi nilai suhu (number | numeric string dari pg | null) → angka valid atau null. */
export function toTemp(raw) {
    // Cek null/kosong SEBELUM Number(): Number(null) = 0 dan Number("") = 0.
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string" && raw.trim() === "") return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n < F0_TEMP_MIN || n > F0_TEMP_MAX) return null;
    return n;
}

function toMs(ts) {
    if (ts === null || ts === undefined) return NaN;
    const ms = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : NaN;
}

function iso(ms) {
    return new Date(ms).toISOString();
}

function lethalRate(T, tRef, z) {
    return Math.pow(10, (T - tRef) / z);
}

/**
 * Hitung F0 satu sensor.
 *
 * @param {Array<{ts: Date|string|number, temp: number|string|null}>} points urut ASC by ts
 * @param {{tRef?: number, z?: number, maxGapSec?: number}} [opts]
 * @returns {{
 *   value: number|null,        // null bila tidak ada interval yang bisa diintegrasikan
 *   integratedMin: number,     // total menit yang benar-benar diintegrasikan
 *   gaps: Array<{from: string, to: string, sec: number}>,
 *   invalid: Array<{at: string, reason: string}>,
 *   gapCount: number, invalidCount: number,
 * }}
 */
export function calcF0(points, { tRef = F0_T_REF, z = F0_Z, maxGapSec = F0_MAX_GAP_SEC } = {}) {
    const gaps = [];
    const invalid = [];
    let gapCount = 0;
    let invalidCount = 0;
    let f0 = 0;
    let integratedMin = 0;

    const pts = Array.isArray(points) ? points : [];

    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const tsA = toMs(a?.ts);
        const tsB = toMs(b?.ts);

        if (Number.isNaN(tsA) || Number.isNaN(tsB)) {
            invalidCount++;
            if (invalid.length < MAX_LISTED) invalid.push({ at: `index ${i}`, reason: "timestamp tidak valid" });
            continue;
        }

        const dtSec = (tsB - tsA) / 1000;
        if (dtSec <= 0) continue; // duplikat ts (baris peristiwa) atau urutan aneh: tidak berbobot

        if (dtSec > maxGapSec) {
            gapCount++;
            if (gaps.length < MAX_LISTED) gaps.push({ from: iso(tsA), to: iso(tsB), sec: Math.round(dtSec) });
            continue;
        }

        const TA = toTemp(a?.temp);
        const TB = toTemp(b?.temp);
        if (TA === null || TB === null) {
            invalidCount++;
            if (invalid.length < MAX_LISTED) {
                const bad = TB === null ? tsB : tsA;
                const raw = TB === null ? b?.temp : a?.temp;
                const reason = raw === null || raw === undefined || String(raw).trim() === ""
                    ? "suhu kosong" : "suhu di luar rentang / bukan angka";
                invalid.push({ at: iso(bad), reason });
            }
            continue;
        }

        const dtMin = dtSec / 60;
        f0 += ((lethalRate(TA, tRef, z) + lethalRate(TB, tRef, z)) / 2) * dtMin;
        integratedMin += dtMin;
    }

    return {
        value: integratedMin > 0 ? f0 : null,
        integratedMin,
        gaps,
        invalid,
        gapCount,
        invalidCount,
    };
}

/**
 * Hitung 9 F0 + fo_min dari baris batch_trend.
 *
 * @param {Array<object>} rows baris batch_trend urut ASC by ts (kolom ts, t1..t6, th, tm, tl)
 * @param {object} [opts] diteruskan ke calcF0
 * @returns {{ values: Record<string, number|null>, foMin: number|null, complete: boolean, meta: object }}
 */
export function computeBatchF0(rows, opts = {}) {
    const tRef = opts.tRef ?? F0_T_REF;
    const z = opts.z ?? F0_Z;
    const maxGapSec = opts.maxGapSec ?? F0_MAX_GAP_SEC;
    const list = Array.isArray(rows) ? rows : [];

    const values = {};
    const perSensor = {};
    let complete = list.length >= 2;

    for (const [foKey, col] of Object.entries(F0_SENSORS)) {
        const res = calcF0(
            list.map((r) => ({ ts: r.ts, temp: r[col] })),
            { tRef, z, maxGapSec }
        );
        values[foKey] = res.value;
        perSensor[foKey] = {
            integratedMin: Math.round(res.integratedMin * 100) / 100,
            gapCount: res.gapCount,
            invalidCount: res.invalidCount,
            gaps: res.gaps,
            invalid: res.invalid,
        };
        if (res.value === null || res.gapCount > 0 || res.invalidCount > 0) complete = false;
    }

    // fo_min: hanya dari nilai yang ada. Math.min(null) = 0 akan menipu, jadi disaring dulu.
    const present = Object.values(values).filter((v) => v !== null);
    const foMin = present.length > 0 ? Math.min(...present) : null;

    const meta = {
        method: F0_METHOD,
        tRef,
        z,
        maxGapSec,
        tempRange: [F0_TEMP_MIN, F0_TEMP_MAX],
        rowCount: list.length,
        firstTs: list.length > 0 && !Number.isNaN(toMs(list[0].ts)) ? iso(toMs(list[0].ts)) : null,
        lastTs: list.length > 0 && !Number.isNaN(toMs(list[list.length - 1].ts)) ? iso(toMs(list[list.length - 1].ts)) : null,
        complete,
        perSensor,
    };

    return { values, foMin, complete, meta };
}
