import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { USER_SELECT, rowToUser } from "@/lib/userQueries";
import {
    withTransaction,
    lockRoleMutations,
    assertRoleManagerRemains,
    HttpError,
    toErrorResponse,
} from "@/lib/roleAdmin";

// ── POST /api/users/[username]/delete — hapus lunak user (users = edit) ────────
// Baris user TIDAK dihapus dari database. Username terkunci selamanya.
// Endpoint terpisah dari DELETE /api/users/[username] yang berarti NONAKTIFKAN.
export async function POST(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "users", "edit");
        if (errorResponse) return errorResponse;

        const { username } = await params;

        // Tolak menghapus akun sendiri
        if (username === session.username) {
            return Response.json(
                { ok: false, error: "Tidak bisa menghapus akun sendiri" },
                { status: 400 }
            );
        }

        await withTransaction(async (client) => {
            await lockRoleMutations(client);

            // Cek keberadaan dan status hapus lunak
            const check = await client.query(
                `${USER_SELECT} WHERE u.username = $1 FOR UPDATE OF u`,
                [username]
            );
            if (check.rows.length === 0) {
                throw new HttpError(404, `User "${username}" tidak ditemukan`);
            }
            const target = rowToUser(check.rows[0]);

            if (target.deletedAt !== undefined && target.deletedAt !== null) {
                throw new HttpError(404, `User "${username}" tidak ditemukan`);
            }

            // Snapshot old_value untuk audit
            const oldValue = {
                username:  target.username,
                fullName:  target.fullName,
                full_name: target.fullName,
                roleKey:   target.role,
                role_key:  target.role,
                roleName:  target.roleName,
                role_name: target.roleName,
                isActive:  target.isActive,
                is_active: target.isActive,
            };

            // Hapus lunak: set deleted_at, is_active = false, role_id = NULL
            await client.query(
                `UPDATE users
                    SET deleted_at = now(),
                        is_active  = false,
                        role_id    = NULL,
                        updated_at = now()
                  WHERE username = $1`,
                [username]
            );

            // Audit fail-closed
            await insertAudit(client, {
                actor:      session.username,
                actorRole:  session.role,
                action:     "delete_user",
                entityType: "user",
                entityId:   username,
                oldValue,
                description: `User ${username} (${target.roleName ?? target.role}) dihapus secara permanen oleh ${session.username}`,
            });

            // Pastikan masih ada pemegang Role Management setelah penghapusan
            await assertRoleManagerRemains(client);
        });

        return Response.json({ ok: true });
    } catch (error) {
        return toErrorResponse(error, "POST /api/users/[username]/delete");
    }
}
