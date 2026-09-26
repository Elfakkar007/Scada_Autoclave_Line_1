/**
 * /api/status — versi REAL (baca PLC via KEPServerEX IoT Gateway)
 *
 * Logic pembacaan PLC (TAG_MAP, scaling, phase detection) sudah dipindah ke
 * @/lib/plc supaya bisa dipakai juga oleh trendRecorder (background process
 * di custom server). File ini hanya bertugas:
 *   1. Panggil readPlcSnapshot() dari @/lib/plc
 *   2. Ambil data batch aktif dari DB
 *   3. Gabungkan & kembalikan sebagai JSON response
 *
 * Perilaku endpoint dari sisi konsumen (frontend) TIDAK BERUBAH.
 */

import { readPlcSnapshot } from "@/lib/plc";
import pool from "@/lib/db";

export async function GET() {
    // Baca semua data PLC (sudah include scaling, phase, dummy fallback jika PLC mati)
    const { plcOk, plcError, ...sensorData } = await readPlcSnapshot();

    try {
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
                plcOk, plcError,
                running: true,
                batchNo: row.batch_no,
                operator: row.operator,
                productName: row.product_name,
                machineId: row.machine_id,
                formulaNo: row.formula_no,
                runBegin: row.run_begin,
            });
        }

        return Response.json({
            ...sensorData,
            plcOk, plcError,
            running: false,
            batchNo: null, operator: null, productName: null,
            machineId: null, formulaNo: null, runBegin: null,
        });
    } catch (error) {
        console.error("[GET /api/status] DB error:", error);
        return Response.json({
            ...sensorData,
            plcOk, plcError,
            running: false,
            dbError: error.message,
        });
    }
}