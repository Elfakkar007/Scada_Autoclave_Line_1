import pool from "@/lib/db";

// GET /api/auth/users — PUBLIK (tanpa login), untuk dropdown username di halaman login.
// Hanya mengembalikan username dan nama lengkap user AKTIF. Sengaja TIDAK mengembalikan
// role, id, atau data lain. Daftar ini terlihat oleh siapa pun yang bisa membuka web;
// aman selama web hanya diakses dari PC mesin / jaringan tepercaya.
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const result = await pool.query(
            "SELECT username, full_name FROM users WHERE is_active = true ORDER BY full_name"
        );
        return Response.json({
            ok: true,
            users: result.rows.map((r) => ({ username: r.username, fullName: r.full_name })),
        });
    } catch (error) {
        console.error("[GET /api/auth/users]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan server", users: [] }, { status: 500 });
    }
}