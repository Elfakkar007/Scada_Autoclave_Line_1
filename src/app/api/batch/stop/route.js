import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writePlcTags } from "@/lib/plcWrite";

/**
 * Hitung F0 dari deretan titik data trend untuk satu kolom suhu.
 *
 * Rumus F0 standar farmasi: F0 = SUM( 10^((T - 121.1) / 10) * dt_menit )
 * Pendekatan: nilai T di titik AKHIR interval (rectangular/right-endpoint).
 * Dipilih karena sederhana dan konservatif (tidak over-estimate sterilitas).
 * Untuk akurasi lebih tinggi bisa pakai trapezoid nanti, tapi belum perlu
 * selama interval rekaman ~60 detik dan kurva suhu relatif smooth.
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
        const dtMin = dtMs / (1000 * 60); // konversi ms -> menit

        if (dtMin <= 0) continue; // sanity check: jangan proses interval aneh (duplikat ts, dll)

        f0 += Math.pow(10, (T - 121.1) / 10) * dtMin;
    }
    return f0;
}

export async function POST() {
    try {
        // Proteksi server-side: wajib login (admin atau operator boleh)
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        // Cari batch yang sedang running
        const runningResult = await pool.query(
            `SELECT br.*, r.fo_val_setting
             FROM batch_records br
             LEFT JOIN recipes r ON br.recipe_id = r.id
             WHERE br.status = 'running'
             LIMIT 1`
        );
        if (runningResult.rows.length === 0) {
            return Response.json(
                { ok: false, error: "Tidak ada batch yang sedang berjalan" },
                { status: 400 }
            );
        }

        const batch = runningResult.rows[0];

        // ── Kirim perintah STOP ke PLC ─────────────────────────────────────────
        // PENTING: apapun hasilnya, TETAP lanjutkan finalisasi batch di sistem kita.
        // Operator harus tetap bisa menutup batch meskipun komunikasi PLC bermasalah.
        let plcStopWritten = false;
        try {
            const stopResult = await writePlcTags([{ tag: "STOP", value: true }]);
            plcStopWritten = stopResult.ok;
            if (!stopResult.ok) {
                console.error(
                    "[batch/stop] Gagal kirim STOP ke PLC (finalisasi batch tetap dilanjutkan):",
                    stopResult.results.filter((r) => !r.success)
                );
            }
        } catch (plcErr) {
            console.error(
                "[batch/stop] Exception saat kirim STOP ke PLC (finalisasi batch tetap dilanjutkan):",
                plcErr.message
            );
        }

        // UPDATE: set status = 'finished' dan run_finish = now()
        await pool.query(
            `UPDATE batch_records
             SET status = 'finished', run_finish = now()
             WHERE id = $1`,
            [batch.id]
        );

        // ── Kalkulasi F0 dari data trend ────────────────────────────────────────
        // Ambil semua titik trend untuk batch ini, urut ASC by ts
        const trendResult = await pool.query(
            `SELECT ts, t1, t2, t3, t4, t5, t6, th, tm, tl
             FROM batch_trend
             WHERE batch_id = $1
             ORDER BY ts ASC`,
            [batch.id]
        );

        const rows = trendResult.rows;
        let sterilizationResult = "pending";
        let fo1 = null, fo2 = null, fo3 = null, fo4 = null, fo5 = null, fo6 = null;
        let foh = null, fom = null, fol = null, foMin = null;

        if (rows.length >= 2) {
            // Hitung F0 untuk setiap kolom suhu secara terpisah.
            // Mapping: fo1<-t1, fo2<-t2, ..., fo6<-t6, foh<-th, fom<-tm, fol<-tl
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

            // fo_min = nilai terkecil dari 9 F0 (paling konservatif = worst-case sensor)
            foMin = Math.min(fo1, fo2, fo3, fo4, fo5, fo6, foh, fom, fol);

            // Bandingkan fo_min dengan target F0 dari resep
            const foTarget = batch.fo_val_setting;
            if (foTarget !== null && foTarget !== undefined) {
                sterilizationResult = foMin >= foTarget ? "pass" : "fail";
            } else {
                // Tidak ada target F0 di resep — tidak bisa menentukan pass/fail
                sterilizationResult = "pending";
                console.warn(
                    `[batch/stop] Batch ${batch.batch_no}: fo_val_setting null di recipe, ` +
                    `sterilization_result tetap 'pending'`
                );
            }
        } else {
            // Data trend kurang dari 2 baris — tidak cukup untuk hitung F0
            sterilizationResult = "pending";
            console.warn(
                `[batch/stop] Batch ${batch.batch_no}: data trend hanya ${rows.length} baris, ` +
                `tidak cukup untuk hitung F0 (butuh >= 2). sterilization_result = 'pending'`
            );
        }

        // UPDATE batch_records dengan hasil F0 dan sterilization_result
        await pool.query(
            `UPDATE batch_records
             SET fo1=$1, fo2=$2, fo3=$3, fo4=$4, fo5=$5, fo6=$6,
                 foh=$7, fom=$8, fol=$9,
                 fo_min=$10, sterilization_result=$11
             WHERE id = $12`,
            [fo1, fo2, fo3, fo4, fo5, fo6, foh, fom, fol, foMin, sterilizationResult, batch.id]
        );

        console.log(
            `[batch/stop] Batch ${batch.batch_no} selesai. ` +
            `fo_min=${foMin !== null ? foMin.toFixed(2) : "N/A"}, ` +
            `result=${sterilizationResult}`
        );

        // Tulis audit log — actor dari session (TIDAK DIUBAH dari versi sebelumnya)
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, old_value, source, description)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
            [
                session.username,
                session.role,
                "stop_batch",
                "batch",
                batch.batch_no,
                JSON.stringify({ batchNo: batch.batch_no, operator: batch.operator, runBegin: batch.run_begin }),
                "web",
                `Batch ${batch.batch_no} diselesaikan oleh ${session.username}`,
            ]
        );

        return Response.json({
            ok: true,
            batchNo: batch.batch_no,
            sterilizationResult,
            foMin: foMin !== null ? parseFloat(foMin.toFixed(2)) : null,
            plcStopWritten,
        });
    } catch (error) {
        console.error("[POST /api/batch/stop]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
