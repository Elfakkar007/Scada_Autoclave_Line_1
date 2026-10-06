/**
 * src/lib/batchFinalize.js — Finalisasi batch (hitung F0, tentukan status akhir).
 *
 * Rumus F0 ada di src/lib/f0.js (fungsi murni). File ini hanya mengambil data trend,
 * memanggil computeBatchF0(), dan menyimpan hasilnya. TIDAK ada vonis PASS/FAIL:
 * SCADA lama tidak punya kriteria itu, jadi hanya angka F0 yang disimpan.
 * Dipanggil oleh:
 *   - /api/batch/stop (route handler Next.js) via import "@/lib/batchFinalize"
 *   - src/lib/trendRecorder.js (background recorder di custom server) via import relatif "./batchFinalize.js"
 *
 * ATURAN IMPORT:
 *   File ini WAJIB pakai import relatif dengan ekstensi .js untuk semua
 *   dependensi di src/lib (karena ikut dimuat dari custom server CommonJS).
 */

import pool from "./db.js";
import { computeBatchF0 } from "./f0.js";

// ── Konstanta perilaku status akhir ──────────────────────────────────────────
// Fase PLC yang dianggap "sudah melewati sterilisasi" (mesin benar-benar selesai siklus).
// Dipakai untuk menentukan status 'finished' vs 'aborted'.
// TODO: konfirmasikan ke QA apakah kode 5 (cooling) sudah cukup sebagai bukti sterilisasi selesai.
const PHASES_FINISHED = new Set([5, 6, 7]);

// ── Export utama ──────────────────────────────────────────────────────────────
/**
 * Finalisasi satu batch: UPDATE status, hitung F0, simpan semua di satu transaksi.
 *
 * @param {number} batchId - ID baris di tabel batch_records
 * @param {{ forceStatus?: string|null, plcPhase?: number|null }} [options]
 *   forceStatus: kalau diisi, status akhir dipaksa ke nilai ini ('finished'/'aborted').
 *   plcPhase:    kode fase PLC saat pemanggil memutuskan finalisasi.
 *                Dipakai untuk membantu menentukan status bila forceStatus tidak diisi.
 *
 * @returns {Promise<{
 *   alreadyFinalized: boolean,
 *   batch?: object,
 *   status?: string,
 *   foMin?: number|null,
 *   f0Complete?: boolean,   // false bila ada gap/data tidak valid saat menghitung F0
 * }>}
 */
export async function finalizeBatch(batchId, { forceStatus = null, plcPhase = null } = {}) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // ── Ambil batch, kunci baris untuk update ─────────────────────────────
        const batchRes = await client.query(
            `SELECT * FROM batch_records WHERE id = $1 FOR UPDATE`,
            [batchId]
        );

        if (batchRes.rows.length === 0) {
            await client.query("COMMIT");
            throw new Error(`[batchFinalize] Batch id=${batchId} tidak ditemukan`);
        }

        const batch = batchRes.rows[0];

        // Kalau batch sudah tidak 'running', tidak perlu diproses lagi
        if (batch.status !== "running") {
            await client.query("COMMIT");
            return { alreadyFinalized: true };
        }

        // ── Ambil data trend untuk hitung F0 ─────────────────────────────────
        const trendRes = await client.query(
            `SELECT ts, t1, t2, t3, t4, t5, t6, th, tm, tl, phase_code
             FROM batch_trend
             WHERE batch_id = $1
             ORDER BY ts ASC`,
            [batchId]
        );
        const rows = trendRes.rows;

        // ── Hitung 9 F0 + fo_min (lihat f0.js) ───────────────────────────────
        // Kurang dari 2 baris → semua nilai null (tidak cukup data), bukan 0.
        const f0 = computeBatchF0(rows);
        const { values, foMin, complete: f0Complete, meta: f0Meta } = f0;

        if (rows.length < 2) {
            console.warn(
                `[batchFinalize] Batch ${batch.batch_no}: data trend hanya ${rows.length} baris, ` +
                `tidak cukup untuk hitung F0 (butuh >= 2).`
            );
        } else if (!f0Complete) {
            console.warn(
                `[batchFinalize] Batch ${batch.batch_no}: F0 dihitung dari data tidak lengkap ` +
                `(ada gap atau nilai tidak valid, lihat f0_meta).`
            );
        }

        // ── Tentukan status akhir ─────────────────────────────────────────────
        let finalStatus;

        if (forceStatus) {
            // Pemanggil memaksa status tertentu
            finalStatus = forceStatus;
        } else {
            // Tentukan otomatis:
            // 'finished' kalau plcPhase termasuk PHASES_FINISHED,
            //  ATAU kalau ada baris trend dengan phase_code yang termasuk PHASES_FINISHED.
            const plcSaysDone = plcPhase !== null && plcPhase !== undefined && PHASES_FINISHED.has(plcPhase);
            const trendSaysDone = rows.some(
                (r) => r.phase_code !== null && PHASES_FINISHED.has(r.phase_code)
            );
            finalStatus = (plcSaysDone || trendSaysDone) ? "finished" : "aborted";
        }

        // ── Satu UPDATE batch_records ─────────────────────────────────────────
        // run_finish: ts baris trend pertama dengan phase_code = 6;
        //   kalau tidak ada (batch di-stop sebelum PLC masuk fase 6), pakai now().
        // total_time_min: selisih run_begin → run_finish, dibulatkan 1 desimal.
        //   TODO (pertanyaan terbuka #2): definisi Total.Time di printout lama belum pasti
        //   (60,0 menit vs Run.Begin→Run.Finish 58,4 menit). Sementara memakai Run.Begin→Run.Finish.
        // f0_meta: parameter + catatan gap/invalid hasil computeBatchF0 (jsonb).
        // sterilization_result sengaja TIDAK ditulis (tidak ada vonis); kolom dibiarkan di DB.
        await client.query(
            `UPDATE batch_records
             SET status               = $1,
                 run_finish           = COALESCE(
                     (SELECT MIN(ts) FROM batch_trend
                      WHERE batch_id = $13 AND phase_code = 6),
                     now()
                 ),
                 total_time_min       = CASE
                     WHEN run_begin IS NOT NULL THEN
                         ROUND(
                             EXTRACT(EPOCH FROM (
                                 COALESCE(
                                     (SELECT MIN(ts) FROM batch_trend
                                      WHERE batch_id = $13 AND phase_code = 6),
                                     now()
                                 ) - run_begin
                             )) / 60.0, 1
                         )
                     ELSE NULL
                 END,
                 fo1                  = $2,
                 fo2                  = $3,
                 fo3                  = $4,
                 fo4                  = $5,
                 fo5                  = $6,
                 fo6                  = $7,
                 foh                  = $8,
                 fom                  = $9,
                 fol                  = $10,
                 fo_min               = $11,
                 f0_meta              = $12::jsonb
             WHERE id = $13`,
            [
                finalStatus,
                values.fo1, values.fo2, values.fo3, values.fo4, values.fo5, values.fo6,
                values.foh, values.fom, values.fol,
                foMin,
                JSON.stringify(f0Meta),
                batchId,
            ]
        );

        await client.query("COMMIT");

        console.log(
            `[batchFinalize] Batch ${batch.batch_no} → status=${finalStatus}, ` +
            `fo_min=${foMin !== null ? foMin.toFixed(2) : "N/A"}, ` +
            `f0Complete=${f0Complete}`
        );

        return {
            alreadyFinalized: false,
            batch,
            status: finalStatus,
            foMin,
            f0Complete,
        };
    } catch (err) {
        // Rollback hanya kalau transaksi belum di-commit
        try { await client.query("ROLLBACK"); } catch (_) { /* abaikan error rollback */ }
        throw err;
    } finally {
        client.release();
    }
}
