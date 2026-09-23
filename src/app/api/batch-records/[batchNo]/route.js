import pool from "@/lib/db";

export async function GET(request, { params }) {
    try {
        // Next.js 15: params adalah Promise, wajib di-await dulu
        const { batchNo: rawNo } = await params;
        const batchNo = decodeURIComponent(rawNo);

        // ── Ambil data batch ──────────────────────────────────────────────
        const batchResult = await pool.query(
            "SELECT * FROM batch_records WHERE batch_no = $1",
            [batchNo]
        );

        if (batchResult.rows.length === 0) {
            return Response.json(
                { ok: false, error: `Batch "${batchNo}" tidak ditemukan` },
                { status: 404 }
            );
        }

        const row = batchResult.rows[0];
        const batch = {
            id:           row.id,
            batchNo:      row.batch_no,
            loadingNo:    row.loading_no,
            operator:     row.operator,
            machineId:    row.machine_id,
            recipeId:     row.recipe_id,
            productName:  row.product_name,
            productSpec:  row.product_spec,
            ctrlType:     row.ctrl_type,
            sterTemp:     row.ster_temp     !== null ? parseFloat(row.ster_temp)      : null,
            coolTemp:     row.cool_temp     !== null ? parseFloat(row.cool_temp)      : null,
            heatBegin:    row.heat_begin,
            sterBegin:    row.ster_begin,
            coolBegin:    row.cool_begin,
            runBegin:     row.run_begin,
            runFinish:    row.run_finish,
            heatTimeMin:  row.heat_time_min  !== null ? parseFloat(row.heat_time_min)  : null,
            sterTimeMin:  row.ster_time_min  !== null ? parseFloat(row.ster_time_min)  : null,
            coolTimeMin:  row.cool_time_min  !== null ? parseFloat(row.cool_time_min)  : null,
            totalTimeMin: row.total_time_min !== null ? parseFloat(row.total_time_min) : null,
            fo1:  row.fo1  !== null ? parseFloat(row.fo1)  : null,
            fo2:  row.fo2  !== null ? parseFloat(row.fo2)  : null,
            fo3:  row.fo3  !== null ? parseFloat(row.fo3)  : null,
            fo4:  row.fo4  !== null ? parseFloat(row.fo4)  : null,
            fo5:  row.fo5  !== null ? parseFloat(row.fo5)  : null,
            fo6:  row.fo6  !== null ? parseFloat(row.fo6)  : null,
            foh:  row.foh  !== null ? parseFloat(row.foh)  : null,
            fom:  row.fom  !== null ? parseFloat(row.fom)  : null,
            fol:  row.fol  !== null ? parseFloat(row.fol)  : null,
            status:    row.status,
            createdAt: row.created_at,
        };

        // ── Ambil data trend (mungkin kosong — tangani dengan array []) ──
        let trend = [];
        try {
            const trendResult = await pool.query(
                `SELECT id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg
                 FROM batch_trend
                 WHERE batch_id = $1
                 ORDER BY ts ASC`,
                [row.id]
            );
            trend = trendResult.rows.map((t) => ({
                id:  t.id,
                ts:  t.ts,
                t1:  t.t1  !== null ? parseFloat(t.t1)  : null,
                t2:  t.t2  !== null ? parseFloat(t.t2)  : null,
                t3:  t.t3  !== null ? parseFloat(t.t3)  : null,
                t4:  t.t4  !== null ? parseFloat(t.t4)  : null,
                t5:  t.t5  !== null ? parseFloat(t.t5)  : null,
                t6:  t.t6  !== null ? parseFloat(t.t6)  : null,
                p:   t.p   !== null ? parseFloat(t.p)   : null,
                th:  t.th  !== null ? parseFloat(t.th)  : null,
                tm:  t.tm  !== null ? parseFloat(t.tm)  : null,
                tl:  t.tl  !== null ? parseFloat(t.tl)  : null,
                avg: t.avg !== null ? parseFloat(t.avg) : null,
            }));
        } catch (trendError) {
            // Tabel batch_trend mungkin belum ada — kembalikan array kosong
            console.warn("[batch-records/[batchNo]] Trend query warning:", trendError.message);
            trend = [];
        }

        return Response.json({ batch, trend });
    } catch (error) {
        console.error("[GET /api/batch-records/[batchNo]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
