"use client";

import { useState, useEffect, useCallback } from "react";

const LIMIT = 20;

// ── Helper: format tanggal ────────────────────────────────────────────────────
function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

// ── Badge Event Type ──────────────────────────────────────────────────────────
function EventTypeBadge({ value }) {
    if (!value) return <span className="text-slate-500">-</span>;
    return (
        <span className="inline-block px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300 font-mono">
            {value}
        </span>
    );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilter }) {
    return (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
            <div className="text-5xl opacity-20 select-none">🔕</div>
            <p className="text-slate-300 font-semibold text-base">
                {hasFilter ? "Tidak ada alarm yang sesuai filter." : "Belum ada data alarm."}
            </p>
            {!hasFilter && (
                <p className="text-slate-500 text-sm max-w-sm">
                    Data akan muncul otomatis setelah sistem terhubung ke PLC.
                </p>
            )}
        </div>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function AlarmPage() {
    const [rows, setRows]               = useState([]);
    const [total, setTotal]             = useState(0);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState("");
    const [eventType, setEventType]     = useState("");
    const [eventTypes, setEventTypes]   = useState([]);   // untuk dropdown
    const [offset, setOffset]           = useState(0);
    const [error, setError]             = useState(null);

    // ── Fetch distinct event types untuk dropdown ────────────────────────
    useEffect(() => {
        fetch("/api/alarms/event-types")
            .then((r) => r.json())
            .then((data) => setEventTypes(Array.isArray(data) ? data : []))
            .catch(() => setEventTypes([]));
    }, []);

    // ── Fetch data alarm ─────────────────────────────────────────────────
    const fetchData = useCallback(async (searchVal, eventTypeVal, offsetVal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                limit:  String(LIMIT),
                offset: String(offsetVal),
            });
            if (searchVal.trim())   params.set("search",    searchVal.trim());
            if (eventTypeVal.trim()) params.set("eventType", eventTypeVal.trim());

            const res  = await fetch(`/api/alarms?${params.toString()}`);
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
            fetchData(search, eventType, 0);
        }, 400);
        return () => clearTimeout(t);
    }, [search, eventType, fetchData]);

    // Fetch ulang saat offset berubah (pagination)
    useEffect(() => {
        fetchData(search, eventType, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    const totalPages  = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;
    const hasPrev     = offset > 0;
    const hasNext     = offset + LIMIT < total;
    const hasFilter   = search.trim() !== "" || eventType !== "";

    const thClass = "px-3 py-3 text-left text-xs text-slate-400 uppercase tracking-wider font-semibold whitespace-nowrap";
    const tdClass = "px-3 py-3 text-sm text-slate-200";

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* ── Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Alarm Message</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Log alarm &amp; event mesin sterilizer
                </p>
            </div>

            {/* ── Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                    type="text"
                    placeholder="Cari Variable Name / Operator / Alarm Type…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <select
                    value={eventType}
                    onChange={(e) => { setEventType(e.target.value); setOffset(0); }}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                    <option value="">Semua Event Type</option>
                    {eventTypes.map((et) => (
                        <option key={et} value={et}>{et}</option>
                    ))}
                </select>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-900 border border-red-700 text-red-200 rounded text-sm">
                    {error}
                </div>
            )}

            {/* ── Tabel ── */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-slate-500 text-sm">Memuat data…</div>
                ) : rows.length === 0 ? (
                    <EmptyState hasFilter={hasFilter} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800 border-b border-slate-700">
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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-slate-700/50 transition-colors"
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Pagination (sembunyikan jika total <= limit) ── */}
            {total > LIMIT && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>
                        Menampilkan {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total} record
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setOffset((p) => Math.max(p - LIMIT, 0))}
                            disabled={!hasPrev || loading}
                            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-200 transition-colors"
                        >
                            ← Sebelumnya
                        </button>
                        <span className="px-3 py-1.5 text-slate-300 tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setOffset((p) => p + LIMIT)}
                            disabled={!hasNext || loading}
                            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-200 transition-colors"
                        >
                            Selanjutnya →
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}