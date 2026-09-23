import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST() {
    try {
        // ▼ PROTEKSI SERVER-SIDE: wajib login (admin atau operator boleh)
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        // Cari batch yang sedang running
        const runningResult = await pool.query(
            "SELECT * FROM batch_records WHERE status = 'running' LIMIT 1"
        );
        if (runningResult.rows.length === 0) {
            return Response.json(
                { ok: false, error: "Tidak ada batch yang sedang berjalan" },
                { status: 400 }
            );
        }

        const batch = runningResult.rows[0];

        // UPDATE: set status = 'finished' dan run_finish = now()
        await pool.query(
            `UPDATE batch_records
             SET status = 'finished', run_finish = now()
             WHERE id = $1`,
            [batch.id]
        );

        // Tulis audit log — actor dari session
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

        return Response.json({ ok: true, batchNo: batch.batch_no });
    } catch (error) {
        console.error("[POST /api/batch/stop]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
