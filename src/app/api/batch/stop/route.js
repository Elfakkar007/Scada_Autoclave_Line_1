import pool from "@/lib/db";

export async function POST(request) {
    try {
        const body = await request.json().catch(() => ({}));
        const actor = body.actor ?? "unknown";

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

        // Tulis audit log
        await pool.query(
            `INSERT INTO audit_log
                (actor, action, entity_type, entity_id, old_value, source, description)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [
                actor, "stop_batch", "batch", batch.batch_no,
                JSON.stringify({ batchNo: batch.batch_no, operator: batch.operator, runBegin: batch.run_begin }),
                "web",
                `Batch ${batch.batch_no} diselesaikan oleh ${actor}`,
            ]
        );

        return Response.json({ ok: true, batchNo: batch.batch_no });
    } catch (error) {
        console.error("[POST /api/batch/stop]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
