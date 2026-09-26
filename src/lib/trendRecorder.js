/**
 * src/lib/trendRecorder.js — Perekam data trend suhu tiap interval waktu.
 *
 * Dipanggil oleh server.js (custom server) via setInterval, bukan oleh Next.js.
 * Tugasnya: kalau ada batch yang sedang running, baca PLC dan simpan 1 baris
 * ke tabel batch_trend.
 *
 * DESAIN ANTI-CRASH:
 * - Semua error di-catch di level recordTrendTick() dan hanya di-log ke console.
 * - Tidak ada throw ke atas, supaya server tidak crash gara-gara 1 tick gagal
 *   (misal: PLC momentarily disconnect, DB timeout, dll).
 */

import pool from "./db.js";
import { readPlcSnapshot } from "./plc.js";

/**
 * Rekam satu data point suhu ke batch_trend.
 * Dipanggil tiap interval dari server.js (setInterval).
 *
 * Alur:
 *   1. Cek apakah ada batch_records dengan status = 'running'.
 *      Kalau tidak ada, return diam-diam (tidak perlu rekam apa-apa).
 *   2. Panggil readPlcSnapshot() untuk baca data sensor.
 *   3. Kalau plcOk === false, SKIP insert (jangan rekam data tidak valid).
 *   4. Kalau plcOk true, INSERT 1 baris ke batch_trend.
 */
export async function recordTrendTick() {
    try {
        // 1. Cek apakah ada batch yang sedang running
        const batchResult = await pool.query(
            "SELECT id FROM batch_records WHERE status = 'running' LIMIT 1"
        );
        if (batchResult.rows.length === 0) {
            // Tidak ada batch running, tidak perlu rekam apa-apa
            return;
        }
        const batchId = batchResult.rows[0].id;

        // 2. Baca PLC
        const snap = await readPlcSnapshot();

        // 3. Kalau PLC tidak terhubung, skip tick ini - jangan insert data invalid
        if (!snap.plcOk) {
            console.warn(
                `[trendRecorder] Tick dilewati (PLC tidak terhubung): ${snap.plcError}`
            );
            return;
        }

        // 4. Hitung rata-rata suhu T1-T6 (simple average, null diabaikan)
        const tempVals = [snap.t1, snap.t2, snap.t3, snap.t4, snap.t5, snap.t6]
            .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
        const avgTemp = tempVals.length > 0
            ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length
            : null;

        // INSERT 1 baris ke batch_trend.
        // CATATAN kolom tekanan:
        //   - Kalau tabel batch_trend punya kolom "p" tunggal, diisi dengan p1.
        //     Alasannya: p1 adalah sensor tekanan utama chamber.
        //     p2 bisa ditambahkan sebagai kolom terpisah kalau skema tabel diupdate.
        //   - Kalau tabel sudah punya kolom p1 dan p2 terpisah, ganti query di bawah.
        await pool.query(
            `INSERT INTO batch_trend
                (batch_id, ts, t1, t2, t3, t4, t5, t6, th, tm, tl, p1, p2, avg)
             VALUES
                ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                batchId,
                snap.t1 ?? null,
                snap.t2 ?? null,
                snap.t3 ?? null,
                snap.t4 ?? null,
                snap.t5 ?? null,
                snap.t6 ?? null,
                snap.th ?? null,
                snap.tm ?? null,
                snap.tl ?? null,
                snap.p1 ?? null,  // tekanan utama chamber
                snap.p2 ?? null,  // tekanan sekunder (bisa null kalau kolom belum ada di skema)
                avgTemp,
            ]
        );

        console.log(
            `[trendRecorder] Tick OK — batch ${batchId}, ` +
            `TL=${snap.tl ?? "-"}°C, avg=${avgTemp !== null ? avgTemp.toFixed(1) : "-"}°C`
        );
    } catch (err) {
        // JANGAN re-throw: proses background tidak boleh crash server
        // gara-gara 1 tick gagal (mis. DB timeout sesaat, PLC disconnect, dll)
        console.error("[trendRecorder] Gagal merekam tick:", err.message ?? err);
    }
}
