"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function toWIBStr(date) {
    return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

function fmtN(v) {
    if (v === null || v === undefined || v === "") return "-";
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
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
                @page { size: A4 landscape; margin: 10mm; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { font-family: 'IBM Plex Mono','Courier New',monospace; background:#fff; color:#000; margin:0; font-size:10px; }
                table { border-collapse: collapse; width: 100%; }
                thead { display: table-header-group; }
                tr { break-inside: avoid; }
                th { font-weight:700; font-size:9px; border-top:1.5px solid #000; border-bottom:1.5px solid #000; padding:2px 3px; text-align:center; }
                td { font-size:9px; padding:1px 3px; border-bottom:1px dotted #aaa; text-align:center; }
                td:first-child { text-align:left; }
            `}</style>

            {/* Toolbar */}
            <div className="no-print" style={{ display:"flex", gap:8, padding:"8px 12px", background:"#f3f4f6", borderBottom:"1px solid #d1d5db" }}>
                <button onClick={() => window.print()} style={{ padding:"5px 14px", background:"#1d4ed8", color:"#fff", border:"none", borderRadius:4, cursor:"pointer", fontWeight:600, fontSize:13 }}>🖨 Cetak</button>
                <button onClick={() => { if (window.history.length <= 1 || window.opener) { window.close(); } else { window.history.back(); } }} style={{ padding:"5px 14px", background:"#e5e7eb", border:"1px solid #9ca3af", borderRadius:4, cursor:"pointer", fontSize:13 }}>← Kembali</button>
            </div>

            <div style={{ padding:"8mm 10mm 4mm 10mm" }}>
                {/* Judul */}
                <div style={{ textAlign:"center", marginBottom:6 }}>
                    <div style={{ fontWeight:900, fontSize:14, letterSpacing:2 }}>DATA REPORT — DAFTAR BATCH</div>
                    <div style={{ fontSize:10 }}>Periode: {periode}</div>
                    <div style={{ fontSize:9, marginTop:2 }}>Dicetak oleh {user || "?"} pada {printedAt} | {total} baris</div>
                    {(search || status) && (
                        <div style={{ fontSize:9, color:"#555" }}>
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
                                    <td>{r.loadingNo}</td>
                                    <td style={{ maxWidth:100, wordBreak:"break-word", textAlign:"left" }}>{r.productName}</td>
                                    <td>{r.operator}</td>
                                    <td>{r.machineId}</td>
                                    <td>{fmtN(r.sterTemp)}</td>
                                    <td style={{ whiteSpace:"nowrap" }}>{r.runBegin}</td>
                                    <td style={{ whiteSpace:"nowrap" }}>{r.runFinish}</td>
                                    <td>{fmtN(r.totalTimeMin)}</td>
                                    <td>{fmtN(r.heatTimeMin)}</td>
                                    <td>{fmtN(r.sterTimeMin)}</td>
                                    <td>{fmtN(r.coolTimeMin)}</td>
                                    <td>{fmtN(r.foMin)}</td>
                                    <td>{fmtN(r.fo1)}</td>
                                    <td>{fmtN(r.fo2)}</td>
                                    <td>{fmtN(r.fo3)}</td>
                                    <td>{fmtN(r.fo4)}</td>
                                    <td>{fmtN(r.fo5)}</td>
                                    <td>{fmtN(r.fo6)}</td>
                                    <td>{fmtN(r.foh)}</td>
                                    <td>{fmtN(r.fom)}</td>
                                    <td>{fmtN(r.fol)}</td>
                                    <td>{r.status}</td>
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
