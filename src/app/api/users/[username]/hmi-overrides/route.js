import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { validateHmiOverrides } from "@/lib/hmiOverrideCatalog";

// ── GET /api/users/[username]/hmi-overrides — baca override HMI user (users >= view) ─
export async function GET(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "users", "view");
        if (errorResponse) return errorResponse;

        const { username } = await params;
        const result = await pool.query(
            "SELECT hmi_overrides FROM users WHERE username = $1 AND deleted_at IS NULL",
            [username]
        );
        if (result.rows.length === 0) {
            return Response.json({ ok: false, error: `User "${username}" tidak ditemukan` }, { status: 404 });
        }
        return Response.json({ ok: true, hmiOverrides: result.rows[0].hmi_overrides ?? null });
    } catch (error) {
        console.error("[GET /api/users/[username]/hmi-overrides]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server" }, { status: 500 });
    }
}

// ── PUT /api/users/[username]/hmi-overrides — simpan override HMI user (users >= edit) ─
// Body: { hmiOverrides: null | { <page>: { mode: "default"|"custom", items: { <key>: "none"|"read"|"write" } } } }
// Kirim null untuk mereset semua override ke default (ikuti RBAC).
export async function PUT(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "users", "edit");
        if (errorResponse) return errorResponse;

        const { username } = await params;
        let body;
        try { body = await request.json(); } catch {
            return Response.json({ ok: false, error: "Body bukan JSON valid" }, { status: 400 });
        }

        // Validasi struktur hmi_overrides
        const validation = validateHmiOverrides(body?.hmiOverrides);
        if (!validation.ok) {
            return Response.json({ ok: false, error: validation.error }, { status: 400 });
        }
        const normalized = validation.normalized;

        // Pastikan target user ada dan tidak terhapus
        const check = await pool.query(
            "SELECT id, hmi_overrides FROM users WHERE username = $1 AND deleted_at IS NULL",
            [username]
        );
        if (check.rows.length === 0) {
            return Response.json({ ok: false, error: `User "${username}" tidak ditemukan` }, { status: 404 });
        }
        const oldOverrides = check.rows[0].hmi_overrides ?? null;

        // Update kolom hmi_overrides
        await pool.query(
            "UPDATE users SET hmi_overrides = $1, updated_at = now() WHERE username = $2",
            [normalized ? JSON.stringify(normalized) : null, username]
        );

        // Catat audit
        await insertAudit(pool, {
            actor: session.username,
            actorRole: session.role,
            action: "update_hmi_overrides",
            entityType: "user",
            entityId: username,
            oldValue: oldOverrides,
            newValue: normalized,
            description: normalized
                ? `HMI override user ${username} diperbarui oleh ${session.username}`
                : `HMI override user ${username} direset ke default oleh ${session.username}`,
        });

        return Response.json({ ok: true, hmiOverrides: normalized });
    } catch (error) {
        console.error("[PUT /api/users/[username]/hmi-overrides]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server" }, { status: 500 });
    }
}

