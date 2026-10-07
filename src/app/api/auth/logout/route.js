import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/auth";
import { tryAudit } from "@/lib/auditLog";

export async function POST() {
    try {
        const cookieStore = await cookies();
        const session = await getSessionFromCookies(cookieStore);

        // Catat di audit_log bila ada sesi valid. tryAudit TIDAK melempar error:
        // kegagalan database tidak boleh mencegah pengguna logout.
        if (session) {
            await tryAudit({
                actor: session.username,
                actorRole: session.role ?? "unknown",
                action: "logout",
                entityType: "user",
                entityId: session.username,
                description: `User ${session.username} logout`,
            }, "auth/logout");
        }

        // Hapus cookie sesi APA PUN hasil audit-nya
        cookieStore.delete("session_token");

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[POST /api/auth/logout]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan server" }, { status: 500 });
    }
}