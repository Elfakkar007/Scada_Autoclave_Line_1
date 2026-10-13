"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    ReferenceLine,
} from "recharts";

// ── Helper format ─────────────────────────────────────────────────────────────
function fmtTime(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

function fmtDateTitle(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const tz = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(d);
    const p = Object.fromEntries(tz.map((x) => [x.type, x.value]));
    return `${p.year}/${Number(p.month)}/${Number(p.day)}`;
}

function fmtTemp(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : "-";
}

function fmtInt(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n).toString() : "-";
}

function fmtMin(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return (Math.floor(n * 10) / 10).toFixed(1);
}

function fmtStr(v) {
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
}

// ── Konfigurasi garis grafik (disamakan dengan halaman Trend) ────────────────
const LINE_CFG = [
    { key: "t1",  label: "T1",  color: "#f87171", yAxis: "left"  },
    { key: "t2",  label: "T2",  color: "#fb923c", yAxis: "left"  },
    { key: "t3",  label: "T3",  color: "#facc15", yAxis: "left"  },
    { key: "t4",  label: "T4",  color: "#4ade80", yAxis: "left"  },
    { key: "t5",  label: "T5",  color: "#34d399", yAxis: "left"  },
    { key: "t6",  label: "T6",  color: "#22d3ee", yAxis: "left"  },
    { key: "th",  label: "TH",  color: "#e879f9", yAxis: "left"  },
    { key: "tm",  label: "TM",  color: "#c084fc", yAxis: "left"  },
    { key: "tl",  label: "TL",  color: "#f0abfc", yAxis: "left"  },
    { key: "p",   label: "P",   color: "#3b82f6", yAxis: "right", dash: "5 3" },
];

// Tick sumbu Y kanan (P, kPa) — persis seperti printout lama
const P_TICKS = [0, 30, 61, 91, 122, 152, 182, 213, 243, 274, 304];

// ── Baris header gaya printout ────────────────────────────────────────────────
function HRow({ cols }) {
    return (
        <div style={{ display: "flex", gap: 8, fontSize: 10, marginBottom: 1 }}>
            {cols.map(({ label, value, flex = 1 }, i) => (
                <div key={i} style={{ flex, display: "flex", gap: 3 }}>
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
                    <span>{value}</span>
                </div>
            ))}
        </div>
    );
}

// ── Legend manual ─────────────────────────────────────────────────────────────
function ManualLegend() {
    return (
        <div style={{ position: "absolute", top: 0, right: 0, fontSize: 9, lineHeight: "16px", background: "rgba(255,255,255,0.85)", padding: "4px 6px", border: "1px solid #ccc", zIndex: 10 }}>
            {LINE_CFG.map(({ key, color, label, dash }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="20" height="4">
                        <line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="1.5" strokeDasharray={dash} />
                    </svg>
                    <span>{label}</span>
                </div>
            ))}
        </div>
    );
}

// ── Halaman cetak ─────────────────────────────────────────────────────────────
export default function PrintCurvePage() {
    const { batchNo } = useParams();
    const decoded = decodeURIComponent(batchNo);

    const [batch, setBatch] = useState(null);
    const [trend, setTrend] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!batchNo) return;
        fetch(`/api/batch-records/${encodeURIComponent(decoded)}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.ok === false) throw new Error(json.error ?? "Batch tidak ditemukan");
                setBatch(json.batch);
                setTrend(json.trend ?? []);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [batchNo, decoded]);

    if (loading) return <div style={{ padding: 24, fontFamily: "monospace" }}>Memuat…</div>;
    if (error || !batch) return <div style={{ padding: 24, color: "red" }}>{error ?? "Batch tidak ditemukan."}</div>;

    const dateTitle = fmtDateTitle(batch.runBegin);

    // Baris F0 pendek untuk header
    const f0Line = [
        ...["fo1","fo2","fo3","fo4","fo5","fo6"].map((k,i) => `F0${i+1}:${fmtTemp(batch[k])}`),
        `FOH:${fmtTemp(batch.foh)}`,
        `FOM:${fmtTemp(batch.fom)}`,
        `FOL:${fmtTemp(batch.fol)}`,
    ].join("  ");

    // Data kurva disamakan dengan halaman Trend:
    // Menggunakan _label (waktu aktual) sehingga kurva membentang 100% penuh
    // dari awal hingga akhir batch tanpa terpotong di tengah jalan.
    const chartData = trend.map((row) => ({
        ...row,
        _label: fmtTime(row.ts),
    }));

    // Cari _label terdekat untuk garis bantu fase Heat/Ster/Cool Begin
    function findClosestLabel(dateStr) {
        if (!dateStr || !trend || trend.length === 0) return null;
        const targetMs = new Date(dateStr).getTime();
        let closest = trend[0];
        let minDiff = Math.abs(new Date(closest.ts).getTime() - targetMs);
        for (let i = 1; i < trend.length; i++) {
            const diff = Math.abs(new Date(trend[i].ts).getTime() - targetMs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = trend[i];
            }
        }
        return fmtTime(closest.ts);
    }
    const heatX = findClosestLabel(batch.heatBegin);
    const sterX = findClosestLabel(batch.sterBegin);
    const coolX = findClosestLabel(batch.coolBegin);

    // Tutup tab jika dibuka sebagai tab baru (window.opener), atau back jika tidak
    function handleBack() {
        if (window.history.length <= 1 || window.opener) {
            window.close();
        } else {
            window.history.back();
        }
    }

    return (
        <>
            {/* ── CSS cetak ── */}
            <style>{`
                @page { size: A4 landscape; margin: 10mm; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    /* Jaga agar header + grafik tidak terpisah antar halaman */
                    .curve-block { page-break-inside: avoid; break-inside: avoid; }
                }
                body { font-family: 'IBM Plex Mono','Courier New',monospace; background: #fff; color: #000; margin: 0; }
            `}</style>

            {/* ── Toolbar ── */}
            <div className="no-print" style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#f3f4f6", borderBottom: "1px solid #d1d5db" }}>
                <button
                    onClick={() => window.print()}
                    style={{ padding: "5px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                >
                    🖨 Cetak
                </button>
                <button
                    onClick={handleBack}
                    style={{ padding: "5px 14px", background: "#e5e7eb", border: "1px solid #9ca3af", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                >
                    ← Kembali
                </button>
            </div>

            {/* ── Isi laporan — dibungkus curve-block agar header+grafik satu halaman ── */}
            <div style={{ padding: "6mm 10mm", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#000", maxWidth: "297mm", margin: "0 auto", boxSizing: "border-box" }}>
            <div className="curve-block">

                {/* Judul */}
                <div style={{ textAlign: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>TEMPERATURE PRESSURE CURVE</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>{dateTitle}</div>
                </div>

                {/* Header */}
                <div style={{ marginBottom: 4, fontSize: 10 }}>
                    <HRow cols={[{ label: "Prod.Name :", value: fmtStr(batch.productName) }]} />
                    <HRow cols={[
                        { label: "Prod.Spec.:", value: fmtStr(batch.productSpec), flex: 2 },
                        { label: "Loading   :", value: fmtStr(batch.loadingNo), flex: 1 },
                    ]} />
                    <HRow cols={[
                        { label: "Operator  :", value: fmtStr(batch.operator), flex: 1 },
                        { label: "Batch.No. :", value: fmtStr(batch.batchNo), flex: 1 },
                        { label: "Mach. ID. :", value: fmtStr(batch.machineId), flex: 1 },
                    ]} />
                    <HRow cols={[
                        { label: "Ster.Temp :", value: `${fmtTemp(batch.sterTemp)} °C`, flex: 1 },
                        { label: "Ctrl.Type :", value: fmtStr(batch.ctrlType), flex: 1 },
                        { label: "Cool.Temp :", value: `${fmtTemp(batch.coolTemp)} °C`, flex: 1 },
                    ]} />
                    <HRow cols={[
                        { label: "Heat.Begin:", value: fmtTime(batch.heatBegin), flex: 1 },
                        { label: "Ster.Begin:", value: fmtTime(batch.sterBegin), flex: 1 },
                        { label: "Cool.Begin:", value: fmtTime(batch.coolBegin), flex: 1 },
                    ]} />
                    <HRow cols={[
                        { label: "Heat.Time :", value: `${fmtMin(batch.heatTimeMin)} Min`, flex: 1 },
                        { label: "Ster.Time :", value: `${fmtMin(batch.sterTimeMin)} Min`, flex: 1 },
                        { label: "Cool.Time :", value: `${fmtMin(batch.coolTimeMin)} Min`, flex: 1 },
                    ]} />
                    <div style={{ fontSize: 10, marginTop: 2 }}>{f0Line}</div>
                </div>

                {/* ── Grafik: fixed width 940px pas untuk A4 landscape (297mm-20mm margin) ── */}
                <div style={{ position: "relative", width: 940, height: 480 }}>
                    <ManualLegend />
                    <LineChart
                        width={940}
                        height={480}
                        data={chartData}
                        margin={{ top: 10, right: 64, bottom: 20, left: 46 }}
                    >
                        <CartesianGrid stroke="#ccc" strokeWidth={0.5} />
                        <XAxis
                            dataKey="_label"
                            tick={{ fontSize: 9 }}
                            minTickGap={20}
                            tickLine={false}
                        />
                        {/* Sumbu Y kiri — suhu */}
                        <YAxis
                            yAxisId="left"
                            domain={[0, 150]}
                            ticks={[0,15,30,45,60,75,90,105,120,135,150]}
                            tick={{ fontSize: 9 }}
                            label={{ value: "Deg.C", angle: -90, position: "insideLeft", offset: -4, fontSize: 9 }}
                        />
                        {/* Sumbu Y kanan — tekanan */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 304]}
                            ticks={P_TICKS}
                            tick={{ fontSize: 9 }}
                            label={{ value: "Kpa", angle: 90, position: "insideRight", offset: -4, fontSize: 9 }}
                        />

                        {/* Garis bantu vertikal fase */}
                        {heatX && <ReferenceLine yAxisId="left" x={heatX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
                        {sterX && <ReferenceLine yAxisId="left" x={sterX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
                        {coolX && <ReferenceLine yAxisId="left" x={coolX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}

                        {/* Garis data */}
                        {LINE_CFG.map(({ key, color, yAxis, dash }) => (
                            <Line
                                key={key}
                                yAxisId={yAxis}
                                type="monotone"
                                dataKey={key}
                                stroke={color}
                                strokeWidth={key === "p" ? 2 : 1.4}
                                strokeDasharray={dash}
                                dot={false}
                                isAnimationActive={false}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4, fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>
                    <span>Begin: {fmtTime(batch.runBegin)}</span>
                    <span>Total: {fmtMin(batch.totalTimeMin)} Min</span>
                    <span>Finish: {fmtTime(batch.runFinish)}</span>
                </div>
            </div>{/* end curve-block */}
            </div>
        </>
    );
}
