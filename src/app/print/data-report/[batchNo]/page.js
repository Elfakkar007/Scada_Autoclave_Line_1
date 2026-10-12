"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    ReferenceLine, ResponsiveContainer,
} from "recharts";
import { eventLabel } from "@/lib/alarmEventLabels";

// ── Helper format waktu Asia/Jakarta ─────────────────────────────────────────
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

// ── Pemetaan phase_code → label ───────────────────────────────────────────────
const PHASE_LABELS = {
    0: "IDLE (pintu terbuka)",
    1: "IDLE (siap)",
    2: "FILLING",
    3: "HEATING",
    4: "STERIL",
    5: "COOLING",
    7: "DRAIN",
    6: "SELESAI",
};

// ── Baris header ──────────────────────────────────────────────────────────────
function HRow({ cols }) {
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

const P_TICKS = [0, 30, 61, 91, 122, 152, 182, 213, 243, 274, 304];

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
export default function PrintDataReport() {
    const { batchNo } = useParams();
    const decoded = decodeURIComponent(batchNo);

    const [batch, setBatch] = useState(null);
    const [trend, setTrend] = useState([]);
    const [alarms, setAlarms] = useState(null); // null = belum dimuat
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!batchNo) return;

        // Fetch batch + trend dan alarm secara paralel
        Promise.all([
            fetch(`/api/batch-records/${encodeURIComponent(decoded)}`).then((r) => r.json()),
            fetch(`/api/alarms/by-batch/${encodeURIComponent(decoded)}`).then((r) => r.json()),
        ])
            .then(([batchJson, alarmJson]) => {
                if (batchJson.ok === false) throw new Error(batchJson.error ?? "Batch tidak ditemukan");
                setBatch(batchJson.batch);
                setTrend(batchJson.trend ?? []);
                setAlarms(alarmJson.ok !== false ? (alarmJson.alarms ?? []) : []);
                // Set document.title di sini (sebelum early return) agar browser
                // memakai nomor batch sebagai nama file default "Save as PDF".
                if (batchJson.batch?.batchNo) {
                    document.title = `${batchJson.batch.batchNo} - Data Record`;
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [batchNo, decoded]);

    // ── JS-based per-section page numbering ──────────────────────────────────
    // CSS counter(page) di Chrome selalu global; @page counter-reset tidak berfungsi.
    // Solusi: beforeprint → inject dynamic <style> + DOM marker untuk halaman ke-2+.
    useEffect(() => {
        const bn = batch?.batchNo;
        // Berjalan kembali setiap kali batch berubah (termasuk saat null → value).
        // Saat belum ada batch, listener didaftarkan tapi cleanup tetap aman.

        const PAGE_H_PX = 1047; // A4 content 277 mm @ 96 dpi

        function cleanup() {
            document.getElementById("js-pn-style")?.remove();
            document.querySelectorAll(".js-pg-inj").forEach((e) => e.remove());
        }

        function beforePrint() {
            cleanup();
            if (!bn) return;

            // Inject SEMUA @bottom-right rules via JS sehingga tidak ada konflik
            // dengan CSS statis. Tidak ada @bottom-right di CSS statis sama sekali.
            // sec-data  : counter(page) — dimulai dari 1 karena section pertama
            // sec-curve : hardcode "Hal. 1" — selalu 1 halaman
            // sec-alarm : hardcode "Hal. 1" — biasanya 1 halaman
            const styleEl = document.createElement("style");
            styleEl.id = "js-pn-style";
            styleEl.textContent = `
                @page sec-data   { @bottom-right { content: "Hal. " counter(page); font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 9px; font-weight: 700; color: #000; } }
                @page sec-curve  { @bottom-right { content: "Hal. 1"; font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 9px; font-weight: 700; color: #000; } }
                @page sec-alarm  { @bottom-right { content: "Hal. 1"; font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 9px; font-weight: 700; color: #000; } }
            `;
            document.head.appendChild(styleEl);

            // 2. Untuk alarm yang lebih dari 1 halaman: inject baris Hal. N
            //    di tbody tepat sebelum baris yang jatuh di halaman berikutnya.
            const alarmEl = document.querySelector(".sec-alarm");
            if (!alarmEl) return;
            const alarmPages = Math.max(1, Math.ceil(alarmEl.scrollHeight / PAGE_H_PX));
            if (alarmPages <= 1) return;

            const tbody = alarmEl.querySelector("tbody");
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll("tr:not(.js-pg-inj)"));
            if (!rows.length) return;

            const rowsPerPage = Math.max(1, Math.floor(rows.length / alarmPages));
            for (let p = 2; p <= alarmPages; p++) {
                const idx = (p - 1) * rowsPerPage;
                if (idx >= rows.length) break;
                const tr = document.createElement("tr");
                tr.className = "js-pg-inj";
                tr.style.breakBefore = "page";
                const td = document.createElement("td");
                td.colSpan = 10;
                td.style.cssText = [
                    "padding: 3px 4px",
                    "font-size: 8px",
                    "color: #333",
                    "border-bottom: 1.5px solid #000",
                    "font-family: 'IBM Plex Mono','Courier New',monospace",
                    "font-weight: 700",
                ].join(";");
                td.textContent = `Log Alarm \u0026 Event \u2022 Batch: ${bn} \u2014 Hal. ${p}`;
                tr.appendChild(td);
                rows[idx].before(tr);
            }
        }

        window.addEventListener("beforeprint", beforePrint);
        window.addEventListener("afterprint", cleanup);
        return () => {
            window.removeEventListener("beforeprint", beforePrint);
            window.removeEventListener("afterprint", cleanup);
            cleanup();
        };
    }, [batch?.batchNo]);

    if (loading) return <div style={{ padding: 24, fontFamily: "monospace" }}>Memuat…</div>;
    if (error || !batch) return <div style={{ padding: 24, color: "red" }}>{error ?? "Batch tidak ditemukan."}</div>;

    const dateTitle = fmtDateTitle(batch.runBegin);

    const f0Row1 = ["fo1","fo2","fo3","fo4","fo5","fo6"].map((k,i) =>
        `F0${i+1}: ${fmtTemp(batch[k])}`
    ).join("  ");
    const f0Row2 = [["FOH",batch.foh],["FOM",batch.fom],["FOL",batch.fol]]
        .map(([l,v]) => `${l}: ${fmtTemp(v)}`).join("  ");

    // ── Data grafik (kurva) ──────────────────────────────────────────────────
    const runBeginMs = batch.runBegin ? new Date(batch.runBegin).getTime() : 0;
    const chartData = trend.map((row) => {
        const xMin = runBeginMs ? (new Date(row.ts).getTime() - runBeginMs) / 60000 : 0;
        return { xMin, ...row };
    });
    const maxXRaw = chartData.length > 0 ? chartData[chartData.length - 1].xMin : 0;
    const xDomainMax = Math.max(100, Math.ceil(maxXRaw / 20) * 20);
    const xTicks = Array.from({ length: xDomainMax / 20 + 1 }, (_, i) => i * 20);

    function toXMin(dateStr) {
        if (!dateStr || !runBeginMs) return null;
        const ms = new Date(dateStr).getTime() - runBeginMs;
        return ms > 0 ? ms / 60000 : null;
    }
    const heatX = toXMin(batch.heatBegin);
    const sterX = toXMin(batch.sterBegin);
    const coolX = toXMin(batch.coolBegin);

    // ── Tabel trend: deteksi pergantian fase ──────────────────────────────────
    // phaseCode dari tiap baris trend dipakai untuk menyisipkan baris separator
    function buildTrendRows() {
        const rows = [];
        let lastPhase = undefined;
        for (let i = 0; i < trend.length; i++) {
            const row = trend[i];
            const phase = row.phaseCode;
            if (phase !== undefined && phase !== null && phase !== lastPhase) {
                if (lastPhase !== undefined) {
                    // Baris separator pergantian fase
                    rows.push({ _separator: true, phase });
                }
                lastPhase = phase;
            }
            rows.push(row);
        }
        return rows;
    }
    const trendRows = buildTrendRows();

    // ── Label event type alarm ────────────────────────────────────────────────
    const EVENT_LABEL = {
        alarm_active:           "ALARM AKTIF",
        alarm_recovery:         "PULIH",
        monitor_gap:            "GAP PEMANTAU",
        communication_abnormal: "KOMUNIKASI ABNORMAL",
        communication_normal:   "KOMUNIKASI NORMAL",
        server_start:           "SERVER START",
    };
    const EVENT_COLOR = {
        alarm_active:           "#a23b2e",
        alarm_recovery:         "#4f7a52",
        monitor_gap:            "#b9762f",
        communication_abnormal: "#b9762f",
    };

    // Handle tombol Kembali: tutup tab ini jika dibuka sebagai tab baru, 
    // kalau tidak, kembali ke history sebelumnya
    function handleBack() {
        if (window.history.length <= 1 || window.opener) {
            window.close();
        } else {
            window.history.back();
        }
    }


    return (
        <>
            {/* ── CSS cetak + preview ── */}
            <style>{`
                /* ── Named pages: setiap section punya penomoran halaman sendiri ──
                   Browser Chrome/Edge me-reset counter(page) ke 1 saat ganti named page.
                   @bottom-left / @bottom-right: Chrome 131+ / Edge 131+.          */

                @page sec-data {
                    size: A4 portrait;
                    margin: 10mm 10mm 16mm 10mm;
                    @bottom-left {
                        content: "Data Record \u2022 Batch: ${batch.batchNo}";
                        font-family: 'IBM Plex Mono','Courier New',monospace;
                        font-size: 8px; color: #555;
                    }
                    /* @bottom-right dihandle oleh JS beforePrint agar tidak konflik */
                }
                @page sec-curve {
                    size: A4 portrait;
                    margin: 10mm 10mm 16mm 10mm;
                    @bottom-left {
                        content: "Temperature Pressure Curve \u2022 Batch: ${batch.batchNo}";
                        font-family: 'IBM Plex Mono','Courier New',monospace;
                        font-size: 8px; color: #555;
                    }
                    /* @bottom-right dihandle oleh JS beforePrint */
                }
                @page sec-alarm {
                    size: A4 portrait;
                    margin: 10mm 10mm 16mm 10mm;
                    @bottom-left {
                        content: "Log Alarm & Event \u2022 Batch: ${batch.batchNo}";
                        font-family: 'IBM Plex Mono','Courier New',monospace;
                        font-size: 8px; color: #555;
                    }
                    /* @bottom-right dihandle oleh JS beforePrint */
                }

                /* ── Tampilan di layar: simulasi kertas A4 di atas background abu ── */
                @media screen {
                    body { background: #d1d5db !important; }
                    .print-sheet {
                        background: #fff;
                        width: 210mm;
                        min-height: 297mm;
                        margin: 0 auto 28px auto;
                        padding: 14mm;
                        box-sizing: border-box;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.22);
                    }
                    .page-break-screen { margin-top: 28px; }
                }

                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page-break { page-break-before: always; break-before: page; }
                    .keep-together { page-break-inside: avoid; break-inside: avoid; }
                    .curve-block { page-break-inside: avoid; break-inside: avoid; }
                    .print-sheet { width: auto; padding: 0; margin: 0; box-shadow: none; min-height: auto; }
                    .page-break-screen { margin-top: 0; }
                    /* Named page assignment + page break pada transisi section.
                       break-before: page pada sec-curve dan sec-alarm memastikan
                       Chrome mendeteksi transisi named page di titik yang benar,
                       sehingga counter(page) ter-reset ke 1 di setiap section. */
                    .sec-data  { page: sec-data; }
                    .sec-curve { page: sec-curve; break-before: page; counter-reset: page 0; }
                    .sec-alarm { page: sec-alarm; break-before: page; counter-reset: page 0; }
                }

                body { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 11px; color: #000; margin: 0; }
                table { border-collapse: collapse; width: 100%; }
                thead { display: table-header-group; }
                tr { break-inside: avoid; }
                .trend-th { font-weight: 700; font-size: 10px; text-align: center; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 2px 3px; }
                .trend-td { text-align: center; font-size: 10px; padding: 1px 3px; border-bottom: 1px dotted #aaa; }
                .phase-sep { background: #1e2a2e; color: #fff; font-weight: 700; font-size: 10px; padding: 3px 4px; text-align: left; letter-spacing: 1.5px; }
                .alarm-th { font-weight: 700; font-size: 9px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 2px 4px; text-align: left; }
                .alarm-td { font-size: 9px; padding: 1px 4px; border-bottom: 1px dotted #aaa; vertical-align: top; }
            `}</style>

            {/* ── Toolbar sticky (hanya di layar) ── */}
            <div className="no-print" style={{
                position: "sticky", top: 0, zIndex: 99,
                display: "flex", gap: 8, padding: "10px 20px",
                background: "#1e2a2e", alignItems: "center",
                fontFamily: "'IBM Plex Mono','Courier New',monospace",
            }}>
                <button
                    onClick={() => window.print()}
                    style={{ padding: "6px 16px", background: "#1c6e74", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 13 }}
                >
                    🖨 Cetak / Save PDF
                </button>
                <button
                    onClick={handleBack}
                    style={{ padding: "6px 14px", background: "transparent", border: "1px solid #4f7a52", borderRadius: 4, cursor: "pointer", fontSize: 13, color: "#d8dedc" }}
                >
                    ← Kembali
                </button>
                <span style={{ fontSize: 12, color: "#8fa09e", marginLeft: "auto" }}>
                    {batch.batchNo} — Data Record + Kurva + Alarm
                </span>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                BAGIAN 1: DATA RECORD (tabel trend)
                ═══════════════════════════════════════════════════════════════ */}
            <div className="print-sheet sec-data" style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, color: "#000" }}>

                {/* Judul */}
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 3 }}>DATA REPORT</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{dateTitle}</div>
                </div>

                {/* Header blok */}
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
                    <div style={{ borderBottom: "1px dotted #aaa", padding: "1px 0", fontSize: 11 }}>{f0Row1}</div>
                    <div style={{ borderBottom: "1px dotted #aaa", padding: "1px 0", fontSize: 11 }}>{f0Row2}</div>
                    <div style={{ borderBottom: "1px dotted #aaa", padding: "1px 0", fontSize: 11 }}>
                        {`F0 Min: ${fmtTemp(batch.foMin)}  FOVal: ${fmtTemp(batch.foValSetting)}`}
                        {batch.f0Meta && batch.f0Meta.complete === false ? "  (* F0 dihitung dari data tidak lengkap)" : ""}
                    </div>
                    <HRow cols={[
                        { label: "Run.Begin :", value: fmtTime(batch.runBegin), flex: 1 },
                        { label: "Run.Finish:", value: fmtTime(batch.runFinish), flex: 1 },
                        { label: "Total.Time:", value: `${fmtMin(batch.totalTimeMin)} MIN`, flex: 1 },
                    ]} />
                </div>

                {/* Tabel trend dengan separator fase */}
                <table>
                    <thead>
                        <tr>
                            {["Time","T1","T2","T3","T4","T5","T6","P","TH","TM","TL","Avg","Cond"].map((h) => (
                                <th key={h} className="trend-th">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {trendRows.length === 0 ? (
                            <tr><td colSpan={13} style={{ textAlign: "center", padding: 8, fontSize: 11 }}>Tidak ada data trend</td></tr>
                        ) : trendRows.map((row, i) => {
                            if (row._separator) {
                                const label = PHASE_LABELS[row.phase] ?? `FASE ${row.phase}`;
                                return (
                                    <tr key={`sep-${i}`}>
                                        <td colSpan={13} className="phase-sep">
                                            ▶ {label}
                                        </td>
                                    </tr>
                                );
                            }
                            return (
                                <tr key={row.id ?? i}>
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
                            );
                        })}
                    </tbody>
                </table>
            </div>{/* end print-sheet bagian 1 */}

            {/* ═══════════════════════════════════════════════════════════════
                BAGIAN 2: TEMPERATURE & PRESSURE CURVE (halaman baru)
                Dibungkus keep-together agar header + grafik tidak terpisah
                ═══════════════════════════════════════════════════════════════ */}
            <div className="print-sheet page-break-screen sec-curve" style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#000" }}>
                <div className="curve-block keep-together">
                    {/* Judul kurva */}
                    <div style={{ textAlign: "center", marginBottom: 6 }}>
                        <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>TEMPERATURE PRESSURE CURVE</div>
                        <div style={{ fontSize: 10, marginTop: 2 }}>{dateTitle} — Batch: {fmtStr(batch.batchNo)}</div>
                    </div>

                    {/* Header mini kurva */}
                    <div style={{ marginBottom: 4, fontSize: 10 }}>
                        <HRow cols={[
                            { label: "Operator  :", value: fmtStr(batch.operator), flex: 1 },
                            { label: "Batch.No. :", value: fmtStr(batch.batchNo), flex: 1 },
                            { label: "Loading   :", value: fmtStr(batch.loadingNo), flex: 1 },
                        ]} />
                        <HRow cols={[
                            { label: "Heat.Begin:", value: fmtTime(batch.heatBegin), flex: 1 },
                            { label: "Ster.Begin:", value: fmtTime(batch.sterBegin), flex: 1 },
                            { label: "Cool.Begin:", value: fmtTime(batch.coolBegin), flex: 1 },
                        ]} />
                        <div style={{ fontSize: 10 }}>
                            {[..."fo1fo2fo3fo4fo5fo6".match(/.{3}/g)].map((k,i) => `F0${i+1}:${fmtTemp(batch[k])}`).join("  ")}
                            {"  "}FOH:{fmtTemp(batch.foh)}  FOM:{fmtTemp(batch.fom)}  FOL:{fmtTemp(batch.fol)}
                        </div>
                    </div>

                    {/* Grafik */}
                    {chartData.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", fontSize: 11, color: "#555" }}>
                            Tidak ada data trend untuk grafik
                        </div>
                    ) : (
                        // Grafik dicetak dalam lebar fixed 680px = pas untuk A4 portrait
                        // setelah margin 10mm kiri+kanan (≈0mm sisa). ResponsiveContainer
                        // bergantung DOM size yang tidak reliabel saat print, maka pakai fixed.
                        <div style={{ position: "relative", width: 680 }}>
                            <ManualLegend />
                            <LineChart
                                width={680}
                                height={400}
                                data={chartData}
                                margin={{ top: 10, right: 64, bottom: 20, left: 46 }}
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
                                <YAxis
                                    yAxisId="left"
                                    domain={[0, 150]}
                                    ticks={[0,15,30,45,60,75,90,105,120,135,150]}
                                    tick={{ fontSize: 9 }}
                                    label={{ value: "Deg.C", angle: -90, position: "insideLeft", offset: -4, fontSize: 9 }}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    domain={[0, 304]}
                                    ticks={P_TICKS}
                                    tick={{ fontSize: 9 }}
                                    label={{ value: "Kpa", angle: 90, position: "insideRight", offset: -4, fontSize: 9 }}
                                />
                                {heatX !== null && <ReferenceLine yAxisId="left" x={heatX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
                                {sterX !== null && <ReferenceLine yAxisId="left" x={sterX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
                                {coolX !== null && <ReferenceLine yAxisId="left" x={coolX} stroke="#888" strokeDasharray="4 2" strokeWidth={0.8} />}
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
                    )}

                    {/* Footer grafik */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 4 }}>
                        <span>Begin: {fmtTime(batch.runBegin)}</span>
                        <span>Total: {fmtMin(batch.totalTimeMin)} Min</span>
                        <span>Finish: {fmtTime(batch.runFinish)}</span>
                    </div>
            </div>{/* end curve-block */}
            </div>{/* end print-sheet bagian 2 */}

            {/* ═══════════════════════════════════════════════════════════════
                BAGIAN 3: DATA ALARM BATCH
                ═══════════════════════════════════════════════════════════════ */}
            <div className="print-sheet page-break-screen sec-alarm" style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, color: "#000" }}>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>LOG ALARM & EVENT</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                        Batch: {fmtStr(batch.batchNo)} — {fmtTime(batch.runBegin)} s/d {fmtTime(batch.runFinish)}
                    </div>
                </div>

                {alarms === null ? (
                    <div style={{ textAlign: "center", padding: 8 }}>Memuat data alarm…</div>
                ) : alarms.length === 0 ? (
                    <table>
                        <thead>
                            <tr>
                                {["Alarm Date","Event Date","Variable","Alarm Type","Alarm Value","Recovery","Limit","Event","Operator","Keterangan"].map((h) => (
                                    <th key={h} className="alarm-th">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={10} style={{ textAlign: "center", padding: "12px 4px", fontSize: 10, color: "#555" }}>
                                    Tidak ada alarm selama batch ini berlangsung
                                </td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                {["Alarm Date","Event Date","Variable","Alarm Type","Alarm Value","Recovery","Limit","Event","Operator","Keterangan"].map((h) => (
                                    <th key={h} className="alarm-th">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {alarms.map((row, i) => {
                                // Format tanggal lengkap (bukan hanya waktu) agar sesuai dengan
                                // halaman alarm asli yang menampilkan tanggal + jam
                                const fmtDt = (ds) => {
                                    if (!ds) return "-";
                                    return new Date(ds).toLocaleString("id-ID", {
                                        timeZone: "Asia/Jakarta",
                                        day: "2-digit", month: "2-digit", year: "numeric",
                                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                                        hour12: false,
                                    });
                                };
                                const isAlarm = row.eventType === "alarm_active";
                                return (
                                    <tr key={row.id ?? i}>
                                        <td className="alarm-td" style={{ whiteSpace: "nowrap" }}>{fmtDt(row.alarmDate)}</td>
                                        <td className="alarm-td" style={{ whiteSpace: "nowrap" }}>{fmtDt(row.eventDate)}</td>
                                        <td className="alarm-td">{row.variableName || "-"}</td>
                                        <td className="alarm-td">{row.alarmType || "-"}</td>
                                        <td className="alarm-td" style={{ textAlign: "center" }}>{row.alarmValue !== null && row.alarmValue !== undefined ? fmtTemp(row.alarmValue) : "-"}</td>
                                        <td className="alarm-td" style={{ textAlign: "center" }}>{row.recoveryValue !== null && row.recoveryValue !== undefined ? fmtTemp(row.recoveryValue) : "-"}</td>
                                        <td className="alarm-td" style={{ textAlign: "center" }}>{row.limitValue !== null && row.limitValue !== undefined ? fmtTemp(row.limitValue) : "-"}</td>
                                        <td className="alarm-td" style={{ fontWeight: isAlarm ? 700 : 400 }}>{eventLabel(row.eventType)}</td>
                                        <td className="alarm-td">{row.operator || "-"}</td>
                                        <td className="alarm-td" style={{ maxWidth: 200, wordBreak: "break-word" }}>{row.description || "-"}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>{/* end print-sheet bagian 3 */}
        </>
    );
}
