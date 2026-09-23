"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const LIMIT = 20;

const STATUS_STYLES = {
    running:  "bg-blue-600 text-white",
    finished: "bg-green-600 text-white",
    aborted:  "bg-red-600 text-white",
};

function StatusBadge({ status }) {
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-slate-600 text-white"}`}>
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
    const [offset, setOffset]     = useState(0);
    const [error, setError]       = useState(null);

    const fetchData = useCallback(async (searchVal, statusVal, offsetVal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                limit:  String(LIMIT),
                offset: String(offsetVal),
            });
            if (searchVal.trim()) params.set("search", searchVal.trim());
            if (statusVal)        params.set("status", statusVal);

            const res  = await fetch(`/api/batch-records?${params.toString()}`);
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

    // Debounce search: tunggu 400ms setelah user berhenti mengetik
    useEffect(() => {
        const t = setTimeout(() => {
            setOffset(0);
            fetchData(search, status, 0);
        }, 400);
        return () => clearTimeout(t);
    }, [search, status, fetchData]);

    // Fetch ulang saat offset berubah (pagination)
    useEffect(() => {
        fetchData(search, status, offset);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset]);

    const totalPages   = Math.ceil(total / LIMIT);
    const currentPage  = Math.floor(offset / LIMIT) + 1;
    const hasPrev      = offset > 0;
    const hasNext      = offset + LIMIT < total;

    const thClass = "px-4 py-3 text-left text-xs text-slate-400 uppercase tracking-wider font-semibold";
    const tdClass = "px-4 py-3 text-sm text-slate-200";

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* ── Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Data Report</h1>
                <p className="text-sm text-slate-400 mt-1">Riwayat batch sterilisasi</p>
            </div>

            {/* ── Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                    type="text"
                    placeholder="Cari Batch No / Operator / Produk…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setOffset(0); }}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                    <option value="">Semua Status</option>
                    <option value="running">Running</option>
                    <option value="finished">Finished</option>
                    <option value="aborted">Aborted</option>
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
                    <div className="py-16 text-center text-slate-500 text-sm">
                        {search || status ? "Tidak ada batch yang sesuai filter." : "Belum ada riwayat batch."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800 border-b border-slate-700">
                                <tr>
                                    <th className={thClass}>Batch No</th>
                                    <th className={thClass}>Product Name</th>
                                    <th className={thClass}>Operator</th>
                                    <th className={thClass}>Ster. Temp</th>
                                    <th className={thClass}>Run Begin</th>
                                    <th className={thClass}>Run Finish</th>
                                    <th className={thClass}>Total (min)</th>
                                    <th className={thClass}>Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {rows.map((row) => (
                                    <tr
                                        key={row.batchNo}
                                        className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                                    >
                                        <td className={tdClass}>
                                            <Link
                                                href={`/data-report/${encodeURIComponent(row.batchNo)}`}
                                                className="font-mono font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                                            >
                                                {row.batchNo}
                                            </Link>
                                        </td>
                                        <td className={tdClass}>{row.productName ?? "-"}</td>
                                        <td className={tdClass}>{row.operator ?? "-"}</td>
                                        <td className={tdClass}>
                                            {row.sterTemp !== null ? `${row.sterTemp} °C` : "-"}
                                        </td>
                                        <td className={tdClass + " whitespace-nowrap"}>{fmt(row.runBegin)}</td>
                                        <td className={tdClass + " whitespace-nowrap"}>{fmt(row.runFinish)}</td>
                                        <td className={tdClass}>
                                            {row.totalTimeMin !== null ? row.totalTimeMin : "-"}
                                        </td>
                                        <td className={tdClass}>
                                            <StatusBadge status={row.status} />
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
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>
                        Menampilkan {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total} batch
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setOffset((p) => Math.max(p - LIMIT, 0))}
                            disabled={!hasPrev || loading}
                            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-200 transition-colors"
                        >
                            ← Sebelumnya
                        </button>
                        <span className="px-3 py-1.5 text-slate-300">
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