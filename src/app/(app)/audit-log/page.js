"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const LIMIT = 20;

function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

function Badge({ value, colorClass = "bg-slate-700" }) {
    if (!value) return <span className="text-slate-500">-</span>;
    return (
        <span className={`inline-block px-2 py-0.5 ${colorClass} rounded text-xs font-mono`}>
            {value}
        </span>
    );
}

// ── Modal sederhana untuk detail old/new value ────────────────────────────────
function DetailModal({ row, onClose }) {
    if (!row) return null;
    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-3xl max-h-[80vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
                    <h2 className="font-semibold text-sm">
                        Detail Perubahan — <span className="font-mono text-slate-400">{row.entityId}</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-xl leading-none"
                    >
                        ×
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-700">
                    <div className="p-4">
                        <p className="text-xs text-slate-400 uppercase mb-2">Old Value</p>
                        <pre className="bg-slate-950 rounded p-3 text-xs text-slate-300 overflow-auto whitespace-pre-wrap">
                            {row.oldValue ? JSON.stringify(row.oldValue, null, 2) : "—"}
                        </pre>
                    </div>
                    <div className="p-4">
                        <p className="text-xs text-slate-400 uppercase mb-2">New Value</p>
                        <pre className="bg-slate-950 rounded p-3 text-xs text-slate-300 overflow-auto whitespace-pre-wrap">
                            {row.newValue ? JSON.stringify(row.newValue, null, 2) : "—"}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function AuditLogPage() {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false); // proteksi client-side

    // Proteksi level halaman: kalau bukan admin, redirect ke /
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                if (json.ok && json.user?.role === "admin") {
                    setAuthorized(true);
                } else {
                    router.replace("/");
                }
            })
            .catch(() => router.replace("/"));
    }, [router]);

    const [rows, setRows]         = useState([]);
    const [total, setTotal]       = useState(0);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState("");
    const [action, setAction]     = useState("");
    const [entityType, setEntityType] = useState("");
    const [offset, setOffset]     = useState(0);
    const [error, setError]       = useState(null);
    const [filters, setFilters]   = useState({ actions: [], entityTypes: [] });
    const [detailRow, setDetailRow] = useState(null);

    // Fetch dropdown filters
    useEffect(() => {
        fetch("/api/audit-log/filters")
            .then((r) => r.json())
            .then((data) => setFilters(data))
            .catch(() => {});
    }, []);

    const fetchData = useCallback(async (searchVal, actionVal, entityTypeVal, offsetVal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                limit:  String(LIMIT),
                offset: String(offsetVal),
            });
            if (searchVal.trim())    params.set("search",     searchVal.trim());
            if (actionVal.trim())    params.set("action",     actionVal.trim());
            if (entityTypeVal.trim()) params.set("entityType", entityTypeVal.trim());

            const res  = await fetch(`/api/audit-log?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Gagal memuat data");

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

    // Debounce search 400ms
    useEffect(() => {
        if (!authorized) return;
        const t = setTimeout(() => {
            setOffset(0);
            fetchData(search, action, entityType, 0);
        }, 400);
        return () => clearTimeout(t);
    }, [search, action, entityType, fetchData, authorized]);

    // Fetch ulang saat offset berubah
    useEffect(() => {
        if (!authorized) return;
        fetchData(search, action, entityType, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    const totalPages  = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;
    const hasPrev     = offset > 0;
    const hasNext     = offset + LIMIT < total;

    const ACTION_COLORS = {
        create:      "bg-green-800 text-green-200",
        update:      "bg-blue-800 text-blue-200",
        delete:      "bg-red-800 text-red-200",
        login:       "bg-slate-600 text-slate-200",
        logout:      "bg-slate-600 text-slate-200",
        start_batch: "bg-amber-800 text-amber-200",
        stop_batch:  "bg-purple-800 text-purple-200",
    };

    const thClass = "px-3 py-3 text-left text-xs text-slate-400 uppercase tracking-wider font-semibold whitespace-nowrap";
    const tdClass = "px-3 py-3 text-sm text-slate-200";

    if (!authorized) {
        return <div className="min-h-screen bg-slate-900" />;
    }

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {detailRow && <DetailModal row={detailRow} onClose={() => setDetailRow(null)} />}

            {/* ── Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Riwayat aktivitas sistem (khusus admin)
                </p>
            </div>

            {/* ── Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                    type="text"
                    placeholder="Cari actor / entity / deskripsi…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <select
                    value={action}
                    onChange={(e) => { setAction(e.target.value); setOffset(0); }}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                    <option value="">Semua Action</option>
                    {filters.actions.map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>
                <select
                    value={entityType}
                    onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                    <option value="">Semua Entity Type</option>
                    {filters.entityTypes.map((et) => (
                        <option key={et} value={et}>{et}</option>
                    ))}
                </select>
            </div>

            {/* ── Error ── */}
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
                    <div className="py-16 text-center text-slate-500 text-sm">
                        Belum ada log aktivitas.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800 border-b border-slate-700">
                                <tr>
                                    <th className={thClass}>Waktu</th>
                                    <th className={thClass}>Actor</th>
                                    <th className={thClass}>Role</th>
                                    <th className={thClass}>Action</th>
                                    <th className={thClass}>Entity</th>
                                    <th className={thClass}>Deskripsi</th>
                                    <th className={thClass}>Detail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-700/40 transition-colors">
                                        <td className={tdClass + " whitespace-nowrap font-mono text-xs"}>
                                            {fmt(row.eventTime)}
                                        </td>
                                        <td className={tdClass + " font-semibold"}>
                                            {row.actor ?? "-"}
                                        </td>
                                        <td className={tdClass}>
                                            <Badge value={row.actorRole} />
                                        </td>
                                        <td className={tdClass}>
                                            <Badge
                                                value={row.action}
                                                colorClass={ACTION_COLORS[row.action] ?? "bg-slate-700 text-slate-300"}
                                            />
                                        </td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <Badge value={row.entityType} />
                                                {row.entityId && (
                                                    <span className="text-xs text-slate-400 font-mono">{row.entityId}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={tdClass + " max-w-xs"}>
                                            <span className="text-slate-300 text-xs">
                                                {row.description ?? "-"}
                                            </span>
                                        </td>
                                        <td className={tdClass}>
                                            {(row.oldValue || row.newValue) ? (
                                                <button
                                                    onClick={() => setDetailRow(row)}
                                                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors whitespace-nowrap"
                                                >
                                                    Lihat Detail
                                                </button>
                                            ) : (
                                                <span className="text-slate-600 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Pagination ── */}
            {total > LIMIT && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>
                        Menampilkan {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total} log
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
