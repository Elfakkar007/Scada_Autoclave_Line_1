import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// ── Helper: baris user tanpa password_hash ────────────────────────────────────
function rowToUser(row) {
    return {
        id:          row.id,
        username:    row.username,
        fullName:    row.full_name,
        role:        row.role,
        isActive:    row.is_active,
        lastLoginAt: row.last_login_at,
        createdAt:   row.created_at,
    };
}

// ── GET /api/users — daftar semua user (ADMIN ONLY) ───────────────────────────
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        // TIDAK select password_hash
        const result = await pool.query(
            `SELECT id, username, full_name, role, is_active, last_login_at, created_at
             FROM users
             ORDER BY created_at DESC`
        );
        return Response.json(result.rows.map(rowToUser));
    } catch (error) {
        console.error("[GET /api/users]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// ── POST /api/users — buat user baru (ADMIN ONLY) ────────────────────────────
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const { username, password, fullName, role } = body ?? {};

        // Validasi field wajib
        if (!username?.trim() || !password || !fullName?.trim()) {
            return Response.json(
                { ok: false, error: "Username, password, dan full name wajib diisi" },
                { status: 400 }
            );
        }
        if (!["admin", "operator"].includes(role)) {
            return Response.json(
                { ok: false, error: "Role harus 'admin' atau 'operator'" },
                { status: 400 }
            );
        }
        if (password.length < 6) {
            return Response.json(
                { ok: false, error: "Password minimal 6 karakter" },
                { status: 400 }
            );
        }

        // Cek duplikat username
        const existing = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [username.trim()]
        );
        if (existing.rows.length > 0) {
            return Response.json(
                { ok: false, error: "Username sudah digunakan" },
                { status: 400 }
            );
        }

        // Hash password
        const passwordHash = bcrypt.hashSync(password, 10);

        // INSERT user baru
        const insertResult = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, full_name, role, is_active, last_login_at, created_at`,
            [username.trim(), passwordHash, fullName.trim(), role]
        );
        const newUser = rowToUser(insertResult.rows[0]);

        // Audit log — new_value TANPA password
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
            [
                session.username,
                session.role,
                "create_user",
                "user",
                newUser.username,
                JSON.stringify({ username: newUser.username, fullName: newUser.fullName, role: newUser.role }),
                "web",
                `User ${newUser.username} (${newUser.role}) dibuat oleh ${session.username}`,
            ]
        );

        return Response.json(newUser, { status: 201 });
    } catch (error) {
        console.error("[POST /api/users]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
