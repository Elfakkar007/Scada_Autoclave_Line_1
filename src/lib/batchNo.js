/**
 * src/lib/batchNo.js — Aturan nomor batch (dipakai klien DAN server).
 *
 * File ini sengaja murni (tanpa import server-only seperti "pg"), supaya aman
 * di-import dari komponen "use client" (halaman Prepare) maupun route handler.
 *
 * Aturan:
 *  - Huruf, angka, spasi, titik, garis bawah, strip. Maks 50 karakter.
 *  - Karakter lain (/ \ ? # % dll) ditolak supaya URL /data-report/[batchNo]
 *    dan nama file ekspor tidak bermasalah.
 *  - Keunikan TIDAK dicek di sini; dicek di route (dan dijaga unique index DB
 *    pada lower(btrim(batch_no))).
 */

export const BATCH_NO_MAX_LEN = 50;
export const BATCH_NO_PATTERN = /^[A-Za-z0-9 ._-]+$/;
export const BATCH_NO_RULE_TEXT =
    "Hanya huruf, angka, spasi, titik (.), garis bawah (_), dan strip (-); maksimal 50 karakter.";

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateBatchNo(raw) {
    const value = String(raw ?? "").trim();
    if (value === "") {
        return { ok: false, error: "Batch No tidak boleh kosong" };
    }
    if (value.length > BATCH_NO_MAX_LEN) {
        return { ok: false, error: `Batch No terlalu panjang (maks ${BATCH_NO_MAX_LEN} karakter)` };
    }
    if (!BATCH_NO_PATTERN.test(value)) {
        return { ok: false, error: `Batch No mengandung karakter yang tidak diizinkan. ${BATCH_NO_RULE_TEXT}` };
    }
    return { ok: true, value };
}