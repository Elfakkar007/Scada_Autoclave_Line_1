"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { eventLabel } from "@/lib/alarmEventLabels";

function toWIBStr(date) {
    return new Date(date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

// ── Label tanggal untuk judul/nama file PDF ───────────────────────────────────
// Input from/to berformat "YYYY-MM-DD" (dari input type=date). Diurai manual
// (tanpa zona waktu) supaya tanggalnya tidak bergeser.
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
    "Agustus", "September", "Oktober", "November", "Desember"];
const pad2 = (n) => String(n).padStart(2, "0");

function parseYmd(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, mo, d, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
}
const ddmmyyyy = (p) => `${pad2(p.d)}${pad2(p.mo)}${p.y}`;
const longDate = (p) => `${HARI[p.dow]}, ${pad2(p.d)} ${BULAN[p.mo - 1]} ${p.y}`;

// Satu hari  : "Log Alarm Senin, 02 Mei 2077"
// Rentang    : "Log Alarm 02052077 - 02062077"
// Tanpa filter tanggal: "Log Alarm Semua Data"
function buildLogLabel(from, to) {
    const f = parseYmd(from);
    const t = parseYmd(to);
    if (f && t) {
        return from === to ? `Log Alarm ${longDate(f)}` : `Log Alarm ${ddmmyyyy(f)} - ${ddmmyyyy(t)}`;
    }
    if (f) return `Log Alarm mulai ${ddmmyyyy(f)}`;
    if (t) return `Log Alarm sampai ${ddmmyyyy(t)}`;
    return "Log Alarm Semua Data";
}

// Cap waktu cetak untuk nama file (WIB). Tanpa ":" karena tidak boleh ada di nama file Windows.
// Contoh: "07-10-2026 15.47.29"
function fileStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "00";
    return `${g("day")}-${g("month")}-${g("year")} ${g("hour")}.${g("minute")}.${g("second")}`;
}

// Teks aman untuk string CSS (dipakai di content: "...")
const cssStr = (v) => `"${String(v ?? "").replace(/[\\"\n\r]/g, " ")}"`;

function AlarmPrintContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const search = searchParams.get("search") ?? "";
    const eventType = searchParams.get("eventType") ?? "";

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [user, setUser] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [printedAt, setPrintedAt] = useState("");

    const logLabel = buildLogLabel(from, to);

    // Nama file default saat "Save as PDF" mengikuti document.title.
    // Supaya file tidak saling menimpa, saat cetak (tombol Cetak ATAU Ctrl+P) judul diberi
    // waktu cetak saat itu juga, dan footer ikut memakai waktu yang sama.
    useEffect(() => {
        document.title = logLabel;

        function onBeforePrint() {
            const now = new Date();
            flushSync(() => setPrintedAt(toWIBStr(now))); // render ulang footer SEBELUM dicetak
            document.title = `${logLabel} (dicetak ${fileStamp(now)})`;
        }
        function onAfterPrint() {
            document.title = logLabel;
        }

        window.addEventListener("beforeprint", onBeforePrint);
        window.addEventListener("afterprint", onAfterPrint);
        return () => {
            window.removeEventListener("beforeprint", onBeforePrint);
            window.removeEventListener("afterprint", onAfterPrint);
        };
    }, [logLabel]);

    function handleBack() {
        // Halaman ini dibuka di tab baru oleh halaman Alarm. Cukup tutup tab ini:
        // tab Alarm yang asli masih terbuka dengan filternya utuh.
        if (window.opener || window.history.length <= 1) {
            try { window.opener?.focus(); } catch { /* abaikan */ }
            window.close();
            // Cadangan: bila browser menolak menutup (mis. URL dibuka manual), pindah ke
            // halaman Alarm di tab ini. Bila tab berhasil ditutup, baris ini tidak jalan.
            setTimeout(() => { if (!window.closed) router.push("/alarm"); }, 300);
            return;
        }
        router.back();
    }

    function handlePrint() {
        window.print(); // judul + footer diberi waktu cetak oleh listener "beforeprint"
    }

    useEffect(() => {
        // Ambil nama user
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((j) => { if (j.ok) setUser(j.user?.fullName ?? j.user?.username ?? ""); })
            .catch(() => { });

        // Ambil data dari route print-data (JSON)
        const p = new URLSearchParams();
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        if (search) p.set("search", search);
        if (eventType) p.set("eventType", eventType);

        fetch(`/api/alarms/print-data?${p}`)
            .then((r) => r.json())
            .then((j) => {
                if (j.ok === false) throw new Error(j.error ?? "Gagal memuat data");
                setRows(j.rows ?? []);
                setTotal(j.total ?? 0);
                // Waktu cetak diisi saat data siap; listener "beforeprint" memperbaruinya saat benar-benar dicetak.
                setPrintedAt(toWIBStr(new Date()));
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [from, to, search, eventType]);

    const pf = parseYmd(from);
    const pt = parseYmd(to);
    const periode = (from || to)
        ? `${pf ? longDate(pf) : "—"} s/d ${pt ? longDate(pt) : "—"}`
        : "Semua";

    return (
        <>
            <style>{`
                @page {
                    size: A4 landscape;
                    margin: 10mm 10mm 14mm 10mm;
                    /* Nomor halaman + identitas cetak di setiap halaman (butuh Chrome/Brave 131+) */
                    @bottom-left {
                        content: ${cssStr(`${logLabel} | Dicetak oleh ${user || "?"} pada ${printedAt}`)};
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
                }
                body { font-family: 'IBM Plex Mono','Courier New',monospace; background:#fff; color:#000; margin:0; font-size:10px; }
                table { border-collapse: collapse; width: 100%; }
                thead { display: table-header-group; }
                tr { break-inside: avoid; }
                th { font-weight:700; font-size:9px; border-top:1.5px solid #000; border-bottom:1.5px solid #000; padding:2px 4px; text-align:left; }
                td { font-size:9px; padding:1px 4px; border-bottom:1px dotted #aaa; }
            `}</style>

            {/* Toolbar */}
            <div className="no-print" style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#f3f4f6", borderBottom: "1px solid #d1d5db" }}>
                <button onClick={handlePrint} style={{ padding: "5px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>🖨 Cetak</button>
                <button onClick={handleBack} style={{ padding: "5px 14px", background: "#e5e7eb", border: "1px solid #9ca3af", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>← Kembali</button>
            </div>

            <div style={{ padding: "8mm 10mm 4mm 10mm" }}>
                {/* Judul */}
                <div style={{ textAlign: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1.5, marginBottom: 2 }}>ALARM MESSAGE AUTOCLAVE LINE 1</div>
                    <div style={{ fontSize: 10 }}>Periode: {periode}</div>
                    <div style={{ fontSize: 9, marginTop: 2 }}>Dicetak oleh {user || "?"} pada {printedAt} | {total} baris</div>
                    {(search || eventType) && (
                        <div style={{ fontSize: 9, color: "#555" }}>
                            Filter: {[search && `cari="${search}"`, eventType && `event="${eventLabel(eventType)}"`].filter(Boolean).join(", ")}
                        </div>
                    )}
                </div>

                {loading && <div style={{ textAlign: "center", padding: 24 }}>Memuat…</div>}
                {error && <div style={{ textAlign: "center", color: "red", padding: 12 }}>Error: {error}</div>}
                {!loading && !error && (
                    <table>
                        <thead>
                            <tr>
                                {["Alarm Date", "Event Date", "Variable", "Alarm Type", "Alarm Value", "Recovery", "Limit", "Event", "Operator"].map((h) => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={9} style={{ textAlign: "center", padding: 8 }}>Tidak ada data</td></tr>
                            ) : rows.map((r, i) => (
                                <tr key={i}>
                                    <td style={{ whiteSpace: "nowrap" }}>{r.alarmDate || "-"}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>{r.eventDate || "-"}</td>
                                    <td>{r.variableName || "-"}</td>
                                    <td>{r.alarmType || "-"}</td>
                                    <td>{r.alarmValue || "-"}</td>
                                    <td>{r.recoveryValue || "-"}</td>
                                    <td>{r.limitValue || "-"}</td>
                                    <td style={{ fontWeight: r.eventType === "alarm_active" ? 700 : 400 }}>{eventLabel(r.eventType)}</td>
                                    <td>{r.operator || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}

export default function PrintAlarmPage() {
    return (
        <Suspense fallback={<div style={{ padding: 24 }}>Memuat…</div>}>
            <AlarmPrintContent />
        </Suspense>
    );
}