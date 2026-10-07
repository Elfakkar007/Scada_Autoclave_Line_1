"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const LIMIT = 20;

// ── Helper tanggal ────────────────────────────────────────────────────────────
function todayWIB() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}
function nDaysAgoWIB(n) {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

function Badge({ value, colorClass = "bg-scada-bg text-scada-ink border border-scada-idle" }) {
    if (!value) return <span className="text-scada-muted">-</span>;
    return (
        <span className={`inline-block px-2 py-0.5 ${colorClass} rounded text-xs font-mono`}>
            {value}
        </span>
    );
}

// ── Modal detail old/new value ────────────────────────────────────────────────
function DetailModal({ row, onClose }) {
    if (!row) return null;
    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white border border-scada-rule rounded-lg w-full max-w-3xl max-h-[80vh] overflow-auto shadow-xl text-scada-ink"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-scada-rule bg-scada-bg">
                    <h2 className="font-semibold text-sm">
                        Detail Perubahan — <span className="font-mono text-scada-muted">{row.entityId}</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-scada-muted hover:text-scada-stop text-xl leading-none transition-colors"
                    >
                        ×
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-scada-rule">
                    <div className="p-4">
                        <p className="text-xs text-scada-muted uppercase mb-2">Old Value</p>
                        <pre className="bg-scada-bg border border-scada-rule rounded p-3 text-xs text-scada-ink overflow-auto whitespace-pre-wrap">
                            {row.oldValue ? JSON.stringify(row.oldValue, null, 2) : "—"}
                        </pre>
                    </div>
                    <div className="p-4">
                        <p className="text-xs text-scada-muted uppercase mb-2">New Value</p>
                        <pre className="bg-scada-bg border border-scada-rule rounded p-3 text-xs text-scada-ink overflow-auto whitespace-pre-wrap">
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
    const [authorized, setAuthorized] = useState(false);

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

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [action, setAction] = useState("");
    const [entityType, setEntityType] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ actions: [], entityTypes: [] });
    const [detailRow, setDetailRow] = useState(null);
    const [exportErr, setExportErr] = useState(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetch("/api/audit-log/filters")
            .then((r) => r.json())
            .then((data) => setFilters(data))
            .catch(() => { });
    }, []);

    const fetchData = useCallback(async (searchVal, actionVal, entityTypeVal, from, to, offsetVal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offsetVal) });
            if (searchVal.trim()) params.set("search", searchVal.trim());
            if (actionVal.trim()) params.set("action", actionVal.trim());
            if (entityTypeVal.trim()) params.set("entityType", entityTypeVal.trim());
            if (from.trim()) params.set("from", from.trim());
            if (to.trim()) params.set("to", to.trim());

            const res = await fetch(`/api/audit-log?${params}`);
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
            fetchData(search, action, entityType, fromDate, toDate, 0);
        }, 400);
        return () => clearTimeout(t);
    }, [search, action, entityType, fromDate, toDate, fetchData, authorized]);

    // Fetch ulang saat offset berubah
    useEffect(() => {
        if (!authorized) return;
        fetchData(search, action, entityType, fromDate, toDate, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    // ── Fungsi export ─────────────────────────────────────────────────────────
    function buildExportParams(fmt) {
        const p = new URLSearchParams({ format: fmt });
        if (search.trim()) p.set("search", search.trim());
        if (action.trim()) p.set("action", action.trim());
        if (entityType.trim()) p.set("entityType", entityType.trim());
        if (fromDate.trim()) p.set("from", fromDate.trim());
        if (toDate.trim()) p.set("to", toDate.trim());
        return p.toString();
    }

    async function handleExcelExport() {
        setExporting(true);
        setExportErr(null);
        try {
            const res = await fetch(`/api/audit-log/export?${buildExportParams("xlsx")}`);
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Gagal export (HTTP ${res.status})`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-log_${fromDate || "semua"}_${toDate || "semua"}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            setExportErr(e.message);
        } finally {
            setExporting(false);
        }
    }

    function handlePrint() {
        const url = `/print/audit-log?${buildExportParams("json")}`;
        // Tanpa "noopener": halaman cetak (satu origin, tepercaya) perlu bisa menutup dirinya
        // sendiri dan memfokuskan kembali tab ini lewat tombol Kembali.
        window.open(url, "_blank");
    }

    const totalPages = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;
    const hasPrev = offset > 0;
    const hasNext = offset + LIMIT < total;

    const ACTION_COLORS = {
        create: "bg-scada-run text-white",
        update: "bg-scada-water text-white",
        delete: "bg-scada-stop text-white",
        login: "bg-scada-bg text-scada-ink border border-scada-idle",
        logout: "bg-scada-idle text-scada-ink",
        start_batch: "bg-scada-steam text-white",
        stop_batch: "bg-scada-stop text-white",
    };

    const thClass = "px-3 py-3 text-left text-xs text-scada-muted uppercase tracking-wider font-semibold whitespace-nowrap";
    const tdClass = "px-3 py-3 text-sm text-scada-ink";

    if (!authorized) return <div className="min-h-screen bg-scada-bg" />;

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {detailRow && <DetailModal row={detailRow} onClose={() => setDetailRow(null)} />}

            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
                    <p className="text-sm text-scada-muted mt-1">Riwayat aktivitas sistem (khusus admin)</p>
                </div>
                {/* Tombol export */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExcelExport}
                        disabled={loading || exporting}
                        className="px-3 py-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
                    >
                        {exporting ? "Mengunduh…" : "⬇ Export Excel"}
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={loading}
                        className="px-3 py-1.5 bg-scada-ink hover:bg-scada-muted disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors"
                    >
                        🖨 Cetak / PDF
                    </button>
                </div>
            </div>

            {/* ── Filter tanggal ── */}
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
                    placeholder="Cari nama / username / entity / deskripsi…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink placeholder-scada-muted focus:outline-none focus:border-scada-water transition-colors"
                />
                <select
                    value={action}
                    onChange={(e) => { setAction(e.target.value); setOffset(0); }}
                    className="bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors cursor-pointer"
                >
                    <option value="">Semua Action</option>
                    {filters.actions.map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>
                <select
                    value={entityType}
                    onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}
                    className="bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors cursor-pointer"
                >
                    <option value="">Semua Entity Type</option>
                    {filters.entityTypes.map((et) => (
                        <option key={et} value={et}>{et}</option>
                    ))}
                </select>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-scada-stop text-scada-stop rounded text-sm">{error}</div>
            )}
            {exportErr && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-scada-stop text-scada-stop rounded text-sm">Export gagal: {exportErr}</div>
            )}

            {/* ── Tabel ── */}
            <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-scada-muted text-sm">Memuat data…</div>
                ) : rows.length === 0 ? (
                    <div className="py-16 text-center text-scada-muted text-sm">Belum ada log aktivitas.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-scada-bg border-b border-scada-rule">
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
                            <tbody className="divide-y divide-scada-rule">
                                {rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-scada-bg transition-colors">
                                        <td className={tdClass + " whitespace-nowrap font-mono text-xs"}>{fmt(row.eventTime)}</td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold">{row.actorName ?? row.actor ?? "-"}</span>
                                                {row.actorName && row.actor && (
                                                    <span className="text-xs text-scada-muted font-mono">{row.actor}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={tdClass}><Badge value={row.actorRole} /></td>
                                        <td className={tdClass}>
                                            <Badge value={row.action} colorClass={ACTION_COLORS[row.action] ?? "bg-scada-bg text-scada-ink border border-scada-idle"} />
                                        </td>
                                        <td className={tdClass}>
                                            <div className="flex flex-col gap-0.5">
                                                <Badge value={row.entityType} />
                                                {row.entityId && <span className="text-xs text-scada-muted font-mono">{row.entityId}</span>}
                                            </div>
                                        </td>
                                        <td className={tdClass + " max-w-xs"}>
                                            <span className="text-scada-ink text-xs">{row.description ?? "-"}</span>
                                        </td>
                                        <td className={tdClass}>
                                            {(row.oldValue || row.newValue) ? (
                                                <button
                                                    onClick={() => setDetailRow(row)}
                                                    className="text-xs text-scada-water hover:text-scada-water-hover hover:underline transition-colors whitespace-nowrap"
                                                >
                                                    Lihat Detail
                                                </button>
                                            ) : (
                                                <span className="text-scada-idle text-xs">—</span>
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
                <div className="mt-4 flex items-center justify-between text-sm text-scada-muted">
                    <span>Menampilkan {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total} log</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setOffset((p) => Math.max(p - LIMIT, 0))}
                            disabled={!hasPrev || loading}
                            className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg disabled:opacity-40 disabled:cursor-not-allowed rounded text-scada-ink transition-colors"
                        >
                            ← Sebelumnya
                        </button>
                        <span className="px-3 py-1.5 text-scada-ink font-semibold tabular-nums">{currentPage} / {totalPages}</span>
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