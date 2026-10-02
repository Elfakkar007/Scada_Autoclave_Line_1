"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const LIMIT = 20;

// ── Helper tanggal WIB ────────────────────────────────────────────────────────
function todayWIB() {
    return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}
function nDaysAgoWIB(n) {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

const STATUS_STYLES = {
    running:  "bg-scada-water text-white",
    finished: "bg-scada-run text-white",
    aborted:  "bg-scada-stop text-white",
};

function StatusBadge({ status }) {
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-scada-idle text-scada-ink"}`}>
            {status ?? "-"}
        </span>
    );
}

function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

export default function DataReportPage() {
    const [rows, setRows]         = useState([]);
    const [total, setTotal]       = useState(0);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState("");
    const [status, setStatus]     = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate]     = useState("");
    const [offset, setOffset]     = useState(0);
    const [error, setError]       = useState(null);
    const [exportErr, setExportErr] = useState(null);
    const [exporting, setExporting] = useState(false);

    const fetchData = useCallback(async (searchVal, statusVal, from, to, offsetVal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offsetVal) });
            if (searchVal.trim()) params.set("search", searchVal.trim());
            if (statusVal)        params.set("status", statusVal);
            if (from.trim())      params.set("from",   from.trim());
            if (to.trim())        params.set("to",     to.trim());

            const res  = await fetch(`/api/batch-records?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Gagal memuat data");
            setRows(json.data ?? []);
            setTotal(json.total ?? 0);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce search 400ms
    useEffect(() => {
        const t = setTimeout(() => {
            setOffset(0);
            fetchData(search, status, fromDate, toDate, 0);
        }, 400);
        return () => clearTimeout(t);
    }, [search, status, fromDate, toDate, fetchData]);

    // Fetch ulang saat offset berubah
    useEffect(() => {
        fetchData(search, status, fromDate, toDate, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    // ── Export helpers ────────────────────────────────────────────────────────
    function buildExportParams(fmt) {
        const p = new URLSearchParams({ format: fmt });
        if (search.trim()) p.set("search", search.trim());
        if (status)        p.set("status", status);
        if (fromDate.trim()) p.set("from", fromDate.trim());
        if (toDate.trim())   p.set("to",   toDate.trim());
        return p.toString();
    }

    async function handleExcelExport() {
        setExporting(true);
        setExportErr(null);
        try {
            const res = await fetch(`/api/batch-records/export?${buildExportParams("xlsx")}`);
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.error ?? `Gagal export (HTTP ${res.status})`);
            }
            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = `batch-records_${fromDate || "semua"}_${toDate || "semua"}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            setExportErr(e.message);
        } finally {
            setExporting(false);
        }
    }

    function handlePrint() {
        const url = `/print/batch-records?${buildExportParams("json")}`;
        window.open(url, "_blank", "noopener,noreferrer");
    }

    const totalPages  = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;
    const hasPrev     = offset > 0;
    const hasNext     = offset + LIMIT < total;

    const thClass = "px-4 py-3 text-left text-xs text-scada-muted uppercase tracking-wider font-semibold";
    const tdClass = "px-4 py-3 text-sm text-scada-ink";

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Data Report</h1>
                    <p className="text-sm text-scada-muted mt-1">Riwayat batch sterilisasi</p>
                </div>
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
                    placeholder="Cari Batch No / Operator / Produk…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink placeholder-scada-muted focus:outline-none focus:border-scada-water transition-colors"
                />
                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setOffset(0); }}
                    className="bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors cursor-pointer"
                >
                    <option value="">Semua Status</option>
                    <option value="running">Running</option>
                    <option value="finished">Finished</option>
                    <option value="aborted">Aborted</option>
                </select>
            </div>

            {/* ── Error banner ── */}
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
                    <div className="py-16 text-center text-scada-muted text-sm">
                        {search || status || fromDate || toDate ? "Tidak ada batch yang sesuai filter." : "Belum ada riwayat batch."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-scada-bg border-b border-scada-rule">
                                <tr>
                                    <th className={thClass}>Batch No</th>
                                    <th className={thClass}>Product Name</th>
                                    <th className={thClass}>Operator</th>
                                    <th className={thClass}>Ster. Temp</th>
                                    <th className={thClass}>Run Begin</th>
                                    <th className={thClass}>Run Finish</th>
                                    <th className={thClass}>Total (min)</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Hasil</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-scada-rule">
                                {rows.map((row) => (
                                    <tr key={row.batchNo} className="hover:bg-scada-bg cursor-pointer transition-colors">
                                        <td className={tdClass}>
                                            <Link
                                                href={`/data-report/${encodeURIComponent(row.batchNo)}`}
                                                className="font-mono font-semibold text-scada-water hover:underline"
                                            >
                                                {row.batchNo}
                                            </Link>
                                        </td>
                                        <td className={tdClass}>{row.productName ?? "-"}</td>
                                        <td className={tdClass}>{row.operator ?? "-"}</td>
                                        <td className={tdClass}>{row.sterTemp !== null ? `${row.sterTemp} °C` : "-"}</td>
                                        <td className={tdClass + " whitespace-nowrap"}>{fmt(row.runBegin)}</td>
                                        <td className={tdClass + " whitespace-nowrap"}>{fmt(row.runFinish)}</td>
                                        <td className={tdClass}>{row.totalTimeMin !== null ? row.totalTimeMin : "-"}</td>
                                        <td className={tdClass}><StatusBadge status={row.status} /></td>
                                        <td className={tdClass}>
                                            {row.sterilizationResult ? (
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    row.sterilizationResult === "pass"
                                                        ? "bg-scada-run text-white"
                                                        : row.sterilizationResult === "fail"
                                                        ? "bg-scada-stop text-white"
                                                        : row.sterilizationResult === "pending"
                                                        ? "bg-scada-water text-white"
                                                        : "bg-scada-idle text-scada-ink"
                                                }`}>
                                                    {row.sterilizationResult.toUpperCase()}
                                                </span>
                                            ) : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Pagination ── */}
            {total > 0 && (
                <div className="mt-4 flex items-center justify-between text-sm text-scada-muted">
                    <span>Menampilkan {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total} batch</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setOffset((p) => Math.max(p - LIMIT, 0))}
                            disabled={!hasPrev || loading}
                            className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg disabled:opacity-40 disabled:cursor-not-allowed rounded text-scada-ink transition-colors"
                        >
                            ← Sebelumnya
                        </button>
                        <span className="px-3 py-1.5 text-scada-ink font-semibold">{currentPage} / {totalPages}</span>
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