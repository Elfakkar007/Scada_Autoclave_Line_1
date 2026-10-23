// Helper query user (SERVER-ONLY). Dipisah dari route.js karena Next.js hanya
// mengizinkan route.js mengekspor handler HTTP (GET/POST/PUT/DELETE, dll.).

// ── SELECT user + role (tanpa password_hash) ──────────────────────────────────
export const USER_SELECT = `
    SELECT u.id, u.username, u.full_name, u.is_active, u.last_login_at, u.created_at,
           u.deleted_at, u.role_id, r.key AS role_key, r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id`;

// `role` tetap berisi KEY role supaya UI lama tidak rusak; roleId/roleName tambahan.
export function rowToUser(row) {
    return {
        id:          row.id,
        username:    row.username,
        fullName:    row.full_name,
        role:        row.role_key,
        roleId:      row.role_id,
        roleName:    row.role_name,
        isActive:    row.is_active,
        lastLoginAt: row.last_login_at,
        createdAt:   row.created_at,
        deletedAt:   row.deleted_at ?? null,
    };
}

// Terima roleId (angka) ATAU role (key string, kompatibel UI lama).
export async function resolveRole(db, { roleId, role }) {
    if (roleId !== undefined && roleId !== null && roleId !== "") {
        const id = Number(roleId);
        if (!Number.isInteger(id)) return null;
        const r = await db.query("SELECT id, key, name FROM roles WHERE id = $1", [id]);
        return r.rows[0] ?? null;
    }
    if (typeof role === "string" && role) {
        const r = await db.query("SELECT id, key, name FROM roles WHERE key = $1", [role]);
        return r.rows[0] ?? null;
    }
    return null;
}
