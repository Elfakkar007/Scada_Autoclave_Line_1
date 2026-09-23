import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password } = body ?? {};

        // Validasi field tidak kosong
        if (!username?.trim() || !password) {
            return Response.json(
                { ok: false, error: "Username dan password wajib diisi" },
                { status: 400 }
            );
        }

        // Ambil user dari database (hanya yang aktif)
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 AND is_active = true",
            [username.trim()]
        );

        // Pesan generik — jangan bocorkan apakah username atau password yang salah
        const GENERIC_ERROR = "Username atau password salah";

        if (result.rows.length === 0) {
            return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
        }

        const user = result.rows[0];

        // Verifikasi password dengan bcrypt
        const passwordMatch = bcrypt.compareSync(password, user.password_hash);
        if (!passwordMatch) {
            return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
        }

        // Update last_login_at
        await pool.query(
            "UPDATE users SET last_login_at = now() WHERE id = $1",
            [user.id]
        );

        // Tulis ke audit_log
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, source, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                user.username,
                user.role,
                "login",
                "user",
                user.username,
                "web",
                `User ${user.username} login berhasil`,
            ]
        );

        // Buat JWT session token
        const token = await createSessionToken({
            userId:   user.id,
            username: user.username,
            fullName: user.full_name,
            role:     user.role,
        });

        // Set httpOnly cookie
        const cookieStore = await cookies();
        cookieStore.set("session_token", token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge:   60 * 60 * 8,  // 8 jam
            path:     "/",
        });

        return Response.json({
            ok: true,
            user: {
                username: user.username,
                fullName: user.full_name,
                role:     user.role,
            },
        });
    } catch (error) {
        console.error("[POST /api/auth/login]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
