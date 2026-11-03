"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import PermissionGate from "@/components/PermissionGate";
import SignOffBlock from "@/components/SignOffBlock";

// ── Helper format ─────────────────────────────────────────────────────────────
function toWIBStr(date) {
    return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

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

function fmtStr(v) {
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
}

function fmtTemp(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : "-";
}

function fmtMin(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return (Math.floor(n * 10) / 10).toFixed(1);
}

// ── Cap waktu cetak untuk nama file ──────────────────────────────────────────
function fileStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "00";
    return `${g("day")}-${g("month")}-${g("year")} ${g("hour")}.${g("minute")}.${g("second")}`;
}

// Teks aman untuk string CSS
const cssStr = (v) => `"${String(v ?? "").replace(/[\\"\n\r]/g, " ")}"`;

// ── Konfigurasi garis (sama dengan halaman Trend) ─────────────────────────────
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

const P_TICKS = [0, 30, 61, 91, 122, 152, 182, 213, 243, 274, 304];

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

// ── Baris header gaya printout ────────────────────────────────────────────────
function HRow({ cols }) {
    return (
        <div style={{ display: "flex", gap: 8, fontSize: 9, marginBottom: 1 }}>
            {cols.map(({ label, value, flex = 1 }, i) => (
                <div key={i} style={{ flex, display: "flex", gap: 3 }}>
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
                    <span>{value}</span>
                </div>
            ))}
        </div>
    );
}

// ── Konten halaman cetak ──────────────────────────────────────────────────────
function TrendPrintContent() {
    const router = useRouter();
    const { batchNo } = useParams();
    const decoded = decodeURIComponent(batchNo ?? "");

    const [batch, setBatch] = useState(null);
    const [trend, setTrend] = useState([]);
    const [user, setUser] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [printedAt, setPrintedAt] = useState("");

    // Judul dokumen / nama file PDF
    const docTitle = decoded ? `Trend Batch ${decoded}` : "Trend";

    // Sinkronkan title + footer saat cetak
    useEffect(() => {
        document.title = docTitle;
        function onBeforePrint() {
            const now = new Date();
            flushSync(() => setPrintedAt(toWIBStr(now)));
            document.title = `${docTitle} (dicetak ${fileStamp(now)})`;
        }
        function onAfterPrint() {
            document.title = docTitle;
        }
        window.addEventListener("beforeprint", onBeforePrint);
        window.addEventListener("afterprint", onAfterPrint);
        return () => {
            window.removeEventListener("beforeprint", onBeforePrint);
            window.removeEventListener("afterprint", onAfterPrint);
        };
    }, [docTitle]);

    // Tombol Kembali — tutup tab jika dibuka dari tab lain
    function handleBack() {
        if (window.opener || window.history.length <= 1) {
            try { window.opener?.focus(); } catch { /* abaikan */ }
            window.close();
            setTimeout(() => { if (!window.closed) router.push("/trend"); }, 300);
            return;
        }
        router.back();
    }

    function handlePrint() {
        window.print();
    }

    // Fetch user + data batch
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((j) => { if (j.ok) setUser(j.user?.fullName ?? j.user?.username ?? ""); })
            .catch(() => {});

        if (!decoded) { setLoading(false); return; }

        fetch(`/api/batch-records/${encodeURIComponent(decoded)}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.ok === false) throw new Error(json.error ?? "Batch tidak ditemukan");
                setBatch(json.batch ?? null);
                setTrend(json.trend ?? []);
                setPrintedAt(toWIBStr(new Date()));
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [decoded]);

    // Cari label X terdekat untuk garis bantu fase
    function findClosestLabel(dateStr) {
        if (!dateStr || trend.length === 0) return null;
        const targetMs = new Date(dateStr).getTime();
        let closest = trend[0];
        let minDiff = Math.abs(new Date(closest.ts).getTime() - targetMs);
        for (let i = 1; i < trend.length; i++) {
            const diff = Math.abs(new Date(trend[i].ts).getTime() - targetMs);
            if (diff < minDiff) { minDiff = diff; closest = trend[i]; }
        }
        return fmtTime(closest.ts);
    }

    const chartData = trend.map((row) => ({ ...row, _label: fmtTime(row.ts) }));
    const heatX = batch ? findClosestLabel(batch.heatBegin) : null;
    const sterX = batch ? findClosestLabel(batch.sterBegin) : null;
    const coolX = batch ? findClosestLabel(batch.coolBegin) : null;
    const dateTitle = batch ? fmtDateTitle(batch.runBegin) : "";

    return (
        <>
            <style>{`
                @page {
                    size: A4 landscape;
                    margin: 6mm 10mm 14mm 10mm;
                    @bottom-left {
                        content: ${cssStr(`${docTitle} | Dicetak oleh ${user || "?"} pada ${printedAt}`)};
                        font-family: 'IBM Plex Mono','Courier New',monospace;
                        font-size: 8px;
                        color: #000;
                    }
                    @bottom-right {
                        content: "Halaman " counter(page) " dari " counter(pages);
                        font-family: 'IBM Plex Mono','Courier New',monospace;
                        font-size: 9px;
                        font-weight: 700;
                        color: #000;
                    }
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .curve-block { page-break-inside: avoid; break-inside: avoid; }
                }
                body { font-family: 'IBM Plex Mono','Courier New',monospace; background: #fff; color: #000; margin: 0; }
            `}</style>

            {/* ── Toolbar ── */}
            <div className="no-print" style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#f3f4f6", borderBottom: "1px solid #d1d5db" }}>
                <button
                    onClick={handlePrint}
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

            {/* ── Isi cetak ── */}
            <div style={{ padding: "4mm 10mm", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#000", maxWidth: "297mm", margin: "0 auto", boxSizing: "border-box" }}>

                {loading && <div style={{ textAlign: "center", padding: 24 }}>Memuat…</div>}
                {error && <div style={{ textAlign: "center", color: "red", padding: 12 }}>Error: {error}</div>}

                {!loading && !error && !batch && (
                    <div style={{ textAlign: "center", padding: 24 }}>Batch tidak ditemukan.</div>
                )}

                {!loading && !error && batch && (
                    <div className="curve-block">
                        {/* Judul */}
                        <div style={{ textAlign: "center", marginBottom: 4 }}>
                            <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 2 }}>TEMPERATURE PRESSURE CURVE</div>
                            <div style={{ fontSize: 9, marginTop: 1 }}>{dateTitle}</div>
                            <div style={{ fontSize: 8, marginTop: 1 }}>
                                Dicetak oleh {user || "?"} pada {printedAt}
                            </div>
                        </div>

                        {/* Header info batch */}
                        <div style={{ marginBottom: 4 }}>
                            <HRow cols={[
                                { label: "Prod.Name :", value: fmtStr(batch.productName), flex: 2 },
                                { label: "Amount    :", value: batch.bottleCount != null ? `${batch.bottleCount} Botol` : "-", flex: 1 },
                            ]} />
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
                        </div>

                        {/* Grafik atau pesan kosong */}
                        {trend.length === 0 ? (
                            <div style={{ textAlign: "center", padding: 32, border: "1px solid #ccc", borderRadius: 4 }}>
                                Belum ada data trend untuk batch ini.
                            </div>
                        ) : (
                            <div style={{ position: "relative", width: 940, height: 360 }}>
                                <ManualLegend />
                                <LineChart
                                    width={940}
                                    height={360}
                                    data={chartData}
                                    margin={{ top: 6, right: 64, bottom: 16, left: 46 }}
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
                                        ticks={[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150]}
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
                        )}

                        {/* Footer ringkas */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginTop: 2 }}>
                            <span>Begin: {fmtTime(batch.runBegin)}</span>
                            <span>Total: {fmtMin(batch.totalTimeMin)} Min</span>
                            <span>Finish: {fmtTime(batch.runFinish)}</span>
                        </div>

                        <SignOffBlock style={{ marginTop: 10 }} />
                    </div>
                )}
            </div>
        </>
    );
}

export default function PrintTrendPage() {
    return (
        <PermissionGate resource="trend" minLevel="view">
            <TrendPrintContent />
        </PermissionGate>
    );
}

