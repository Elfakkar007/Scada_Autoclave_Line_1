/**
 * src/lib/atvProcess.js — Pengetahuan proses mesin ATV (data murni, tanpa React).
 *
 * Sumber: export_atv.awl (SBR0..SBR6, SBR9) + plc.js (TAG_MAP, PHASE_MAP).
 * Dipakai oleh src/components/AtvDiagram.js untuk:
 *   1. menentukan status tiap valve (LIVE dari tag, atau ESTIMASI dari logika ladder)
 *   2. mode PELAJARI (simulasi per fase) + teks edukasi
 *
 * ── PEMETAAN TAG → ALAMAT PLC → ELEMEN DIAGRAM ─────────────────────
 *  Terkonfirmasi dari ekspor KEPServerEX (SiemensS7-200.csv) + ladder:
 *    STEAM_1 Q0.6 · STEAM_2 Q0.7 · STEAM_EXHS Q1.5 (vent chamber)
 *    COOLING_1 Q1.1 · COOLING_2 Q1.7 · WTR_FILL Q2.0 (SOFT WATER)
 *    WTR_PUMP Q3.0 (kontaktor pompa: hanya HEATING, STERIL, COOLING)
 *    AIR_CMBR Q1.3 (udara tekan)
 *  Dua drain PHE (tag baru DRAIN_STEAM / DRAIN_COOL):
 *    DRAIN_COOL  Q1.2 → WATER DRAIN kiri atas  : air pendingin keluar PHE → cooling tower,
 *                       nyala selama COOLING. (Q1.2 dipilih dari grup Q1.2/Q2.6/Q2.7/Q3.6/Q3.7
 *                       yang berlogika identik; dicocokkan dengan perilaku SCADA lama.)
 *    DRAIN_STEAM Q1.0 → DRAIN kiri bawah (UOV) : kondensat uap keluar PHE → boiler,
 *                       nyala FILLING, HEATING, STERIL. (di mode manual ikut STEAM 1/2)
 *  Q2.1 (nyala idle/FILLING/awal HEATING/30 dtk awal COOLING) tidak cocok dengan valve
 *  mana pun di SCADA lama, jadi TIDAK digambar.
 *  WTR_DRAIN Q1.4: menurut ladder nyala selama DRAIN_TIME di awal fase DRAIN. Operator
 *  mengonfirmasi fase DRAIN hanya membuka EXHAUST dan air proses tidak dibuang
 *  (soft water diisi sekali). Fungsi fisik Q1.4 belum jelas → hanya status valve
 *  (tanpa animasi air keluar chamber).
 *  CATATAN: SCADA lama menukar label COOLING 1 dan 2 (konfirmasi operator).
 *  Pemetaan di file ini (COOLING_1 = Q1.1, COOLING_2 = Q1.7) yang benar.
 */

/* ───────────── Fase ───────────── */

// 7 kotak timeline. Urutan sesuai ladder: ... COOLING → DRAIN → END
export const STEPS = ["PREPARE", "FILLING", "HEATING", "STERIL.", "COOLING", "DRAIN", "END"];

// data.phase.code (plc.js) → kotak timeline
// null = tidak ada kotak yang di-highlight (seperti SCADA lama saat mesin benar-benar idle)
export const PHASE_CODE_TO_STEP = {
  // VW98=0: pintu belum tertutup / seal belum aktif → tidak highlight apapun
  // (operator belum siap; START diblokir; sesuai perilaku SCADA lama)
  idle_door_open: null,
  // VW98=1: pintu tertutup & terseal → siap mulai → highlight PREPARE
  idle_ready: "PREPARE",
  filling: "FILLING",
  heating: "HEATING",
  steril: "STERIL.",
  cooling: "COOLING",
  drain: "DRAIN",
  finished: "END",
};

// Warna tiap kotak fase di timeline (HEATING kuning, STERIL merah, COOLING biru)
export const STEP_COLOR = {
  PREPARE: "#8A9492",
  FILLING: "#1C6E74",
  HEATING: "#E0A526",
  "STERIL.": "#C0392B",
  COOLING: "#2F7FBF",
  DRAIN: "#9C6B98",
  END: "#4F7A52",
};

/* ───────────── Warna medium (selaras design system + kode warna PDF) ───────────── */

export const MEDIUM = {
  steam: "#FF6A00",  // uap & exhaust (oranye neon menyala terang)
  water: "#0090FF",  // air proses / pendingin / soft water (biru elektrik menyala)
  air: "#00D0F5",    // udara tekan (cyan neon menyala)
  drainA: "#00C853", // WATER DRAIN (air pendingin keluar PHE - hijau neon menyala)
  drainB: "#D500F9", // DRAIN (kondensat uap keluar PHE / jalur buang bawah - magenta elektrik menyala)
};

/* ───────────── Sumber status valve ───────────── */

// Elemen diagram → key di data.valves (plc.js). Semua valve kini punya tag live.
// Bila suatu tag belum ada di KEPServerEX, statusnya "unknown" (abu-abu putus-putus).
export const LIVE_TAG = {
  steam1: "steam1",
  steam2: "steam2",
  waterDrain: "drainCool",   // Q1.2 — drain sisi air pendingin (kiri atas)
  utilOut: "drainSteam",     // Q1.0 — drain sisi uap / kondensat (kiri bawah)
  drain: "wtrDrain",         // Q1.4
  cool1: "cooling1",
  cool2: "cooling2",
  exhaust: "steamExhs",
  softWater: "wtrFill",
  air: "airCmbr",
};

export const VALVE_IDS = [
  "steam1", "steam2", "waterDrain", "cool1", "cool2",
  "utilOut", "drain", "air", "exhaust", "softWater",
];

/* ───────────── Profil per fase (sumber: ladder) ─────────────
 * valves: 1 = buka, 0 = tutup, "auto" = dibuka/ditutup otomatis oleh PLC di fase itu
 * chamber: empty | filling | full | draining
 * heat: 0..1 perkiraan "panas" air proses (untuk warna) saat tidak ada data suhu
 */

const num = (v, d = 1) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v).toFixed(d);
const withVal = (name, v, unit, d = 1) => {
  const n = num(v, d);
  return n === null ? name : `${name} (${n} ${unit})`;
};

export const PROFILES = {
  PREPARE: {
    title: "PREPARE — siap menunggu START",
    valves: {},
    pump: false,
    chamber: "full",
    heat: 0,
    happens: [
      "Mesin diam. Semua katup uap, pendingin, dan soft water tertutup. Air proses di chamber tidak dibuang di akhir siklus, jadi chamber tetap berisi.",
      "Status berubah dari “pintu belum tertutup” menjadi “Siap” hanya bila pintu depan & belakang tertutup dan seal pintu aktif.",
      "Pada kondisi normal semua katup tertutup. Hanya bila P1 masih ≥ ALRM_PRES, EXHAUST membuka otomatis untuk melepas sisa tekanan.",
    ],
    exit: () => "Tombol START ditekan saat kedua pintu tertutup dan seal pintu aktif → masuk FILLING.",
    watch: "START ditolak dan alarm menyala bila salah satu pintu belum tertutup atau seal belum aktif.",
  },

  FILLING: {
    title: "FILLING — pengisian / melengkapi air proses",
    valves: { softWater: 1, exhaust: 1 },
    pump: false,
    chamber: "filling",
    heat: 0,
    happens: [
      "SOFT WATER membuka. Air lunak masuk dari sambungan bawah sampai level penuh. Karena air proses tidak dibuang di akhir siklus, pada siklus berikutnya fase ini hanya melengkapi level.",
      "EXHAUST terbuka supaya udara di dalam chamber terdorong keluar saat permukaan air naik.",
      "Pompa sirkulasi belum menyala; pompa baru start di fase HEATING.",
      "RUN lamp menyala sejak fase ini.",
    ],
    exit: () => "Sensor level penuh aktif → SOFT WATER dan EXHAUST menutup → masuk HEATING.",
    watch: "Jika level tidak pernah penuh, fase ini tidak akan selesai (cek suplai soft water).",
  },

  HEATING: {
    title: "HEATING — pemanasan lewat PHE",
    valves: { steam1: "auto", steam2: "auto", utilOut: 1, air: "auto", exhaust: "auto" },
    pump: true,
    chamber: "full",
    heat: 0.55,
    happens: [
      "Pompa menyala (start bertahap sekitar 8 detik, lalu berjalan penuh) dan menyirkulasikan air proses: air diisap dari dasar chamber, dipompa ke PHE, lalu kembali ke chamber dari atas. Gelombang oranye menunjukkan air proses yang sedang dipanaskan.",
      "Uap masuk ke sisi utilitas PHE dan memanaskan air proses tanpa bercampur. STEAM 2 terbuka selama TH < CTRL_TEMP; STEAM 1 membantu saat TH < CTRL_TEMP − 1 °C dan baru menutup setelah TH ≥ CTRL_TEMP.",
      "DRAIN sisi uap PHE (kiri bawah) terbuka selama pemanasan supaya kondensat uap kembali ke boiler.",
      "Mulai sekitar 80 °C, PLC menjaga tekanan chamber mengikuti tekanan target (overpressure): COMPRESSED AIR menambah bila kurang, EXHAUST melepas bila berlebih. Tujuannya agar kemasan lunak tidak menggembung.",
    ],
    exit: ({ sp }) =>
      `Semua kanal suhu proses ≥ ${withVal("STER_SET", sp.sterSet, "°C")} bertahan 5 detik → masuk STERIL.`,
    watch: "Buzzer setelah 5 menit pemanasan adalah pemberitahuan rutin, bukan alarm.",
  },

  "STERIL.": {
    title: "STERIL. — menahan suhu sterilisasi",
    valves: {},
    pump: true,
    chamber: "full",
    heat: 1,
    happens: [
      "Suhu proses ditahan di sekitar STER_SET selama waktu sterilisasi.",
      "Pompa tetap menyala: air proses diisap dari dasar chamber, dipompa ke PHE, lalu kembali ke chamber dari atas, sehingga suhu merata di seluruh chamber. Gelombang oranye menunjukkan air panas yang bersirkulasi.",
      "Simulasi ini hanya menggambarkan sirkulasi. Di mesin nyata PLC masih membuka-menutup STEAM 2 sesaat untuk menjaga suhu, serta COMPRESSED AIR / EXHAUST untuk menjaga tekanan. Itu terlihat di mode LIVE.",
      "PLC menghitung waktu sterilisasi per detik.",
    ],
    exit: ({ sp }) =>
      `Waktu sterilisasi mencapai ${withVal("STER_SET_TIME", sp.sterSetTime, "menit", 0)} → masuk COOLING.`,
    watch: "Alarm bila salah satu sensor < STER_SET atau > OVER_TEMP selama fase ini.",
  },

  COOLING: {
    title: "COOLING — pendinginan",
    valves: { cool2: 1, cool1: "auto", waterDrain: 1, air: "auto", exhaust: "auto" },
    pump: true,
    chamber: "full",
    heat: 0.5,
    happens: [
      "Katup uap tertutup. Selama 30 detik pertama air pendingin belum dibuka (jeda awal).",
      "COOLING WATER 2 membuka setelah 30 detik. COOLING WATER 1 membuka saat suhu acuan turun ≤ COOL1_TEMP.",
      "Air proses tetap disirkulasikan melewati PHE yang kini dialiri air pendingin, sehingga suhunya turun.",
      "WATER DRAIN (kiri atas) terbuka selama COOLING: air pendingin yang sudah menyerap panas keluar dari PHE dan kembali ke cooling tower.",
      "Tekanan chamber tetap dijaga (udara tekan / exhaust) supaya kemasan tidak menggembung saat suhu turun.",
    ],
    exit: ({ sp }) =>
      `Suhu acuan turun ≤ batas akhir pendinginan ${withVal("COOL2_TEMP", sp.cool2Temp, "°C")} → masuk DRAIN.`,
    watch: "Buzzer setelah 5 menit pendinginan juga pemberitahuan rutin.",
  },

  DRAIN: {
    title: "DRAIN — pelepasan tekanan",
    valves: { exhaust: 1 },
    pump: false,
    chamber: "full",
    heat: 0.15,
    happens: [
      "Pompa sirkulasi sudah mati. EXHAUST membuka untuk melepas tekanan chamber sampai mencapai batas aman.",
      "Air proses TIDAK dibuang: soft water hanya diisi sekali dan tidak berkurang di akhir siklus. Fase ini hanya menurunkan tekanan.",
    ],
    exit: ({ limits }) =>
      `Tekanan chamber ≤ ${withVal("SAFETY_PRESS", limits.safetyPress, "kPa", 0)} (dan waktu drain di PLC habis) → masuk END.`,
    watch: "Interlock PLC: pintu hanya boleh dibuka bila tekanan ≤ SAFETY_PRESS.",
  },

  END: {
    title: "END — siklus selesai",
    valves: { exhaust: 1 },
    pump: false,
    chamber: "full",
    heat: 0,
    happens: [
      "Siklus selesai: RUN lamp mati dan buzzer menyala sebagai tanda batch selesai.",
      "EXHAUST terbuka untuk menuntaskan pelepasan tekanan.",
      "Status END bertahan sampai tombol STOP / release ditekan. Tidak otomatis kembali ke PREPARE.",
    ],
    exit: () => "Tombol STOP / release ditekan → kembali ke PREPARE.",
    watch: "Ambil produk hanya setelah tekanan aman dan pintu dibuka lewat interlock.",
  },
};

/* ───────────── Resolver status ───────────── */

const UNKNOWN = { s: "unknown", src: "none" };
const norm = (v) => (v === "auto" ? "auto" : v ? "open" : "closed");

/**
 * Status tiap elemen valve.
 * return { [id]: { s: 'open'|'closed'|'auto'|'unknown', src: 'live'|'est'|'sim'|'none' } }
 *  - mode "learn"  : semua dari profil fase (src sim)
 *  - mode "live"   : semua valve dibaca dari tag PLC (src live); tag yang belum ada → unknown
 */
export function resolveStates({ mode, valves, step, noData }) {
  const prof = step ? PROFILES[step] : null;
  const out = {};

  if (mode === "learn") {
    for (const id of VALVE_IDS) {
      out[id] = prof ? { s: norm(prof.valves[id] ?? 0), src: "sim" } : UNKNOWN;
    }
    return out;
  }

  if (noData) {
    for (const id of VALVE_IDS) out[id] = UNKNOWN;
    return out;
  }

  for (const id of VALVE_IDS) {
    const tag = LIVE_TAG[id];
    if (tag) {
      const raw = valves?.[tag];
      out[id] = raw === null || raw === undefined ? UNKNOWN : { s: raw ? "open" : "closed", src: "live" };
    } else {
      // cadangan bila ada elemen tanpa tag: estimasi dari fase aktif
      out[id] = prof ? { s: norm(prof.valves[id] ?? 0), src: "est" } : UNKNOWN;
    }
  }
  return out;
}

export function resolvePump({ mode, valves, step, noData }) {
  if (mode === "learn") return step ? !!PROFILES[step].pump : null;
  if (noData) return null;
  const v = valves?.wtrPump;
  return v === null || v === undefined ? null : !!v;
}

export function resolveChamber({ mode, step, noData }) {
  if (mode !== "learn" && noData) return "unknown";
  return step ? PROFILES[step].chamber : "unknown";
}

// 0 (dingin / teal) .. 1 (panas / amber)
export function resolveHeat({ mode, step, tl, tm, sterSet }) {
  if (mode !== "learn") {
    const t = Number.isFinite(Number(tl)) && tl !== null ? Number(tl)
      : Number.isFinite(Number(tm)) && tm !== null ? Number(tm) : null;
    if (t !== null) {
      const top = Number.isFinite(Number(sterSet)) && sterSet ? Number(sterSet) : 121;
      return Math.max(0, Math.min(1, (t - 30) / (top - 30)));
    }
  }
  return step ? PROFILES[step].heat : 0;
}

export function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const m = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

/* ───────────── Info komponen (panel inspektur) ───────────── */

export const COMPONENT_INFO = {
  steam1: {
    code: "SV1",
    name: "STEAM 1 (SV1)", tag: "STEAM_1", addr: "Q0.6",
    role: "Jalur uap pertama ke sisi utilitas PHE (katup SV1).",
    logic: "Fase HEATING: membuka saat TH < CTRL_TEMP − 1 °C dan tertahan terbuka sampai TH ≥ CTRL_TEMP (on-off dengan histeresis). Tertutup di fase lain.",
  },
  steam2: {
    code: "SV2",
    name: "STEAM 2 (SV2)", tag: "STEAM_2", addr: "Q0.7",
    role: "Jalur uap kedua (katup SV2), juga pengatur suhu saat sterilisasi.",
    logic: "HEATING: terbuka selama TH < CTRL_TEMP. STERIL.: satu-satunya jalur uap, membuka saat TH < STER_SET + TEMP_SPACE.",
  },
  waterDrain: {
    code: "WDV",
    name: "WATER DRAIN (WDV)", tag: "DRAIN_COOL", addr: "Q1.2",
    role: "Drain sisi air pendingin PHE: air pendingin yang sudah menyerap panas keluar dari PHE dan kembali ke cooling tower.",
    logic: "Terbuka selama fase COOLING; tertutup di fase lain. Di mode manual ikut terbuka bersama COOLING 1/2.",
  },
  cool1: {
    code: "CWV1",
    name: "COOLING WATER 1 (CWV1)", tag: "COOLING_1", addr: "Q1.1",
    role: "Air pendingin ke sisi utilitas PHE (katup CWV1).",
    logic: "Fase COOLING: membuka selama suhu acuan ≤ COOL1_TEMP.",
  },
  cool2: {
    code: "CWV2",
    name: "COOLING WATER 2 (CWV2)", tag: "COOLING_2", addr: "Q1.7",
    role: "Air pendingin jalur kedua ke PHE (katup CWV2).",
    logic: "Fase COOLING: membuka 30 detik setelah COOLING mulai dan bertahan sampai pendinginan selesai.",
  },
  utilOut: {
    code: "UOV",
    name: "DRAIN sisi uap PHE (UOV)", tag: "DRAIN_STEAM", addr: "Q1.0",
    role: "Drain sisi uap PHE: kondensat uap keluar dari PHE dan kembali ke boiler, melewati sensor conductivity.",
    logic: "Mode PELAJARI: terbuka selama HEATING. Mode LIVE: status dibaca dari PLC, dan ladder membuka Q1.0 sejak FILLING hingga STERIL., tertutup saat COOLING dan sesudahnya. Di mode manual ikut terbuka bila STEAM 1/2 terbuka.",
  },
  drain: {
    code: "DPWV",
    name: "DRAIN bawah (DPWV)", tag: "WTR_DRAIN", addr: "Q1.4",
    role: "Output Q1.4 ke jalur DRAIN bawah. Fungsi fisiknya belum terkonfirmasi.",
    logic: "Menurut ladder, Q1.4 menyala selama waktu drain di awal fase DRAIN. Menurut operator, fase DRAIN hanya membuka EXHAUST dan air proses tidak dibuang.",
  },
  air: {
    code: "AIR_CMBR",
    name: "COMPRESSED AIR (AIR_CMBR)", tag: "AIR_CMBR", addr: "Q1.3",
    role: "Katup injeksi udara tekan ke chamber (AIR_CMBR / Q1.3).",
    logic: "Dibaca live dari PLC. Menambah tekanan chamber saat P1 di bawah target (mulai ≥ 80 °C di HEATING, STERIL., dan COOLING).",
  },
  exhaust: {
    code: "SDFC",
    name: "EXHAUST (SDFC)", tag: "STEAM_EXHS", addr: "Q1.5",
    role: "Melepas udara dan tekanan dari chamber (vent / SDFC).",
    logic: "Terbuka saat FILLING (mengusir udara), saat tekanan melewati target (HEATING/STERIL./COOLING), selama fase DRAIN untuk melepas tekanan, dan selama END.",
  },
  softWater: {
    code: "PWCV",
    name: "SOFT WATER (PWCV)", tag: "WTR_FILL", addr: "Q2.0",
    role: "Katup isi air ke chamber (PWCV).",
    logic: "Terbuka di FILLING sampai sensor level penuh (WATR_INDICATOR) aktif. Ada ball valve manual di jalur yang sama yang tidak dipantau PLC.",
  },
  pump: {
    code: "WTR_PUMP",
    name: "Pompa sirkulasi (WTR_PUMP)", tag: "WTR_PUMP", addr: "Q3.0",
    role: "Menyirkulasikan air proses: dasar chamber → pompa → PHE → kembali ke chamber dari atas.",
    logic: "Menyala hanya di HEATING, STERIL., dan COOLING, dengan start bertahap sekitar 8 detik. Mati di FILLING dan DRAIN. Air diisap dari dasar chamber dan ditekan ke PHE.",
  },
  phe: {
    name: "PHE (plate heat exchanger)", tag: null, addr: null,
    role: "Memindahkan panas antara sisi utilitas (uap / air pendingin) dan air proses tanpa kontak langsung.",
    logic: "Saat HEATING dan STERIL. inti PHE memerah (sisi utilitas panas). Saat COOLING inti membiru karena dialiri air pendingin.",
  },
  chamber: {
    name: "CHAMBER ATV", tag: null, addr: null,
    role: "Ruang sterilisasi produk dengan pintu depan dan belakang.",
    logic: "Terisi di FILLING, penuh dan bertekanan selama HEATING–COOLING. Air proses tidak dibuang di akhir siklus; fase DRAIN hanya melepas tekanan. Tampilan dalam chamber hanyalah ilustrasi.",
  },
  th: { name: "TH — suhu kendali uap", tag: "TH", addr: "VW100", role: "Suhu yang dipakai PLC untuk mengatur katup uap.", logic: "Dibandingkan dengan CTRL_TEMP: STEAM 2 membuka selama TH < CTRL_TEMP, STEAM 1 membuka saat TH < CTRL_TEMP − 1 °C. Saat STERIL. batasnya STER_SET + TEMP_SPACE." },
  p1: { name: "P1 — tekanan", tag: "P1", addr: "VW118", role: "Tekanan chamber dalam kPa.", logic: "PLC membandingkan P1 dengan tekanan target (naik mengikuti suhu) untuk memutuskan buka COMPRESSED AIR atau EXHAUST." },
  p2: { name: "P2 — tekanan", tag: "P2", addr: "VW120", role: "Sensor tekanan kedua dalam kPa.", logic: "Hanya ditampilkan; tidak dipakai langsung pada logika fase." },
  tm: { name: "TM — suhu", tag: "TM", addr: "VW114", role: "Sensor suhu di jalur sirkulasi dekat PHE.", logic: "Termasuk 8 kanal suhu yang diperiksa PLC: semua harus ≥ STER_SET untuk lanjut dari HEATING ke STERIL." },
  tl: { name: "TL — suhu bawah", tag: "TL", addr: "VW116", role: "Sensor suhu bagian bawah.", logic: "Termasuk 8 kanal suhu yang diperiksa PLC. Dipakai juga untuk mewarnai air di chamber pada diagram." },
  level: { name: "Level air", tag: "WATER", addr: "VW124", role: "Level air di chamber.", logic: "Nilai mentah PLC (skala belum dikonfirmasi). Animasi level air di chamber hanya ilustrasi berdasarkan fase." },
  cond: { name: "CONDUCTIVITY", tag: "L", addr: "VW122", role: "Mengukur daya hantar air di jalur buang PHE.", logic: "Lonjakan mendadak biasanya tanda air proses bocor ke sisi utilitas. Nilai mentah PLC (belum dikalibrasi ke µS/cm)." },
};