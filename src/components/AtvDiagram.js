"use client";

import { useState } from "react";
import {
  MEDIUM,
  STEPS,
  PROFILES,
  COMPONENT_INFO,
  resolveStates,
  resolvePump,
  resolveChamber,
  resolveHeat,
  mixHex,
} from "@/lib/atvProcess";

/* ─────────────────────────────────────────────────────────────
   Diagram P&ID mesin ATV — layout mengikuti PIPING_WATER_STERIL_ATV.pdf
   (halaman 1, tampak 2D). Koordinat SVG = koordinat gambar PDF.

   Animasi:
   - aliran = garis putus-putus berjalan di atas pipa, searah aliran nyata
   - valve open/auto berwarna sesuai medium, closed abu-abu
   - pompa berputar, air di chamber naik/turun, warna air ikut suhu
   Semua animasi mengikuti status valve (LIVE dari PLC) atau profil fase (PELAJARI).
   ───────────────────────────────────────────────────────────── */

const INK = "#1E2A2E";
const MUTED = "#5C6B6A";
const IDLE = "#B8C0BE";
const RULE = "#D8DEDC";
const RUN = "#4F7A52";
const STOP = "#A23B2E";
const { steam: STEAM, water: WATER, air: AIR, drainA: DRAIN_A, drainB: DRAIN_B } = MEDIUM;

const MONO = {
  fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
};
const SANS = { fontFamily: "var(--font-plex-sans), system-ui, sans-serif" };

const fmt1 = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--" : Number(v).toFixed(1));
const fmt0 = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--" : String(Math.round(Number(v))));

/* ───────────── Geometri ───────────── */

// polyline → path dengan sudut membulat
function rp(pts, r = 18) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x + ((px - x) / l1) * rr;
    const ay = y + ((py - y) / l1) * rr;
    const bx = x + ((nx - x) / l2) * rr;
    const by = y + ((ny - y) / l2) * rr;
    d += ` L${ax} ${ay} Q${x} ${y} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

// Pipa statis (abu-abu). Urutan titik tidak penting di sini.
const BASE_PIPES = [
  { pts: [[182, 118], [548, 118], [548, 297], [610, 297]], r: 18 },   // steam 1 + trunk uap
  { pts: [[182, 190], [548, 190]] },                                   // steam 2
  { pts: [[182, 265], [548, 265]] },                                   // water drain
  { pts: [[182, 388], [548, 388]] },                                   // cooling 1
  { pts: [[182, 466], [548, 466]] },                                   // cooling 2
  { pts: [[262, 620], [262, 545], [548, 545], [548, 352], [610, 352]], r: 18 }, // jalur buang + trunk pendingin
  { pts: [[660, 297], [718, 297], [718, 165], [1005, 165], [1005, 222]], r: 20 }, // chamber atas ↔ PHE
  { pts: [[660, 352], [718, 352], [718, 515], [770, 515]], r: 20 },    // PHE → pompa
  { pts: [[899, 555], [1005, 555]] },                                  // pompa → dasar chamber
  { pts: [[1005, 435], [1005, 620]] },                                 // dasar chamber
  { pts: [[105, 620], [1360, 620]] },                                  // pipa drain / soft water
  { pts: [[1360, 165], [1145, 165], [1145, 222]], r: 18 },             // compressed air
  { pts: [[1145, 435], [1145, 518], [1360, 518]], r: 18 },             // exhaust
];

// Posisi valve [cx, cy]
const VALVE_POS = {
  steam1: [378, 118],
  steam2: [378, 190],
  waterDrain: [378, 265],
  cool1: [378, 388],
  cool2: [378, 466],
  utilOut: [378, 545],
  drain: [630, 620],
  softWater: [1085, 620],
  air: [1255, 165],
  exhaust: [1240, 518],
};

const VALVE_TONE = {
  steam1: STEAM, steam2: STEAM, waterDrain: DRAIN_A,
  cool1: WATER, cool2: WATER, utilOut: DRAIN_B,
  drain: DRAIN_B, air: AIR, exhaust: STEAM, softWater: WATER,
};

// Panah sumber / tujuan di tepi gambar (mengikuti PDF)
const ARROWS = [
  { el: "steam1", x0: 65, x1: 172, y: 118, dir: "r", color: STEAM, label: "STEAM 1", lx: 65, ly: 154 },
  { el: "steam2", x0: 65, x1: 172, y: 190, dir: "r", color: STEAM, label: "STEAM 2", lx: 65, ly: 226 },
  { el: "waterDrain", x0: 65, x1: 172, y: 265, dir: "l", color: DRAIN_A, label: "WATER DRAIN", lx: 65, ly: 301 },
  { el: "cool1", x0: 65, x1: 172, y: 388, dir: "r", color: WATER, label: "COOLING WATER 1", lx: 65, ly: 424 },
  { el: "cool2", x0: 65, x1: 172, y: 466, dir: "r", color: WATER, label: "COOLING WATER 2", lx: 65, ly: 502 },
  { el: "drain", el2: "utilOut", x0: 105, x1: 210, y: 585, dir: "l", color: DRAIN_B, label: "DRAIN", lx: 105, ly: 650 },
  { el: "air", x0: 1370, x1: 1475, y: 165, dir: "l", color: AIR, label: "COMPRESSED AIR", lx: 1475, ly: 203, anchor: "end" },
  { el: "exhaust", x0: 1370, x1: 1475, y: 518, dir: "r", color: STEAM, label: "EXHAUST", lx: 1475, ly: 556, anchor: "end" },
  { el: "softWater", x0: 1370, x1: 1475, y: 620, dir: "l", color: WATER, label: "SOFT WATER", lx: 1475, ly: 656, anchor: "end" },
];

// Area klik (inspektur)
const vhot = ([cx, cy]) => ({ x: cx - 36, y: cy - 42, w: 72, h: 80 });
const HOT = {
  steam1: vhot(VALVE_POS.steam1),
  steam2: vhot(VALVE_POS.steam2),
  waterDrain: vhot(VALVE_POS.waterDrain),
  cool1: vhot(VALVE_POS.cool1),
  cool2: vhot(VALVE_POS.cool2),
  utilOut: vhot(VALVE_POS.utilOut),
  drain: vhot(VALVE_POS.drain),
  softWater: vhot(VALVE_POS.softWater),
  air: vhot(VALVE_POS.air),
  exhaust: vhot(VALVE_POS.exhaust),
  pump: { x: 764, y: 486, w: 138, h: 86 },
  phe: { x: 598, y: 266, w: 70, h: 124 },
  chamber: { x: 842, y: 222, w: 423, h: 213 },
  th: { x: 1024, y: 166, w: 106, h: 42 },
  p1: { x: 1300, y: 250, w: 106, h: 42 },
  p2: { x: 1300, y: 305, w: 106, h: 42 },
  tm: { x: 735, y: 316, w: 100, h: 42 },
  tl: { x: 1024, y: 468, w: 106, h: 42 },
  level: { x: 860, y: 447, w: 100, h: 42 },
  cond: { x: 579, y: 458, w: 106, h: 42 },
};

/* ───────────── CSS animasi ───────────── */

const CSS = `
.atv-flow{stroke-dasharray:11 15;animation:atv-dash .9s linear infinite}
.atv-flow.dots{stroke-dasharray:1 13;stroke-linecap:round}
.atv-flow.auto{animation:atv-dash .9s linear infinite,atv-blink 1.8s ease-in-out infinite}
@keyframes atv-dash{to{stroke-dashoffset:-26}}
@keyframes atv-blink{0%,100%{opacity:1}50%{opacity:.3}}
.atv-wheel-auto{animation:atv-blink 1.8s ease-in-out infinite}
.atv-spin{transform-box:fill-box;transform-origin:center;animation:atv-rot .9s linear infinite}
@keyframes atv-rot{to{transform:rotate(360deg)}}
.atv-bubble{animation:atv-rise 3.4s ease-in infinite}
@keyframes atv-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.85}100%{transform:translateY(-118px);opacity:0}}
.atv-wave{animation:atv-wave 3.2s linear infinite}
@keyframes atv-wave{to{transform:translateX(-40px)}}
.atv-pulse{animation:atv-pulse 1.8s ease-in-out infinite}
@keyframes atv-pulse{0%,100%{opacity:.12}50%{opacity:.5}}
.atv-flash{transform-box:fill-box;transform-origin:center;animation:atv-flash .9s ease-out 1 both}
@keyframes atv-flash{from{opacity:.9;transform:scale(.55)}to{opacity:0;transform:scale(1.9)}}
.atv-arrow-on{animation:atv-glow 1.8s ease-in-out infinite}
@keyframes atv-glow{0%,100%{opacity:1}50%{opacity:.7}}
.atv-hot{fill:transparent;pointer-events:all;cursor:pointer;outline:none}
.atv-hot:hover{fill:rgba(28,110,116,.07)}
.atv-hot:focus-visible{stroke:#1C6E74;stroke-width:2}
.atv-paused *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.atv-root *{animation:none!important}}
`;

/* ───────────── Komponen SVG ───────────── */

function BasePipes() {
  const ds = BASE_PIPES.map((p) => rp(p.pts, p.r ?? 18));
  return (
    <g fill="none" strokeLinejoin="round">
      {ds.map((d, i) => <path key={`o${i}`} d={d} stroke="#4B5557" strokeWidth="15" />)}
      {ds.map((d, i) => <path key={`b${i}`} d={d} stroke="#AEB5B3" strokeWidth="10" />)}
      {ds.map((d, i) => <path key={`h${i}`} d={d} stroke="#E4E8E7" strokeOpacity="0.55" strokeWidth="2.6" />)}
    </g>
  );
}

function FlowLayer({ flows }) {
  return (
    <g fill="none" strokeLinejoin="round">
      {flows.map((f) => (
        <g key={f.k}>
          <path d={f.d} stroke={f.color} strokeOpacity="0.32" strokeWidth="9" />
          <path
            d={f.d}
            stroke={f.color}
            strokeWidth={f.dots ? 5 : 4.5}
            className={`atv-flow${f.dots ? " dots" : ""}${f.auto ? " auto" : ""}`}
          />
        </g>
      ))}
    </g>
  );
}

function ArrowTag({ a, active }) {
  const { x0, x1, y, dir, color } = a;
  const pts =
    dir === "r"
      ? [[x0, y - 9], [x1 - 26, y - 9], [x1 - 26, y - 17], [x1, y], [x1 - 26, y + 17], [x1 - 26, y + 9], [x0, y + 9]]
      : [[x1, y - 9], [x0 + 26, y - 9], [x0 + 26, y - 17], [x0, y], [x0 + 26, y + 17], [x0 + 26, y + 9], [x1, y + 9]];
  return (
    <g>
      <polygon
        points={pts.map((p) => p.join(",")).join(" ")}
        fill={color}
        fillOpacity={active ? 1 : 0.5}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
        className={active ? "atv-arrow-on" : undefined}
      />
      <text x={a.lx} y={a.ly} fontSize="15" fill={INK} textAnchor={a.anchor || "start"}>
        {a.label}
      </text>
    </g>
  );
}

function ValveGlyph({ id, st }) {
  const [cx, cy] = VALVE_POS[id];
  const tone = VALVE_TONE[id];
  const s = st?.s ?? "unknown";
  const est = st?.src === "est";
  const live = s === "open" || s === "auto";
  const wheel = live ? tone : s === "closed" ? "#C8CECC" : "#FFFFFF";
  const text = s === "open" ? "OPEN" : s === "auto" ? "AUTO" : s === "closed" ? "CLOSED" : "-";
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {est && (
        <rect x="-37" y="-40" width="74" height="76" rx="7" fill="none" stroke={IDLE} strokeDasharray="3 3" />
      )}
      <rect x="-32" y="-13" width="7" height="26" fill="#BFC5C3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="25" y="-13" width="7" height="26" fill="#BFC5C3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="-25" y="-9" width="50" height="18" rx="2" fill="#C9CFCD" stroke="#3E484B" strokeWidth="1.2" />
      <path d="M-7 -9 L7 9 M7 -9 L-7 9" stroke="#3E484B" strokeOpacity="0.35" strokeWidth="1" />
      <rect x="-4" y="-19" width="8" height="10" fill="#C9CFCD" stroke="#3E484B" strokeWidth="1.2" />
      <path
        d="M-14 -19 Q-14 -35 0 -35 Q14 -35 14 -19 Z"
        fill={wheel}
        stroke="#3E484B"
        strokeWidth="1.3"
        strokeDasharray={s === "unknown" ? "3 2" : undefined}
        className={s === "auto" ? "atv-wheel-auto" : undefined}
      />
      {live && (
        <circle key={s} cy="-24" r="16" fill="none" stroke={tone} strokeWidth="2" className="atv-flash" />
      )}
      <text
        y="32"
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        fill={live ? tone : MUTED}
      >
        {est && s !== "unknown" ? "≈ " : ""}
        {text}
      </text>
    </g>
  );
}

function ManualBallValve() {
  return (
    <g transform="translate(1230 620)">
      <rect x="-32" y="-13" width="7" height="26" fill="#BFC5C3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="25" y="-13" width="7" height="26" fill="#BFC5C3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="-25" y="-11" width="50" height="22" rx="3" fill="#C9CFCD" stroke="#3E484B" strokeWidth="1.2" />
      <circle r="8" fill="#B3BAB8" stroke="#3E484B" strokeWidth="1.2" />
      <path d="M0 -11 L4 -20 L62 -23" fill="none" stroke="#3E484B" strokeWidth="1.5" />
      <text y="32" fontSize="10" textAnchor="middle" fill={MUTED}>MANUAL</text>
    </g>
  );
}

function Plate({ x, y, w = 106, h = 42, label, value, unit, note }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="#FFFFFF" stroke={IDLE} />
      <line x1={x} x2={x + w} y1={y + 15} y2={y + 15} stroke={RULE} />
      <text x={x + 6} y={y + 11} fontSize="10.5" fill={MUTED}>{label}</text>
      {note && <text x={x + 6} y={y + 35} fontSize="8.5" fill={MUTED}>{note}</text>}
      <text x={x + w - 6} y={y + 35} textAnchor="end" fontSize="18" fontWeight="500" fill={INK} style={MONO}>
        {value}
        {unit && <tspan fontSize="10" fill={MUTED} dx="3" style={SANS}>{unit}</tspan>}
      </text>
    </g>
  );
}

function Pump({ on }) {
  const lamp = on === null ? IDLE : on ? RUN : STOP;
  return (
    <g>
      {/* dudukan */}
      <path d="M803 570 L813 552 L857 552 L867 570 Z" fill="#8F9593" stroke={INK} strokeWidth="1.2" />
      {/* flens + stub */}
      <rect x="766" y="503" width="7" height="24" fill="#BFC5C3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="773" y="509" width="32" height="12" fill="#AEB5B3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="864" y="549" width="30" height="12" fill="#AEB5B3" stroke="#3E484B" strokeWidth="1.2" />
      <rect x="892" y="543" width="7" height="24" fill="#BFC5C3" stroke="#3E484B" strokeWidth="1.2" />
      {/* rumah pompa */}
      <circle cx="835" cy="522" r="32" fill="#A3A7A5" stroke={INK} strokeWidth="1.6" />
      <circle cx="835" cy="522" r="23" fill="#B9BFBD" stroke="#3E484B" strokeWidth="1" />
      <g transform="translate(835 522)">
        <g className={on ? "atv-spin" : undefined}>
          <path d="M0 0 L0 -19 M0 0 L18 -6 M0 0 L11 15 M0 0 L-11 15 M0 0 L-18 -6" stroke="#5C6B6A" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
      <rect x="821" y="516" width="28" height="13" rx="1.5" fill={lamp} stroke={INK} strokeWidth="1.2" />
    </g>
  );
}

function Phe({ mode }) {
  // mode: 'steam' | 'cool' | null → warna inti
  const tone = mode === "steam" ? STEAM : mode === "cool" ? WATER : null;
  const coil = mode === "steam" ? "#C96B3A" : mode === "cool" ? "#3F9AA1" : "#C98C93";
  let zig = "M626 292";
  for (let i = 0; i < 8; i++) zig += ` L${i % 2 === 0 ? 640 : 626} ${300 + i * 10}`;
  return (
    <g>
      <rect x="605" y="275" width="15" height="107" fill="#7A7F7D" stroke={INK} strokeWidth="1.5" />
      <rect x="645" y="275" width="15" height="107" fill="#7A7F7D" stroke={INK} strokeWidth="1.5" />
      <rect x="620" y="285" width="25" height="87" fill="#D7DBDA" stroke={INK} strokeWidth="1" />
      {tone && <rect x="620" y="285" width="25" height="87" fill={tone} className="atv-pulse" />}
      <path d={zig} fill="none" stroke={coil} strokeWidth="2" strokeLinejoin="round" />
      <rect x="600" y="270" width="25" height="5" fill="#5C6B6A" stroke={INK} strokeWidth="0.8" />
      <rect x="640" y="270" width="25" height="5" fill="#5C6B6A" stroke={INK} strokeWidth="0.8" />
      <rect x="600" y="382" width="25" height="5" fill="#5C6B6A" stroke={INK} strokeWidth="0.8" />
      <rect x="640" y="382" width="25" height="5" fill="#5C6B6A" stroke={INK} strokeWidth="0.8" />
      <text x="632" y="259" fontSize="15" fill={INK} textAnchor="middle">PHE</text>
    </g>
  );
}

const WIN = [
  { id: "front", x: 886, y: 268, w: 113, h: 124 },
  { id: "rear", x: 1011, y: 268, w: 113, h: 124 },
];

function waveD(x, y, w, h) {
  let d = `M${x - 40} ${y + 3} q10 -6 20 0`;
  const n = Math.ceil((w + 80) / 20);
  for (let i = 1; i < n; i++) d += " t20 0";
  return `${d} V${y + h + 4} H${x - 40} Z`;
}

function Chamber({ chamber, heat, flowing, doors, sim, noData, running, lampOn }) {
  const level = chamber === "empty" || chamber === "unknown" || chamber === "draining" ? 0 : chamber === "filling" ? 0.95 : 0.96;
  const trans =
    chamber === "filling" ? "transform 24s linear" : chamber === "draining" ? "transform 14s ease-in" : "transform 1.2s ease-out";
  const water = mixHex("#6FB1B6", "#D79A4E", heat);
  const showDoor = !sim && !noData;
  const lamp = noData ? IDLE : lampOn ? RUN : "#2B3436";
  return (
    <g>
      {/* badan */}
      <rect x="842" y="222" width="423" height="213" fill="#A3A7A5" stroke={INK} strokeWidth="2" />
      <rect x="842" y="222" width="38" height="213" fill="#B7BBB9" stroke={INK} strokeWidth="1.2" />
      <rect x="1130" y="222" width="135" height="213" fill="#B7BBB9" stroke={INK} strokeWidth="1.2" />
      <rect x="880" y="222" width="250" height="40" fill="#9DA1A0" stroke={INK} strokeWidth="1.2" />
      <rect x="880" y="398" width="250" height="37" fill="#9DA1A0" stroke={INK} strokeWidth="1.2" />
      <line x1="1005" y1="262" x2="1005" y2="398" stroke={INK} strokeWidth="2" />
      <text x="1005" y="248" fontSize="15" fontWeight="600" fill={INK} textAnchor="middle">CHAMBER ATV</text>

      {/* jendela pintu + isi chamber */}
      {WIN.map((wn, wi) => {
        const bottles = [];
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 7; c++) {
            bottles.push(
              <g key={`${r}-${c}`} transform={`translate(${wn.x + 9 + c * 15} ${wn.y + wn.h - 52 + r * 26})`}>
                <rect x="1" y="0" width="9" height="5" rx="1.5" fill="#EEF1F0" stroke="#5C6B6A" strokeWidth="0.7" />
                <rect x="0" y="4" width="11" height="17" rx="3" fill="#EEF1F0" stroke="#5C6B6A" strokeWidth="0.7" />
              </g>
            );
          }
        }
        return (
          <g key={wn.id}>
            <clipPath id={`atv-clip-${wn.id}`}>
              <rect x={wn.x} y={wn.y} width={wn.w} height={wn.h} rx="3" />
            </clipPath>
            <g clipPath={`url(#atv-clip-${wn.id})`}>
              <rect x={wn.x} y={wn.y} width={wn.w} height={wn.h} fill="#7F8583" />
              <path d={`M${wn.x} ${wn.y + wn.h - 29} H${wn.x + wn.w} M${wn.x} ${wn.y + wn.h - 3} H${wn.x + wn.w}`} stroke="#5C6B6A" strokeWidth="1.5" />
              {bottles}
              <g style={{ transform: `translateY(${(1 - level) * wn.h}px)`, transition: trans }}>
                <path d={waveD(wn.x, wn.y, wn.w, wn.h)} fill={water} fillOpacity="0.68" className="atv-wave" />
                {flowing &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <circle
                      key={i}
                      className="atv-bubble"
                      cx={wn.x + 14 + i * 21}
                      cy={wn.y + wn.h - 10}
                      r={2 + (i % 2)}
                      fill="#FFFFFF"
                      fillOpacity="0.75"
                      style={{ animationDelay: `${i * 0.65 + wi * 0.3}s` }}
                    />
                  ))}
              </g>
            </g>
            <rect x={wn.x} y={wn.y} width={wn.w} height={wn.h} rx="3" fill="none" stroke={INK} strokeWidth="1.6" />
            <text x={wn.x + wn.w / 2} y="420" fontSize="11" textAnchor="middle" fill={INK}>
              {wn.id === "front" ? "FRONT" : "REAR"}
              {showDoor ? ` · ${doors?.[wn.id] === "open" ? "OPEN" : "CLOSED"}` : ""}
            </text>
            {showDoor && doors?.[wn.id] === "open" && (
              <rect x={wn.x - 3} y={wn.y - 3} width={wn.w + 6} height={wn.h + 6} rx="5" fill="none" stroke={RUN} strokeWidth="2.5" />
            )}
          </g>
        );
      })}

      {/* modul kontrol kanan */}
      <rect x="1180" y="262" width="45" height="53" fill={lamp} stroke={INK} strokeWidth="3" />
      <text x="1202" y="334" fontSize="11" textAnchor="middle" fill={INK}>RUN</text>
      {/* engsel */}
      <g fill="#FFFFFF" stroke={INK}>
        <rect x="838" y="248" width="4" height="22" />
        <rect x="838" y="388" width="4" height="22" />
        <rect x="1265" y="248" width="4" height="22" />
        <rect x="1265" y="388" width="4" height="22" />
      </g>
    </g>
  );
}

/* ───────────── Diagram utama ───────────── */

const LEGEND_FLOW = [
  ["Uap / exhaust", STEAM],
  ["Air proses & pendingin", WATER],
  ["Udara tekan", AIR],
  ["Buang (kondensat)", DRAIN_A],
  ["Buang (DRAIN)", DRAIN_B],
];

export function AtvDiagram({
  mode,            // "live" | "learn"
  step,            // label timeline aktif (STEPS) atau null
  valves,          // data.valves
  doors,           // { front, rear } = "open" | "closed"
  noData,
  running,         // RUN_LAMP
  values,          // { p1, p2, tm, tl, level, conductivity }
  sterSet,         // °C, untuk skala warna
  controls,        // { setMode, autoplay, setAutoplay, prev, next }
}) {
  const [selected, setSelected] = useState(null);
  const [paused, setPaused] = useState(false);

  const sim = mode === "learn";
  const hideNums = sim || noData;

  const st = resolveStates({ mode, valves, step, noData });
  const pump = resolvePump({ mode, valves, step, noData });
  const chamber = resolveChamber({ mode, step, noData });
  const heat = resolveHeat({ mode, step, tl: values?.tl, tm: values?.tm, sterSet });

  const on = (id) => st[id]?.s === "open" || st[id]?.s === "auto";
  const isAuto = (id) => st[id]?.s === "auto";

  const steamAny = on("steam1") || on("steam2");
  const coolAny = on("cool1") || on("cool2");
  const pumpOn = pump === true;
  const draining = on("drain");
  const loopColor = mixHex(WATER, STEAM, heat);

  /* ── susun aliran ── */
  const flows = [];
  const add = (k, pts, color, o = {}) => flows.push({ k, d: rp(pts, o.r ?? 18), color, auto: !!o.auto, dots: !!o.dots });

  if (on("steam1")) add("s1", [[182, 118], [548, 118], [548, 190]], STEAM, { auto: isAuto("steam1") });
  if (on("steam2")) add("s2", [[182, 190], [548, 190]], STEAM, { auto: isAuto("steam2") });
  if (steamAny) {
    const a = (!on("steam1") || isAuto("steam1")) && (!on("steam2") || isAuto("steam2"));
    add("st-mid", [[548, 190], [548, 265]], STEAM, { auto: a });
    add("st-low", [[548, 265], [548, 297], [610, 297]], STEAM, { auto: a });
  }
  if (on("waterDrain")) {
    const pts = steamAny
      ? [[548, 265], [182, 265]]
      : [[610, 297], [548, 297], [548, 265], [182, 265]];
    add("wd", pts, DRAIN_A, { auto: isAuto("waterDrain") });
  }
  if (on("cool1")) add("c1", [[182, 388], [548, 388]], WATER, { auto: isAuto("cool1") });
  if (on("cool2")) add("c2", [[182, 466], [548, 466]], WATER, { auto: isAuto("cool2") });
  if (coolAny) {
    const a = (!on("cool1") || isAuto("cool1")) && (!on("cool2") || isAuto("cool2"));
    add("ct-top", [[548, 388], [548, 352], [610, 352]], WATER, { auto: a });
    if (on("cool2")) add("ct-mid", [[548, 466], [548, 388]], WATER, { auto: isAuto("cool2") && !on("cool1") });
  }
  if (on("utilOut") && !coolAny) {
    add("uo", [[610, 352], [548, 352], [548, 545], [262, 545], [262, 620]], DRAIN_B, { auto: isAuto("utilOut") });
    if (!draining) add("uo-l", [[262, 620], [105, 620]], DRAIN_B, { auto: isAuto("utilOut") });
  }
  if (pumpOn) {
    add("l3", [[899, 555], [1005, 555]], loopColor);
    if (!draining) add("l4", [[1005, 555], [1005, 436]], loopColor);
    add("l1", [[1005, 222], [1005, 165], [718, 165], [718, 297], [665, 297]], loopColor, { r: 20 });
    add("core", [[632, 296], [632, 354]], loopColor);
    add("l2", [[665, 352], [718, 352], [718, 515], [770, 515]], loopColor, { r: 20 });
  }
  if (on("softWater")) {
    const up = pumpOn && !draining ? 555 : 436;
    add("sw", [[1360, 620], [1005, 620], [1005, up]], WATER, { r: 16 });
  }
  if (draining) add("dr", [[1005, 436], [1005, 620], [105, 620]], DRAIN_B, { r: 16 });
  if (on("air")) add("air", [[1360, 165], [1145, 165], [1145, 222]], AIR, { auto: isAuto("air"), dots: true });
  if (on("exhaust")) add("ex", [[1145, 435], [1145, 518], [1360, 518]], STEAM, { auto: isAuto("exhaust"), dots: true });

  const pheMode = steamAny ? "steam" : coolAny ? "cool" : null;
  const flowing = pumpOn && (chamber === "full" || chamber === "filling");

  /* ── inspektur ── */
  const info = selected ? COMPONENT_INFO[selected] : null;
  const selState = selected && st[selected] ? st[selected] : null;
  let stateLine = null;
  if (selected === "pump") {
    stateLine = pump === null ? "Status tidak diketahui" : pump ? "Menyala" : "Mati";
    stateLine += pump === null ? "" : sim ? " (simulasi)" : " — dibaca langsung dari PLC";
  } else if (selState) {
    const label = { open: "OPEN", closed: "CLOSED", auto: "AUTO (buka-tutup otomatis)", unknown: "Tidak diketahui" }[selState.s];
    const srcTxt = { live: " — dibaca langsung dari PLC", est: " — estimasi dari logika PLC (belum ada tag)", sim: " (simulasi)", none: "" }[selState.src];
    stateLine = `${label}${srcTxt}`;
  }

  const hotLabels = Object.fromEntries(Object.keys(HOT).map((k) => [k, COMPONENT_INFO[k]?.name ?? k]));
  const selBox = selected ? HOT[selected] : null;
  const tmShow = hideNums ? "--" : fmt1(values?.tm);
  const tlShow = hideNums ? "--" : fmt1(values?.tl);

  return (
    <div className={`atv-root${paused ? " atv-paused" : ""}`}>
      <style>{CSS}</style>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
        <div role="group" aria-label="Mode tampilan" className="inline-flex rounded-[3px] border border-[#B8C0BE] overflow-hidden text-[12px] font-semibold">
          {[["live", "LIVE"], ["learn", "PELAJARI"]].map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => controls.setMode(m)}
              className={`px-3 py-1 transition-colors ${mode === m ? "bg-[#1E2A2E] text-white" : "bg-white text-[#5C6B6A] hover:bg-[#EEF1F0]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {sim && (
          <div className="inline-flex items-center gap-1.5 text-[12px]">
            <button type="button" onClick={controls.prev} className="px-2 py-1 rounded-[3px] border border-[#B8C0BE] bg-white text-[#5C6B6A] hover:bg-[#EEF1F0]" aria-label="Fase sebelumnya">‹</button>
            <button type="button" onClick={controls.next} className="px-2 py-1 rounded-[3px] border border-[#B8C0BE] bg-white text-[#5C6B6A] hover:bg-[#EEF1F0]" aria-label="Fase berikutnya">›</button>
            <button
              type="button"
              aria-pressed={controls.autoplay}
              onClick={() => controls.setAutoplay(!controls.autoplay)}
              className={`px-2.5 py-1 rounded-[3px] border font-semibold ${controls.autoplay ? "bg-[#1C6E74] border-[#1C6E74] text-white" : "border-[#B8C0BE] bg-white text-[#5C6B6A] hover:bg-[#EEF1F0]"}`}
            >
              {controls.autoplay ? "■ Hentikan siklus" : "▶ Putar siklus"}
            </button>
          </div>
        )}

        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="ml-auto px-2.5 py-1 rounded-[3px] border border-[#B8C0BE] bg-white text-[12px] text-[#5C6B6A] hover:bg-[#EEF1F0]"
        >
          {paused ? "▶ Lanjutkan animasi" : "❚❚ Jeda animasi"}
        </button>
      </div>

      {sim && (
        <div role="status" className="mb-2 bg-white border-l-[3px] border-[#1C6E74] px-3 py-1.5 text-[12px] text-[#1E2A2E]">
          <span className="font-semibold">Mode PELAJARI: simulasi per fase.</span>{" "}
          Ini bukan kondisi mesin saat ini, dan angka sensor disembunyikan. Klik kotak fase di timeline untuk berpindah.
        </div>
      )}

      {/* ── SVG ── */}
      <div className="overflow-x-auto">
        <svg
          viewBox="0 75 1560 610"
          className="w-full h-auto min-w-[780px]"
          role="img"
          aria-label="Diagram perpipaan dan aliran mesin sterilizer ATV"
          style={SANS}
        >
          <BasePipes />
          <FlowLayer flows={flows} />

          {/* sensor conductivity (lingkaran pink di jalur buang) */}
          <circle cx="262" cy="578" r="14" fill="#C985C4" stroke={INK} strokeWidth="1.5" />
          <line x1="632" y1="500" x2="632" y2="505" stroke={IDLE} />

          <Phe mode={pheMode} />
          <Chamber
            chamber={chamber}
            heat={heat}
            flowing={flowing}
            doors={doors}
            sim={sim}
            noData={noData}
            running={running}
            lampOn={sim ? !!step && step !== "PREPARE" && step !== "END" : !!running}
          />
          <Pump on={pump} />

          {Object.keys(VALVE_POS).map((id) => (
            <ValveGlyph key={id} id={id} st={st[id]} />
          ))}
          <ManualBallValve />

          {ARROWS.map((a) => (
            <ArrowTag key={a.label} a={a} active={on(a.el) || (a.el2 ? on(a.el2) : false)} />
          ))}

          {/* instrumen */}
          <Plate x={1024} y={166} label="TH" value={hideNums ? "--" : fmt1(values?.th)} unit="°C" />
          <path d="M1269 271 H1300 M1269 326 H1300" stroke={IDLE} strokeWidth="1.5" fill="none" />
          <Plate x={1300} y={250} label="P1" value={hideNums ? "--" : fmt0(values?.p1)} unit="kPa" />
          <Plate x={1300} y={305} label="P2" value={hideNums ? "--" : fmt0(values?.p2)} unit="kPa" />
          <Plate x={735} y={316} w={100} label="TM" value={tmShow} unit="°C" />
          <Plate x={1024} y={468} label="TL" value={tlShow} unit="°C" />
          <Plate x={860} y={447} w={100} label="Level" value={hideNums ? "--" : fmt0(values?.level)} note="nilai PLC" />
          <Plate x={579} y={458} label="CONDUCTIVITY" value={hideNums ? "--" : fmt0(values?.conductivity)} note="raw PLC" />
          <text x="632" y="523" fontSize="11" fill={MUTED} textAnchor="middle">μS/cm (belum dikalibrasi)</text>

          {/* sorotan komponen terpilih */}
          {selBox && (
            <rect
              x={selBox.x - 3} y={selBox.y - 3} width={selBox.w + 6} height={selBox.h + 6}
              rx="5" fill="none" stroke={WATER} strokeWidth="2" strokeDasharray="6 4"
            />
          )}

          {/* area klik */}
          {Object.entries(HOT).map(([id, b]) => (
            <rect
              key={id}
              className="atv-hot"
              x={b.x} y={b.y} width={b.w} height={b.h} rx="4"
              role="button"
              tabIndex={0}
              aria-label={`Lihat penjelasan ${hotLabels[id]}`}
              onClick={() => setSelected(selected === id ? null : id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(selected === id ? null : id);
                }
              }}
            >
              <title>{hotLabels[id]}</title>
            </rect>
          ))}
        </svg>
      </div>

      {/* ── Legenda ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1 text-[11px] text-[#5C6B6A]">
        {LEGEND_FLOW.map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-[3px]" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-t-full bg-[#1C6E74]" /> OPEN
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-t-full bg-[#1C6E74] opacity-50" /> AUTO (berkedip)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-t-full bg-[#C8CECC] border border-[#8A9492]" /> CLOSED
        </span>
        <span>≈ = estimasi dari logika PLC (belum ada tag)</span>
      </div>

      {/* ── Inspektur ── */}
      <div className="mt-2 border border-[#D8DEDC] rounded-[3px] bg-[#EEF1F0] px-3 py-2 text-[12px] leading-snug min-h-[64px]">
        {info ? (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold text-[#1E2A2E]">{info.name}</span>
              {info.tag && <span className="text-[11px] text-[#5C6B6A]" style={MONO}>tag {info.tag}{info.addr ? ` · ${info.addr}` : ""}</span>}
              {stateLine && <span className="text-[11px] font-semibold text-[#1C6E74]">{stateLine}</span>}
            </div>
            <p className="mt-1 text-[#1E2A2E]">{info.role}</p>
            <p className="mt-0.5 text-[#5C6B6A]">{info.logic}</p>
          </div>
        ) : (
          <p className="text-[#5C6B6A]">
            Klik katup, pompa, PHE, chamber, atau kotak sensor pada diagram untuk melihat fungsi dan statusnya.
          </p>
        )}
      </div>
    </div>
  );
}

/* ───────────── Panel penjelasan fase ───────────── */

const VALVE_NAMES = {
  steam1: "STEAM 1", steam2: "STEAM 2", waterDrain: "WATER DRAIN",
  cool1: "COOLING WATER 1", cool2: "COOLING WATER 2", utilOut: "Buang PHE",
  drain: "DRAIN", air: "COMPRESSED AIR", exhaust: "EXHAUST", softWater: "SOFT WATER",
};

export function PhaseGuide({ mode, step, valves, noData, setpoints, limits }) {
  const sim = mode === "learn";
  const prof = step ? PROFILES[step] : null;

  if (!prof) {
    return (
      <section className="bg-white border border-[#D8DEDC] rounded-[4px] p-3 text-[12px] text-[#5C6B6A]">
        {noData && !sim
          ? "Tidak ada data PLC, jadi fase tidak diketahui. Pilih mode PELAJARI untuk melihat penjelasan tiap fase."
          : "Fase belum dikenali. Klik salah satu kotak fase di timeline untuk melihat penjelasannya."}
      </section>
    );
  }

  const st = resolveStates({ mode, valves, step, noData });
  const pump = resolvePump({ mode, valves, step, noData });
  const active = Object.keys(VALVE_NAMES).filter((id) => st[id]?.s === "open" || st[id]?.s === "auto");
  const closed = Object.keys(VALVE_NAMES).filter((id) => st[id]?.s === "closed");
  const n = STEPS.indexOf(step) + 1;
  const ctx = { sp: setpoints ?? {}, limits: limits ?? {} };

  const chip = (id) => {
    const s = st[id];
    const tone = { steam1: STEAM, steam2: STEAM, exhaust: STEAM, air: AIR, waterDrain: DRAIN_A, drain: DRAIN_B, utilOut: DRAIN_B }[id] ?? WATER;
    return (
      <li key={id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] border border-[#D8DEDC] bg-[#EEF1F0] text-[11px]">
        <span className="w-2 h-2 rounded-full" style={{ background: tone, opacity: s.s === "auto" ? 0.55 : 1 }} />
        {VALVE_NAMES[id]}
        <span className="text-[#5C6B6A]">
          {s.src === "est" ? "≈ " : ""}
          {s.s === "auto" ? "AUTO" : "OPEN"}
        </span>
      </li>
    );
  };

  return (
    <section aria-label="Penjelasan fase" className="bg-white border border-[#D8DEDC] rounded-[4px] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 mb-2 border-b border-[#D8DEDC]">
        <h2 className="text-[14px] font-semibold text-[#1E2A2E]">{prof.title}</h2>
        <span className="text-[11px] text-[#5C6B6A]">
          Fase {n} dari {STEPS.length} · {sim ? "simulasi" : "mengikuti mesin"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#5C6B6A] mb-1.5">Yang sedang terjadi</h3>
          <ol className="list-decimal pl-4 space-y-1.5 text-[12px] leading-snug text-[#1E2A2E]">
            {prof.happens.map((t) => <li key={t}>{t}</li>)}
          </ol>
        </div>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#5C6B6A] mb-1.5">Aktuator saat ini</h3>
          <ul className="flex flex-wrap gap-1.5 mb-2">
            {pump !== null && (
              <li className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] border border-[#D8DEDC] bg-[#EEF1F0] text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ background: pump ? RUN : STOP }} />
                Pompa <span className="text-[#5C6B6A]">{pump ? "ON" : "OFF"}</span>
              </li>
            )}
            {active.map(chip)}
          </ul>
          {active.length === 0 && pump !== true && (
            <p className="text-[11px] text-[#5C6B6A] mb-2">Tidak ada katup yang terbuka.</p>
          )}
          {closed.length > 0 && (
            <p className="text-[11px] text-[#5C6B6A] leading-snug">
              Tertutup: {closed.map((id) => VALVE_NAMES[id]).join(", ")}.
            </p>
          )}
          {sim && (
            <p className="text-[11px] text-[#5C6B6A] leading-snug mt-2">
              Status “AUTO” berarti PLC membuka-menutup katup itu sendiri sesuai sensor selama fase ini.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#5C6B6A] mb-1.5">Pindah fase kapan?</h3>
          <p className="text-[12px] leading-snug text-[#1E2A2E] border-l-[3px] border-[#4F7A52] pl-2">
            {prof.exit(ctx)}
          </p>
          <p className="text-[11px] leading-snug text-[#5C6B6A] mt-2">
            <span className="font-semibold text-[#B9762F]">Perhatikan:</span> {prof.watch}
          </p>
          <p className="text-[10px] leading-snug text-[#5C6B6A] mt-2">
            Sumber: logika ladder PLC (export_atv.awl). Nilai setpoint diambil dari PLC bila terbaca.
          </p>
        </div>
      </div>
    </section>
  );
}