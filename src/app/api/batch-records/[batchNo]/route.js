import pool from "@/lib/db";
import { snapshotNumber } from "@/lib/recipeSnapshot";

export async function GET(request, { params }) {
    try {
        // Next.js 15: params adalah Promise, wajib di-await dulu
        const { batchNo: rawNo } = await params;
        let batchNo;
        try {
            batchNo = decodeURIComponent(rawNo);
        } catch {
            // URL rusak (mis. "%" tanpa kode valid) — bukan salah server
            return Response.json({ ok: false, error: "Nomor batch pada URL tidak valid" }, { status: 400 });
        }

        // ── Ambil data batch + fo_val_setting dari resep (hanya fallback batch lama) ──
        // Sumber utama = b.recipe_snapshot (item 6). Kolom live_fo_val_setting hanya dipakai
        // bila batch tidak punya snapshot (batch sebelum item 6).
        const batchResult = await pool.query(
            `SELECT b.*, r.fo_val_setting AS live_fo_val_setting
             FROM batch_records b
             LEFT JOIN recipes r ON b.recipe_id = r.id
             WHERE b.batch_no = $1`,
            [batchNo]
        );

        if (batchResult.rows.length === 0) {
            return Response.json(
                { ok: false, error: `Batch "${batchNo}" tidak ditemukan` },
                { status: 404 }
            );
        }

        const row = batchResult.rows[0];
        // Snapshot resep saat START. NULL = batch lama → fallback ke resep "live" (bisa sudah berubah).
        const recipeSnapshot = row.recipe_snapshot ?? null;
        const recipeSource = recipeSnapshot ? "snapshot" : "live";
        const batch = {
            id: row.id,
            batchNo: row.batch_no,
            loadingNo: row.loading_no,
            operator: row.operator,
            machineId: row.machine_id,
            recipeId: row.recipe_id,
            productName: row.product_name,
            productSpec: row.product_spec,
            ctrlType: row.ctrl_type,
            sterTemp: row.ster_temp !== null ? parseFloat(row.ster_temp) : null,
            coolTemp: row.cool_temp !== null ? parseFloat(row.cool_temp) : null,
            heatBegin: row.heat_begin,
            sterBegin: row.ster_begin,
            coolBegin: row.cool_begin,
            runBegin: row.run_begin,
            runFinish: row.run_finish,
            heatTimeMin: row.heat_time_min !== null ? parseFloat(row.heat_time_min) : null,
            sterTimeMin: row.ster_time_min !== null ? parseFloat(row.ster_time_min) : null,
            coolTimeMin: row.cool_time_min !== null ? parseFloat(row.cool_time_min) : null,
            totalTimeMin: row.total_time_min !== null ? parseFloat(row.total_time_min) : null,
            fo1: row.fo1 !== null ? parseFloat(row.fo1) : null,
            fo2: row.fo2 !== null ? parseFloat(row.fo2) : null,
            fo3: row.fo3 !== null ? parseFloat(row.fo3) : null,
            fo4: row.fo4 !== null ? parseFloat(row.fo4) : null,
            fo5: row.fo5 !== null ? parseFloat(row.fo5) : null,
            fo6: row.fo6 !== null ? parseFloat(row.fo6) : null,
            foh: row.foh !== null ? parseFloat(row.foh) : null,
            fom: row.fom !== null ? parseFloat(row.fom) : null,
            fol: row.fol !== null ? parseFloat(row.fol) : null,
            foMin: row.fo_min !== null ? parseFloat(row.fo_min) : null,
            // foValSetting hanya angka pembanding dari QA (opsional), bukan dasar vonis.
            // Dibaca dari snapshot resep batch; batch lama (tanpa snapshot) memakai resep live.
            f0Meta: row.f0_meta ?? null, // parameter hitung F0 + catatan gap (null untuk batch lama)
            foValSetting: recipeSnapshot
                ? snapshotNumber(recipeSnapshot, "foValSetting")
                : (row.live_fo_val_setting !== null && row.live_fo_val_setting !== undefined
                    ? parseFloat(row.live_fo_val_setting)
                    : null),
            recipeSnapshot,
            recipeSource, // "snapshot" | "live" (live = batch sebelum item 6, nilai bisa sudah berubah)
            status: row.status,
            createdAt: row.created_at,
        };

        // ── Ambil data trend (mungkin kosong — tangani dengan array []) ──
        let trend = [];
        try {
            const trendResult = await pool.query(
                `SELECT id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg, cond, phase_code
                 FROM batch_trend
                 WHERE batch_id = $1
                 ORDER BY ts ASC`,
                [row.id]
            );
            trend = trendResult.rows.map((t) => ({
                id: t.id,
                ts: t.ts,
                t1: t.t1 !== null ? parseFloat(t.t1) : null,
                t2: t.t2 !== null ? parseFloat(t.t2) : null,
                t3: t.t3 !== null ? parseFloat(t.t3) : null,
                t4: t.t4 !== null ? parseFloat(t.t4) : null,
                t5: t.t5 !== null ? parseFloat(t.t5) : null,
                t6: t.t6 !== null ? parseFloat(t.t6) : null,
                p: t.p !== null ? parseFloat(t.p) : null,
                th: t.th !== null ? parseFloat(t.th) : null,
                tm: t.tm !== null ? parseFloat(t.tm) : null,
                tl: t.tl !== null ? parseFloat(t.tl) : null,
                avg: t.avg !== null ? parseFloat(t.avg) : null,
                cond: t.cond !== null ? parseFloat(t.cond) : null, // konduktivitas (tag L/VW122)
                phaseCode: t.phase_code !== null ? parseInt(t.phase_code, 10) : null,
            }));
        } catch (trendError) {
            // Tabel batch_trend mungkin belum ada — kembalikan array kosong
            console.warn("[batch-records/[batchNo]] Trend query warning:", trendError.message);
            trend = [];
        }

        return Response.json({ batch, trend });
    } catch (error) {
        console.error("[GET /api/batch-records/[batchNo]]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}