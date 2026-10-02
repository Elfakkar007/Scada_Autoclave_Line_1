"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────
   Product material masih belum ada tag PLC-nya (murni data resep
   kita sendiri) — default ini dipakai sampai field ini diisi dari
   data formula/batch aktif.
   Catatan: conductivity, tekanan compressed air, level air, F0 per
   channel, dan valve SOFT WATER sengaja TIDAK ditampilkan karena
   belum ada tag PLC yang sesuai (sistem hanya punya 105 tag di
   KEPServerEX).
   ───────────────────────────────────────────────────────────── */
const DEFAULT_MATERIAL = "Soft Bottle";

// Pemetaan data.phase.code (dari /api/status) ke label kotak timeline.
// CATATAN: 'drain' (kode 6 dari PLC) sementara digabung ke kotak COOLING
// karena timeline hanya punya 6 kotak dan tidak ada kotak DRAIN tersendiri.
// Ini keputusan sementara — evaluasi ulang setelah ladder logic fase 6 dikonfirmasi.
const PHASE_CODE_TO_TIMELINE = {
  idle_door_open: "PREPARE",
  idle_ready:     "PREPARE",
  filling:        "FILLING",
  heating:        "HEATING",
  steril:         "STERIL.",
  cooling:        "COOLING",
  drain:          "COOLING", // sementara gabung ke COOLING (timeline tidak punya kotak DRAIN)
  finished:       "END",
  // 'unknown': tidak memetakan ke kotak manapun
};

const PHASES = ["PREPARE", "FILLING", "HEATING", "STERIL.", "COOLING", "END"];

// Warna sesuai design system
const INK = "#1E2A2E";
const MUTED = "#5C6B6A";
const STEAM = "#B9762F";
const WATER = "#1C6E74";
const RUN = "#4F7A52";
const STOP = "#A23B2E";
const IDLE = "#B8C0BE";
const RULE = "#D8DEDC";

const MONO = {
  fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
};
const SANS = { fontFamily: "var(--font-plex-sans), system-ui, sans-serif" };

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
  return Number(v).toFixed(1);
}

// Format bilangan bulat (untuk tekanan dalam kPa — tidak ada desimal)
function fmtInt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "--";
  return String(Math.round(Number(v)));
}

function formatElapsed(begin) {
  if (!begin) return "--:--:--";
  const s = Math.max(
    0,
    Math.floor((Date.now() - new Date(begin).getTime()) / 1000)
  );
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/* ─────────────── Komponen SVG (P&ID) ─────────────── */

// Pipa dua garis: lapisan tinta dulu, lalu lapisan dalam putih, lalu tint aksen.
// Semua pipa digambar per-lapisan supaya persimpangan menyatu bersih.
function Pipes({ list }) {
  return (
    <g fill="none">
      {list.map((p, i) => (
        <path key={`o${i}`} d={p.d} stroke={INK} strokeWidth="9" />
      ))}
      {list.map((p, i) => (
        <path key={`w${i}`} d={p.d} stroke="#FFFFFF" strokeWidth="5" />
      ))}
      {list
        .filter((p) => p.tint)
        .map((p, i) => (
          <path
            key={`t${i}`}
            d={p.d}
            stroke={p.tint}
            strokeOpacity="0.35"
            strokeWidth="5"
          />
        ))}
    </g>
  );
}

// Valve bowtie: terisi saat open, outline saja saat closed.
// unknown = status belum diketahui (tidak ada tag PLC): outline netral, tanpa fill.
function Valve({ x, y, open, tone, unknown = false, vertical = false, label, lx, ly, anchor = "start" }) {
  const isOpen = !unknown && open;
  const fill = isOpen ? tone : "#FFFFFF";
  const stroke = isOpen ? tone : IDLE;
  return (
    <g>
      <g transform={`translate(${x} ${y})${vertical ? " rotate(90)" : ""}`}>
        <path
          d="M-11 -8 L0 0 L-11 8 Z M11 -8 L0 0 L11 8 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M0 0 V-14 M-5 -14 H5" stroke={stroke} strokeWidth="1.5" fill="none" />
      </g>
      <text x={lx} y={ly} fontSize="11" fontWeight="600" fill={INK} textAnchor={anchor}>
        {label}
      </text>
      <text
        x={vertical ? x + 16 : x}
        y={vertical ? y + 4 : y + 24}
        fontSize="8"
        fontWeight="600"
        fill={isOpen ? tone : MUTED}
        textAnchor={vertical ? "start" : "middle"}
      >
        {unknown ? "-" : open ? "OPEN" : "CLOSED"}
      </text>
    </g>
  );
}

// Plakat instrumen: strip label di atas, angka mono di bawah
function Plate({ x, y, w, h = 34, label, value, unit }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="#FFFFFF" stroke={IDLE} />
      <line x1={x} x2={x + w} y1={y + 13} y2={y + 13} stroke={RULE} />
      <text x={x + 6} y={y + 9.5} fontSize="9" fill={MUTED}>
        {label}
      </text>
      <text
        x={x + w - 6}
        y={y + 28}
        textAnchor="end"
        fontSize="14"
        fontWeight="500"
        fill={INK}
        style={MONO}
      >
        {value}
        {unit && (
          <tspan fontSize="8" fill={MUTED} dx="3" style={SANS}>
            {unit}
          </tspan>
        )}
      </text>
    </g>
  );
}

function PidDiagram({ valves, doors, p1, p2, level, conductivity }) {
  // valves berasal dari data.valves (tag asli PLC). exhaust dipetakan ke
  // steamExhs (tag STEAM_EXHS) — itu tag yang sama dengan label "EXHAUST"
  // di diagram ini. "drain" bawah & "air" (compressed air) TIDAK dipetakan
  // ke tag apapun karena belum ada tag PLC yang confirmed untuk itu —
  // tetap unknown, sama seperti SOFT WATER, biar diagram tetap jujur.
  const v = {
    steam1: valves?.steam1 ?? false,
    steam2: valves?.steam2 ?? false,
    waterDrain: valves?.wtrDrain ?? false,
    cool1: valves?.cooling1 ?? false,
    cool2: valves?.cooling2 ?? false,
    exhaust: valves?.steamExhs ?? false,
  };

  const pipes = [
    // Steam
    { d: "M30 40 H190", tint: v.steam1 && STEAM },
    { d: "M30 100 H190", tint: v.steam2 && STEAM },
    { d: "M190 40 V100 H250 V190 H320", tint: (v.steam1 || v.steam2) && STEAM },
    // Water drain (keluar dari chamber ke kiri)
    { d: "M320 240 H30", tint: v.waterDrain && WATER },
    // Cooling water
    { d: "M30 380 H190", tint: v.cool1 && WATER },
    { d: "M30 440 H190", tint: v.cool2 && WATER },
    { d: "M190 380 V440 H250 V300 H320", tint: (v.cool1 || v.cool2) && WATER },
    // Drain bawah — belum ada tag PLC yang confirmed, biarkan netral
    { d: "M360 340 V490", tint: false },
    // Compressed air — belum ada tag PLC
    { d: "M870 60 H580 V150", tint: false },
    // Exhaust
    { d: "M640 300 H870", tint: v.exhaust && STEAM },
    // Soft water (status belum diketahui: tanpa tint aksen)
    { d: "M870 440 H600 V340", tint: false },
  ];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 900 510"
        className="w-full h-auto"
        role="img"
        aria-label="Diagram perpipaan mesin sterilizer"
        style={SANS}
      >
        <Pipes list={pipes} />

        {/* ── Chamber ── */}
        <rect x="320" y="150" width="320" height="190" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
        {/* panel pintu ganda */}
        <rect x="330" y="160" width="140" height="170" fill="none" stroke={IDLE} />
        <rect x="490" y="160" width="140" height="170" fill="none" stroke={IDLE} />
        <line x1="480" x2="480" y1="150" y2="340" stroke={INK} strokeWidth="2" />
        {/* engsel */}
        <g fill="#FFFFFF" stroke={INK}>
          <rect x="316" y="178" width="4" height="16" />
          <rect x="316" y="296" width="4" height="16" />
          <rect x="640" y="178" width="4" height="16" />
          <rect x="640" y="296" width="4" height="16" />
        </g>
        {/* handle: terisi hijau jika pintu open */}
        <rect x="462" y="230" width="6" height="30" fill={doors?.front === "open" ? RUN : "#FFFFFF"} stroke={INK} />
        <rect x="492" y="230" width="6" height="30" fill={doors?.rear === "open" ? RUN : "#FFFFFF"} stroke={INK} />
        <text x="400" y="180" fontSize="10" fill={MUTED} textAnchor="middle">Front door</text>
        <text x="560" y="180" fontSize="10" fill={MUTED} textAnchor="middle">Rear door</text>
        {/* Level (tag WATER/VW124) — satuan belum dikonfirmasi, tampilkan raw */}
        <g>
          <rect x="585" y="305" width="64" height="34" rx="2" fill="#FFFFFF" stroke={IDLE} />
          <line x1="585" x2="649" y1="318" y2="318" stroke={RULE} />
          <text x="591" y="314.5" fontSize="9" fill={MUTED}>Level</text>
          <text x="643" y="332" textAnchor="end" fontSize="14" fontWeight="500" fill={INK} style={MONO}>
            {level !== null && level !== undefined ? Math.round(level) : "-"}
          </text>
          <text x="591" y="333" fontSize="7" fill={MUTED} style={SANS}>nilai PLC</text>
        </g>

        {/* Conductivity (tag L/VW122) — satuan belum dikonfirmasi, tampilkan raw */}
        <g>
          <rect x="585" y="345" width="64" height="34" rx="2" fill="#FFFFFF" stroke={IDLE} />
          <line x1="585" x2="649" y1="358" y2="358" stroke={RULE} />
          <text x="591" y="354.5" fontSize="9" fill={MUTED}>Cond.</text>
          <text x="643" y="372" textAnchor="end" fontSize="14" fontWeight="500" fill={INK} style={MONO}>
            {conductivity !== null && conductivity !== undefined ? Math.round(conductivity) : "-"}
          </text>
          <text x="591" y="373" fontSize="7" fill={MUTED} style={SANS}>belum dikalibrasi</text>
        </g>

        {/* P1 / P2 — tekanan dalam kPa (nilai raw PLC, terkonfirmasi dari layar SCADA lama) */}
        <line x1="375" x2="375" y1="134" y2="150" stroke={IDLE} />
        <line x1="455" x2="455" y1="134" y2="150" stroke={IDLE} />
        <Plate x={340} y={100} w={70} label="P1" value={fmtInt(p1)} unit="kPa" />
        <Plate x={420} y={100} w={70} label="P2" value={fmtInt(p2)} unit="kPa" />

        {/* F0: hanya 1 tag di sistem; nilai akan dihitung di backend dari data suhu */}
        <text x="392" y="358" fontSize="9" fill={MUTED}>
          <tspan x="392">F0 tercapai: akan dihitung dari data suhu</tspan>
          <tspan x="392" dy="12">(belum tersedia)</tspan>
        </text>

        {/* ── Steam ── */}
        <Valve x={100} y={40} open={v.steam1} tone={STEAM} label="STEAM 1" lx={30} ly={18} />
        <Valve x={100} y={100} open={v.steam2} tone={STEAM} label="STEAM 2" lx={30} ly={78} />
        <Valve x={100} y={240} open={v.waterDrain} tone={WATER} label="WATER DRAIN" lx={30} ly={218} />

        {/* ── Cooling ── */}
        <Valve x={100} y={380} open={v.cool1} tone={WATER} label="COOLING WATER 1" lx={30} ly={358} />
        <Valve x={100} y={440} open={v.cool2} tone={WATER} label="COOLING WATER 2" lx={30} ly={418} />

        {/* ── Drain bawah — belum ada tag PLC confirmed, status unknown ── */}
        <Valve x={360} y={430} vertical unknown label="DRAIN" lx={376} ly={426} />

        {/* ── Compressed air — belum ada tag PLC confirmed, status unknown ── */}
        <Valve x={740} y={60} unknown label="COMPRESSED AIR" lx={870} ly={38} anchor="end" />

        {/* ── Exhaust & soft water ── */}
        <Valve x={760} y={300} open={v.exhaust} tone={INK} label="EXHAUST" lx={870} ly={278} anchor="end" />
        {/* SOFT WATER: belum ada tag PLC, status valve tidak diketahui */}
        <Valve x={760} y={440} unknown label="SOFT WATER" lx={870} ly={418} anchor="end" />
      </svg>
    </div>
  );
}

/* ─────────────── Komponen UI (HTML) ─────────────── */

function Gauge({ label, value }) {
  return (
    <div className="border border-[#B8C0BE] rounded-[3px] bg-white">
      <div className="px-2 py-1 border-b border-[#D8DEDC] text-xs text-[#5C6B6A]">
        {label}
      </div>
      <div className="m-1 px-2 py-1.5 bg-[#EEF1F0] rounded-[2px] shadow-[inset_0_1px_2px_rgba(30,42,46,0.15)] flex items-baseline justify-end gap-1">
        <span className="text-xl font-medium text-[#1E2A2E]" style={MONO}>
          {fmt(value)}
        </span>
        <span className="text-[10px] text-[#5C6B6A]">°C</span>
      </div>
    </div>
  );
}

function DoorRow({ label, state }) {
  const open = state === "open";
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
        {open ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );
}

function PhaseTimeline({ activePhase }) {
  return (
    <div className="relative">
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
      <ol className="relative grid grid-cols-6">
        {PHASES.map((p) => {
          const active = activePhase === p;
          return (
            <li key={p} className="flex flex-col items-center">
              <div className="h-4 flex items-end">
                <span
                  className={
                    active
                      ? "block w-[3px] h-4 bg-[#4F7A52]"
                      : "block w-px h-2 bg-[#5C6B6A]"
                  }
                />
              </div>
              <span
                className={`mt-2 text-[11px] sm:text-xs ${active ? "font-bold text-[#1E2A2E]" : "text-[#5C6B6A]"
                  }`}
              >
                {p}
              </span>
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

  // State untuk tombol Reset Mesin
  const [resetDialog, setResetDialog] = useState(false);  // dialog konfirmasi tampil?
  const [resetting, setResetting] = useState(false);       // sedang mengirim request?
  const [resetMsg, setResetMsg] = useState(null);          // { ok, text } atau null

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/status");
    const json = await res.json();
    setData(json);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleStop() {
    if (!window.confirm(`Yakin ingin menghentikan batch ${data.batchNo}?`)) return;
    setStopping(true);
    try {
      await fetch("/api/batch/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: data.operator ?? "unknown" }),
      });
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
      const json = await res.json();
      if (json.ok) {
        setResetMsg({ ok: true, text: json.message ?? "Reset berhasil. Mesin kembali ke Idle." });
        setResetDialog(false);
        await fetchData();
      } else {
        setResetMsg({ ok: false, text: json.error ?? "Reset gagal." });
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
        Memuat data...
      </main>
    );
  }

  // phase kini object {code, label, confirmed, rawValue} dari /api/status.
  // Kalau masih pakai dummy lama (string), code di bawah tetap aman karena
  // activePhase akan null dan statusLabel akan jatuh ke "--".
  const phaseObj = data.phase && typeof data.phase === 'object' ? data.phase : null;

  // Tentukan kotak mana di timeline yang perlu di-highlight.
  // code 'unknown' atau null -> tidak highlight kotak manapun.
  const activePhase = phaseObj ? (PHASE_CODE_TO_TIMELINE[phaseObj.code] ?? null) : null;

  const isRunning = data.runLamp ?? data.running; // utamakan status PLC asli (RUN_LAMP), fallback ke status DB kalau field ini belum ada (mis. saat masih dummy)
  const statusLabel = phaseObj ? phaseObj.label : (data.phase ?? "--");
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
            <Gauge key={label} label={label} value={value} />
          ))}
        </section>

        {/* ── Strip peringatan interlock dan mode (muncul hanya bila kondisi aktif) ── */}
        {data.plcOk && (
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
            <PidDiagram
              valves={data.valves}
              doors={{
                front: data.door?.opnFrnt ? "open" : "closed",
                rear: data.door?.opnRear ? "open" : "closed",
              }}
              p1={data.p1}
              p2={data.p2}
              level={data.level}
              conductivity={data.conductivity}
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
                <span className={`w-1.5 h-1.5 rounded-full ${data.plcOk === false ? "bg-[#A23B2E]" : "bg-[#4F7A52]"}`} />
                Comm: {data.plcOk === false ? "Abnormal" : "Normal"}
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
                  className={`w-2 h-2 rounded-full ${isRunning ? "bg-[#4F7A52]" : "bg-[#A23B2E]"
                    }`}
                />
                {isRunning ? "Mesin berjalan" : "Mesin berhenti"}
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
              <DoorRow label="Front door" state={data.door?.opnFrnt ? "open" : "closed"} />
              <DoorRow label="Rear door" state={data.door?.opnRear ? "open" : "closed"} />
              {/* Bypass interlock (M6.0): merah saat aktif, outline abu saat tidak aktif */}
              <div className="flex items-center justify-between py-2 border-t border-[#D8DEDC]">
                <span className="text-sm">Bypass interlock</span>
                <span
                  className={`flex items-center gap-2 text-xs font-semibold ${
                    data.door?.bypass ? "text-[#A23B2E]" : "text-[#5C6B6A]"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      data.door?.bypass ? "bg-[#A23B2E]" : "border border-[#B8C0BE]"
                    }`}
                  />
                  {data.door?.bypass ? "AKTIF" : "TIDAK AKTIF"}
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
                  Read only: {data.door?.bypass ? "Bypass" : data.door?.seal ? "Sealed" : "Released"}
                </span>
              </div>

              <button
                onClick={handleStop}
                disabled={stopping || !data.running}
                className="px-2 py-1.5 rounded-[3px] bg-[#A23B2E] hover:bg-[#8F3327] active:bg-[#7B2B21] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
              >
                {stopping ? "Menghentikan…" : "STOP"}
              </button>

              {/* ── Tombol Reset Mesin: hanya tampil saat fase=6 dan tidak ada batch running ── */}
              {data.plcOk && data.phase?.rawValue === 6 && !data.running && (
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
          <div className="flex items-baseline justify-between mb-1.5 text-[11px] text-[#5C6B6A]">
            <span>
              Waktu berjalan{" "}
              <span className="text-base text-[#1E2A2E] ml-1" style={MONO}>
                {data.running ? formatElapsed(data.runBegin) : "--:--:--"}
              </span>
            </span>
            <span>
              Update terakhir{" "}
              <span className="text-[#1E2A2E] ml-1" style={MONO}>
                {new Date(data.updatedAt).toLocaleTimeString("id-ID")}
              </span>
            </span>
          </div>
          <PhaseTimeline activePhase={activePhase} />
        </section>
      </div>
    </main>
  );
}