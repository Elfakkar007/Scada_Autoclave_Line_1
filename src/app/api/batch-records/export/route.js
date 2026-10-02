import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { buildDateRangeFilter } from "@/lib/dateRange";

const MAX_ROWS = 50_000;

function toWIB(dateVal) {
    if (!dateVal) return "";
    return new Date(dateVal).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

function fmtNum(v) {
    if (v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
}

function buildQuery(searchParams) {
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const from   = searchParams.get("from")   ?? "";
    const to     = searchParams.get("to")     ?? "";

    const conditions = [];
    const values     = [];

    if (search.trim()) {
        values.push(`%${search.trim()}%`);
        conditions.push(
            `(batch_no ILIKE $${values.length}
              OR operator ILIKE $${values.length}
              OR product_name ILIKE $${values.length})`
        );
    }
    if (status.trim() && ["running", "finished", "aborted"].includes(status.trim())) {
        values.push(status.trim());
        conditions.push(`status = $${values.length}`);
    }

    const df = buildDateRangeFilter(
        from, to,
        "COALESCE(run_begin, created_at)",
        values.length + 1
    );
    if (df.error) return { error: df.error };
    values.push(...df.values);
    conditions.push(...df.conditions);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, values, from, to, error: null };
}

export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") ?? "xlsx";

        const q = buildQuery(searchParams);
        if (q.error) return Response.json({ ok: false, error: q.error }, { status: 400 });

        // Cek jumlah baris
        const countRes = await pool.query(
            `SELECT COUNT(*) FROM batch_records ${q.where}`, q.values
        );
        const total = parseInt(countRes.rows[0].count, 10);
        if (total > MAX_ROWS) {
            return Response.json(
                { ok: false, error: `Terlalu banyak data (${total} baris). Maks ${MAX_ROWS}. Persempit rentang tanggal.` },
                { status: 413 }
            );
        }

        const dataRes = await pool.query(
            `SELECT batch_no, loading_no, product_name, product_spec, operator,
                    machine_id, ster_temp, run_begin, run_finish, total_time_min,
                    heat_time_min, ster_time_min, cool_time_min,
                    fo_min, fo1, fo2, fo3, fo4, fo5, fo6, foh, fom, fol,
                    sterilization_result, status
             FROM batch_records
             ${q.where}
             ORDER BY COALESCE(run_begin, created_at) DESC`,
            q.values
        );
        const rows = dataRes.rows;

        // ── Catat audit ───────────────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username, session.role,
                    "export_batch_records", "batch", null,
                    JSON.stringify({ format, from: q.from || null, to: q.to || null, rowCount: rows.length }),
                    "web",
                    `Export batch records oleh ${session.username}: ${rows.length} baris, format=${format}`,
                ]
            );
        } catch (auditErr) {
            console.error("[export/batch-records] Gagal catat audit:", auditErr.message);
        }

        // ── Format JSON ───────────────────────────────────────────────────
        if (format === "json") {
            const data = rows.map((r) => ({
                batchNo:             r.batch_no        ?? "",
                loadingNo:           r.loading_no      ?? "",
                productName:         r.product_name    ?? "",
                productSpec:         r.product_spec    ?? "",
                operator:            r.operator        ?? "",
                machineId:           r.machine_id      ?? "",
                sterTemp:            fmtNum(r.ster_temp),
                runBegin:            toWIB(r.run_begin),
                runFinish:           toWIB(r.run_finish),
                totalTimeMin:        fmtNum(r.total_time_min),
                heatTimeMin:         fmtNum(r.heat_time_min),
                sterTimeMin:         fmtNum(r.ster_time_min),
                coolTimeMin:         fmtNum(r.cool_time_min),
                foMin:               fmtNum(r.fo_min),
                fo1:                 fmtNum(r.fo1),
                fo2:                 fmtNum(r.fo2),
                fo3:                 fmtNum(r.fo3),
                fo4:                 fmtNum(r.fo4),
                fo5:                 fmtNum(r.fo5),
                fo6:                 fmtNum(r.fo6),
                foh:                 fmtNum(r.foh),
                fom:                 fmtNum(r.fom),
                fol:                 fmtNum(r.fol),
                sterilizationResult: r.sterilization_result ?? "",
                status:              r.status          ?? "",
            }));
            return Response.json({ rows: data, total: data.length });
        }

        // ── Format XLSX ───────────────────────────────────────────────────
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Data Report");

        ws.columns = [
            { header: "Batch No",       key: "batchNo",             width: 16 },
            { header: "Loading No",     key: "loadingNo",           width: 14 },
            { header: "Produk",         key: "productName",         width: 26 },
            { header: "Spesifikasi",    key: "productSpec",         width: 20 },
            { header: "Operator",       key: "operator",            width: 16 },
            { header: "Mach. ID",       key: "machineId",           width: 12 },
            { header: "Ster. Temp",     key: "sterTemp",            width: 12 },
            { header: "Run Begin",      key: "runBegin",            width: 22 },
            { header: "Run Finish",     key: "runFinish",           width: 22 },
            { header: "Total (min)",    key: "totalTimeMin",        width: 12 },
            { header: "Heat Time",      key: "heatTimeMin",         width: 12 },
            { header: "Ster Time",      key: "sterTimeMin",         width: 12 },
            { header: "Cool Time",      key: "coolTimeMin",         width: 12 },
            { header: "F0 Min",         key: "foMin",               width: 10 },
            { header: "FO1",            key: "fo1",                 width: 9  },
            { header: "FO2",            key: "fo2",                 width: 9  },
            { header: "FO3",            key: "fo3",                 width: 9  },
            { header: "FO4",            key: "fo4",                 width: 9  },
            { header: "FO5",            key: "fo5",                 width: 9  },
            { header: "FO6",            key: "fo6",                 width: 9  },
            { header: "FOH",            key: "foh",                 width: 9  },
            { header: "FOM",            key: "fom",                 width: 9  },
            { header: "FOL",            key: "fol",                 width: 9  },
            { header: "Hasil",          key: "sterilizationResult", width: 10 },
            { header: "Status",         key: "status",              width: 12 },
        ];

        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        ws.views = [{ state: "frozen", ySplit: 1 }];

        rows.forEach((r) => {
            ws.addRow({
                batchNo:             r.batch_no        ?? "",
                loadingNo:           r.loading_no      ?? "",
                productName:         r.product_name    ?? "",
                productSpec:         r.product_spec    ?? "",
                operator:            r.operator        ?? "",
                machineId:           r.machine_id      ?? "",
                sterTemp:            fmtNum(r.ster_temp),
                runBegin:            toWIB(r.run_begin),
                runFinish:           toWIB(r.run_finish),
                totalTimeMin:        fmtNum(r.total_time_min),
                heatTimeMin:         fmtNum(r.heat_time_min),
                sterTimeMin:         fmtNum(r.ster_time_min),
                coolTimeMin:         fmtNum(r.cool_time_min),
                foMin:               fmtNum(r.fo_min),
                fo1:                 fmtNum(r.fo1),
                fo2:                 fmtNum(r.fo2),
                fo3:                 fmtNum(r.fo3),
                fo4:                 fmtNum(r.fo4),
                fo5:                 fmtNum(r.fo5),
                fo6:                 fmtNum(r.fo6),
                foh:                 fmtNum(r.foh),
                fom:                 fmtNum(r.fom),
                fol:                 fmtNum(r.fol),
                sterilizationResult: r.sterilization_result ?? "",
                status:              r.status          ?? "",
            });
        });

        const buf      = await wb.xlsx.writeBuffer();
        const from     = q.from || "semua";
        const to       = q.to   || "semua";
        const filename = `batch-records_${from}_${to}.xlsx`;

        return new Response(buf, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("[GET /api/batch-records/export]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
