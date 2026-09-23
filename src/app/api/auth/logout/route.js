import { cookies } from "next/headers";
import pool from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

export async function POST() {
    try {
        const cookieStore = await cookies();
        const session = await getSessionFromCookies(cookieStore);

        // Kalau ada session valid, catat di audit_log
        if (session) {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    session.username,
                    session.role ?? "unknown",
                    "logout",
                    "user",
                    session.username,
                    "web",
                    `User ${session.username} logout`,
                ]
            );
        }

        // Hapus cookie session
        cookieStore.delete("session_token");

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[POST /api/auth/logout]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan server" }, { status: 500 });
    }
}
