import pool from "@/lib/db";

// GET /api/alarms/event-types
// Return array of distinct event_type strings untuk isi dropdown filter.
// Kalau tabel kosong atau semua event_type null, return [].
export async function GET() {
    try {
        const result = await pool.query(
            `SELECT DISTINCT event_type
             FROM alarm_log
             WHERE event_type IS NOT NULL
             ORDER BY event_type`
        );
        const types = result.rows.map((row) => row.event_type);
        return Response.json(types);
    } catch (error) {
        console.error("[GET /api/alarms/event-types]", error);
        // Graceful fallback: kembalikan array kosong agar dropdown tetap tampil
        return Response.json([]);
    }
}
