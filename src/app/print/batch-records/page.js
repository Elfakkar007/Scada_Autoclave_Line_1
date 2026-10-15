"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function toWIBStr(date) {
    return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

function fmtDec1(v) {
    if (v === null || v === undefined || v === "") return "-";
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : "-";
}

function fmtTemp(v) {
    if (v === null || v === undefined || v === "") return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function BatchRecordsPrintContent() {
    const searchParams = useSearchParams();
    const from   = searchParams.get("from")   ?? "";
    const to     = searchParams.get("to")     ?? "";
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";

    const [rows, setRows]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [user, setUser]       = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [printedAt, setPrintedAt] = useState("");

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((j) => { if (j.ok) setUser(j.user?.username ?? ""); })
            .catch(() => {});

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrintedAt(toWIBStr(new Date()));

        const p = new URLSearchParams({ format: "json" });
        if (from)   p.set("from",   from);
        if (to)     p.set("to",     to);
        if (search) p.set("search", search);
        if (status) p.set("status", status);

        fetch(`/api/batch-records/export?${p}`)
            .then((r) => r.json())
            .then((j) => {
                if (j.ok === false) throw new Error(j.error ?? "Gagal memuat data");
                setRows(j.rows ?? []);
                setTotal(j.total ?? 0);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [from, to, search, status]);

    const periode = (from || to)
        ? `${from || "—"} s/d ${to || "—"}`
        : "Semua";

    return (
        <>
            <style>{`
                @page { size: A4 landscape; margin: 8mm 8mm 10mm 8mm; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    th { border: 1px solid #000 !important; background: #e2e8f0 !important; }
                    td { border: 0.5pt solid #475569 !important; }
                }
                body { font-family: 'IBM Plex Mono','Courier New',monospace; background:#fff; color:#000; margin:0; font-size:9px; }
                table { border-collapse: collapse; width: 100%; border: 1.5px solid #000; }
                thead { display: table-header-group; }
                tr { break-inside: avoid; }
                th {
                    font-weight: 700;
                    font-size: 8px;
                    border: 1px solid #334155;
                    padding: 3px 2px;
                    text-align: center;
                    background: #f1f5f9;
                    white-space: nowrap;
                    letter-spacing: 0.2px;
                }
                td {
                    font-size: 8px;
                    padding: 2.5px 2px;
                    border: 1px solid #94a3b8;
                    text-align: center;
                    white-space: nowrap;
                }
                td:first-child { text-align: left; }
                td.col-prod { text-align: left; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            `}</style>

            {/* Toolbar */}
            <div className="no-print" style={{ display:"flex", gap:8, padding:"8px 12px", background:"#f3f4f6", borderBottom:"1px solid #d1d5db" }}>
                <button onClick={() => window.print()} style={{ padding:"5px 14px", background:"#1d4ed8", color:"#fff", border:"none", borderRadius:4, cursor:"pointer", fontWeight:600, fontSize:13 }}>🖨 Cetak</button>
                <button onClick={() => { if (window.history.length <= 1 || window.opener) { window.close(); } else { window.history.back(); } }} style={{ padding:"5px 14px", background:"#e5e7eb", border:"1px solid #9ca3af", borderRadius:4, cursor:"pointer", fontSize:13 }}>← Kembali</button>
            </div>

            <div style={{ padding:"6mm 8mm 4mm 8mm" }}>
                {/* Judul */}
                <div style={{ textAlign:"center", marginBottom:6 }}>
                    <div style={{ fontWeight:900, fontSize:13, letterSpacing:2 }}>DATA REPORT — DAFTAR BATCH</div>
                    <div style={{ fontSize:9.5 }}>Periode: {periode}</div>
                    <div style={{ fontSize:8.5, marginTop:2, color:"#333" }}>Dicetak oleh {user || "?"} pada {printedAt} | {total} baris</div>
                    {(search || status) && (
                        <div style={{ fontSize:8.5, color:"#555" }}>
                            Filter: {[search && `cari="${search}"`, status && `status="${status}"`].filter(Boolean).join(", ")}
                        </div>
                    )}
                </div>

                {loading && <div style={{ textAlign:"center", padding:24 }}>Memuat…</div>}
                {error   && <div style={{ textAlign:"center", color:"red", padding:12 }}>Error: {error}</div>}
                {!loading && !error && (
                    <table>
                        <thead>
                            <tr>
                                {["Batch No","Loading","Produk","Operator","Mach.ID","Ster°C",
                                  "Run Begin","Run Finish","Total","Heat","Ster","Cool",
                                  "F0Min","FO1","FO2","FO3","FO4","FO5","FO6","FOH","FOM","FOL",
                                  "Status"].map((h) => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={23} style={{ textAlign:"center", padding:8 }}>Tidak ada data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={i}>
                                    <td style={{ textAlign:"left", whiteSpace:"nowrap", fontWeight:600 }}>{r.batchNo}</td>
                                    <td>{r.loadingNo || "-"}</td>
                                    <td className="col-prod">{r.productName || "-"}</td>
                                    <td>{r.operator || "-"}</td>
                                    <td>{r.machineId || "-"}</td>
                                    <td>{fmtTemp(r.sterTemp)}</td>
                                    <td style={{ whiteSpace:"nowrap" }}>{r.runBegin || "-"}</td>
                                    <td style={{ whiteSpace:"nowrap" }}>{r.runFinish || "-"}</td>
                                    <td>{fmtDec1(r.totalTimeMin)}</td>
                                    <td>{fmtDec1(r.heatTimeMin)}</td>
                                    <td>{fmtDec1(r.sterTimeMin)}</td>
                                    <td>{fmtDec1(r.coolTimeMin)}</td>
                                    <td style={{ fontWeight:600 }}>{fmtDec1(r.foMin)}</td>
                                    <td>{fmtDec1(r.fo1)}</td>
                                    <td>{fmtDec1(r.fo2)}</td>
                                    <td>{fmtDec1(r.fo3)}</td>
                                    <td>{fmtDec1(r.fo4)}</td>
                                    <td>{fmtDec1(r.fo5)}</td>
                                    <td>{fmtDec1(r.fo6)}</td>
                                    <td>{fmtDec1(r.foh)}</td>
                                    <td>{fmtDec1(r.fom)}</td>
                                    <td>{fmtDec1(r.fol)}</td>
                                    <td>{r.status || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}

export default function PrintBatchRecordsPage() {
    return (
        <Suspense fallback={<div style={{ padding:24 }}>Memuat…</div>}>
            <BatchRecordsPrintContent />
        </Suspense>
    );
}
