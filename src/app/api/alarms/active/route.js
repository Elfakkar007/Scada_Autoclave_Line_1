/**
 * GET /api/alarms/active — alarm yang sedang aktif (episode alarm_active tanpa alarm_recovery)
 * + status hidup pemantau alarm. Sumber kebenaran = DB (alarm_log), bukan memori proses,
 * karena route handler Next.js dan alarmMonitor (dimuat server.js) adalah instance modul berbeda.
 *
 * Lokasi file: src/app/api/alarms/active/route.js
 * Perlindungan login: sama seperti route alarms lain (lewat proxy).
 */
import pool from "@/lib/db";
import { ALARM_CATALOG } from "@/lib/alarmCatalog";

const MONITOR_STALE_SEC = 30; // heartbeat tiap 10 dtk; lewat 30 dtk dianggap pemantau mati

export async function GET() {
    try {
        const [openRes, hbRes] = await Promise.all([
            pool.query(
                `SELECT a.episode_id, a.alarm_key, a.variable_name, a.alarm_type, a.alarm_value,
                        a.limit_value, a.alarm_date, a.batch_no, a.phase_code
                 FROM alarm_log a
                 WHERE a.event_type = 'alarm_active' AND a.episode_id IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM alarm_log r
                                   WHERE r.episode_id = a.episode_id AND r.event_type = 'alarm_recovery')
                 ORDER BY a.alarm_date`
            ),
            pool.query(
                `SELECT EXTRACT(EPOCH FROM (now() - beat_at)) AS age FROM monitor_heartbeat WHERE id = 1`
            ),
        ]);

        const age = hbRes.rows[0] ? Number(hbRes.rows[0].age) : null;
        const active = openRes.rows.map((row) => {
            const cat = ALARM_CATALOG[row.alarm_key];
            return {
                episodeId: row.episode_id,
                key: row.alarm_key,
                tag: row.variable_name,
                title: cat?.title ?? row.alarm_type ?? row.alarm_key,
                cause: cat?.cause ?? null,
                action: cat?.action ?? null,
                textConfirmed: cat?.confirmed === true,
                alarmValue: row.alarm_value,
                limitValue: row.limit_value,
                since: row.alarm_date,
                batchNo: row.batch_no,
                phaseCode: row.phase_code,
            };
        });

        return Response.json({
            ok: true,
            monitorAlive: age !== null && age <= MONITOR_STALE_SEC,
            heartbeatAgeSec: age === null ? null : Math.round(age),
            active,
        });
    } catch (error) {
        console.error("[GET /api/alarms/active]", error);
        return Response.json({ ok: false, error: "Gagal memuat alarm aktif" }, { status: 500 });
    }
}