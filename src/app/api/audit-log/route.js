import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const search     = searchParams.get("search")     ?? "";
        const action     = searchParams.get("action")     ?? "";
        const entityType = searchParams.get("entityType") ?? "";
        const limit      = Math.min(parseInt(searchParams.get("limit")  ?? "20", 10), 100);
        const offset     = Math.max(parseInt(searchParams.get("offset") ?? "0",  10), 0);

        const conditions = [];
        const values     = [];

        if (search.trim()) {
            values.push(`%${search.trim()}%`);
            conditions.push(
                `(actor ILIKE $${values.length}
                  OR entity_id ILIKE $${values.length}
                  OR description ILIKE $${values.length})`
            );
        }
        if (action.trim()) {
            values.push(action.trim());
            conditions.push(`action = $${values.length}`);
        }
        if (entityType.trim()) {
            values.push(entityType.trim());
            conditions.push(`entity_type = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM audit_log ${whereClause}`, values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const dataValues = [...values, limit, offset];
        const dataResult = await pool.query(
            `SELECT id, event_time, actor, actor_role, action, entity_type,
                    entity_id, old_value, new_value, source, description
             FROM audit_log
             ${whereClause}
             ORDER BY event_time DESC
             LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
            dataValues
        );

        const data = dataResult.rows.map((row) => ({
            id:          row.id,
            eventTime:   row.event_time,
            actor:       row.actor,
            actorRole:   row.actor_role,
            action:      row.action,
            entityType:  row.entity_type,
            entityId:    row.entity_id,
            oldValue:    row.old_value,
            newValue:    row.new_value,
            source:      row.source,
            description: row.description,
        }));

        return Response.json({ data, total });
    } catch (error) {
        console.error("[GET /api/audit-log]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
