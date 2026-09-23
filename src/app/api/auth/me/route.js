import { cookies } from "next/headers";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = await getSessionFromCookies(cookieStore);

        if (!session) {
            return Response.json({ ok: false }, { status: 401 });
        }

        // Data diambil langsung dari isi token — tidak perlu query DB
        return Response.json({
            ok: true,
            user: {
                username: session.username,
                fullName: session.fullName,
                role:     session.role,
            },
        });
    } catch (error) {
        console.error("[GET /api/auth/me]", error);
        return Response.json({ ok: false }, { status: 401 });
    }
}
