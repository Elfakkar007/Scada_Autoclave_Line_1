import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { USER_SELECT, rowToUser, resolveRole } from "@/lib/userQueries";
import {
    withTransaction,
    lockRoleMutations,
    HttpError,
    toErrorResponse,
} from "@/lib/roleAdmin";

// ── GET /api/users — daftar user aktif/nonaktif, TIDAK termasuk akun terhapus (users ≥ view) ──
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "users", "view");
        if (errorResponse) return errorResponse;

        const result = await pool.query(
            `${USER_SELECT} WHERE u.deleted_at IS NULL ORDER BY u.created_at DESC`
        );
        return Response.json(result.rows.map(rowToUser));
    } catch (error) {
        return toErrorResponse(error, "GET /api/users");
    }
}

// ── POST /api/users — buat user baru (izin: users = edit) ─────────────────────
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "users", "edit");
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const { username, password, fullName } = body ?? {};

        if (!username?.trim() || !password || !fullName?.trim()) {
            return Response.json(
                { ok: false, error: "Username, password, dan full name wajib diisi" },
                { status: 400 }
            );
        }
        if (password.length < 6) {
            return Response.json(
                { ok: false, error: "Password minimal 6 karakter" },
                { status: 400 }
            );
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        const newUser = await withTransaction(async (client) => {
            await lockRoleMutations(client);

            const role = await resolveRole(client, body);
            if (!role) throw new HttpError(400, "Role tidak valid");

            // Cek akun terhapus: TANPA membedakan huruf besar/kecil (409)
            const deletedCheck = await client.query(
                "SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NOT NULL",
                [username.trim()]
            );
            if (deletedCheck.rows.length > 0) {
                throw new HttpError(
                    409,
                    "Username ini pernah dipakai akun yang sudah dihapus dan tidak bisa dipakai lagi"
                );
            }

            // Cek akun aktif: case-sensitive seperti perilaku lama (400)
            const existing = await client.query(
                "SELECT id FROM users WHERE username = $1",
                [username.trim()]
            );
            if (existing.rows.length > 0) throw new HttpError(400, "Username sudah digunakan");

            // users.role (kolom lama) diisi otomatis oleh trigger dari role_id
            const ins = await client.query(
                `INSERT INTO users (username, password_hash, full_name, role_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [username.trim(), passwordHash, fullName.trim(), role.id]
            );
            const created = rowToUser(
                (await client.query(`${USER_SELECT} WHERE u.id = $1`, [ins.rows[0].id])).rows[0]
            );

            // Audit fail-closed: bila gagal, user ikut dibatalkan. new_value TANPA password.
            await insertAudit(client, {
                actor: session.username,
                actorRole: session.role,
                action: "create_user",
                entityType: "user",
                entityId: created.username,
                newValue: {
                    username: created.username,
                    fullName: created.fullName,
                    role: created.role,
                    roleId: created.roleId,
                },
                description: `User ${created.username} (${created.roleName}) dibuat oleh ${session.username}`,
            });
            return created;
        });

        return Response.json(newUser, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, "POST /api/users");
    }
}