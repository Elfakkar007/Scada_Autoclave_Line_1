"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    ReferenceLine, ResponsiveContainer, Tooltip,
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

// ── Konfigurasi garis grafik ──────────────────────────────────────────────────
const LINE_CFG = [
    { key: "th",  color: "#d4b400", label: "TH",  yAxis: "left"  },
    { key: "tm",  color: "#8b0000", label: "TM",  yAxis: "left"  },
    { key: "tl",  color: "#8b4513", label: "TL",  yAxis: "left"  },
    { key: "t1",  color: "#000000", label: "T1",  yAxis: "left"  },
    { key: "t2",  color: "#e00000", label: "T2",  yAxis: "left"  },
    { key: "t3",  color: "#c000c0", label: "T3",  yAxis: "left"  },
    { key: "t4",  color: "#00aadd", label: "T4",  yAxis: "left"  },
    { key: "t5",  color: "#00aa00", label: "T5",  yAxis: "left"  },
    { key: "t6",  color: "#ff8800", label: "T6",  yAxis: "left"  },
    { key: "p",   color: "#003399", label: "P",   yAxis: "right" },
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
        <div style={{ position: "absolute", top: 0, right: 0, fontSize: 9, lineHeight: "16px", background: "rgba(255,255,255,0.85)", padding: "4px 6px", border: "1px solid #ccc" }}>
            {LINE_CFG.map(({ key, color, label }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="1.5" /></svg>
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

    // Konversi trend ke menit sejak runBegin untuk sumbu X
    const runBeginMs = batch.runBegin ? new Date(batch.runBegin).getTime() : 0;
    const chartData = trend.map((row) => {
        const xMin = runBeginMs ? (new Date(row.ts).getTime() - runBeginMs) / 60000 : 0;
        return { xMin, ...row };
    });

    // Domain X: kelipatan 20, minimum 100 atau lebih dari durasi data
    const maxXRaw = chartData.length > 0 ? chartData[chartData.length - 1].xMin : 0;
    const xDomainMax = Math.max(100, Math.ceil(maxXRaw / 20) * 20);
    const xTicks = Array.from({ length: xDomainMax / 20 + 1 }, (_, i) => i * 20);

    // Garis bantu vertikal: menit sejak runBegin untuk heat/ster/cool begin
    function toXMin(dateStr) {
        if (!dateStr || !runBeginMs) return null;
        const ms = new Date(dateStr).getTime() - runBeginMs;
        return ms > 0 ? ms / 60000 : null;
    }
    const heatX = toXMin(batch.heatBegin);
    const sterX = toXMin(batch.sterBegin);
    const coolX = toXMin(batch.coolBegin);

    return (
        <>
            {/* ── CSS cetak ── */}
            <style>{`
                @page { size: A4 landscape; margin: 10mm; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
                    onClick={() => window.history.back()}
                    style={{ padding: "5px 14px", background: "#e5e7eb", border: "1px solid #9ca3af", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                >
                    ← Kembali
                </button>
            </div>

            {/* ── Isi laporan ── */}
            <div style={{ padding: "6mm 10mm", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#000", maxWidth: "297mm", margin: "0 auto", boxSizing: "border-box" }}>

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

                {/* ── Grafik ── */}
                <div style={{ position: "relative", width: 1000, height: 560 }}>
                    <ManualLegend />
                    <LineChart
                        width={1000}
                        height={560}
                        data={chartData}
                        margin={{ top: 10, right: 60, bottom: 20, left: 50 }}
                    >
                        <CartesianGrid stroke="#ccc" strokeWidth={0.5} />
                        <XAxis
                            dataKey="xMin"
                            type="number"
                            domain={[0, xDomainMax]}
                            ticks={xTicks}
                            tick={{ fontSize: 9 }}
                            label={{ value: "Min", position: "insideBottomRight", offset: -4, fontSize: 9 }}
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
                        {heatX !== null && <ReferenceLine yAxisId="left" x={heatX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
                        {sterX !== null && <ReferenceLine yAxisId="left" x={sterX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
                        {coolX !== null && <ReferenceLine yAxisId="left" x={coolX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}

                        {/* Garis data */}
                        {LINE_CFG.map(({ key, color, yAxis }) => (
                            <Line
                                key={key}
                                yAxisId={yAxis}
                                type="linear"
                                dataKey={key}
                                stroke={color}
                                strokeWidth={1.3}
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
            </div>
        </>
    );
}
