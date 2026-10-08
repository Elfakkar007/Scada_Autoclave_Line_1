/**
 * src/lib/alarmEventLabels.js — Label tampilan untuk event_type di alarm_log (data murni).
 * Nilai mentah di DB tetap dipakai untuk filter; label hanya untuk layar dan cetakan.
 */
export const EVENT_LABELS = {
    alarm_active: "Alarm",
    alarm_recovery: "Pulih",
    monitor_gap: "Pemantauan terputus",
    communication_abnormal: "Komunikasi putus",
    communication_normal: "Komunikasi pulih",
    server_start: "Server start",
};

export const eventLabel = (v) => EVENT_LABELS[v] ?? v;
