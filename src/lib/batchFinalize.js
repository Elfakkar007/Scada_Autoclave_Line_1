/**
 * src/lib/batchFinalize.js — Finalisasi batch (hitung F0, tentukan status akhir).
 *
 * Ini adalah SATU-SATUNYA tempat rumus F0 dalam seluruh proyek.
 * Dipanggil oleh:
 *   - /api/batch/stop (route handler Next.js) via import "@/lib/batchFinalize"
 *   - src/lib/trendRecorder.js (background recorder di custom server) via import relatif "./batchFinalize.js"
 *
 * ATURAN IMPORT:
 *   File ini WAJIB pakai import relatif dengan ekstensi .js untuk semua
 *   dependensi di src/lib (karena ikut dimuat dari custom server CommonJS).
 */

import pool from "./db.js";

// ── Konstanta perilaku status akhir ──────────────────────────────────────────
// Fase PLC yang dianggap "sudah melewati sterilisasi" (mesin benar-benar selesai siklus).
// Dipakai untuk menentukan status 'finished' vs 'aborted'.
// TODO: konfirmasikan ke QA apakah kode 5 (cooling) sudah cukup sebagai bukti sterilisasi selesai.
const PHASES_FINISHED = new Set([5, 6, 7]);

// Kalau status akhir 'aborted', sterilization_result dipaksa ke nilai ini.
// TODO: konfirmasikan ke QA — apakah batch yang dibatalkan selalu 'fail',
//       atau ada kemungkinan 'pending' kalau dibatalkan saat tahap awal?
const ABORTED_STERILIZATION_RESULT = "fail";

// ── Rumus F0 ──────────────────────────────────────────────────────────────────
/**
 * Hitung F0 dari deretan titik data trend untuk satu kolom suhu.
 *
 * Rumus F0 standar farmasi: F0 = SUM( 10^((T - 121.1) / 10) * dt_menit )
 *
 * Pendekatan: right-endpoint (nilai T di titik AKHIR interval).
 * Catatan metode: right-endpoint MELEBIHKAN F0 saat suhu sedang naik
 * dan MENGURANGI F0 saat suhu sedang turun. Tidak bisa disebut "konservatif"
 * secara umum. Pemilihan metode yang lebih akurat (mis. trapesium/Simpson)
 * menunggu kesepakatan QA sebelum diimplementasikan.
 *
 * @param {Array<{ts: Date, temp: number|null}>} points - Data trend, urut ASC by ts
 * @returns {number} Nilai F0 kumulatif
 */
function calcF0(points) {
    let f0 = 0;
    for (let i = 1; i < points.length; i++) {
        const T = points[i].temp;
        if (T === null || T === undefined) continue; // skip baris dengan data null

        const dtMs = new Date(points[i].ts).getTime() - new Date(points[i - 1].ts).getTime();
        const dtMin = dtMs / (1000 * 60); // konversi ms → menit

        if (dtMin <= 0) continue; // sanity check: jangan proses interval aneh (duplikat ts, dll)

        f0 += Math.pow(10, (T - 121.1) / 10) * dtMin;
    }
    return f0;
}

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
 *   sterilizationResult?: string,
 *   foMin?: number|null,
 * }>}
 */
export async function finalizeBatch(batchId, { forceStatus = null, plcPhase = null } = {}) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // ── Ambil batch + target F0 dari resep, kunci baris untuk update ──────
        const batchRes = await client.query(
            `SELECT b.*, r.fo_val_setting
             FROM batch_records b
             LEFT JOIN recipes r ON b.recipe_id = r.id
             WHERE b.id = $1
             FOR UPDATE OF b`,
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

        // ── Hitung 9 F0 individual + fo_min ──────────────────────────────────
        let fo1 = null, fo2 = null, fo3 = null, fo4 = null, fo5 = null, fo6 = null;
        let foh = null, fom = null, fol = null, foMin = null;
        let sterilizationResult = "pending";

        if (rows.length >= 2) {
            // Mapping: fo1←t1, fo2←t2, ..., fo6←t6, foh←th, fom←tm, fol←tl
            const mkPoints = (col) => rows.map((r) => ({ ts: r.ts, temp: r[col] }));

            fo1 = calcF0(mkPoints("t1"));
            fo2 = calcF0(mkPoints("t2"));
            fo3 = calcF0(mkPoints("t3"));
            fo4 = calcF0(mkPoints("t4"));
            fo5 = calcF0(mkPoints("t5"));
            fo6 = calcF0(mkPoints("t6"));
            foh = calcF0(mkPoints("th"));
            fom = calcF0(mkPoints("tm"));
            fol = calcF0(mkPoints("tl"));

            // fo_min = nilai terkecil dari 9 F0 (patokan worst-case sensor)
            foMin = Math.min(fo1, fo2, fo3, fo4, fo5, fo6, foh, fom, fol);

            // Bandingkan dengan target F0 dari resep
            const foTarget = batch.fo_val_setting;
            if (foTarget !== null && foTarget !== undefined) {
                sterilizationResult = foMin >= foTarget ? "pass" : "fail";
            } else {
                // Tidak ada target F0 di resep
                sterilizationResult = "pending";
                console.warn(
                    `[batchFinalize] Batch ${batch.batch_no}: fo_val_setting null di recipe, ` +
                    `sterilization_result tetap 'pending'`
                );
            }
        } else {
            // Data trend kurang dari 2 baris — tidak cukup untuk hitung F0
            sterilizationResult = "pending";
            console.warn(
                `[batchFinalize] Batch ${batch.batch_no}: data trend hanya ${rows.length} baris, ` +
                `tidak cukup untuk hitung F0 (butuh >= 2). sterilization_result = 'pending'`
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

        // Kalau aborted: paksa sterilization_result ke ABORTED_STERILIZATION_RESULT
        // F0 tetap dihitung dan disimpan untuk keperluan audit.
        if (finalStatus === "aborted") {
            sterilizationResult = ABORTED_STERILIZATION_RESULT;
        }

        // ── Satu UPDATE batch_records ─────────────────────────────────────────
        await client.query(
            `UPDATE batch_records
             SET status               = $1,
                 run_finish           = now(),
                 total_time_min       = ROUND((EXTRACT(EPOCH FROM (now() - run_begin)) / 60)::numeric, 1),
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
                 sterilization_result = $12
             WHERE id = $13`,
            [
                finalStatus,
                fo1, fo2, fo3, fo4, fo5, fo6,
                foh, fom, fol,
                foMin,
                sterilizationResult,
                batchId,
            ]
        );

        await client.query("COMMIT");

        console.log(
            `[batchFinalize] Batch ${batch.batch_no} → status=${finalStatus}, ` +
            `fo_min=${foMin !== null ? foMin.toFixed(2) : "N/A"}, ` +
            `sterilizationResult=${sterilizationResult}`
        );

        return {
            alreadyFinalized: false,
            batch,
            status: finalStatus,
            sterilizationResult,
            foMin,
        };
    } catch (err) {
        // Rollback hanya kalau transaksi belum di-commit
        try { await client.query("ROLLBACK"); } catch (_) { /* abaikan error rollback */ }
        throw err;
    } finally {
        client.release();
    }
}
