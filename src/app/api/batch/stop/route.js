import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readPlcSnapshot } from "@/lib/plc";
import { pulsePlcTag } from "@/lib/plcWrite";
import { finalizeBatch } from "@/lib/batchFinalize";
import { tryAudit } from "@/lib/auditLog";

export async function POST() {
    try {
        // Proteksi server-side: wajib login (admin atau operator boleh)
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        // Cari batch yang sedang running
        // (tidak perlu join recipes: fo_val_setting tidak dipakai di sini, dan nilai resep
        // batch ada di batch_records.recipe_snapshot sejak item 6)
        const runningResult = await pool.query(
            `SELECT * FROM batch_records WHERE status = 'running' LIMIT 1`
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

        // ── Audit SEBELUM pulsa STOP (item 7) ─────────────────────────────────
        // STOP adalah tindakan keselamatan: kalau audit gagal, STOP TETAP dikirim
        // (tryAudit tidak melempar; kegagalan hanya masuk log server).
        await tryAudit({
            actor: session.username,
            actorRole: session.role,
            action: "stop_requested",
            entityType: "batch",
            entityId: batch.batch_no,
            oldValue: { batchNo: batch.batch_no, plcPhaseBefore: plcPhase },
            description: `STOP diminta oleh ${session.username} untuk batch ${batch.batch_no} (fase PLC: ${plcPhase ?? "tidak terbaca"}); pulsa STOP akan dikirim`,
        }, "batch/stop");

        // ── Kirim perintah STOP ke PLC sebagai pulsa ──────────────────────────
        // PENTING: apapun hasilnya, TETAP lanjutkan finalisasi batch di sistem kita.
        // Operator harus tetap bisa menutup batch meskipun komunikasi PLC bermasalah.
        // STOP (M1.5) dibaca PLC sebagai LEVEL — wajib ditulis sebagai pulsa (true, tunggu, false).
        let plcStopWritten = false;
        let plcStuckRisk = false;
        // Rincian pulsa dikirim ke klien (hanya flag, tanpa teks error) supaya dashboard
        // bisa membedakan "STOP tidak sampai" dari "STOP sampai tapi mungkin tertahan ON" (item 10).
        let plcPulse = { wroteOn: false, wroteOff: false };
        try {
            const pulse = await pulsePlcTag("STOP");
            plcStopWritten = pulse.ok;
            plcStuckRisk = pulse.stuckRisk ?? false;
            plcPulse = { wroteOn: pulse.wroteOn, wroteOff: pulse.wroteOff };
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
            // Nasib pulsa tidak diketahui: anggap berisiko tertahan supaya operator diperingatkan.
            plcStuckRisk = true;
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
                plcPulse,
            });
        }

        const { status, foMin, f0Complete } = finalizeResult;

        // ── Tulis audit log ────────────────────────────────────────────────────
        // Hasil pulsa STOP ikut dicatat (item 10). Kegagalan audit tidak fatal (tryAudit).
        const plcNote = plcStopWritten
            ? ""
            : plcStuckRisk
                ? " PERINGATAN: STOP ke PLC tidak terkonfirmasi dan mungkin tertahan aktif (stuckRisk)."
                : " PERINGATAN: STOP ke PLC gagal ditulis.";
        await tryAudit({
            actor: session.username,
            actorRole: session.role,
            action: "stop_batch",
            entityType: "batch",
            entityId: batch.batch_no,
            oldValue: {
                batchNo: batch.batch_no,
                operator: batch.operator,
                runBegin: batch.run_begin,
            },
            newValue: { status, plcStopWritten, plcStuckRisk, plcPulse },
            description: `Batch ${batch.batch_no} diselesaikan oleh ${session.username}. Status akhir: ${status}.${plcNote}`,
        }, "batch/stop");

        return Response.json({
            ok: true,
            batchNo: batch.batch_no,
            status,
            foMin: foMin !== null ? parseFloat(foMin.toFixed(2)) : null,
            f0Complete,
            plcStopWritten,
            plcStuckRisk,
            plcPulse,
        });
    } catch (error) {
        console.error("[POST /api/batch/stop]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}