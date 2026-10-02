import pool from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/dateRange";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search  = searchParams.get("search")  ?? "";
        const status  = searchParams.get("status")  ?? "";
        const from    = searchParams.get("from")    ?? "";
        const to      = searchParams.get("to")      ?? "";
        const limit   = Math.min(parseInt(searchParams.get("limit")  ?? "20", 10), 100);
        const offset  = Math.max(parseInt(searchParams.get("offset") ?? "0",  10), 0);

        // ── Bangun kondisi WHERE secara dinamis ──────────────────────────
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

        // Filter rentang tanggal terhadap COALESCE(run_begin, created_at) (WIB)
        const dateFilter = buildDateRangeFilter(
            from, to,
            "COALESCE(run_begin, created_at)",
            values.length + 1
        );
        if (dateFilter.error) {
            return Response.json({ ok: false, error: dateFilter.error }, { status: 400 });
        }
        values.push(...dateFilter.values);
        conditions.push(...dateFilter.conditions);

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // ── Query COUNT total (tanpa limit/offset) ───────────────────────
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM batch_records ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // ── Query data dengan limit/offset ───────────────────────────────
        const dataValues = [...values, limit, offset];
        const dataResult = await pool.query(
            `SELECT
                batch_no,
                operator,
                product_name,
                machine_id,
                ster_temp,
                run_begin,
                run_finish,
                total_time_min,
                status,
                fo_min,
                sterilization_result
             FROM batch_records
             ${whereClause}
             ORDER BY COALESCE(run_begin, created_at) DESC
             LIMIT $${dataValues.length - 1}
             OFFSET $${dataValues.length}`,
            dataValues
        );

        const data = dataResult.rows.map((row) => ({
            batchNo:              row.batch_no,
            operator:             row.operator,
            productName:          row.product_name,
            machineId:            row.machine_id,
            sterTemp:             row.ster_temp !== null ? parseFloat(row.ster_temp) : null,
            runBegin:             row.run_begin,
            runFinish:            row.run_finish,
            totalTimeMin:         row.total_time_min !== null ? parseFloat(row.total_time_min) : null,
            status:               row.status,
            foMin:                row.fo_min !== null ? parseFloat(row.fo_min) : null,
            sterilizationResult:  row.sterilization_result ?? null,
        }));

        return Response.json({ data, total });
    } catch (error) {
        console.error("[GET /api/batch-records]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
