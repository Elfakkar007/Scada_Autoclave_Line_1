/**
 * GET /api/alarms/print-data — seluruh baris yang cocok dengan filter, untuk halaman cetak.
 * Lokasi file: src/app/api/alarms/print-data/route.js
 * Perlindungan login: lewat middleware (sama seperti /api/alarms).
 */
import pool from "@/lib/db";
import { ALARM_FROM, ALARM_ORDER, buildAlarmFilter } from "@/lib/alarmQuery";

const MAX_ROWS = 50_000;

// Format waktu WIB, sama dengan route export audit log
function toWIB(dateVal) {
    if (!dateVal) return "";
    return new Date(dateVal).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const q = buildAlarmFilter(searchParams);
        if (q.error) return Response.json({ ok: false, error: q.error }, { status: 400 });

        const countRes = await pool.query(`SELECT COUNT(*) ${ALARM_FROM} ${q.where}`, q.values);
        const total = parseInt(countRes.rows[0].count, 10);
        if (total > MAX_ROWS) {
            return Response.json(
                { ok: false, error: `Terlalu banyak data (${total} baris). Maks ${MAX_ROWS}. Persempit rentang tanggal.` },
                { status: 413 }
            );
        }

        const dataRes = await pool.query(
            `SELECT alarm_date, event_date, variable_name, alarm_type, alarm_value,
                    recovery_value, limit_value, event_type, operator, description
             ${ALARM_FROM}
             ${q.where}
             ${ALARM_ORDER}`,
            q.values
        );

        const rows = dataRes.rows.map((r) => ({
            alarmDate: toWIB(r.alarm_date),
            eventDate: toWIB(r.event_date),
            variableName: r.variable_name ?? "",
            alarmType: r.alarm_type ?? "",
            alarmValue: r.alarm_value ?? "",
            recoveryValue: r.recovery_value ?? "",
            limitValue: r.limit_value ?? "",
            eventType: r.event_type ?? "",
            operator: r.operator ?? "",
            description: r.description ?? "",
        }));
        return Response.json({ rows, total: rows.length });
    } catch (error) {
        console.error("[GET /api/alarms/print-data]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}
