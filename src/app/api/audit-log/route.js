import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/dateRange";

export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "audit_log", "view");
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") ?? "";
        const action = searchParams.get("action") ?? "";
        const entityType = searchParams.get("entityType") ?? "";
        const from = searchParams.get("from") ?? "";
        const to = searchParams.get("to") ?? "";
        const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
        const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

        const conditions = [];
        const values = [];

        if (search.trim()) {
            values.push(`%${search.trim()}%`);
            conditions.push(
                `(al.actor ILIKE $${values.length}
                  OR al.actor_name ILIKE $${values.length}
                  OR al.entity_id ILIKE $${values.length}
                  OR al.description ILIKE $${values.length})`
            );
        }
        if (action.trim()) {
            values.push(action.trim());
            conditions.push(`al.action = $${values.length}`);
        }
        if (entityType.trim()) {
            values.push(entityType.trim());
            conditions.push(`al.entity_type = $${values.length}`);
        }

        // Filter rentang tanggal terhadap event_time (WIB)
        const dateFilter = buildDateRangeFilter(from, to, "al.event_time", values.length + 1);
        if (dateFilter.error) {
            return Response.json({ ok: false, error: dateFilter.error }, { status: 400 });
        }
        values.push(...dateFilter.values);
        conditions.push(...dateFilter.conditions);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM audit_log al LEFT JOIN users u ON u.username = al.actor ${whereClause}`, values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const dataValues = [...values, limit, offset];
        const dataResult = await pool.query(
            `SELECT al.id, al.event_time, al.actor, al.actor_name, al.actor_role, al.action, al.entity_type,
                    al.entity_id, al.old_value, al.new_value, al.source, al.description,
                    (u.deleted_at IS NOT NULL) AS actor_deleted
             FROM audit_log al
             LEFT JOIN users u ON u.username = al.actor
             ${whereClause}
             ORDER BY al.event_time DESC
             LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
            dataValues
        );

        const data = dataResult.rows.map((row) => ({
            id: row.id,
            eventTime: row.event_time,
            actor: row.actor,
            actorName: row.actor_name,
            actorRole: row.actor_role,
            actorDeleted: row.actor_deleted ?? false,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            oldValue: row.old_value,
            newValue: row.new_value,
            source: row.source,
            description: row.description,
        }));

        return Response.json({ data, total });
    } catch (error) {
        console.error("[GET /api/audit-log]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}