import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth";
import { testDirectoryAccess } from "@/lib/backupService";

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "backup", "view");
        if (errorResponse) return errorResponse;

        let body = null;
        try {
            body = await request.json();
        } catch {
            return Response.json({ ok: false, error: "Isi permintaan bukan JSON yang valid" }, { status: 400 });
        }

        const dir = typeof body?.dir === "string" ? body.dir.trim() : "";
        if (!dir) {
            return Response.json({ ok: false, error: "Direktori tujuan wajib diisi" }, { status: 400 });
        }

        const res = await testDirectoryAccess(dir);
        if (!res.ok) {
            return Response.json({ ok: false, error: res.error }, { status: 400 });
        }

        return Response.json({ ok: true, path: res.path, message: "Direktori dapat diakses dan siap digunakan untuk salinan otomatis." });
    } catch (error) {
        console.error("[POST /api/backup/check-dir]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}
