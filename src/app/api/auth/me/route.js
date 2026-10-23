import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/auth/me — data sesi terkini untuk klien (Navbar, gating halaman).
// Semua dibaca dari DB tiap request (bukan dari token): perubahan role/izin oleh
// admin langsung berlaku. `permissions` = { resource: "none" | "view" | "edit" }.
// Catatan: ini hanya untuk menampilkan/menyembunyikan UI. Penjagaan data tetap di API
// (requirePermission) — jangan jadikan respons ini satu-satunya pagar.
export async function GET() {
    try {
        const cookieStore = await cookies();
        const jwtPayload = await getSessionFromCookies(cookieStore);

        if (!jwtPayload) {
            return Response.json({ ok: false }, { status: 401 });
        }

        const result = await pool.query(
            `SELECT u.full_name, u.is_active, u.deleted_at, u.role_id,
                    r.key AS role_key, r.name AS role_name
               FROM users u
               LEFT JOIN roles r ON r.id = u.role_id
              WHERE u.username = $1`,
            [jwtPayload.username]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active || result.rows[0].deleted_at !== null) {
            // Akun tidak aktif, terhapus, atau tidak ditemukan — hapus cookie session
            cookieStore.delete("session_token");
            return Response.json(
                { ok: false, error: "Akun tidak aktif" },
                { status: 401 }
            );
        }

        const dbUser = result.rows[0];

        // Izin role. Tidak ada baris = tolak (klien memperlakukan resource yang
        // tidak muncul sebagai "none"). User tanpa role => objek kosong.
        const permissions = {};
        if (dbUser.role_id != null) {
            const perm = await pool.query(
                "SELECT resource, level FROM role_permissions WHERE role_id = $1",
                [dbUser.role_id]
            );
            for (const row of perm.rows) permissions[row.resource] = row.level;
        }

        const roleKey = dbUser.role_key ?? "none";

        return Response.json({
            ok: true,
            user: {
                username: jwtPayload.username,
                fullName: dbUser.full_name,
                role: roleKey,                          // key role (kompatibel kode lama)
                roleId: dbUser.role_id,
                roleName: dbUser.role_name ?? roleKey,  // untuk ditampilkan di UI
                permissions,
            },
        });
    } catch (error) {
        console.error("[GET /api/auth/me]", error);
        return Response.json({ ok: false }, { status: 401 });
    }
}