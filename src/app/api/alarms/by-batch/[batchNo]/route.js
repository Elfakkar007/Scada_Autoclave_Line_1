import pool from "@/lib/db";

/**
 * GET /api/alarms/by-batch/[batchNo]
 * Mengembalikan semua baris alarm_log yang terjadi selama batch berjalan.
 * Filter utama: batch_no = :batchNo. Mencakup semua event_type (alarm_active,
 * alarm_recovery, monitor_gap, dll.) agar catatan di halaman cetak lengkap.
 * Diurutkan berdasarkan waktu kejadian (asc) supaya mudah dibaca kronologis.
 */
export async function GET(request, { params }) {
    try {
        const { batchNo: rawNo } = await params;
        let batchNo;
        try {
            batchNo = decodeURIComponent(rawNo);
        } catch {
            return Response.json({ ok: false, error: "Nomor batch pada URL tidak valid" }, { status: 400 });
        }

        const result = await pool.query(
            `SELECT id,
                    alarm_date,
                    event_date,
                    variable_name,
                    alarm_type,
                    alarm_value,
                    recovery_value,
                    limit_value,
                    event_type,
                    operator,
                    description,
                    phase_code,
                    episode_id
             FROM alarm_log
             WHERE batch_no = $1
             ORDER BY COALESCE(alarm_date, event_date) ASC, created_at ASC`,
            [batchNo]
        );

        const alarms = result.rows.map((row) => ({
            id: row.id,
            alarmDate: row.alarm_date,
            eventDate: row.event_date,
            variableName: row.variable_name,
            alarmType: row.alarm_type,
            alarmValue: row.alarm_value !== null ? parseFloat(row.alarm_value) : null,
            recoveryValue: row.recovery_value !== null ? parseFloat(row.recovery_value) : null,
            limitValue: row.limit_value !== null ? parseFloat(row.limit_value) : null,
            eventType: row.event_type,
            operator: row.operator,
            description: row.description,
            phaseCode: row.phase_code,
            episodeId: row.episode_id,
        }));

        return Response.json({ ok: true, alarms });
    } catch (error) {
        console.error("[GET /api/alarms/by-batch/[batchNo]]", error);
        return Response.json({ ok: false, error: "Gagal memuat data alarm batch" }, { status: 500 });
    }
}
