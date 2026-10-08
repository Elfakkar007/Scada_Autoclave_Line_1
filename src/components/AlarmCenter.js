"use client";

/**
 * src/components/AlarmCenter.js — Popup alarm global (Item 8b).
 *
 * Dipasang di src/app/(app)/layout.js, di ATAS area konten. Sengaja berada di dalam alur
 * layout (bukan overlay melayang) supaya tidak pernah menutupi tombol STOP atau elemen
 * lain di halaman mana pun: panel mendorong konten ke bawah.
 *
 * Sumber data: GET /api/alarms/active tiap 1 detik (alarm_log, ditulis alarmMonitor).
 * Web hanya pendamping; buzzer dan interlock PLC tetap pengaman utama.
 */

import { useEffect, useRef, useState } from "react";
import { deriveAlarmView, minimizeAll, pruneIds } from "@/lib/alarmView";

const POLL_MS = 1000;
const FAIL_LIMIT = 3;                 // gagal berturut-turut sebelum banner "tidak dapat dimuat"
const SOUND_SRC = "/sounds/alarm.wav"; // ganti file ini dengan suara sendiri bila perlu

const UNITS = { m8_0: "kPa", m10_2: "°C", m10_3: "°C" };
const LIMIT_LABEL = { m8_0: "batas aman", m10_2: "setpoint", m10_3: "batas atas" };

function fmtTime(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour12: false });
}

function valueText(a) {
    const unit = UNITS[a.key];
    if (!unit || a.alarmValue == null) return null;
    const lim = a.limitValue != null ? ` (${LIMIT_LABEL[a.key] ?? "batas"} ${a.limitValue} ${unit})` : "";
    return `${a.alarmValue} ${unit}${lim}`;
}

function AlarmItem({ a }) {
    const vt = valueText(a);
    return (
        <li className="px-4 py-3 text-sm text-scada-ink">
            <p className="font-semibold">{a.title}</p>
            <p className="text-xs text-scada-muted font-mono mt-0.5">
                {a.tag} · sejak {fmtTime(a.since)}
                {a.batchNo ? ` · batch ${a.batchNo}` : ""}
            </p>
            {vt && (
                <p className="mt-1 text-xs">
                    <span className="text-scada-muted">Nilai saat terjadi: </span>
                    <span className="font-mono font-semibold">{vt}</span>
                </p>
            )}
            {a.cause && (
                <p className="mt-1.5">
                    <span className="font-semibold">Penyebab: </span>
                    {a.cause}
                </p>
            )}
            {a.action && (
                <p className="mt-1">
                    <span className="font-semibold">Tindakan: </span>
                    {a.action}
                </p>
            )}
            {!a.textConfirmed && (
                <p className="mt-1 text-[11px] text-scada-steam">
                    Teks draf, belum dikonfirmasi teknisi.
                </p>
            )}
        </li>
    );
}

export default function AlarmCenter() {
    const [data, setData] = useState({ active: [], monitorAlive: true, loaded: false });
    const [failCount, setFailCount] = useState(0);
    const [minimizedIds, setMinimizedIds] = useState(() => new Set());
    const [expandedManual, setExpandedManual] = useState(false);
    const [soundBlocked, setSoundBlocked] = useState(false);
    const audioRef = useRef(null);

    // ── Polling alarm aktif ──────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        let inFlight = false;

        async function poll() {
            if (inFlight) return;
            inFlight = true;
            try {
                const res = await fetch("/api/alarms/active", { cache: "no-store" });
                const json = await res.json();
                if (cancelled) return;
                if (!res.ok || !json.ok) throw new Error("respons tidak valid");
                const active = Array.isArray(json.active) ? json.active : [];
                setFailCount(0);
                setData({ active, monitorAlive: json.monitorAlive !== false, loaded: true });
                setMinimizedIds((prev) => pruneIds(prev, active));
                if (active.length === 0) setExpandedManual(false);
            } catch {
                if (!cancelled) setFailCount((n) => n + 1);
            } finally {
                inFlight = false;
            }
        }

        poll();
        const id = setInterval(poll, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    const view = deriveAlarmView(data.active, minimizedIds, expandedManual);

    // ── Bunyi: menyala selama ada alarm yang belum di-minimize ────────────
    useEffect(() => {
        if (!audioRef.current) {
            const a = new Audio(SOUND_SRC);
            a.loop = true;
            audioRef.current = a;
        }
        const audio = audioRef.current;
        if (view.soundOn) {
            audio.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    }, [view.soundOn]);

    useEffect(() => {
        const audio = audioRef.current;
        return () => audio?.pause();
    }, []);

    // Browser memblokir bunyi sebelum ada interaksi: coba lagi pada klik/tombol pertama.
    useEffect(() => {
        if (!soundBlocked || !view.soundOn) return;
        function retry() {
            audioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => { });
        }
        window.addEventListener("pointerdown", retry);
        window.addEventListener("keydown", retry);
        return () => {
            window.removeEventListener("pointerdown", retry);
            window.removeEventListener("keydown", retry);
        };
    }, [soundBlocked, view.soundOn]);

    // ── Peringatan sistem alarm itu sendiri ───────────────────────────────
    const loadFailed = failCount >= FAIL_LIMIT;
    const monitorDown = data.loaded && !loadFailed && !data.monitorAlive;

    return (
        <>
            {loadFailed && (
                <div role="status" className="shrink-0 bg-scada-idle text-scada-ink px-4 py-1.5 text-xs font-semibold">
                    Status alarm tidak dapat dimuat dari server. Alarm mesin mungkin tidak tampil di sini.
                    Buzzer dan interlock PLC tetap bekerja.
                </div>
            )}
            {monitorDown && (
                <div role="alert" className="shrink-0 bg-scada-steam text-white px-4 py-1.5 text-xs font-semibold">
                    Pemantauan alarm di server tidak aktif. Alarm mesin tidak terpantau oleh web.
                    Buzzer dan interlock PLC tetap bekerja.
                </div>
            )}

            {view.mode === "banner" && (
                <button
                    type="button"
                    onClick={() => setExpandedManual(true)}
                    className="shrink-0 w-full flex items-center justify-between gap-3 bg-scada-stop hover:bg-scada-stop-hover text-white px-4 py-1.5 text-sm text-left transition-colors"
                >
                    <span className="flex items-center gap-2 font-semibold min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
                        <span className="truncate">
                            {view.count} ALARM AKTIF: {data.active[0]?.title}
                            {view.count > 1 ? ` (+${view.count - 1} lainnya)` : ""}
                        </span>
                    </span>
                    <span className="text-xs underline shrink-0">Lihat detail</span>
                </button>
            )}

            {view.mode === "expanded" && (
                <section
                    role="alert"
                    aria-live="assertive"
                    className="shrink-0 bg-white border-b-4 border-scada-stop shadow-md"
                >
                    <div className="flex items-center justify-between gap-3 bg-scada-stop text-white px-4 py-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                            ALARM AKTIF ({view.count})
                        </span>
                        <span className="flex items-center gap-2">
                            {view.soundOn && soundBlocked && (
                                <span className="text-xs bg-white/20 rounded px-2 py-0.5">
                                    Suara belum aktif. Klik di mana saja.
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setMinimizedIds((prev) => minimizeAll(data.active, prev));
                                    setExpandedManual(false);
                                }}
                                className="text-xs font-semibold border border-white/60 hover:bg-white/15 rounded px-3 py-1 transition-colors"
                            >
                                Minimize
                            </button>
                        </span>
                    </div>
                    <ul className="max-h-64 overflow-y-auto divide-y divide-scada-rule">
                        {data.active.map((a) => (
                            <AlarmItem key={a.episodeId} a={a} />
                        ))}
                    </ul>
                    <p className="px-4 py-1.5 text-[11px] text-scada-muted bg-scada-bg">
                        Alarm web hanya pendamping. Buzzer dan interlock PLC tetap pengaman utama.
                    </p>
                </section>
            )}
        </>
    );
}
