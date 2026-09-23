"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";

// ── Palet warna untuk tiap line ───────────────────────────────────────────────
const LINE_CONFIG = [
    { key: "t1",  label: "T1",  color: "#f87171", yAxis: "left"  },  // merah
    { key: "t2",  label: "T2",  color: "#fb923c", yAxis: "left"  },  // oranye
    { key: "t3",  label: "T3",  color: "#facc15", yAxis: "left"  },  // kuning
    { key: "t4",  label: "T4",  color: "#4ade80", yAxis: "left"  },  // hijau
    { key: "t5",  label: "T5",  color: "#34d399", yAxis: "left"  },  // teal
    { key: "t6",  label: "T6",  color: "#22d3ee", yAxis: "left"  },  // cyan
    { key: "th",  label: "TH",  color: "#e879f9", yAxis: "left"  },  // pink/ungu
    { key: "tm",  label: "TM",  color: "#c084fc", yAxis: "left"  },  // lavender
    { key: "tl",  label: "TL",  color: "#f0abfc", yAxis: "left"  },  // pink muda
    { key: "p",   label: "P",   color: "#3b82f6", yAxis: "right", dash: "5 3" }, // biru, dashed
];

// ── Helper: format tanggal singkat ────────────────────────────────────────────
function fmtDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

function fmtTime(tsStr) {
    if (!tsStr) return "";
    return new Date(tsStr).toLocaleTimeString("id-ID");
}

// ── Badge status ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    running:  "bg-blue-600",
    finished: "bg-green-700",
    aborted:  "bg-red-700",
};
function StatusBadge({ status }) {
    if (!status) return null;
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_STYLES[status] ?? "bg-slate-600"}`}>
            {status.toUpperCase()}
        </span>
    );
}

// ── Tooltip kustom (lebih ringkas) ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl max-w-xs">
            <p className="text-slate-400 mb-2 font-mono">{label}</p>
            {payload.map((entry) => (
                <div key={entry.dataKey} className="flex justify-between gap-4">
                    <span style={{ color: entry.color }}>{entry.name}</span>
                    <span className="font-mono text-slate-100">
                        {entry.value !== null && entry.value !== undefined
                            ? entry.value
                            : "—"}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function TrendPage() {
    const [batches, setBatches]           = useState([]);        // daftar batch untuk dropdown
    const [selectedBatchNo, setSelectedBatchNo] = useState(""); // batch yang dipilih
    const [batchDetail, setBatchDetail]   = useState(null);     // { batch, trend }
    const [loadingList, setLoadingList]   = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError]               = useState(null);

    // ── 1. Saat mount: fetch status + list batch ─────────────────────────
    useEffect(() => {
        async function init() {
            setLoadingList(true);
            try {
                // Fetch status dan list batch secara paralel
                const [statusRes, listRes] = await Promise.all([
                    fetch("/api/status"),
                    fetch("/api/batch-records?limit=100"),
                ]);
                const statusJson = await statusRes.json();
                const listJson   = await listRes.json();

                const list = listJson.data ?? [];
                setBatches(list);

                // Tentukan batch yang otomatis terpilih:
                // 1) Batch running (kalau ada), 2) batch pertama di list
                let autoSelect = "";
                if (statusJson.running && statusJson.batchNo) {
                    autoSelect = statusJson.batchNo;
                } else if (list.length > 0) {
                    autoSelect = list[0].batchNo;
                }

                if (autoSelect) {
                    setSelectedBatchNo(autoSelect);
                }
            } catch (e) {
                setError("Gagal memuat daftar batch: " + e.message);
            } finally {
                setLoadingList(false);
            }
        }
        init();
    }, []);

    // ── 2. Setiap selectedBatchNo berubah: fetch detail + trend ──────────
    useEffect(() => {
        if (!selectedBatchNo) {
            setBatchDetail(null);
            return;
        }
        setLoadingDetail(true);
        setError(null);

        fetch(`/api/batch-records/${encodeURIComponent(selectedBatchNo)}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.ok === false) throw new Error(json.error ?? "Batch tidak ditemukan");
                setBatchDetail(json);
            })
            .catch((e) => {
                setError(e.message);
                setBatchDetail(null);
            })
            .finally(() => setLoadingDetail(false));
    }, [selectedBatchNo]);

    const batch = batchDetail?.batch ?? null;
    const trend = batchDetail?.trend ?? [];

    // Format data trend agar X-axis bisa dibaca
    const chartData = trend.map((row) => ({
        ...row,
        _label: fmtTime(row.ts),
    }));

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* ── Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Trend</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Grafik suhu &amp; tekanan per batch sterilisasi
                </p>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-900 border border-red-700 text-red-200 rounded text-sm">
                    {error}
                </div>
            )}

            {/* ── Dropdown pemilihan batch ── */}
            <div className="mb-5">
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">
                    Pilih Batch
                </label>
                {loadingList ? (
                    <div className="h-10 w-80 bg-slate-700 rounded animate-pulse" />
                ) : batches.length === 0 ? (
                    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-500 inline-block">
                        Belum ada batch tersedia
                    </div>
                ) : (
                    <select
                        value={selectedBatchNo}
                        onChange={(e) => setSelectedBatchNo(e.target.value)}
                        className="w-full max-w-xl bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                        {batches.map((b) => (
                            <option key={b.batchNo} value={b.batchNo}>
                                {b.batchNo}
                                {b.productName ? ` — ${b.productName}` : ""}
                                {b.runBegin ? ` (${fmtDate(b.runBegin)})` : ""}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* ── Konten area (loading / info batch + grafik) ── */}
            {loadingDetail ? (
                <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-500 text-sm animate-pulse">
                    Memuat data trend…
                </div>
            ) : batch ? (
                <>
                    {/* ── Card info ringkas batch ── */}
                    <div className="bg-slate-800 rounded-lg p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-slate-400 uppercase mb-0.5">Batch No</p>
                            <p className="font-mono font-bold">{batch.batchNo}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase mb-0.5">Product</p>
                            <p className="font-semibold text-sm">{batch.productName ?? "-"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase mb-0.5">Operator</p>
                            <p className="text-sm">{batch.operator ?? "-"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase mb-0.5">Status</p>
                            <StatusBadge status={batch.status} />
                        </div>
                    </div>

                    {/* ── Grafik atau empty state ── */}
                    {trend.length === 0 ? (
                        <div className="bg-slate-800 rounded-lg p-10 text-center">
                            <div className="text-4xl opacity-20 mb-3 select-none">📈</div>
                            <p className="text-slate-300 font-semibold">
                                Belum ada data trend untuk batch ini.
                            </p>
                            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                                Data akan muncul otomatis setelah sistem terhubung ke PLC
                                dan proses sterilisasi merekam data.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-slate-800 rounded-lg p-5">
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">
                                Temperature &amp; Pressure Curve — {trend.length} titik data
                            </p>
                            <ResponsiveContainer width="100%" height={420}>
                                <ComposedChart
                                    data={chartData}
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="_label"
                                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={{ stroke: "#475569" }}
                                    />
                                    {/* Y kiri: suhu */}
                                    <YAxis
                                        yAxisId="left"
                                        domain={[0, 150]}
                                        tickCount={7}
                                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={{ stroke: "#475569" }}
                                        label={{
                                            value: "Suhu (°C)",
                                            angle: -90,
                                            position: "insideLeft",
                                            fill: "#64748b",
                                            fontSize: 11,
                                            dx: -4,
                                        }}
                                    />
                                    {/* Y kanan: tekanan */}
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        domain={[0, 320]}
                                        tickCount={7}
                                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={{ stroke: "#475569" }}
                                        label={{
                                            value: "Tekanan (KPa)",
                                            angle: 90,
                                            position: "insideRight",
                                            fill: "#64748b",
                                            fontSize: 11,
                                            dx: 14,
                                        }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 12 }}
                                    />
                                    {LINE_CONFIG.map(({ key, label, color, yAxis, dash }) => (
                                        <Line
                                            key={key}
                                            yAxisId={yAxis}
                                            type="monotone"
                                            dataKey={key}
                                            name={label}
                                            stroke={color}
                                            strokeWidth={key === "p" ? 2 : 1.5}
                                            strokeDasharray={dash}
                                            dot={false}
                                            activeDot={{ r: 4, strokeWidth: 0 }}
                                            connectNulls
                                        />
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* ── Link ke detail ── */}
                    <div className="mt-4 text-right">
                        <Link
                            href={`/data-report/${encodeURIComponent(batch.batchNo)}`}
                            className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                        >
                            Lihat detail lengkap →
                        </Link>
                    </div>
                </>
            ) : !loadingList && batches.length === 0 ? null : (
                // Saat belum ada batch terpilih (edge case)
                <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-500 text-sm">
                    Pilih batch di dropdown untuk melihat grafik.
                </div>
            )}
        </main>
    );
}