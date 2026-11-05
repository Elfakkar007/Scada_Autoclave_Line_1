import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth";
import { getStatus, updateSettings, runBackup } from "@/lib/backupService";
import { validateSettingsInput, parseRange } from "@/lib/backupSchedule";

const serverError = () =>
    Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });

async function readJson(request) {
    try {
        return { body: await request.json(), error: null };
    } catch {
        return { body: null, error: "Isi permintaan bukan JSON yang valid" };
    }
}

// Status: pengaturan jadwal, waktu jalan berikutnya, daftar arsip. Butuh backup >= view.
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "backup", "view");
        if (errorResponse) return errorResponse;
        return Response.json({ ok: true, ...(await getStatus()) });
    } catch (error) {
        console.error("[GET /api/backup]", error);
        return serverError();
    }
}

// Ubah pengaturan jadwal. Butuh backup = edit.
export async function PUT(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "backup", "edit");
        if (errorResponse) return errorResponse;

        const { body, error } = await readJson(request);
        if (error) return Response.json({ ok: false, error }, { status: 400 });
        const v = validateSettingsInput(body);
        if (v.error) return Response.json({ ok: false, error: v.error }, { status: 400 });

        const settings = await updateSettings(v.value, session.username, session.role);
        return Response.json({ ok: true, settings });
    } catch (error) {
        console.error("[PUT /api/backup]", error);
        return serverError();
    }
}

// Backup manual. Body: { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }; keduanya kosong = semua data.
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "backup", "edit");
        if (errorResponse) return errorResponse;

        const { body, error } = await readJson(request);
        if (error) return Response.json({ ok: false, error }, { status: 400 });
        const { range, error: rangeError } = parseRange(body?.from, body?.to);
        if (rangeError) return Response.json({ ok: false, error: rangeError }, { status: 400 });

        const r = await runBackup({ kind: "manual", range, actor: session.username, actorRole: session.role });
        return Response.json({
            ok: true,
            file: { kind: r.kind, name: r.name, sizeBytes: r.sizeBytes, sha256: r.sha256 },
            rows: Object.fromEntries(Object.entries(r.manifest.tables).map(([k, t]) => [k, t.rows])),
            complete: r.manifest.complete,
        });
    } catch (error) {
        if (error?.code === "BUSY") {
            return Response.json({ ok: false, error: error.message }, { status: 409 });
        }
        console.error("[POST /api/backup]", error);
        return Response.json({ ok: false, error: "Backup gagal. Lihat Audit Log atau hubungi admin." }, { status: 500 });
    }
}
