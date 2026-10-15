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
            "SELECT id, username, full_name, role, password_hash, is_active FROM users WHERE username = $1",
            [session.username]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            cookieStore.delete("session_token");
            return Response.json(
                { ok: false, error: "Akun dinonaktifkan atau tidak ditemukan", deactive: true },
                { status: 401 }
            );
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            await tryAudit({
                actor: user.username,
                actorRole: user.role,
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
            actorRole: user.role,
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
                role: user.role,
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
