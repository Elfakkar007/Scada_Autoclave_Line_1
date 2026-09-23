import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// ── POST /api/users/[username]/reset-password (ADMIN ONLY) ───────────────────
export async function POST(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        // Next.js 15: await params sebelum diakses
        const { username } = await params;

        const body = await request.json();
        const { newPassword } = body ?? {};

        // Validasi panjang password
        if (!newPassword || newPassword.length < 6) {
            return Response.json(
                { ok: false, error: "Password baru minimal 6 karakter" },
                { status: 400 }
            );
        }

        // Cek user ada
        const check = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [username]
        );
        if (check.rows.length === 0) {
            return Response.json({ ok: false, error: `User "${username}" tidak ditemukan` }, { status: 404 });
        }

        // Hash password baru
        const passwordHash = bcrypt.hashSync(newPassword, 10);

        // UPDATE password_hash
        await pool.query(
            "UPDATE users SET password_hash = $1, updated_at = now() WHERE username = $2",
            [passwordHash, username]
        );

        // Audit log — newPassword TIDAK disertakan dimanapun
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, source, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                session.username,
                session.role,
                "reset_password",
                "user",
                username,
                "web",
                `Password user ${username} di-reset oleh ${session.username}`,
            ]
        );

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[POST /api/users/[username]/reset-password]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
