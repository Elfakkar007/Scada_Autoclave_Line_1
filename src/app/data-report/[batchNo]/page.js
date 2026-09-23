"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ── Helper: format tanggal-jam ────────────────────────────────────────────────
function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

// ── Helper: format angka atau "-" ────────────────────────────────────────────
function val(v, suffix = "") {
    if (v === null || v === undefined) return "-";
    return `${v}${suffix}`;
}

// ── Komponen field info (label + value) ──────────────────────────────────────
function InfoField({ label, value }) {
    return (
        <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-slate-100 break-words">{value}</p>
        </div>
    );
}

// ── Komponen card ringkasan bagian ────────────────────────────────────────────
function SectionCard({ title, children }) {
    return (
        <div className="bg-slate-800 rounded-lg p-5 mb-4">
            {title && (
                <h2 className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4 border-b border-slate-700 pb-2">
                    {title}
                </h2>
            )}
            {children}
        </div>
    );
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    running:  "bg-blue-600",
    finished: "bg-green-600",
    aborted:  "bg-red-600",
};

function StatusBadge({ status }) {
    return (
        <span className={`px-2.5 py-1 rounded text-xs font-bold ${STATUS_STYLES[status] ?? "bg-slate-600"}`}>
            {status?.toUpperCase() ?? "-"}
        </span>
    );
}

// ── Komponen mini card F0 (mirip StatCard) ────────────────────────────────────
function FoCard({ label, value }) {
    return (
        <div className="bg-slate-700 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-400 uppercase">{label}</div>
            <div className="text-lg font-bold mt-0.5">{value ?? "-"}</div>
        </div>
    );
}

// ── Tabel trend ───────────────────────────────────────────────────────────────
function TrendTable({ trend }) {
    if (!trend || trend.length === 0) {
        return (
            <div className="py-10 text-center text-slate-500 text-sm italic">
                Belum ada data trend untuk batch ini<br />
                <span className="text-xs">(data akan muncul otomatis setelah terhubung ke PLC)</span>
            </div>
        );
    }

    const thClass = "px-3 py-2 text-left text-xs text-slate-400 uppercase font-semibold whitespace-nowrap";
    const tdClass = "px-3 py-2 text-xs text-slate-300 whitespace-nowrap";

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-slate-700">
                    <tr>
                        {["Time","T1","T2","T3","T4","T5","T6","P","TH","TM","TL","Avg"].map((h) => (
                            <th key={h} className={thClass}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                    {trend.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-700/40 transition-colors">
                            <td className={tdClass + " font-mono"}>
                                {row.ts ? new Date(row.ts).toLocaleTimeString("id-ID") : "-"}
                            </td>
                            {["t1","t2","t3","t4","t5","t6","p","th","tm","tl","avg"].map((k) => (
                                <td key={k} className={tdClass}>
                                    {row[k] !== null ? row[k] : "-"}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function BatchDetailPage() {
    // useParams dari next/navigation — ini client hook, TIDAK perlu await
    const { batchNo } = useParams();
    const decodedBatchNo = decodeURIComponent(batchNo);

    const [batch, setBatch]   = useState(null);
    const [trend, setTrend]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);

    useEffect(() => {
        if (!batchNo) return;
        setLoading(true);
        fetch(`/api/batch-records/${encodeURIComponent(decodedBatchNo)}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.ok === false) throw new Error(json.error ?? "Batch tidak ditemukan");
                setBatch(json.batch);
                setTrend(json.trend ?? []);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [batchNo, decodedBatchNo]);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
                <p className="text-slate-500">Memuat data batch…</p>
            </main>
        );
    }

    if (error || !batch) {
        return (
            <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
                <Link href="/data-report" className="text-sm text-slate-400 hover:text-slate-200 mb-6 inline-block">
                    ← Kembali ke Data Report
                </Link>
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-5 text-red-200">
                    {error ?? "Batch tidak ditemukan."}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <Link
                        href="/data-report"
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 mb-2"
                    >
                        ← Kembali ke Data Report
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Detail Batch: <span className="font-mono text-blue-400">{decodedBatchNo}</span>
                    </h1>
                </div>
                <StatusBadge status={batch.status} />
            </div>

            {/* ── Baris 1: Produk ── */}
            <SectionCard title="Informasi Produk">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField label="Product Name" value={val(batch.productName)} />
                    <InfoField label="Product Spec" value={val(batch.productSpec)} />
                </div>
            </SectionCard>

            {/* ── Baris 2: Identitas batch ── */}
            <SectionCard title="Identitas Batch">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <InfoField label="Operator"   value={val(batch.operator)} />
                    <InfoField label="Batch No"   value={val(batch.batchNo)} />
                    <InfoField label="Loading No" value={val(batch.loadingNo)} />
                    <InfoField label="Machine ID" value={val(batch.machineId)} />
                </div>
            </SectionCard>

            {/* ── Baris 3: Parameter proses ── */}
            <SectionCard title="Parameter Proses">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <InfoField label="Ster. Temp"  value={val(batch.sterTemp, " °C")} />
                    <InfoField label="Ctrl Type"   value={val(batch.ctrlType)} />
                    <InfoField label="Cool Temp"   value={val(batch.coolTemp, " °C")} />
                </div>
            </SectionCard>

            {/* ── Baris 4-6: Waktu ── */}
            <SectionCard title="Waktu Proses">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <InfoField label="Heat Begin" value={fmt(batch.heatBegin)} />
                    <InfoField label="Ster Begin" value={fmt(batch.sterBegin)} />
                    <InfoField label="Cool Begin" value={fmt(batch.coolBegin)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 border-t border-slate-700 pt-4">
                    <InfoField label="Heat Time" value={val(batch.heatTimeMin, " min")} />
                    <InfoField label="Ster Time" value={val(batch.sterTimeMin, " min")} />
                    <InfoField label="Cool Time" value={val(batch.coolTimeMin, " min")} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-700 pt-4">
                    <InfoField label="Run Begin"   value={fmt(batch.runBegin)} />
                    <InfoField label="Run Finish"  value={fmt(batch.runFinish)} />
                    <InfoField label="Total Time"  value={val(batch.totalTimeMin, " min")} />
                </div>
            </SectionCard>

            {/* ── Nilai F0 ── */}
            <SectionCard title="Nilai F0">
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
                    {[
                        ["FO1", batch.fo1], ["FO2", batch.fo2], ["FO3", batch.fo3],
                        ["FO4", batch.fo4], ["FO5", batch.fo5], ["FO6", batch.fo6],
                        ["FOH", batch.foh], ["FOM", batch.fom], ["FOL", batch.fol],
                    ].map(([label, value]) => (
                        <FoCard key={label} label={label} value={value} />
                    ))}
                </div>
            </SectionCard>

            {/* ── Tabel Trend ── */}
            <SectionCard title={`Data Trend (${trend.length} titik)`}>
                <TrendTable trend={trend} />
            </SectionCard>
        </main>
    );
}
