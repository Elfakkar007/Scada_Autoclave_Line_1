"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

// ── Helper format waktu Asia/Jakarta H:mm:ss ─────────────────────────────────
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

// Tanggal judul: YYYY/M/D dari runBegin
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

// 1 desimal untuk suhu & F0
function fmtTemp(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : "-";
}

// Bilangan bulat untuk P dan Cond (P bisa negatif)
function fmtInt(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n).toString() : "-";
}

// Menit 1 desimal dibulatkan ke bawah
function fmtMin(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return (Math.floor(n * 10) / 10).toFixed(1);
}

// Nilai string biasa atau "-"
function fmtStr(v) {
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
}

// ── Baris header (label : value) ─────────────────────────────────────────────
function HRow({ cols }) {
    // cols: array { label, value, wide? }
    return (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px dotted #aaa", padding: "1px 0", fontSize: 11 }}>
            {cols.map(({ label, value, flex = 1 }, i) => (
                <div key={i} style={{ flex, display: "flex", gap: 4 }}>
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
                    <span style={{ fontWeight: 400 }}>{value}</span>
                </div>
            ))}
        </div>
    );
}

// ── Halaman cetak ─────────────────────────────────────────────────────────────
export default function PrintDataReport() {
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

    // Baris F0 — nilai 1 desimal
    const f0Row1 = ["fo1","fo2","fo3","fo4","fo5","fo6"].map((k,i) =>
        `F0${i+1}: ${fmtTemp(batch[k])}`
    ).join("  ");
    const f0Row2 = [["FOH",batch.foh],["FOM",batch.fom],["FOL",batch.fol]]
        .map(([l,v]) => `${l}: ${fmtTemp(v)}`).join("  ");

    return (
        <>
            {/* ── CSS cetak ── */}
            <style>{`
                @page { size: A4 portrait; margin: 10mm; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 11px; background: #fff; color: #000; margin: 0; }
                table { border-collapse: collapse; width: 100%; }
                thead { display: table-header-group; }
                tr { break-inside: avoid; }
                .trend-th { font-weight: 700; font-size: 10px; text-align: center; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 2px 3px; }
                .trend-td { text-align: center; font-size: 10px; padding: 1px 3px; border-bottom: 1px dotted #aaa; }
            `}</style>

            {/* ── Toolbar (disembunyikan saat cetak) ── */}
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
            <div style={{ padding: "10mm 10mm 4mm 10mm", fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, color: "#000", maxWidth: "210mm", margin: "0 auto", boxSizing: "border-box" }}>

                {/* Judul */}
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 3 }}>DATA REPORT</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{dateTitle}</div>
                </div>

                {/* ── Header blok ── */}
                <div style={{ border: "1px solid #555", padding: "4px 6px", marginBottom: 6, fontSize: 11 }}>
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
                        { label: "Heat.Time :", value: `${fmtMin(batch.heatTimeMin)} MIN`, flex: 1 },
                        { label: "Ster.Time :", value: `${fmtMin(batch.sterTimeMin)} MIN`, flex: 1 },
                        { label: "Cool.Time :", value: `${fmtMin(batch.coolTimeMin)} MIN`, flex: 1 },
                    ]} />

                    {/* Baris F0 */}
                    <div style={{ borderBottom: "1px dotted #aaa", padding: "1px 0", fontSize: 11 }}>
                        {f0Row1}
                    </div>
                    <div style={{ borderBottom: "1px dotted #aaa", padding: "1px 0", fontSize: 11 }}>
                        {f0Row2}
                    </div>

                    <HRow cols={[
                        { label: "Run.Begin :", value: fmtTime(batch.runBegin), flex: 1 },
                        { label: "Run.Finish:", value: fmtTime(batch.runFinish), flex: 1 },
                        { label: "Total.Time:", value: `${fmtMin(batch.totalTimeMin)} MIN`, flex: 1 },
                    ]} />
                </div>

                {/* ── Tabel trend ── */}
                <table>
                    <thead>
                        <tr>
                            {["Time","T1","T2","T3","T4","T5","T6","P","TH","TM","TL","Avg","Cond"].map((h) => (
                                <th key={h} className="trend-th">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {trend.length === 0 ? (
                            <tr><td colSpan={13} style={{ textAlign: "center", padding: 8, fontSize: 11 }}>Tidak ada data trend</td></tr>
                        ) : trend.map((row, i) => (
                            <tr key={i}>
                                <td className="trend-td" style={{ whiteSpace: "nowrap" }}>{fmtTime(row.ts)}</td>
                                <td className="trend-td">{fmtTemp(row.t1)}</td>
                                <td className="trend-td">{fmtTemp(row.t2)}</td>
                                <td className="trend-td">{fmtTemp(row.t3)}</td>
                                <td className="trend-td">{fmtTemp(row.t4)}</td>
                                <td className="trend-td">{fmtTemp(row.t5)}</td>
                                <td className="trend-td">{fmtTemp(row.t6)}</td>
                                <td className="trend-td">{fmtInt(row.p)}</td>
                                <td className="trend-td">{fmtTemp(row.th)}</td>
                                <td className="trend-td">{fmtTemp(row.tm)}</td>
                                <td className="trend-td">{fmtTemp(row.tl)}</td>
                                <td className="trend-td">{fmtTemp(row.avg)}</td>
                                <td className="trend-td">{fmtInt(row.cond)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
