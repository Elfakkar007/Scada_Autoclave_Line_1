import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth";
import { insertAudit } from "@/lib/auditLog";
import { withTransaction, HttpError, toErrorResponse } from "@/lib/roleAdmin";

// ── POST /api/users/[username]/reset-password (izin: users = edit) ────────────
export async function POST(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "users", "edit");
        if (errorResponse) return errorResponse;

        const { username } = await params;
        const body = await request.json();
        const { newPassword } = body ?? {};

        if (!newPassword || newPassword.length < 6) {
            return Response.json(
                { ok: false, error: "Password baru minimal 6 karakter" },
                { status: 400 }
            );
        }

        const passwordHash = bcrypt.hashSync(newPassword, 10);

        await withTransaction(async (client) => {
            const check = await client.query(
                "SELECT id, deleted_at FROM users WHERE username = $1",
                [username]
            );
            if (check.rows.length === 0) throw new HttpError(404, `User "${username}" tidak ditemukan`);
            // User terhapus secara lunak diperlakukan sebagai tidak ada
            if (check.rows[0].deleted_at !== null) {
                throw new HttpError(404, `User "${username}" tidak ditemukan`);
            }

            await client.query(
                "UPDATE users SET password_hash = $1, updated_at = now() WHERE username = $2",
                [passwordHash, username]
            );

            // Audit fail-closed — newPassword TIDAK disertakan dimanapun
            await insertAudit(client, {
                actor: session.username,
                actorRole: session.role,
                action: "reset_password",
                entityType: "user",
                entityId: username,
                description: `Password user ${username} di-reset oleh ${session.username}`,
            });
        });

        return Response.json({ ok: true });
    } catch (error) {
        return toErrorResponse(error, "POST /api/users/[username]/reset-password");
    }
}