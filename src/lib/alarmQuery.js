/**
 * src/lib/alarmQuery.js — Pembangun filter alarm_log, dipakai bersama oleh
 * /api/alarms (tabel) dan /api/alarms/print-data (cetak) supaya keduanya selalu sama.
 *
 * Filter tanggal memakai kolom turunan log_time = COALESCE(alarm_date, event_date):
 *  - baris alarm/pulih  -> waktu mulai alarm (pasangan satu episode tetap sekelompok)
 *  - baris event lain   -> waktu kejadian
 * log_time adalah kolom polos di subquery, jadi aman diberikan ke buildDateRangeFilter.
 */
import { buildDateRangeFilter } from "@/lib/dateRange";

export const ALARM_FROM =
    "FROM (SELECT *, COALESCE(alarm_date, event_date) AS log_time FROM alarm_log) t";

export const ALARM_ORDER = "ORDER BY alarm_date DESC NULLS LAST, created_at DESC, id DESC";

export function buildAlarmFilter(searchParams) {
    const search    = searchParams.get("search")    ?? "";
    const eventType = searchParams.get("eventType") ?? "";
    const from      = searchParams.get("from")      ?? "";
    const to        = searchParams.get("to")        ?? "";

    const conditions = [];
    const values = [];

    if (search.trim()) {
        values.push(`%${search.trim()}%`);
        conditions.push(
            `(variable_name ILIKE $${values.length}
              OR operator    ILIKE $${values.length}
              OR alarm_type  ILIKE $${values.length}
              OR description ILIKE $${values.length})`
        );
    }
    if (eventType.trim()) {
        values.push(eventType.trim());
        conditions.push(`event_type = $${values.length}`);
    }

    const df = buildDateRangeFilter(from, to, "log_time", values.length + 1);
    if (df.error) return { error: df.error };
    values.push(...df.values);
    conditions.push(...df.conditions);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { where, values, from, to, error: null };
}
