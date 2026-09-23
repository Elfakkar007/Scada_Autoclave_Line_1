import { getDummyStatus } from "@/lib/dummyData";
import pool from "@/lib/db";

export async function GET() {
    // Data sensor dummy (T1-T6, TH/TM/TL, tekanan) — tetap dipertahankan
    // sampai koneksi ke KEPServerEX IoT Gateway sungguhan tersedia
    const sensorData = getDummyStatus();

    try {
        // Cari batch yang sedang running, JOIN ke recipes untuk ambil formula_no
        const result = await pool.query(
            `SELECT
                br.batch_no,
                br.operator,
                br.product_name,
                br.machine_id,
                br.run_begin,
                r.formula_no
             FROM batch_records br
             LEFT JOIN recipes r ON br.recipe_id = r.id
             WHERE br.status = 'running'
             ORDER BY br.run_begin DESC
             LIMIT 1`
        );

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return Response.json({
                ...sensorData,
                running: true,
                batchNo:     row.batch_no,
                operator:    row.operator,
                productName: row.product_name,
                machineId:   row.machine_id,
                formulaNo:   row.formula_no,
                runBegin:    row.run_begin,
            });
        }

        // Tidak ada batch running
        return Response.json({
            ...sensorData,
            running:     false,
            batchNo:     null,
            operator:    null,
            productName: null,
            machineId:   null,
            formulaNo:   null,
            runBegin:    null,
        });
    } catch (error) {
        // Kalau DB error, tetap kembalikan data sensor dummy daripada error total
        console.error("[GET /api/status] DB error:", error);
        return Response.json({
            ...sensorData,
            running: false,
            dbError: error.message,
        });
    }
}