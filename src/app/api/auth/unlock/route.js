import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";
import { tryAudit } from "@/lib/auditLog";

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const session = await getSessionFromCookies(cookieStore);

        if (!session) {
            return Response.json(
                { ok: false, error: "Sesi telah berakhir, silakan login kembali", expired: true },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => null);
        const password = body?.password;

        if (typeof password !== "string" || !password) {
            return Response.json(
                { ok: false, error: "Password wajib diisi" },
                { status: 400 }
            );
        }

        // Ambil data user dari DB untuk memastikan status aktif & ambil password_hash
        const result = await pool.query(
            `SELECT u.id, u.username, u.full_name, u.password_hash, u.is_active, u.deleted_at,
                    r.key AS role_key, r.name AS role_name
               FROM users u
               LEFT JOIN roles r ON r.id = u.role_id
              WHERE u.username = $1`,
            [session.username]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active || result.rows[0].deleted_at !== null) {
            cookieStore.delete("session_token");
            return Response.json(
                { ok: false, error: "Akun dinonaktifkan atau tidak ditemukan", deactive: true },
                { status: 401 }
            );
        }

        const user = result.rows[0];
        // Key role dari tabel roles (bukan kolom lama users.role)
        const roleKey = user.role_key ?? "none";
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            await tryAudit({
                actor: user.username,
                actorRole: roleKey,
                action: "unlock_screen_failed",
                entityType: "user",
                entityId: user.username,
                description: `Percobaan membuka kunci layar gagal untuk "${user.username}" (password salah)`,
            }, "auth/unlock");

            return Response.json(
                { ok: false, error: "Password salah" },
                { status: 401 }
            );
        }

        // Catat audit buka kunci layar berhasil
        await tryAudit({
            actor: user.username,
            actorRole: roleKey,
            action: "unlock_screen",
            entityType: "user",
            entityId: user.username,
            description: `Layar dibuka kembali oleh ${user.full_name} (${user.username})`,
        }, "auth/unlock");

        return Response.json({
            ok: true,
            user: {
                username: user.username,
                fullName: user.full_name,
                role: roleKey,
                roleName: user.role_name ?? roleKey,
            },
        });
    } catch (error) {
        console.error("[POST /api/auth/unlock]", error);
        return Response.json(
            { ok: false, error: "Terjadi kesalahan server" },
            { status: 500 }
        );
    }
}