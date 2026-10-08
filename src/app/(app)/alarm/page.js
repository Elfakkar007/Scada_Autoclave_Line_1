"use client";

import { useState, useEffect, useCallback } from "react";
import { eventLabel } from "@/lib/alarmEventLabels";

const LIMIT = 20;

// ── Helper tanggal WIB (sama dengan halaman Audit Log) ───────────────────────
function todayWIB() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}
function nDaysAgoWIB(n) {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

// ── Helper: format tanggal ────────────────────────────────────────────────────
function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

// ── Event type: label ramah + warna (alarm merah, pulih hijau, seperti SCADA lama) ──
// Nilai mentah di DB tetap dipakai untuk filter; label hanya untuk tampilan.
const EVENT_META = {
    alarm_active: { badge: "bg-red-50 border-scada-stop text-scada-stop font-semibold", row: "bg-red-50/60" },
    alarm_recovery: { badge: "bg-green-50 border-scada-run text-scada-run font-semibold", row: "bg-green-50/60" },
    monitor_gap: { badge: "bg-amber-50 border-scada-steam text-scada-steam font-semibold", row: "bg-amber-50/60" },
    communication_abnormal: { badge: "bg-amber-50 border-scada-steam text-scada-steam font-semibold", row: "bg-amber-50/60" },
    communication_normal: { badge: "bg-green-50 border-scada-run text-scada-run font-semibold", row: "" },
    server_start: { badge: "bg-scada-bg border-scada-idle text-scada-ink", row: "" },
};

// ── Badge Event Type ──────────────────────────────────────────────────────────
function EventTypeBadge({ value }) {
    if (!value) return <span className="text-scada-muted">-</span>;
    const meta = EVENT_META[value];
    return (
        <span
            title={value}
            className={`inline-block px-2 py-0.5 border rounded text-xs ${meta ? meta.badge : "bg-scada-bg border-scada-idle text-scada-ink font-mono"}`}
        >
            {meta ? eventLabel(value) : value}
        </span>
    );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilter }) {
    return (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
            <div className="text-5xl opacity-20 select-none">🔕</div>
            <p className="text-scada-ink font-semibold text-base">
                {hasFilter ? "Tidak ada alarm yang sesuai filter." : "Belum ada data alarm."}
            </p>
            {!hasFilter && (
                <p className="text-scada-muted text-sm max-w-sm">
                    Data akan muncul otomatis setelah sistem terhubung ke PLC.
                </p>
            )}
        </div>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function AlarmPage() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [eventType, setEventType] = useState("");
    const [eventTypes, setEventTypes] = useState([]);   // untuk dropdown
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState(null);

    // ── Fetch distinct event types untuk dropdown ────────────────────────
    useEffect(() => {
        fetch("/api/alarms/event-types")
            .then((r) => r.json())
            .then((data) => setEventTypes(Array.isArray(data) ? data : []))
            .catch(() => setEventTypes([]));
    }, []);

    // ── Fetch data alarm ─────────────────────────────────────────────────
    const fetchData = useCallback(async (searchVal, eventTypeVal, from, to, offsetVal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                limit: String(LIMIT),
                offset: String(offsetVal),
            });
            if (searchVal.trim()) params.set("search", searchVal.trim());
            if (eventTypeVal.trim()) params.set("eventType", eventTypeVal.trim());
            if (from.trim()) params.set("from", from.trim());
            if (to.trim()) params.set("to", to.trim());

            const res = await fetch(`/api/alarms?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Gagal memuat data alarm");

            setRows(json.data ?? []);
            setTotal(json.total ?? 0);
        } catch (e) {
            setError(e.message);
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce 400ms untuk search
    useEffect(() => {
        const t = setTimeout(() => {
            setOffset(0);
            fetchData(search, eventType, fromDate, toDate, 0);
        }, 400);
        return () => clearTimeout(t);
    }, [search, eventType, fromDate, toDate, fetchData]);

    // Fetch ulang saat offset berubah (pagination)
    useEffect(() => {
        fetchData(search, eventType, fromDate, toDate, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    const totalPages = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;
    const hasPrev = offset > 0;
    const hasNext = offset + LIMIT < total;
    const hasFilter = search.trim() !== "" || eventType !== "" || fromDate !== "" || toDate !== "";

    // Buka halaman cetak di tab baru dengan filter yang sedang aktif (sama dengan Audit Log).
    function handlePrint() {
        const p = new URLSearchParams();
        if (search.trim()) p.set("search", search.trim());
        if (eventType.trim()) p.set("eventType", eventType.trim());
        if (fromDate.trim()) p.set("from", fromDate.trim());
        if (toDate.trim()) p.set("to", toDate.trim());
        // Tanpa "noopener": halaman cetak (satu origin) perlu bisa menutup dirinya sendiri.
        window.open(`/print/alarm?${p.toString()}`, "_blank");
    }

    const thClass = "px-3 py-3 text-left text-xs text-scada-muted uppercase tracking-wider font-semibold whitespace-nowrap";
    const tdClass = "px-3 py-3 text-sm text-scada-ink";

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Alarm Message</h1>
                    <p className="text-sm text-scada-muted mt-1">
                        Log alarm &amp; event mesin sterilizer
                    </p>
                </div>
                <button
                    onClick={handlePrint}
                    disabled={loading}
                    className="px-3 py-1.5 bg-scada-ink hover:bg-scada-muted disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
                >
                    🖨 Cetak / PDF
                </button>
            </div>

            {/* ── Filter tanggal (terhadap waktu alarm/event, WIB) ── */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <label className="text-xs text-scada-muted font-semibold">Dari:</label>
                <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setOffset(0); }}
                    className="bg-white border border-scada-idle rounded px-2 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water"
                />
                <label className="text-xs text-scada-muted font-semibold">Sampai:</label>
                <input
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setOffset(0); }}
                    className="bg-white border border-scada-idle rounded px-2 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water"
                />
                <button onClick={() => { setFromDate(todayWIB()); setToDate(todayWIB()); setOffset(0); }} className="px-2 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg rounded text-xs text-scada-ink transition-colors">Hari ini</button>
                <button onClick={() => { setFromDate(nDaysAgoWIB(7)); setToDate(todayWIB()); setOffset(0); }} className="px-2 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg rounded text-xs text-scada-ink transition-colors">7 hari</button>
                <button onClick={() => { setFromDate(nDaysAgoWIB(30)); setToDate(todayWIB()); setOffset(0); }} className="px-2 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg rounded text-xs text-scada-ink transition-colors">30 hari</button>
                <button onClick={() => { setFromDate(""); setToDate(""); setOffset(0); }} className="px-2 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg rounded text-xs text-scada-muted transition-colors">Reset</button>
            </div>

            {/* ── Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                    type="text"
                    placeholder="Cari Variable Name / Operator / Alarm Type / Keterangan…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink placeholder-scada-muted focus:outline-none focus:border-scada-water transition-colors"
                />
                <select
                    value={eventType}
                    onChange={(e) => { setEventType(e.target.value); setOffset(0); }}
                    className="bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors cursor-pointer"
                >
                    <option value="">Semua Event Type</option>
                    {eventTypes.map((et) => (
                        <option key={et} value={et}>{eventLabel(et)}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => fetchData(search, eventType, fromDate, toDate, offset)}
                    disabled={loading}
                    className="bg-white border border-scada-idle hover:bg-scada-bg disabled:opacity-40 rounded px-4 py-2 text-sm text-scada-ink transition-colors"
                >
                    Muat ulang
                </button>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-scada-stop text-scada-stop rounded text-sm">
                    {error}
                </div>
            )}

            {/* ── Tabel ── */}
            <div className="bg-scada-card border border-scada-rule shadow-sm rounded-lg overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-scada-muted text-sm">Memuat data…</div>
                ) : rows.length === 0 ? (
                    <EmptyState hasFilter={hasFilter} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-scada-bg border-b border-scada-rule">
                                <tr>
                                    <th className={thClass}>Alarm Date</th>
                                    <th className={thClass}>Event Date</th>
                                    <th className={thClass}>Variable Name</th>
                                    <th className={thClass}>Alarm Type</th>
                                    <th className={thClass}>Alarm Value</th>
                                    <th className={thClass}>Recovery Value</th>
                                    <th className={thClass}>Limit Value</th>
                                    <th className={thClass}>Event Type</th>
                                    <th className={thClass}>Operator</th>
                                    <th className={thClass}>Keterangan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-scada-rule">
                                {rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={`transition-colors ${EVENT_META[row.eventType]?.row || "hover:bg-scada-bg"}`}
                                    >
                                        <td className={tdClass + " whitespace-nowrap font-mono text-xs"}>
                                            {fmt(row.alarmDate)}
                                        </td>
                                        <td className={tdClass + " whitespace-nowrap font-mono text-xs"}>
                                            {fmt(row.eventDate)}
                                        </td>
                                        <td className={tdClass}>{row.variableName ?? "-"}</td>
                                        <td className={tdClass}>{row.alarmType ?? "-"}</td>
                                        <td className={tdClass + " font-mono"}>
                                            {row.alarmValue ?? "-"}
                                        </td>
                                        <td className={tdClass + " font-mono"}>
                                            {row.recoveryValue ?? "-"}
                                        </td>
                                        <td className={tdClass + " font-mono"}>
                                            {row.limitValue ?? "-"}
                                        </td>
                                        <td className={tdClass}>
                                            <EventTypeBadge value={row.eventType} />
                                        </td>
                                        <td className={tdClass}>{row.operator ?? "-"}</td>
                                        <td className={tdClass + " text-xs text-scada-muted max-w-sm"}>
                                            {row.description ?? "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Pagination (sembunyikan jika total <= limit) ── */}
            {total > LIMIT && (
                <div className="mt-4 flex items-center justify-between text-sm text-scada-muted">
                    <span>
                        Menampilkan {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total} record
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setOffset((p) => Math.max(p - LIMIT, 0))}
                            disabled={!hasPrev || loading}
                            className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg disabled:opacity-40 disabled:cursor-not-allowed rounded text-scada-ink transition-colors"
                        >
                            ← Sebelumnya
                        </button>
                        <span className="px-3 py-1.5 text-scada-ink font-semibold tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setOffset((p) => p + LIMIT)}
                            disabled={!hasNext || loading}
                            className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg disabled:opacity-40 disabled:cursor-not-allowed rounded text-scada-ink transition-colors"
                        >
                            Selanjutnya →
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}