import pool from "@/lib/db";
import { ALARM_FROM, ALARM_ORDER, buildAlarmFilter } from "@/lib/alarmQuery";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        // limit/offset dibersihkan: nilai non-angka tidak boleh menjadi NaN ke query.
        const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
        const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

        const q = buildAlarmFilter(searchParams);
        if (q.error) return Response.json({ ok: false, error: q.error }, { status: 400 });

        const countResult = await pool.query(
            `SELECT COUNT(*) ${ALARM_FROM} ${q.where}`,
            q.values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Urutan: baris alarm (punya alarm_date) di atas, event tanpa alarm_date di bawah;
        // pemulihan satu episode berbagi alarm_date dengan alarmnya dan tampil tepat di atasnya.
        const dataValues = [...q.values, limit, offset];
        const dataResult = await pool.query(
            `SELECT id, alarm_date, event_date, variable_name, alarm_type, alarm_value,
                    recovery_value, limit_value, event_type, operator, description
             ${ALARM_FROM}
             ${q.where}
             ${ALARM_ORDER}
             LIMIT  $${dataValues.length - 1}
             OFFSET $${dataValues.length}`,
            dataValues
        );

        const data = dataResult.rows.map((row) => ({
            id: row.id,
            alarmDate: row.alarm_date,
            eventDate: row.event_date,
            variableName: row.variable_name,
            alarmType: row.alarm_type,
            alarmValue: row.alarm_value,
            recoveryValue: row.recovery_value,
            limitValue: row.limit_value,
            eventType: row.event_type,
            operator: row.operator,
            description: row.description,
        }));

        return Response.json({ data, total });
    } catch (error) {
        console.error("[GET /api/alarms]", error);
        // Detail error hanya di log server; jangan dikirim ke klien.
        return Response.json({ ok: false, error: "Gagal memuat data alarm" }, { status: 500 });
    }
}