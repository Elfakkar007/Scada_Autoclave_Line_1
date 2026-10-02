import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/dateRange";

const MAX_ROWS = 50_000;

// Format waktu WIB untuk tampilan di Excel
function toWIB(dateVal) {
    if (!dateVal) return "";
    return new Date(dateVal).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

// Bangun query + values dari semua filter
function buildQuery(searchParams) {
    const search     = searchParams.get("search")     ?? "";
    const action     = searchParams.get("action")     ?? "";
    const entityType = searchParams.get("entityType") ?? "";
    const from       = searchParams.get("from")       ?? "";
    const to         = searchParams.get("to")         ?? "";

    const conditions = [];
    const values     = [];

    if (search.trim()) {
        values.push(`%${search.trim()}%`);
        conditions.push(
            `(actor ILIKE $${values.length}
              OR entity_id ILIKE $${values.length}
              OR description ILIKE $${values.length})`
        );
    }
    if (action.trim()) {
        values.push(action.trim());
        conditions.push(`action = $${values.length}`);
    }
    if (entityType.trim()) {
        values.push(entityType.trim());
        conditions.push(`entity_type = $${values.length}`);
    }

    const df = buildDateRangeFilter(from, to, "event_time", values.length + 1);
    if (df.error) return { error: df.error };
    values.push(...df.values);
    conditions.push(...df.conditions);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, values, from, to, error: null };
}

export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") ?? "xlsx";

        const q = buildQuery(searchParams);
        if (q.error) return Response.json({ ok: false, error: q.error }, { status: 400 });

        // Cek jumlah baris sebelum export
        const countRes = await pool.query(
            `SELECT COUNT(*) FROM audit_log ${q.where}`, q.values
        );
        const total = parseInt(countRes.rows[0].count, 10);
        if (total > MAX_ROWS) {
            return Response.json(
                { ok: false, error: `Terlalu banyak data (${total} baris). Maks ${MAX_ROWS}. Persempit rentang tanggal.` },
                { status: 413 }
            );
        }

        const dataRes = await pool.query(
            `SELECT event_time, actor, actor_role, action, entity_type, entity_id,
                    source, description, old_value, new_value
             FROM audit_log ${q.where}
             ORDER BY event_time DESC`,
            q.values
        );
        const rows = dataRes.rows;

        // ── Catat audit export ────────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username, session.role,
                    "export_audit_log", "audit_log", null,
                    JSON.stringify({ format, from: q.from || null, to: q.to || null, rowCount: rows.length }),
                    "web",
                    `Export audit log oleh ${session.username}: ${rows.length} baris, format=${format}`,
                ]
            );
        } catch (auditErr) {
            console.error("[export/audit-log] Gagal catat audit:", auditErr.message);
        }

        // ── Format JSON (untuk halaman cetak) ────────────────────────────
        if (format === "json") {
            const data = rows.map((r) => ({
                eventTime:   toWIB(r.event_time),
                actor:       r.actor        ?? "",
                actorRole:   r.actor_role   ?? "",
                action:      r.action       ?? "",
                entityType:  r.entity_type  ?? "",
                entityId:    r.entity_id    ?? "",
                source:      r.source       ?? "",
                description: r.description  ?? "",
                oldValue:    r.old_value    ? JSON.stringify(r.old_value) : "",
                newValue:    r.new_value    ? JSON.stringify(r.new_value) : "",
            }));
            return Response.json({ rows: data, total: data.length });
        }

        // ── Format XLSX ───────────────────────────────────────────────────
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Audit Log");

        // Header
        ws.columns = [
            { header: "Waktu (WIB)",   key: "eventTime",   width: 22 },
            { header: "Aktor",         key: "actor",        width: 16 },
            { header: "Role",          key: "actorRole",    width: 12 },
            { header: "Aksi",          key: "action",       width: 20 },
            { header: "Entitas",       key: "entityType",   width: 14 },
            { header: "ID Entitas",    key: "entityId",     width: 18 },
            { header: "Sumber",        key: "source",       width: 10 },
            { header: "Deskripsi",     key: "description",  width: 50 },
            { header: "Nilai Lama",    key: "oldValue",     width: 40 },
            { header: "Nilai Baru",    key: "newValue",     width: 40 },
        ];

        // Style header
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        ws.views = [{ state: "frozen", ySplit: 1 }];

        // Data
        rows.forEach((r) => {
            ws.addRow({
                eventTime:   toWIB(r.event_time),
                actor:       r.actor        ?? "",
                actorRole:   r.actor_role   ?? "",
                action:      r.action       ?? "",
                entityType:  r.entity_type  ?? "",
                entityId:    r.entity_id    ?? "",
                source:      r.source       ?? "",
                description: r.description  ?? "",
                oldValue:    r.old_value    ? JSON.stringify(r.old_value)  : "",
                newValue:    r.new_value    ? JSON.stringify(r.new_value)  : "",
            });
        });

        const buf  = await wb.xlsx.writeBuffer();
        const from = q.from || "semua";
        const to   = q.to   || "semua";
        const filename = `audit-log_${from}_${to}.xlsx`;

        return new Response(buf, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("[GET /api/audit-log/export]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
