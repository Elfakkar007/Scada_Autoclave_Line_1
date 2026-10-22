// ==============================================================================
// Helper bersama untuk mutasi user/role (SERVER-ONLY).
// - withTransaction : BEGIN/COMMIT/ROLLBACK
// - lockRoleMutations + assertRoleManagerRemains : jaga agar SELALU tersisa
//   minimal satu user AKTIF yang memegang izin Role Management (roles = edit).
//   Pola: terapkan perubahan di dalam transaksi, lalu cek; bila melanggar,
//   lempar HttpError sehingga seluruh transaksi (termasuk audit) dibatalkan.
// - HttpError / toErrorResponse : pemetaan error → Response JSON
// ==============================================================================

import pool from "./db.js";

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        try { await client.query("ROLLBACK"); } catch { /* abaikan */ }
        throw err;
    } finally {
        client.release();
    }
}

// Serialkan semua mutasi user/role supaya pengecekan "minimal satu pemegang" akurat.
export async function lockRoleMutations(client) {
    await client.query("SELECT pg_advisory_xact_lock(7001)");
}

export async function assertRoleManagerRemains(client) {
    const r = await client.query(
        `SELECT count(*)::int AS n
           FROM users u
           JOIN role_permissions rp
             ON rp.role_id = u.role_id AND rp.resource = 'roles' AND rp.level = 'edit'
          WHERE u.is_active`
    );
    if (r.rows[0].n < 1) {
        throw new HttpError(
            409,
            "Perubahan dibatalkan: harus tersisa minimal satu user aktif yang memegang izin Role Management"
        );
    }
}

export function toErrorResponse(error, label) {
    if (error instanceof HttpError) {
        return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    // 23505 = unique_violation, 23503 = foreign_key_violation, 23001 = restrict_violation
    if (error?.code === "23505") {
        return Response.json({ ok: false, error: "Data duplikat (nama/key/username sudah dipakai)" }, { status: 409 });
    }
    if (error?.code === "23503" || error?.code === "23001") {
        return Response.json({ ok: false, error: "Data masih dipakai atau dilindungi, tidak bisa dihapus" }, { status: 409 });
    }
    console.error(`[${label}]`, error);
    return Response.json({ ok: false, error: "Terjadi kesalahan server" }, { status: 500 });
}
