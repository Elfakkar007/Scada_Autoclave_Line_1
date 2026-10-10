"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { describeStopResponse, describeResetPulse } from "@/lib/plcCommandAlert";
import { AtvDiagram, PhaseGuide } from "@/components/AtvDiagram";
import { STEPS, PHASE_CODE_TO_STEP, STEP_COLOR } from "@/lib/atvProcess";

/* ─────────────────────────────────────────────────────────────
   Product material masih belum ada tag PLC-nya (murni data resep
   kita sendiri) — default ini dipakai sampai field ini diisi dari
   data formula/batch aktif.
   Diagram P&ID + animasi ada di src/components/AtvDiagram.js, data
   proses per fase (dari export_atv.awl) di src/lib/atvProcess.js.
   Valve tanpa tag PLC (WATER DRAIN hijau, COMPRESSED AIR, buang PHE) tampil
   sebagai estimasi "≈" dari fase aktif, bukan dari sinyal mesin.
   ───────────────────────────────────────────────────────────── */
const DEFAULT_MATERIAL = "Soft Bottle";

const MONO = {
  fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
};

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
  return Number(v).toFixed(1);
}

const SANS_STYLE = { fontFamily: "var(--font-plex-sans), system-ui, sans-serif" };

const pad2 = (n) => String(n).padStart(2, "0");

// detik -> HH:MM:SS
function formatHMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

// detik -> MM:SS (menit bisa > 99)
function formatMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/* ─────────────── Komponen UI (HTML) ─────────────── */

function Gauge({ label, value, noData = false }) {
  return (
    <div className="border border-[#B8C0BE] rounded-[3px] bg-white">
      <div className="px-2 py-1 border-b border-[#D8DEDC] text-xs text-[#5C6B6A]">
        {label}
      </div>
      <div className="m-1 px-2 py-1.5 bg-[#EEF1F0] rounded-[2px] shadow-[inset_0_1px_2px_rgba(30,42,46,0.15)] flex items-baseline justify-end gap-1">
        {noData ? (
          <span className="text-[11px] font-semibold text-[#A23B2E] py-[5px]">NO DATA</span>
        ) : (
          <>
            <span className="text-xl font-medium text-[#1E2A2E]" style={MONO}>
              {fmt(value)}
            </span>
            <span className="text-[10px] text-[#5C6B6A]">°C</span>
          </>
        )}
      </div>
    </div>
  );
}

function DoorRow({ label, state }) {
  const open = state === "open";
  const noData = state === "nodata";
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#D8DEDC] last:border-b-0">
      <span className="text-sm">{label}</span>
      <span
        className={`flex items-center gap-2 text-xs font-semibold ${open ? "text-[#4F7A52]" : "text-[#5C6B6A]"
          }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${open ? "bg-[#4F7A52]" : "border border-[#B8C0BE]"
            }`}
        />
        {noData ? "NO DATA" : open ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );
}

// Fase yang durasinya ditampilkan di bawah label (key = properti di `durations`)
const DUR_KEY = { HEATING: "heat", "STERIL.": "steril", COOLING: "cool" };

const TL_CSS = `
@keyframes tl-pulse{0%,100%{box-shadow:0 0 0 0 var(--c)}60%{box-shadow:0 0 0 6px transparent}}
@keyframes tl-sweep{to{transform:translateX(100%)}}
.tl-pill{position:relative;overflow:hidden;transition:background-color .25s,color .25s,transform .15s,box-shadow .25s}
.tl-pill:hover{transform:translateY(-1px)}
.tl-live{animation:tl-pulse 2s ease-out infinite}
.tl-live::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.38) 50%,transparent 70%);
  animation:tl-sweep 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.tl-live,.tl-live::after{animation:none}}
`;

// durations: { heat, steril, cool } masing-masing { sec, live, approx } atau null
function PhaseTimeline({ activePhase, selectedPhase, learn, onSelect, durations }) {
  const curIdx = STEPS.indexOf(learn ? selectedPhase : activePhase);
  return (
    <div className="relative">
      <style>{TL_CSS}</style>
      {/* garis dasar + tick minor ala kertas strip-chart */}
      <div className="absolute inset-x-0 top-3 h-px bg-[#5C6B6A]" />
      <svg className="absolute inset-x-0 top-3" width="100%" height="6" aria-hidden="true">
        <defs>
          <pattern id="minor-ticks" width="12" height="6" patternUnits="userSpaceOnUse">
            <path d="M0.5 0V5" stroke="#B8C0BE" />
          </pattern>
        </defs>
        <rect width="100%" height="6" fill="url(#minor-ticks)" />
      </svg>
      <ol className="relative grid grid-cols-7">
        {STEPS.map((p, i) => {
          const color = STEP_COLOR[p];
          const state = i === curIdx ? "active" : curIdx >= 0 && i < curIdx ? "done" : "todo";
          const live = !learn && state === "active";
          const isMachine = learn && activePhase === p;
          // teks gelap di atas kuning, putih di atas warna lain
          const onSolid = p === "HEATING" ? "#1E2A2E" : "#FFFFFF";
          const pillStyle =
            state === "active"
              ? { backgroundColor: color, color: onSolid, "--c": `${color}99` }
              : state === "done"
                ? { backgroundColor: `${color}2B`, color: "#1E2A2E", boxShadow: `inset 0 0 0 1px ${color}80` }
                : { color: "#5C6B6A" };
          const dKey = DUR_KEY[p];
          const d = dKey && !learn ? durations?.[dKey] : null;
          return (
            <li key={p} className="flex flex-col items-center">
              <div className="h-4 flex items-end">
                <span
                  className={state === "active" ? "block w-[3px] h-4" : "block w-px h-2 bg-[#5C6B6A]"}
                  style={state === "active" ? { backgroundColor: color } : undefined}
                />
              </div>
              <button
                type="button"
                onClick={() => onSelect(p)}
                aria-current={state === "active" ? "step" : undefined}
                title={learn ? `Pelajari fase ${p}` : `Pelajari fase ${p} (beralih ke mode PELAJARI)`}
                className={`tl-pill mt-1.5 px-2.5 py-1 rounded-[3px] text-[11px] sm:text-xs ${state === "active" ? "font-bold" : state === "done" ? "font-semibold" : "hover:bg-[#EEF1F0]"
                  } ${live ? "tl-live" : ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1C6E74]`}
                style={pillStyle}
              >
                <span className="relative z-[1]">
                  {state === "done" && <span aria-hidden="true">✓ </span>}
                  {p}
                </span>
              </button>
              {/* durasi per fase (HEATING / STERIL. / COOLING) */}
              {dKey && !learn && (
                <span
                  className="mt-1 text-[13px] leading-none"
                  style={{ ...MONO, color: d ? (d.live ? STEP_COLOR[p] : "#1E2A2E") : "#B8C0BE", fontWeight: d?.live ? 700 : 500 }}
                  title={
                    d
                      ? d.approx
                        ? "Perkiraan dari setpoint (halaman tidak terbuka saat fase ini berjalan)"
                        : d.live
                          ? "Sedang berjalan"
                          : "Total durasi fase"
                      : "Belum dijalankan"
                  }
                >
                  {d ? `${d.approx ? "~" : ""}${formatMS(d.sec)}` : "--:--"}
                  <span className="ml-1 text-[9px] font-normal text-[#5C6B6A]" style={SANS_STYLE}>mnt</span>
                </span>
              )}
              {isMachine && <span className="text-[9px] text-[#4F7A52] font-semibold leading-none mt-1">MESIN</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─────────────── Halaman ─────────────── */

export default function Home() {
  const [data, setData] = useState(null);
  const [stopping, setStopping] = useState(false);
  // true bila /api/status sendiri gagal dijangkau (server web mati / jaringan putus).
  // Tanpa ini, dashboard akan terus menampilkan angka terakhir yang basi.
  const [fetchFailed, setFetchFailed] = useState(false);

  // State untuk tombol Reset Mesin
  const [resetDialog, setResetDialog] = useState(false);  // dialog konfirmasi tampil?
  const [resetting, setResetting] = useState(false);       // sedang mengirim request?
  const [resetMsg, setResetMsg] = useState(null);          // { ok, text } atau null
  // Peringatan hasil perintah STOP/reset yang tidak mulus (item 10). Sengaja TIDAK hilang
  // sendiri: tetap tampil sampai operator menekan "Sudah dicek", walau batch sudah tertutup
  // dan tombol Reset hilang. Bentuk: { level, title, lines } atau null.
  const [cmdAlert, setCmdAlert] = useState(null);

  // Mode tampilan diagram: "live" (ikut PLC) atau "learn" (simulasi edukasi per fase)
  const [mode, setMode] = useState("live");
  const [learnStep, setLearnStep] = useState("FILLING");
  const [autoplay, setAutoplay] = useState(false);

  // Jam lokal 1 detik: membuat "Waktu berjalan" terus berdetak walau polling terlambat
  const [now, setNow] = useState(() => Date.now());
  // Terakhir kali PLC berhasil terbaca (updatedAt dari server), untuk keterangan saat NO DATA
  const [lastPlcOkAt, setLastPlcOkAt] = useState(null);
  // Detik STERIL terakhir yang teramati. Counter PLC (VW230) di-reset begitu COOLING mulai,
  // jadi total fase steril harus "dikunci" di web selagi fasenya masih berjalan.
  const [sterLatch, setSterLatch] = useState(null);
  // Cadangan waktu mulai kalau mesin dijalankan dari panel (tidak ada batch di web)
  const fallbackStart = useRef(null);
  // Mirror state dari ref agar render bisa memakai nilai terbaru tanpa akses ref langsung.
  // (Akses ref.current di render body dilarang oleh React Hooks lint rule.)
  const [fallbackStartMs, setFallbackStartMs] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setFetchFailed(false);
      if (json.plcOk !== false && json.updatedAt) setLastPlcOkAt(json.updatedAt);
    } catch {
      setFetchFailed(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Kunci durasi steril + siapkan waktu mulai cadangan
  useEffect(() => {
    if (!data || data.plcOk === false) return;
    const step = PHASE_CODE_TO_STEP[data.phase?.code];
    const sec = data.timers?.sterSec;
    if (step === "STERIL." && isNum(sec)) {
      setSterLatch((prev) => (prev === null || sec > prev ? sec : prev));
    } else if (step === "PREPARE" || step === "FILLING" || step === "HEATING") {
      setSterLatch(null);
    }
    const lampOn = (data.runLamp ?? data.running) === true;
    if (!lampOn || data.runBegin) {
      fallbackStart.current = null;
      setFallbackStartMs(null);
    } else if (fallbackStart.current === null) {
      const t = data.timers ?? {};
      const known = (isNum(t.heatSec) ? t.heatSec : 0) + (isNum(t.sterSec) ? t.sterSec : 0) + (isNum(t.coolSec) ? t.coolSec : 0);
      const ts = Date.now() - known * 1000;
      fallbackStart.current = ts;
      setFallbackStartMs(ts);
    }
  }, [data]);

  // Putar siklus otomatis di mode PELAJARI: pindah fase tiap 8 detik
  useEffect(() => {
    if (mode !== "learn" || !autoplay) return;
    const t = setInterval(() => {
      setLearnStep((s) => STEPS[(STEPS.indexOf(s) + 1) % STEPS.length]);
    }, 8000);
    return () => clearInterval(t);
  }, [mode, autoplay]);

  function changeMode(m) {
    setMode(m);
    if (m === "live") setAutoplay(false);
  }
  function stepBy(delta) {
    setAutoplay(false);
    setLearnStep((s) => STEPS[(STEPS.indexOf(s) + delta + STEPS.length) % STEPS.length]);
  }
  // Klik kotak fase: langsung masuk mode PELAJARI di fase itu
  function pickStep(p) {
    setMode("learn");
    setAutoplay(false);
    setLearnStep(p);
  }

  async function handleStop() {
    if (stopping) return; // cegah double-click
    if (!window.confirm(`Yakin ingin menghentikan batch ${data.batchNo}?`)) return;
    setStopping(true);
    setCmdAlert(null);
    try {
      let status = 0;
      let json = null;
      let networkError = false;
      try {
        const res = await fetch("/api/batch/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: data.operator ?? "unknown" }),
        });
        status = res.status;
        json = await res.json().catch(() => null);
      } catch {
        networkError = true;
      }
      // Hasil STOP yang tidak mulus (gagal diproses, tidak sampai ke mesin, atau mungkin
      // tertahan ON di PLC) ditampilkan sebagai peringatan; hasil normal -> null.
      const alertInfo = describeStopResponse({ networkError, status, json });
      if (alertInfo) setCmdAlert(alertInfo);
      await fetchData();
    } finally {
      setStopping(false);
    }
  }

  async function handleReset() {
    if (resetting) return; // cegah double-click
    setResetting(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/plc/reset", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!json) {
        setResetMsg({ ok: false, text: "Respons server tidak valid. Muat ulang halaman lalu coba lagi." });
      } else if (json.ok) {
        const idle = json.phaseAfter?.rawValue === 0 || json.phaseAfter?.rawValue === 1;
        setResetMsg({
          ok: true,
          text: json.message
            ?? (idle ? "Reset berhasil. Mesin kembali ke Idle." : "Perintah STOP terkirim. Menunggu mesin kembali ke Idle."),
        });
        setResetDialog(false);
        await fetchData();
      } else {
        // Kegagalan PULSA (STOP tidak sampai / mungkin tertahan ON) -> peringatan permanen.
        // Penolakan guard (409/503) tetap memakai pesan server lewat resetMsg seperti sebelumnya.
        const pulseAlert = describeResetPulse(json);
        if (pulseAlert) {
          setCmdAlert(pulseAlert);
          setResetDialog(false);
        } else {
          setResetMsg({ ok: false, text: json.error ?? "Reset gagal." });
        }
      }
    } catch (err) {
      setResetMsg({ ok: false, text: `Gagal mengirim request: ${err.message}` });
    } finally {
      setResetting(false);
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#EEF1F0] text-[#1E2A2E] p-8">
        {fetchFailed ? "NO DATA: server web tidak merespons." : "Memuat data..."}
      </main>
    );
  }

  // noData: PLC tidak terbaca ATAU server web tidak terjangkau.
  // Dalam kondisi ini tidak ada angka/status yang boleh tampil selain "NO DATA".
  const noData = fetchFailed || data.plcOk === false;

  // phase kini object {code, label, confirmed, rawValue} dari /api/status.
  // Kalau masih pakai dummy lama (string), code di bawah tetap aman karena
  // activePhase akan null dan statusLabel akan jatuh ke "--".
  const phaseObj = data.phase && typeof data.phase === 'object' ? data.phase : null;

  // Tentukan kotak mana di timeline yang perlu di-highlight.
  // code 'unknown' atau null -> tidak highlight kotak manapun.
  const activePhase = !noData && phaseObj ? (PHASE_CODE_TO_STEP[phaseObj.code] ?? null) : null;
  // fase yang dianimasikan: mesin (LIVE) atau pilihan pengguna (PELAJARI)
  const diagramStep = mode === "learn" ? learnStep : activePhase;

  // ── Durasi per fase (dari counter PLC: HEAT_TIME, ster_time, COOL_TIME — satuan detik) ──
  const curIdx = activePhase ? STEPS.indexOf(activePhase) : -1;
  const tmr = data.timers ?? {};
  let durations = null;
  if (!noData && curIdx >= 0) {
    const sterSetSec = isNum(data.setpoints?.sterSetTime) ? data.setpoints.sterSetTime * 60 : null;
    durations = {
      heat: curIdx >= 2 && isNum(tmr.heatSec) ? { sec: tmr.heatSec, live: curIdx === 2 } : null,
      steril:
        curIdx === 3 && isNum(tmr.sterSec)
          ? { sec: tmr.sterSec, live: true }
          : curIdx > 3
            ? sterLatch !== null
              ? { sec: sterLatch, live: false }
              : sterSetSec !== null
                ? { sec: sterSetSec, live: false, approx: true }
                : null
            : null,
      cool: curIdx >= 4 && isNum(tmr.coolSec) ? { sec: tmr.coolSec, live: curIdx === 4 } : null,
    };
  }

  // ── Waktu berjalan ──
  // Utama: runBegin dari batch di web. Cadangan: perkiraan lokal saat RUN_LAMP menyala tanpa batch web.
  // Saat server tidak merespons, waktu dibekukan di respons terakhir (bukan terus berdetak di data basi).
  let elapsedText = "--:--:--";
  let elapsedApprox = false;
  {
    const endMs = fetchFailed ? new Date(data.updatedAt ?? now).getTime() : now;
    const startMs = data.running && data.runBegin ? new Date(data.runBegin).getTime() : null;
    if (startMs !== null && Number.isFinite(startMs)) {
      elapsedText = formatHMS((endMs - startMs) / 1000);
    } else if (!noData && (data.runLamp ?? data.running) === true && fallbackStartMs !== null) {
      elapsedText = formatHMS((endMs - fallbackStartMs) / 1000);
      elapsedApprox = true;
    }
  }
  const updatedClock = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("id-ID") : "--:--:--";
  const lastPlcOkClock = lastPlcOkAt ? new Date(lastPlcOkAt).toLocaleTimeString("id-ID") : null;

  const isRunning = noData ? null : (data.runLamp ?? data.running); // utamakan status PLC asli (RUN_LAMP), fallback ke status DB kalau field ini belum ada (mis. saat masih dummy)
  const statusLabel = noData ? "NO DATA" : (phaseObj ? phaseObj.label : (data.phase ?? "--"));
  const phaseConfirmed = phaseObj ? phaseObj.confirmed : true; // kalau data lama (string), anggap sudah ok

  const sensors = [
    ["T1", data.t1], ["T2", data.t2], ["T3", data.t3],
    ["T4", data.t4], ["T5", data.t5], ["T6", data.t6],
    ["TH", data.th], ["TM", data.tm], ["TL", data.tl],
  ];

  return (
    <main className="min-h-screen bg-[#EEF1F0] text-[#1E2A2E] p-2 sm:p-3">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-2">
        {/* ── Baris instrumen suhu ── */}
        <section
          aria-label="Sensor suhu"
          className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5"
        >
          {sensors.map(([label, value]) => (
            <Gauge key={label} label={label} value={value} noData={noData} />
          ))}
        </section>

        {/* ── Banner koneksi: PLC putus / server tidak terjangkau / data simulasi (dev) ── */}
        {noData && (
          <div
            role="alert"
            className="bg-white border-l-[3px] border-[#A23B2E] px-3 py-2 text-sm text-[#1E2A2E]"
          >
            <span className="font-semibold">
              {fetchFailed ? "Server web tidak merespons." : "PLC tidak terhubung."}
            </span>{" "}
            Data sensor tidak ditampilkan. Jangan mengandalkan layar ini sampai koneksi pulih.
          </div>
        )}
        {!noData && data.isDummy && (
          <div
            role="alert"
            className="bg-white border-l-[3px] border-[#B9762F] px-3 py-2 text-sm text-[#1E2A2E]"
          >
            <span className="font-semibold">DATA SIMULASI (mode development).</span>{" "}
            Angka di layar ini bukan dari PLC.
          </div>
        )}

        {/* ── Strip peringatan interlock dan mode (muncul hanya bila kondisi aktif) ── */}
        {!noData && data.plcOk && (
          <div className="flex flex-col gap-1">
            {/* Bypass interlock aktif */}
            {data.door?.bypass && (
              <div
                role="alert"
                className="bg-white border-l-[3px] border-[#A23B2E] px-3 py-2 text-sm text-[#1E2A2E]"
              >
                <span className="font-semibold">Bypass interlock (DOOR_LOCK/M6.0) AKTIF.</span>{" "}
                Pengecekan keamanan pintu dilewati.
              </div>
            )}
            {/* CTRL SEL aktif → mode F0, mesin bisa macet */}
            {data.ctrlSel === true && (
              <div
                role="alert"
                className="bg-white border-l-[3px] border-[#A23B2E] px-3 py-2 text-sm text-[#1E2A2E]"
              >
                <span className="font-semibold">CTRL SEL aktif (mode F0).</span>{" "}
                Sterilisasi tidak akan selesai berdasarkan waktu. Hubungi teknisi.
              </div>
            )}
            {/* CTRL SEL belum terbaca → bukan alarm, tapi perlu diinformasikan */}
            {data.ctrlSel === null && (
              <div className="bg-white border-l-[3px] border-[#B8C0BE] px-3 py-2 text-sm text-[#5C6B6A]">
                CTRL SEL belum terbaca. Start dari web akan ditolak sampai tag terbaca.
              </div>
            )}
          </div>
        )}

        {/* ── Diagram + panel kanan ── */}
        <div className="flex flex-col lg:flex-row gap-2">
          <section className="flex-1 min-w-0 bg-white border border-[#D8DEDC] rounded-[4px] p-2">
            <AtvDiagram
              mode={mode}
              step={diagramStep}
              valves={data.valves}
              doors={{
                front: data.door?.opnFrnt ? "open" : "closed",
                rear: data.door?.opnRear ? "open" : "closed",
              }}
              noData={noData}
              running={isRunning === true}
              values={{
                th: data.th,
                p1: data.p1,
                p2: data.p2,
                tm: data.tm,
                tl: data.tl,
                level: data.level,
                conductivity: data.conductivity,
              }}
              sterSet={data.setpoints?.sterSet}
              controls={{ setMode: changeMode, autoplay, setAutoplay, prev: () => stepBy(-1), next: () => stepBy(1) }}
            />
          </section>

          <aside className="lg:w-56 shrink-0 flex flex-col gap-2">
            <section className="bg-white border border-[#D8DEDC] rounded-[4px] p-2">
              <p className="text-[11px] text-[#5C6B6A] mb-1">Product material</p>
              <p className="font-semibold border border-[#B8C0BE] rounded-[3px] px-2 py-1.5 text-xs">
                {data.sterilMaterial ?? DEFAULT_MATERIAL}
              </p>
            </section>

            <section className="bg-white border border-[#D8DEDC] rounded-[4px] p-2">
              <div className="flex items-center gap-1.5 text-xs text-[#5C6B6A] mb-1.5 pb-1.5 border-b border-[#D8DEDC]">
                <span className={`w-1.5 h-1.5 rounded-full ${noData ? "bg-[#A23B2E]" : "bg-[#4F7A52]"}`} />
                Comm: {noData ? "Abnormal" : "Normal"}
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#5C6B6A]">Status proses</span>
                <span className="flex items-center gap-1 text-[13px] font-semibold">
                  {statusLabel}
                  {/* Badge peringatan: ditampilkan kalau fase belum diverifikasi ke ladder logic PLC */}
                  {!phaseConfirmed && (
                    <span
                      title="Fase ini belum diverifikasi ke ladder logic PLC"
                      aria-label="Fase ini belum diverifikasi ke ladder logic PLC"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#B9762F',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0,
                        cursor: 'help',
                      }}
                    >
                      !
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs mb-2">
                <span
                  className={`w-2 h-2 rounded-full ${isRunning === null ? "border border-[#B8C0BE]" : isRunning ? "bg-[#4F7A52]" : "bg-[#A23B2E]"
                    }`}
                />
                {isRunning === null ? "Status mesin tidak diketahui" : isRunning ? "Mesin berjalan" : "Mesin berhenti"}
              </div>
              {data.running && data.batchNo && (
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs border-t border-[#D8DEDC] pt-2">
                  <div>
                    <dt className="text-xs text-[#5C6B6A]">Batch no</dt>
                    <dd className="font-semibold">{data.batchNo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5C6B6A]">Operator</dt>
                    <dd className="font-semibold">{data.operator}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5C6B6A]">Produk</dt>
                    <dd className="font-semibold">{data.productName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5C6B6A]">Formula</dt>
                    <dd className="font-semibold">{data.formulaNo}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-[#5C6B6A]">Mulai</dt>
                    <dd>
                      {data.runBegin
                        ? new Date(data.runBegin).toLocaleString("id-ID")
                        : "-"}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="bg-white border border-[#D8DEDC] rounded-[4px] px-2 py-1">
              <DoorRow label="Front door" state={noData ? "nodata" : data.door?.opnFrnt ? "open" : "closed"} />
              <DoorRow label="Rear door" state={noData ? "nodata" : data.door?.opnRear ? "open" : "closed"} />
              {/* Bypass interlock (M6.0): merah saat aktif, outline abu saat tidak aktif */}
              <div className="flex items-center justify-between py-2 border-t border-[#D8DEDC]">
                <span className="text-sm">Bypass interlock</span>
                <span
                  className={`flex items-center gap-2 text-xs font-semibold ${!noData && data.door?.bypass ? "text-[#A23B2E]" : "text-[#5C6B6A]"
                    }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${!noData && data.door?.bypass ? "bg-[#A23B2E]" : "border border-[#B8C0BE]"
                      }`}
                  />
                  {noData ? "NO DATA" : data.door?.bypass ? "AKTIF" : "TIDAK AKTIF"}
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-1.5">
              {!data.running ? (
                <Link
                  href="/prepare"
                  className="block text-center px-2 py-1.5 rounded-[3px] bg-[#4F7A52] hover:bg-[#446C47] active:bg-[#3A5C3D] text-white text-[13px] font-semibold transition-colors"
                >
                  START
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="block text-center px-2 py-1.5 rounded-[3px] border border-[#D8DEDC] text-[#B8C0BE] text-[13px] font-semibold cursor-not-allowed"
                >
                  START
                </span>
              )}

              {/* DOOR: read only, bukan tombol */}
              <div
                role="status"
                className="flex items-center justify-between px-2 py-1.5 rounded-[3px] border border-dashed border-[#B8C0BE] text-[13px] text-[#5C6B6A] cursor-default select-none"
              >
                <span className="font-semibold">DOOR</span>
                <span className="text-[11px]">
                  Read only: {noData ? "NO DATA" : data.door?.bypass ? "Bypass" : data.door?.seal ? "Sealed" : "Released"}
                </span>
              </div>

              <button
                onClick={handleStop}
                disabled={stopping || !data.running}
                className="px-2 py-1.5 rounded-[3px] bg-[#A23B2E] hover:bg-[#8F3327] active:bg-[#7B2B21] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
              >
                {stopping ? "Menghentikan…" : "STOP"}
              </button>

              {/* ── Peringatan hasil STOP/reset (item 10): di dalam alur layout, di bawah STOP,
                  jadi tidak pernah menutupi tombol STOP. Tetap tampil sampai dikonfirmasi. ── */}
              {cmdAlert && (
                <div
                  role="alert"
                  className={`rounded-[3px] border p-2 flex flex-col gap-1 ${cmdAlert.level === "error"
                    ? "border-[#A23B2E] bg-[#F7E9E6]"
                    : "border-[#B9762F] bg-[#FAF1E3]"
                    }`}
                >
                  <p className={`text-[12px] font-semibold ${cmdAlert.level === "error" ? "text-[#A23B2E]" : "text-[#B9762F]"}`}>
                    {cmdAlert.title}
                  </p>
                  {cmdAlert.lines.map((line, i) => (
                    <p key={i} className="text-[11px] text-[#1E2A2E] leading-snug">{line}</p>
                  ))}
                  <button
                    onClick={() => setCmdAlert(null)}
                    className="mt-1 px-2 py-1 rounded-[3px] border border-[#B8C0BE] bg-white text-[11px] text-[#5C6B6A] hover:bg-[#EEF1F0] transition-colors"
                  >
                    Sudah dicek, tutup
                  </button>
                </div>
              )}

              {/* ── Tombol Reset Mesin: hanya tampil saat fase=6 dan tidak ada batch running ── */}
              {!noData && data.plcOk && data.phase?.rawValue === 6 && !data.running && (
                <div className="pt-1 border-t border-[#D8DEDC]">
                  {/* Dialog konfirmasi inline */}
                  {resetDialog ? (
                    <div className="bg-white border border-[#D8DEDC] rounded-[3px] p-2 flex flex-col gap-2">
                      <p className="text-[12px] text-[#1E2A2E] leading-snug">
                        Kirim STOP ke mesin? Pastikan produk sudah diambil.
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setResetDialog(false); setResetMsg(null); }}
                          disabled={resetting}
                          className="flex-1 px-2 py-1 rounded-[3px] border border-[#B8C0BE] text-[12px] text-[#5C6B6A] hover:bg-[#EEF1F0] disabled:opacity-40 transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleReset}
                          disabled={resetting}
                          className="flex-1 px-2 py-1 rounded-[3px] bg-[#A23B2E] hover:bg-[#8F3327] disabled:opacity-40 text-white text-[12px] font-semibold transition-colors"
                        >
                          {resetting ? "Mengirim…" : "Kirim STOP"}
                        </button>
                      </div>
                      {/* Pesan hasil reset */}
                      {resetMsg && (
                        <p className={`text-[11px] ${resetMsg.ok ? "text-[#4F7A52]" : "text-[#A23B2E]"}`}>
                          {resetMsg.text}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => { setResetDialog(true); setResetMsg(null); }}
                        className="w-full px-2 py-1.5 rounded-[3px] border border-[#A23B2E] text-[#A23B2E] hover:bg-[#A23B2E] hover:text-white text-[13px] font-semibold transition-colors"
                      >
                        Reset Mesin (STOP)
                      </button>
                      <p className="text-[10px] text-[#5C6B6A] mt-1 leading-snug">
                        Mesin masih berstatus Selesai dan tidak ada batch aktif. Reset mengirim perintah STOP ke mesin.
                      </p>
                      {/* Tampilkan pesan sukses dari reset sebelumnya */}
                      {resetMsg && (
                        <p className={`text-[11px] mt-0.5 ${resetMsg.ok ? "text-[#4F7A52]" : "text-[#A23B2E]"}`}>
                          {resetMsg.text}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* ── Timeline fase ── */}
        <section className="bg-white border border-[#D8DEDC] rounded-[4px] p-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1.5 text-[11px] text-[#5C6B6A]">
            <span>
              Waktu berjalan{" "}
              <span
                className="text-base text-[#1E2A2E] ml-1"
                style={MONO}
                title={elapsedApprox ? "Perkiraan: mesin berjalan tetapi tidak ada batch yang tercatat di web" : undefined}
              >
                {elapsedApprox ? "~" : ""}
                {elapsedText}
              </span>
              {elapsedApprox && <span className="ml-1.5 text-[10px]">(perkiraan, tanpa batch web)</span>}
            </span>
            <span>
              Update terakhir{" "}
              <span className="text-[#1E2A2E] ml-1" style={MONO}>
                {updatedClock}
              </span>
              {fetchFailed ? (
                <span className="ml-1.5 text-[10px] font-semibold text-[#A23B2E]">server tidak merespons</span>
              ) : noData ? (
                <span className="ml-1.5 text-[10px] font-semibold text-[#A23B2E]">
                  PLC tidak terbaca{lastPlcOkClock ? ` · terakhir terbaca ${lastPlcOkClock}` : ""}
                </span>
              ) : null}
            </span>
          </div>
          <PhaseTimeline
            activePhase={activePhase}
            selectedPhase={learnStep}
            learn={mode === "learn"}
            onSelect={pickStep}
            durations={durations}
          />
        </section>

        {/* ── Penjelasan fase (edukasi) ── */}
        <PhaseGuide
          mode={mode}
          step={diagramStep}
          valves={data.valves}
          noData={noData}
          setpoints={data.setpoints}
          limits={data.limits}
        />
      </div>
    </main>
  );
}