import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/audit-log/filters — distinct actions & entity_types untuk dropdown
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const [actionsResult, entityTypesResult] = await Promise.all([
            pool.query("SELECT DISTINCT action FROM audit_log WHERE action IS NOT NULL ORDER BY action"),
            pool.query("SELECT DISTINCT entity_type FROM audit_log WHERE entity_type IS NOT NULL ORDER BY entity_type"),
        ]);

        return Response.json({
            actions:     actionsResult.rows.map((r) => r.action),
            entityTypes: entityTypesResult.rows.map((r) => r.entity_type),
        });
    } catch (error) {
        console.error("[GET /api/audit-log/filters]", error);
        return Response.json({ actions: [], entityTypes: [] });
    }
}
