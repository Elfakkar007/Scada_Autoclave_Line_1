import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readPlcSnapshot } from "@/lib/plc";
import { pulsePlcTag } from "@/lib/plcWrite";
import { finalizeBatch } from "@/lib/batchFinalize";

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

        // ── Baca snapshot PLC sebelum kirim STOP ──────────────────────────────
        // Dipakai untuk menentukan status akhir batch (finished vs aborted).
        // Dibungkus try/catch: kegagalan baca tidak menghalangi finalisasi batch.
        let plcPhase = null;
        try {
            const snapBefore = await readPlcSnapshot();
            if (snapBefore.plcOk) {
                plcPhase = snapBefore.phase?.rawValue ?? null;
            }
        } catch (snapErr) {
            console.warn("[batch/stop] Gagal baca snapshot PLC sebelum STOP:", snapErr.message);
        }

        // ── Kirim perintah STOP ke PLC sebagai pulsa ──────────────────────────
        // PENTING: apapun hasilnya, TETAP lanjutkan finalisasi batch di sistem kita.
        // Operator harus tetap bisa menutup batch meskipun komunikasi PLC bermasalah.
        // STOP (M1.5) dibaca PLC sebagai LEVEL — wajib ditulis sebagai pulsa (true, tunggu, false).
        let plcStopWritten = false;
        let plcStuckRisk   = false;
        try {
            const pulse = await pulsePlcTag("STOP");
            plcStopWritten = pulse.ok;
            plcStuckRisk   = pulse.stuckRisk ?? false;
            if (!pulse.ok) {
                console.error(
                    "[batch/stop] Gagal kirim STOP ke PLC (finalisasi batch tetap dilanjutkan):",
                    pulse
                );
            }
        } catch (plcErr) {
            console.error(
                "[batch/stop] Exception saat kirim STOP ke PLC (finalisasi batch tetap dilanjutkan):",
                plcErr.message
            );
        }

        // ── Finalisasi batch (F0, status, satu UPDATE) ─────────────────────────
        // Ganti dua UPDATE + calcF0 lokal dengan satu panggilan finalizeBatch.
        const finalizeResult = await finalizeBatch(batch.id, { plcPhase });

        if (finalizeResult.alreadyFinalized) {
            return Response.json({
                ok: true,
                message: "Batch sudah ditutup sebelumnya.",
                batchNo: batch.batch_no,
                plcStopWritten,
                plcStuckRisk,
            });
        }

        const { status, sterilizationResult, foMin } = finalizeResult;

        // ── Tulis audit log ────────────────────────────────────────────────────
        try {
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
                    JSON.stringify({
                        batchNo:   batch.batch_no,
                        operator:  batch.operator,
                        runBegin:  batch.run_begin,
                    }),
                    "web",
                    `Batch ${batch.batch_no} diselesaikan oleh ${session.username}. Status akhir: ${status}`,
                ]
            );
        } catch (auditErr) {
            // Audit log gagal tidak fatal
            console.error("[batch/stop] Gagal catat audit stop_batch:", auditErr.message);
        }

        return Response.json({
            ok: true,
            batchNo:              batch.batch_no,
            status,
            sterilizationResult,
            foMin:                foMin !== null ? parseFloat(foMin.toFixed(2)) : null,
            plcStopWritten,
            plcStuckRisk,
        });
    } catch (error) {
        console.error("[POST /api/batch/stop]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
