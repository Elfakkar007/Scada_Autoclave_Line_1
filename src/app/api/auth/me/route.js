import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const jwtPayload = await getSessionFromCookies(cookieStore);

        if (!jwtPayload) {
            return Response.json({ ok: false }, { status: 401 });
        }

        // Query DB untuk cek is_active dan ambil data terkini
        // (full_name/role mungkin sudah diubah admin sejak token dibuat)
        const result = await pool.query(
            "SELECT full_name, role, is_active FROM users WHERE username = $1",
            [jwtPayload.username]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            // Akun tidak aktif atau tidak ditemukan — hapus cookie session
            cookieStore.delete("session_token");
            return Response.json(
                { ok: false, error: "Akun tidak aktif" },
                { status: 401 }
            );
        }

        const dbUser = result.rows[0];

        // Kembalikan data dari DB (bukan dari token lama)
        return Response.json({
            ok: true,
            user: {
                username: jwtPayload.username,
                fullName: dbUser.full_name,   // dari DB, bukan token
                role:     dbUser.role,         // dari DB, bukan token
            },
        });
    } catch (error) {
        console.error("[GET /api/auth/me]", error);
        return Response.json({ ok: false }, { status: 401 });
    }
}
