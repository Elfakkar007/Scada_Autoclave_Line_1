import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { normalizePermissions } from "@/lib/permissionCatalog";
import {
    withTransaction,
    lockRoleMutations,
    assertRoleManagerRemains,
    HttpError,
    toErrorResponse,
} from "@/lib/roleAdmin";
import {
    fetchRoleById,
    parseRoleId,
    validateName,
    validateDescription,
    validatePermissionsInput,
    upsertPermissions,
    diffPermissions,
} from "@/lib/roleQueries";

// ── GET /api/roles/[id] (roles ≥ view) ────────────────────────────────────────
export async function GET(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "roles", "view");
        if (errorResponse) return errorResponse;

        const id = parseRoleId((await params).id);
        const role = await fetchRoleById(pool, id);
        if (!role) throw new HttpError(404, "Role tidak ditemukan");
        return Response.json({ ok: true, role });
    } catch (error) {
        return toErrorResponse(error, "GET /api/roles/[id]");
    }
}

// ── PUT /api/roles/[id] — ubah nama/deskripsi/izin (roles = edit) ─────────────
// Body: { name?, description?, permissions?: { resource: level } }  (key tidak bisa diubah)
export async function PUT(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "roles", "edit");
        if (errorResponse) return errorResponse;

        const id = parseRoleId((await params).id);
        const body = (await request.json()) ?? {};

        const newName = body.name !== undefined ? validateName(body.name) : undefined;
        const newDesc = body.description !== undefined ? validateDescription(body.description) : undefined;
        const permsInput = body.permissions !== undefined ? validatePermissionsInput(body.permissions) : undefined;

        const result = await withTransaction(async (client) => {
            await lockRoleMutations(client);

            const before = await fetchRoleById(client, id);
            if (!before) throw new HttpError(404, "Role tidak ditemukan");

            const nameChanged = newName !== undefined && newName !== before.name;
            const descChanged = newDesc !== undefined && newDesc !== before.description;
            const finalPerms = permsInput
                ? normalizePermissions({ ...before.permissions, ...permsInput })
                : before.permissions;
            const diff = diffPermissions(before.permissions, finalPerms);

            if (!nameChanged && !descChanged && !diff.changed) {
                return before; // tidak ada perubahan: tanpa tulis, tanpa audit
            }

            if (nameChanged || descChanged) {
                await client.query(
                    `UPDATE roles
                        SET name = $1, description = $2, updated_at = now()
                      WHERE id = $3`,
                    [nameChanged ? newName : before.name, descChanged ? newDesc : before.description, id]
                );
                await insertAudit(client, {
                    actor: session.username,
                    actorRole: session.role,
                    action: "role_update",
                    entityType: "role",
                    entityId: before.key,
                    oldValue: { name: before.name, description: before.description },
                    newValue: {
                        name: nameChanged ? newName : before.name,
                        description: descChanged ? newDesc : before.description,
                    },
                    description: `Role ${before.name} diperbarui oleh ${session.username}`,
                });
            }

            if (diff.changed) {
                await upsertPermissions(client, id, finalPerms);
                await client.query("UPDATE roles SET updated_at = now() WHERE id = $1", [id]);
                await insertAudit(client, {
                    actor: session.username,
                    actorRole: session.role,
                    action: "role_permissions_update",
                    entityType: "role",
                    entityId: before.key,
                    oldValue: diff.old,
                    newValue: diff.new,
                    description: `Izin role ${before.name} diubah oleh ${session.username} (${Object.keys(diff.new).length} resource)`,
                });
            }

            // Jangan sampai tidak ada lagi pemegang Role Management (rollback + audit batal)
            await assertRoleManagerRemains(client);
            return await fetchRoleById(client, id);
        });

        return Response.json({ ok: true, role: result });
    } catch (error) {
        return toErrorResponse(error, "PUT /api/roles/[id]");
    }
}

// ── DELETE /api/roles/[id] (roles = edit) ─────────────────────────────────────
// Role sistem tidak bisa dihapus; role yang masih dipakai user juga tidak.
export async function DELETE(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "roles", "edit");
        if (errorResponse) return errorResponse;

        const id = parseRoleId((await params).id);

        await withTransaction(async (client) => {
            await lockRoleMutations(client);

            const role = await fetchRoleById(client, id);
            if (!role) throw new HttpError(404, "Role tidak ditemukan");
            if (role.isSystem) throw new HttpError(403, "Role sistem tidak boleh dihapus");
            if (role.userCount > 0) {
                throw new HttpError(409, `Role masih dipakai ${role.userCount} user; pindahkan user lebih dulu`);
            }

            await client.query("DELETE FROM roles WHERE id = $1", [id]);

            await insertAudit(client, {
                actor: session.username,
                actorRole: session.role,
                action: "role_delete",
                entityType: "role",
                entityId: role.key,
                oldValue: { key: role.key, name: role.name, description: role.description, permissions: role.permissions },
                description: `Role ${role.name} dihapus oleh ${session.username}`,
            });

            await assertRoleManagerRemains(client);
        });

        return Response.json({ ok: true });
    } catch (error) {
        return toErrorResponse(error, "DELETE /api/roles/[id]");
    }
}