import pool from "@/lib/db";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search    = searchParams.get("search")    ?? "";
        const eventType = searchParams.get("eventType") ?? "";
        const limit     = Math.min(parseInt(searchParams.get("limit")  ?? "20", 10), 100);
        const offset    = Math.max(parseInt(searchParams.get("offset") ?? "0",  10), 0);

        // ── Bangun kondisi WHERE secara dinamis ──────────────────────────
        const conditions = [];
        const values     = [];

        if (search.trim()) {
            values.push(`%${search.trim()}%`);
            conditions.push(
                `(variable_name ILIKE $${values.length}
                  OR operator    ILIKE $${values.length}
                  OR alarm_type  ILIKE $${values.length})`
            );
        }

        if (eventType.trim()) {
            values.push(eventType.trim());
            conditions.push(`event_type = $${values.length}`);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // ── COUNT total (tanpa limit/offset) ─────────────────────────────
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM alarm_log ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // ── Data dengan limit/offset ──────────────────────────────────────
        const dataValues = [...values, limit, offset];
        const dataResult = await pool.query(
            `SELECT
                id,
                alarm_date,
                event_date,
                variable_name,
                alarm_type,
                alarm_value,
                recovery_value,
                limit_value,
                event_type,
                operator
             FROM alarm_log
             ${whereClause}
             ORDER BY alarm_date DESC NULLS LAST, created_at DESC
             LIMIT  $${dataValues.length - 1}
             OFFSET $${dataValues.length}`,
            dataValues
        );

        const data = dataResult.rows.map((row) => ({
            id:            row.id,
            alarmDate:     row.alarm_date,
            eventDate:     row.event_date,
            variableName:  row.variable_name,
            alarmType:     row.alarm_type,
            alarmValue:    row.alarm_value,
            recoveryValue: row.recovery_value,
            limitValue:    row.limit_value,
            eventType:     row.event_type,
            operator:      row.operator,
        }));

        return Response.json({ data, total });
    } catch (error) {
        console.error("[GET /api/alarms]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
