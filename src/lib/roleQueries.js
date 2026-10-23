// Helper query role (SERVER-ONLY). Dipisah dari route.js karena Next.js hanya
// mengizinkan route.js mengekspor handler HTTP.

import { RESOURCES, normalizePermissions, isKnownResource, isLevelAllowed, isValidLevel } from "./permissionCatalog.js";
import { HttpError } from "./roleAdmin.js";

export const ROLE_SELECT = `
    SELECT r.id, r.key, r.name, r.description, r.is_system, r.created_at, r.updated_at,
           (SELECT count(*)::int FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)                  AS user_count,
           (SELECT count(*)::int FROM users u WHERE u.role_id = r.id AND u.is_active AND u.deleted_at IS NULL)  AS active_user_count,
           COALESCE((SELECT jsonb_object_agg(rp.resource, rp.level)
                       FROM role_permissions rp WHERE rp.role_id = r.id), '{}'::jsonb) AS permissions
      FROM roles r`;

export function rowToRole(row) {
    return {
        id:              row.id,
        key:             row.key,
        name:            row.name,
        description:     row.description,
        isSystem:        row.is_system,
        userCount:       row.user_count,
        activeUserCount: row.active_user_count,
        permissions:     normalizePermissions(row.permissions),
        createdAt:       row.created_at,
        updatedAt:       row.updated_at,
    };
}

export async function fetchRoleById(db, id) {
    const r = await db.query(`${ROLE_SELECT} WHERE r.id = $1`, [id]);
    return r.rows[0] ? rowToRole(r.rows[0]) : null;
}

export function parseRoleId(raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "ID role tidak valid");
    return id;
}

// Validasi input peta izin { resource: level }. Lempar HttpError 400 bila ada yang salah.
export function validatePermissionsInput(input) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
        throw new HttpError(400, "permissions harus berupa objek { resource: level }");
    }
    const clean = {};
    for (const [resource, level] of Object.entries(input)) {
        if (!isKnownResource(resource)) throw new HttpError(400, `Resource tidak dikenal: ${resource}`);
        if (!isValidLevel(level) || !isLevelAllowed(resource, level)) {
            throw new HttpError(400, `Level "${level}" tidak sah untuk resource ${resource}`);
        }
        clean[resource] = level;
    }
    return clean;
}

export function validateName(name) {
    const n = typeof name === "string" ? name.trim() : "";
    if (n.length < 2 || n.length > 60) throw new HttpError(400, "Nama role harus 2–60 karakter");
    return n;
}

export function validateDescription(desc) {
    if (desc === undefined || desc === null) return null;
    const d = String(desc).trim();
    if (d.length > 300) throw new HttpError(400, "Deskripsi maksimal 300 karakter");
    return d || null;
}

export function slugifyKey(name) {
    let k = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
    if (!/^[a-z]/.test(k)) k = `r_${k}`.slice(0, 32);
    return k;
}

export function validateKey(key) {
    if (typeof key !== "string" || !/^[a-z][a-z0-9_]{1,31}$/.test(key)) {
        throw new HttpError(400, "Key role: huruf kecil/angka/underscore, diawali huruf, 2–32 karakter");
    }
    return key;
}

// Tulis SEMUA resource katalog untuk role (upsert) dari peta izin lengkap.
export async function upsertPermissions(client, roleId, fullMap) {
    const rows = RESOURCES.map((r) => ({ resource: r.key, level: fullMap[r.key] ?? "none" }));
    await client.query(
        `INSERT INTO role_permissions (role_id, resource, level)
         SELECT $1, x.resource, x.level
           FROM jsonb_to_recordset($2::jsonb) AS x(resource text, level text)
         ON CONFLICT (role_id, resource) DO UPDATE SET level = EXCLUDED.level`,
        [roleId, JSON.stringify(rows)]
    );
}

// Selisih izin: hanya resource yang berubah → { old: {...}, new: {...} }
export function diffPermissions(oldMap, newMap) {
    const o = {}, n = {};
    for (const r of RESOURCES) {
        if (oldMap[r.key] !== newMap[r.key]) {
            o[r.key] = oldMap[r.key];
            n[r.key] = newMap[r.key];
        }
    }
    return { old: o, new: n, changed: Object.keys(n).length > 0 };
}
