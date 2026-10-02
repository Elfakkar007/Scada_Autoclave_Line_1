"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function toWIBStr(date) {
    return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

function AuditLogPrintContent() {
    const searchParams = useSearchParams();
    const from   = searchParams.get("from")       ?? "";
    const to     = searchParams.get("to")         ?? "";
    const search = searchParams.get("search")     ?? "";
    const action = searchParams.get("action")     ?? "";
    const entity = searchParams.get("entityType") ?? "";

    const [rows, setRows]       = useState([]);
    const [total, setTotal]     = useState(0);
    const [user, setUser]       = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [printedAt, setPrintedAt] = useState("");

    useEffect(() => {
        // Ambil nama user
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((j) => { if (j.ok) setUser(j.user?.username ?? ""); })
            .catch(() => {});

        setPrintedAt(toWIBStr(new Date()));

        // Ambil data dari route export format=json
        const p = new URLSearchParams({ format: "json" });
        if (from)   p.set("from",       from);
        if (to)     p.set("to",         to);
        if (search) p.set("search",     search);
        if (action) p.set("action",     action);
        if (entity) p.set("entityType", entity);

        fetch(`/api/audit-log/export?${p}`)
            .then((r) => r.json())
            .then((j) => {
                if (j.ok === false) throw new Error(j.error ?? "Gagal memuat data");
                setRows(j.rows ?? []);
                setTotal(j.total ?? 0);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [from, to, search, action, entity]);

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
                th { font-weight:700; font-size:9px; border-top:1.5px solid #000; border-bottom:1.5px solid #000; padding:2px 4px; text-align:left; }
                td { font-size:9px; padding:1px 4px; border-bottom:1px dotted #aaa; }
            `}</style>

            {/* Toolbar */}
            <div className="no-print" style={{ display:"flex", gap:8, padding:"8px 12px", background:"#f3f4f6", borderBottom:"1px solid #d1d5db" }}>
                <button onClick={() => window.print()} style={{ padding:"5px 14px", background:"#1d4ed8", color:"#fff", border:"none", borderRadius:4, cursor:"pointer", fontWeight:600, fontSize:13 }}>🖨 Cetak</button>
                <button onClick={() => window.history.back()} style={{ padding:"5px 14px", background:"#e5e7eb", border:"1px solid #9ca3af", borderRadius:4, cursor:"pointer", fontSize:13 }}>← Kembali</button>
            </div>

            <div style={{ padding:"8mm 10mm 4mm 10mm" }}>
                {/* Judul */}
                <div style={{ textAlign:"center", marginBottom:6 }}>
                    <div style={{ fontWeight:900, fontSize:14, letterSpacing:2 }}>AUDIT LOG</div>
                    <div style={{ fontSize:10 }}>Periode: {periode}</div>
                    <div style={{ fontSize:9, marginTop:2 }}>Dicetak oleh {user || "?"} pada {printedAt} | {total} baris</div>
                    {(search || action || entity) && (
                        <div style={{ fontSize:9, color:"#555" }}>
                            Filter: {[search && `cari="${search}"`, action && `aksi="${action}"`, entity && `entitas="${entity}"`].filter(Boolean).join(", ")}
                        </div>
                    )}
                </div>

                {loading && <div style={{ textAlign:"center", padding:24 }}>Memuat…</div>}
                {error   && <div style={{ textAlign:"center", color:"red", padding:12 }}>Error: {error}</div>}
                {!loading && !error && (
                    <table>
                        <thead>
                            <tr>
                                {["Waktu (WIB)","Aktor","Role","Aksi","Entitas","ID","Sumber","Deskripsi"].map((h) => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign:"center", padding:8 }}>Tidak ada data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={i}>
                                    <td style={{ whiteSpace:"nowrap" }}>{r.eventTime}</td>
                                    <td>{r.actor}</td>
                                    <td>{r.actorRole}</td>
                                    <td>{r.action}</td>
                                    <td>{r.entityType}</td>
                                    <td>{r.entityId}</td>
                                    <td>{r.source}</td>
                                    <td style={{ maxWidth:260, wordBreak:"break-word" }}>{r.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}

export default function PrintAuditLogPage() {
    return (
        <Suspense fallback={<div style={{ padding:24 }}>Memuat…</div>}>
            <AuditLogPrintContent />
        </Suspense>
    );
}
