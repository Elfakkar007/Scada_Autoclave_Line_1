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

// ── Pemetaan kode fase VW98 (PROCCES_TEXT) ke label tampilan ─────────────────
// Semua kode TERKONFIRMASI dari pembacaan kode ladder PLC (.awl export).
// Kolom phase_code di batch_trend menyimpan nilai VW98 mentah, tidak perlu migrasi.
// Urutan kode tidak berurutan naik: 7 (Drain) muncul SEBELUM 6 (Selesai).
const PHASE_LABELS = {
    0: "Idle (pintu belum tertutup)",
    1: "Siap",
    2: "Filling",
    3: "Heating",
    4: "Sterilisasi",
    5: "Cooling",
    7: "Drain",
    6: "Selesai",
};

function phaseLabel(code) {
    // null atau undefined tampil "-", bukan "Kode null"
    if (code === null || code === undefined) return "-";
    const num = Number(code);
    return PHASE_LABELS[num] ?? `Kode ${num}`;
}

function InfoField({ label, value }) {
    return (
        <div>
            <p className="text-xs text-scada-muted uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-scada-ink break-words">{value}</p>
        </div>
    );
}

// ── Komponen card ringkasan bagian ────────────────────────────────────────────
function SectionCard({ title, children }) {
    return (
        <div className="bg-scada-card border border-scada-rule shadow-sm rounded-lg p-5 mb-4">
            {title && (
                <h2 className="text-xs text-scada-muted uppercase tracking-widest font-semibold mb-4 border-b border-scada-rule pb-2">
                    {title}
                </h2>
            )}
            {children}
        </div>
    );
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    running:  "bg-scada-water text-white",
    finished: "bg-scada-run text-white",
    aborted:  "bg-scada-stop text-white",
};

function StatusBadge({ status }) {
    return (
        <span className={`px-2.5 py-1 rounded text-xs font-bold ${STATUS_STYLES[status] ?? "bg-scada-idle text-scada-ink"}`}>
            {status?.toUpperCase() ?? "-"}
        </span>
    );
}

// ── Komponen mini card F0 (mirip StatCard) ────────────────────────────────────
// value bisa null, undefined, number, atau string angka dari API.
// Ditampilkan 2 desimal jika angka valid; "-" jika tidak.
function FoCard({ label, value }) {
    const num = Number(value);
    const display = (value !== null && value !== undefined && Number.isFinite(num))
        ? num.toFixed(2)
        : "-";
    return (
        <div className="bg-scada-bg border border-scada-rule rounded-lg p-3 text-center">
            <div className="text-xs text-scada-muted uppercase">{label}</div>
            <div className="text-lg font-bold mt-0.5 text-scada-ink">{display}</div>
        </div>
    );
}

// ── Tabel trend ───────────────────────────────────────────────────────────────
function TrendTable({ trend }) {
    if (!trend || trend.length === 0) {
        return (
            <div className="py-10 text-center text-scada-muted text-sm italic">
                Belum ada data trend untuk batch ini<br />
                <span className="text-xs">(data akan muncul otomatis setelah terhubung ke PLC)</span>
            </div>
        );
    }

    const thClass = "px-3 py-2 text-left text-xs text-scada-muted uppercase font-semibold whitespace-nowrap";
    const tdClass = "px-3 py-2 text-xs text-scada-ink whitespace-nowrap";

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-scada-rule bg-scada-bg">
                    <tr>
                        {["Time","Fase","T1","T2","T3","T4","T5","T6","P (kPa)","TH","TM","TL","Avg"].map((h) => (
                            <th key={h} className={thClass}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-scada-rule">
                    {trend.map((row) => (
                        <tr key={row.id} className="hover:bg-scada-bg transition-colors">
                            <td className={tdClass + " font-mono"}>
                                {row.ts ? new Date(row.ts).toLocaleTimeString("id-ID") : "-"}
                            </td>
                            <td className={tdClass}>
                                {phaseLabel(row.phaseCode)}
                            </td>
                            {["t1","t2","t3","t4","t5","t6"].map((k) => (
                                <td key={k} className={tdClass}>
                                    {row[k] !== null && row[k] !== undefined ? row[k] : "-"}
                                </td>
                            ))}
                            {/* tekanan dalam kPa — tampilkan bilangan bulat */}
                            <td className={tdClass}>
                                {row.p !== null && row.p !== undefined ? Math.round(row.p) : "-"}
                            </td>
                            {["th","tm","tl","avg"].map((k) => (
                                <td key={k} className={tdClass}>
                                    {row[k] !== null && row[k] !== undefined ? row[k] : "-"}
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
                <p className="text-scada-muted">Memuat data batch…</p>
            </main>
        );
    }

    if (error || !batch) {
        return (
            <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
                <Link href="/data-report" className="text-sm text-scada-muted hover:text-scada-ink mb-6 inline-block">
                    ← Kembali ke Data Report
                </Link>
                <div className="bg-red-50 border border-scada-stop rounded-lg p-5 text-scada-stop">
                    {error ?? "Batch tidak ditemukan."}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <Link
                        href="/data-report"
                        className="text-xs text-scada-muted hover:text-scada-ink transition-colors inline-flex items-center gap-1 mb-2"
                    >
                        ← Kembali ke Data Report
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Detail Batch: <span className="font-mono text-scada-water">{decodedBatchNo}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Tombol cetak — buka di tab baru agar tidak kehilangan state halaman ini */}
                    <a
                        href={`/print/data-report/${encodeURIComponent(decodedBatchNo)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-scada-ink hover:bg-scada-muted text-white rounded text-xs font-semibold transition-colors"
                    >
                        🖨 Cetak Laporan
                    </a>
                    <a
                        href={`/print/data-report/${encodeURIComponent(decodedBatchNo)}/curve`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-scada-water hover:bg-scada-water-hover text-white rounded text-xs font-semibold transition-colors"
                    >
                        📈 Cetak Kurva
                    </a>
                    <StatusBadge status={batch.status} />
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 border-t border-scada-rule pt-4">
                    <InfoField label="Heat Time" value={val(batch.heatTimeMin, " min")} />
                    <InfoField label="Ster Time" value={val(batch.sterTimeMin, " min")} />
                    <InfoField label="Cool Time" value={val(batch.coolTimeMin, " min")} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-scada-rule pt-4">
                    <InfoField label="Run Begin"   value={fmt(batch.runBegin)} />
                    <InfoField label="Run Finish"  value={fmt(batch.runFinish)} />
                    <InfoField label="Total Time"  value={val(batch.totalTimeMin, " min")} />
                </div>
            </SectionCard>

            {/* ── Nilai F0 ── */}
            <SectionCard title="Nilai F0">
                {/* Ringkasan: F0 Min berdampingan dengan FOVal Setting (tanpa vonis lulus/gagal) */}
                <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-scada-rule">
                    <div>
                        <p className="text-xs text-scada-muted uppercase tracking-wider mb-0.5">F0 Min (worst-case)</p>
                        <p className="text-lg font-bold text-scada-ink">
                            {(() => {
                                const n = Number(batch.foMin);
                                return (batch.foMin !== null && batch.foMin !== undefined && Number.isFinite(n))
                                    ? n.toFixed(2)
                                    : "-";
                            })()}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-scada-muted uppercase tracking-wider mb-0.5">FOVal Setting</p>
                        <p className="text-lg font-bold text-scada-ink">
                            {(() => {
                                const n = Number(batch.foValSetting);
                                return (batch.foValSetting !== null && batch.foValSetting !== undefined && Number.isFinite(n))
                                    ? n
                                    : "-";
                            })()}
                        </p>
                    </div>
                </div>
                {/* Peringatan bila F0 dihitung dari data tidak lengkap (ada gap / nilai tidak valid) */}
                {batch.f0Meta && batch.f0Meta.complete === false && (
                    <p className="mb-3 text-xs text-scada-muted">
                        Perhatian: F0 dihitung dari data yang tidak lengkap (interval lebih dari {batch.f0Meta.maxGapSec ?? 150} detik
                        atau nilai suhu tidak valid dilewati), jadi nilainya batas bawah. Detail ada di f0_meta batch ini.
                    </p>
                )}
                {/* Nilai F0 per sensor */}
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
