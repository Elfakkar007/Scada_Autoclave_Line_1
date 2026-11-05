import { cookies } from "next/headers";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { requirePermission } from "@/lib/auth";
import { resolveBackupFile, auditDownload } from "@/lib/backupService";

// Unduh satu arsip. Butuh backup = edit (arsip memuat audit log dan seluruh data record).
// Nama file dicocokkan dengan pola ketat di resolveBackupFile, jadi path liar tidak mungkin lolos.
export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "backup", "edit");
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const kind = searchParams.get("kind") ?? "";
        const name = searchParams.get("name") ?? "";
        const file = await resolveBackupFile(kind, name);
        if (!file) return Response.json({ ok: false, error: "File backup tidak ditemukan" }, { status: 404 });

        // Audit dulu: unduhan tidak boleh lolos tanpa jejak.
        await auditDownload(session, kind, name, file.sizeBytes);

        return new Response(Readable.toWeb(createReadStream(file.full)), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Length": String(file.sizeBytes),
                "Content-Disposition": `attachment; filename="${name}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("[GET /api/backup/download]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}
