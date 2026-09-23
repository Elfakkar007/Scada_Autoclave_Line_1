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

// ── PUT /api/users/[username] — update fullName/role/isActive (ADMIN ONLY) ────
export async function PUT(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        // Next.js 15: await params sebelum diakses
        const { username } = await params;

        // Ambil data user lama
        const oldResult = await pool.query(
            `SELECT id, username, full_name, role, is_active, last_login_at, created_at
             FROM users WHERE username = $1`,
            [username]
        );
        if (oldResult.rows.length === 0) {
            return Response.json({ ok: false, error: `User "${username}" tidak ditemukan` }, { status: 404 });
        }
        const oldUser = rowToUser(oldResult.rows[0]);

        const body = await request.json();
        const { fullName, role, isActive } = body ?? {};

        // Self-protection: admin tidak bisa menonaktifkan atau menurunkan role dirinya sendiri
        if (username === session.username) {
            if (isActive === false) {
                return Response.json(
                    { ok: false, error: "Tidak bisa mengubah akun sendiri" },
                    { status: 400 }
                );
            }
            if (role && role !== "admin" && oldUser.role === "admin") {
                return Response.json(
                    { ok: false, error: "Tidak bisa mengubah akun sendiri" },
                    { status: 400 }
                );
            }
        }

        // Validasi role kalau diisi
        if (role && !["admin", "operator"].includes(role)) {
            return Response.json({ ok: false, error: "Role harus 'admin' atau 'operator'" }, { status: 400 });
        }

        const newFullName = (fullName?.trim()) ?? oldUser.fullName;
        const newRole     = role ?? oldUser.role;
        const newIsActive = isActive !== undefined ? Boolean(isActive) : oldUser.isActive;

        // UPDATE users
        const updateResult = await pool.query(
            `UPDATE users
             SET full_name = $1, role = $2, is_active = $3, updated_at = now()
             WHERE username = $4
             RETURNING id, username, full_name, role, is_active, last_login_at, created_at`,
            [newFullName, newRole, newIsActive, username]
        );
        const updatedUser = rowToUser(updateResult.rows[0]);

        // Audit log — old/new value tanpa password
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, old_value, new_value, source, description)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
            [
                session.username,
                session.role,
                "update_user",
                "user",
                username,
                JSON.stringify({ fullName: oldUser.fullName, role: oldUser.role, isActive: oldUser.isActive }),
                JSON.stringify({ fullName: newFullName, role: newRole, isActive: newIsActive }),
                "web",
                `User ${username} diperbarui oleh ${session.username}`,
            ]
        );

        return Response.json(updatedUser);
    } catch (error) {
        console.error("[PUT /api/users/[username]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// ── DELETE /api/users/[username] — SOFT DELETE: set is_active=false (ADMIN ONLY)
export async function DELETE(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { username } = await params;

        // Self-protection
        if (username === session.username) {
            return Response.json(
                { ok: false, error: "Tidak bisa menonaktifkan akun sendiri" },
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

        // Soft delete: is_active = false
        await pool.query(
            "UPDATE users SET is_active = false, updated_at = now() WHERE username = $1",
            [username]
        );

        // Audit log
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, source, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                session.username,
                session.role,
                "deactivate_user",
                "user",
                username,
                "web",
                `User ${username} dinonaktifkan oleh ${session.username}`,
            ]
        );

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[DELETE /api/users/[username]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
