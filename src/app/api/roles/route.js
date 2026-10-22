import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { normalizePermissions } from "@/lib/permissionCatalog";
import {
    withTransaction,
    lockRoleMutations,
    HttpError,
    toErrorResponse,
} from "@/lib/roleAdmin";
import {
    ROLE_SELECT,
    rowToRole,
    fetchRoleById,
    validateName,
    validateDescription,
    validateKey,
    slugifyKey,
    validatePermissionsInput,
    upsertPermissions,
} from "@/lib/roleQueries";

// ── GET /api/roles — daftar role + izin + jumlah user (roles ≥ view) ──────────
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "roles", "view");
        if (errorResponse) return errorResponse;

        const result = await pool.query(`${ROLE_SELECT} ORDER BY r.is_system DESC, r.id`);
        return Response.json({ ok: true, roles: result.rows.map(rowToRole) });
    } catch (error) {
        return toErrorResponse(error, "GET /api/roles");
    }
}

// ── POST /api/roles — buat role baru (roles = edit) ───────────────────────────
// Body: { name, key?, description?, copyFromRoleId?, permissions? }
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "roles", "edit");
        if (errorResponse) return errorResponse;

        const body = (await request.json()) ?? {};
        const name = validateName(body.name);
        const description = validateDescription(body.description);
        const key = body.key ? validateKey(body.key) : validateKey(slugifyKey(name));
        const overrides = body.permissions !== undefined ? validatePermissionsInput(body.permissions) : {};

        const created = await withTransaction(async (client) => {
            await lockRoleMutations(client);

            // Dasar izin: salinan role lain (bila diminta) atau semua "none" (default tolak)
            let base = normalizePermissions({});
            if (body.copyFromRoleId !== undefined && body.copyFromRoleId !== null) {
                const src = await fetchRoleById(client, Number(body.copyFromRoleId));
                if (!src) throw new HttpError(400, "Role sumber salinan tidak ditemukan");
                base = src.permissions;
            }
            const finalPerms = normalizePermissions({ ...base, ...overrides });

            const ins = await client.query(
                `INSERT INTO roles (key, name, description, is_system)
                 VALUES ($1, $2, $3, false) RETURNING id`,
                [key, name, description]
            );
            const roleId = ins.rows[0].id;
            await upsertPermissions(client, roleId, finalPerms);

            const role = await fetchRoleById(client, roleId);

            await insertAudit(client, {
                actor: session.username,
                actorRole: session.role,
                action: "role_create",
                entityType: "role",
                entityId: role.key,
                newValue: { key: role.key, name: role.name, description: role.description, permissions: role.permissions },
                description: `Role ${role.name} dibuat oleh ${session.username}`,
            });
            return role;
        });

        return Response.json({ ok: true, role: created }, { status: 201 });
    } catch (error) {
        return toErrorResponse(error, "POST /api/roles");
    }
}