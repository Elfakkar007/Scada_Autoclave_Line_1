import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { USER_SELECT, rowToUser, resolveRole } from "@/lib/userQueries";
import {
    withTransaction,
    lockRoleMutations,
    assertRoleManagerRemains,
    HttpError,
    toErrorResponse,
} from "@/lib/roleAdmin";

// ── PUT /api/users/[username] — update fullName/role/isActive (users = edit) ──
export async function PUT(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "users", "edit");
        if (errorResponse) return errorResponse;

        // Next.js 15+: await params sebelum diakses
        const { username } = await params;
        const body = (await request.json()) ?? {};
        const { fullName, isActive } = body;
        const wantsRoleChange =
            (body.roleId !== undefined && body.roleId !== null && body.roleId !== "") ||
            (typeof body.role === "string" && body.role !== "");

        if (fullName !== undefined && !String(fullName).trim()) {
            return Response.json({ ok: false, error: "Full name tidak boleh kosong" }, { status: 400 });
        }

        const updatedUser = await withTransaction(async (client) => {
            await lockRoleMutations(client);

            const oldRes = await client.query(
                `${USER_SELECT} WHERE u.username = $1 FOR UPDATE OF u`,
                [username]
            );
            if (oldRes.rows.length === 0) throw new HttpError(404, `User "${username}" tidak ditemukan`);
            const oldUser = rowToUser(oldRes.rows[0]);

            // User terhapus secara lunak diperlakukan sebagai tidak ada
            if (oldUser.deletedAt !== null) {
                throw new HttpError(404, `User "${username}" tidak ditemukan`);
            }

            let newRole = { id: oldUser.roleId, key: oldUser.role, name: oldUser.roleName };
            if (wantsRoleChange) {
                const resolved = await resolveRole(client, body);
                if (!resolved) throw new HttpError(400, "Role tidak valid");
                newRole = resolved;
            }

            const roleChanged = newRole.id !== oldUser.roleId;
            const newFullName = fullName !== undefined ? String(fullName).trim() : oldUser.fullName;
            const newIsActive = isActive !== undefined ? Boolean(isActive) : oldUser.isActive;

            // Self-protection: tidak boleh menonaktifkan atau mengubah role akun sendiri
            if (username === session.username) {
                if (newIsActive === false || roleChanged) {
                    throw new HttpError(400, "Tidak bisa mengubah akun sendiri");
                }
            }

            await client.query(
                `UPDATE users
                    SET full_name = $1, role_id = $2, is_active = $3, updated_at = now()
                  WHERE username = $4`,
                [newFullName, newRole.id, newIsActive, username]
            );
            const updated = rowToUser(
                (await client.query(`${USER_SELECT} WHERE u.username = $1`, [username])).rows[0]
            );

            await insertAudit(client, {
                actor: session.username,
                actorRole: session.role,
                action: "update_user",
                entityType: "user",
                entityId: username,
                oldValue: { fullName: oldUser.fullName, role: oldUser.role, isActive: oldUser.isActive },
                newValue: { fullName: updated.fullName, role: updated.role, isActive: updated.isActive },
                description: `User ${username} diperbarui oleh ${session.username}`,
            });

            if (roleChanged) {
                await insertAudit(client, {
                    actor: session.username,
                    actorRole: session.role,
                    action: "user_role_change",
                    entityType: "user",
                    entityId: username,
                    oldValue: { role: oldUser.role, roleId: oldUser.roleId },
                    newValue: { role: updated.role, roleId: updated.roleId },
                    description: `Role user ${username} diubah dari ${oldUser.roleName} ke ${updated.roleName} oleh ${session.username}`,
                });
            }

            await assertRoleManagerRemains(client);
            return updated;
        });

        return Response.json(updatedUser);
    } catch (error) {
        return toErrorResponse(error, "PUT /api/users/[username]");
    }
}

// ── DELETE /api/users/[username] — NONAKTIFKAN: is_active=false (users = edit) ─
// Ini bukan hapus permanen. Hapus permanen (hapus lunak) ada di POST /api/users/[username]/delete
export async function DELETE(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "users", "edit");
        if (errorResponse) return errorResponse;

        const { username } = await params;

        if (username === session.username) {
            return Response.json(
                { ok: false, error: "Tidak bisa menonaktifkan akun sendiri" },
                { status: 400 }
            );
        }

        await withTransaction(async (client) => {
            await lockRoleMutations(client);

            const check = await client.query(
                "SELECT id, deleted_at FROM users WHERE username = $1",
                [username]
            );
            if (check.rows.length === 0) throw new HttpError(404, `User "${username}" tidak ditemukan`);
            // User terhapus secara lunak diperlakukan sebagai tidak ada
            if (check.rows[0].deleted_at !== null) {
                throw new HttpError(404, `User "${username}" tidak ditemukan`);
            }

            await client.query(
                "UPDATE users SET is_active = false, updated_at = now() WHERE username = $1",
                [username]
            );

            await insertAudit(client, {
                actor: session.username,
                actorRole: session.role,
                action: "deactivate_user",
                entityType: "user",
                entityId: username,
                description: `User ${username} dinonaktifkan oleh ${session.username}`,
            });

            await assertRoleManagerRemains(client);
        });

        return Response.json({ ok: true });
    } catch (error) {
        return toErrorResponse(error, "DELETE /api/users/[username]");
    }
}