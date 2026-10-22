import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAnyPermission } from "@/lib/auth";
import { toErrorResponse } from "@/lib/roleAdmin";

// ── GET /api/roles/options — daftar ringkas role untuk dropdown ──────────────
// Boleh diakses pemegang izin Kelola User ATAU Role Management (tanpa detail izin).
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAnyPermission(cookieStore, [
            ["users", "view"],
            ["roles", "view"],
        ]);
        if (errorResponse) return errorResponse;

        const result = await pool.query(
            "SELECT id, key, name FROM roles ORDER BY is_system DESC, id"
        );
        return Response.json({ ok: true, roles: result.rows });
    } catch (error) {
        return toErrorResponse(error, "GET /api/roles/options");
    }
}