/**
 * src/lib/plc.js — Modul reusable pembacaan PLC via KEPServerEX IoT Gateway.
 *
 * Dipakai oleh:
 *   - /api/status (Next.js route handler) → live dashboard
 *   - src/lib/trendRecorder.js (proses background di custom server)
 *
 * CATATAN PENTING:
 * 1. TAG_MAP pakai nama tag PERSIS seperti di KEPServerEX. Beberapa nama tidak
 *    konsisten (spasi, underscore, huruf kecil) — ini nama asli di proyek
 *    KEPServerEX, bukan typo kita.
 * 2. SCALING: T1-T6/TH/TM/TL dikonfirmasi perlu dibagi 10 (raw 355 → 35.5°C).
 *    P1/P2 dibaca apa adanya dalam kPa (terkonfirmasi dari layar SCADA lama).
 *    ALRM_PRES/SAFETY_PRESS juga dalam kPa, tidak di-scale.
 * 3. PROCCES_TEXT (VW98): nomor step fase langsung dari ladder logic PLC.
 *    Urutan DIKONFIRMASI dari pembacaan kode program: 0,1,2,3,4,5,7,6
 *    (kode 7=DRAIN muncul SEBELUM kode 6=END).
 * 4. Tag L (VW122) = CONDUCTIVITY, tag WATER (VW124) = LEVEL AIR.
 *    Kedua tag ini sebelumnya tertukar — sudah dikoreksi.
 */

/**
 * TABEL ALARM PLC (dibaca dari export_atv.awl: SBR12, SBR2, SBR3, SBR4, SBR6).
 * Web hanya MEMBACA. Buzzer dan interlock PLC tetap pengaman utama.
 *
 * Grup "fault"  = masuk alarms.active (arti jelas dari kode, bermakna sebagai kesalahan)
 * Grup "review" = HANYA informasi (alarms.reviewActive). Belum boleh memicu popup/alarm_log
 *                 sebelum diamati di batch nyata, karena bisa menyala pada batch normal.
 *
 *  Bit    Grup    Arti (dari kode PLC)
 *  M8.0   fault   (tombol buka pintu I1.5/I0.4, tombol release I0.6/M1.3) DAN P1 >= SAFETY_PRESS
 *                 = percobaan buka pintu saat tekanan chamber masih di atas batas aman
 *  M8.1   fault   START (M1.4) ditekan DAN I0.2 tidak aktif DAN I0.3 tidak aktif
 *                 (kedua pintu sama-sama tidak tertutup; bila hanya satu terbuka, bit ini TIDAK menyala)
 *  M8.2   fault   START (M1.4) ditekan DAN seal pintu Q0.5 tidak aktif
 *  M10.2  fault   Fase steril (M3.3) DAN salah satu T1..T6/TM < STER_SET (VW200). SESAAT, tanpa tunda
 *  M10.3  fault   Fase steril (M3.3) DAN salah satu T1..T6/TM > OVER_TEMP (VW252). SESAAT, tanpa tunda
 *  M8.3   review  Fase steril DAN VW126 > VW250. VW126 = suhu turunan dari T2/T3/T4. Tidak memicu buzzer
 *  M8.4   review  Fase steril DAN VW126 < STER_SET. SESAAT, tidak memicu buzzer
 *  M8.7   review  TH/T1/T2/T3 > 150.0 C, atau I0.7 aktif (arti I0.7 belum diketahui). Tidak memicu buzzer
 *  M10.1  review  Fase heating DAN counter C6 >= 3000 detik (50 menit). Mungkin batas waktu pemanasan; belum pernah teramati
 *
 * TIDAK DIBACA (sengaja):
 *  - M10.0 (heating 5 menit, counter C5) dan M10.4 (cooling 5 menit, counter C7): buzzer
 *    PEMBERITAHUAN rutin, menyala 30 detik sekali lalu mati sendiri di SETIAP batch normal
 *    (terkonfirmasi dari pengamatan mesin dan keterangan operator). Bukan alarm.
 *  - buzzer output Q2.5 menyala juga saat fase END (M3.6) pada
 * siklus normal, jadi bukan indikator alarm. M10.5/M10.6 bukan alarm (M10.6 tidak pernah di-set PLC).
 *
 * CATATAN WAKTU: bit alarm berupa DENYUT, bukan latch. M8.0-M8.2 menyala ~5 detik
 * (T105/T106/T107) dan M10.2/M10.3 ~120 detik (T102), lalu mati 1 scan dan menyala lagi
 * bila kondisinya masih ada (timernya bergantung pada bit itu sendiri). M10.1 beda: timernya
 * (T116) bergantung pada kondisi fase, jadi menyala SEKALI ~30 detik lalu mati dan tidak berulang. Deteksi tepi di web (Item 8) harus
 * polling <= 1 detik DAN memberi debounce supaya satu episode tidak tercatat berkali-kali.
 */

import { getDummyStatus } from "./dummyData.js";

// Tag map: logical key -> nama tag PERSIS di KEPServerEX
// (sumber: tag_address_clean.xlsx, kolom "Nama Tag (KepServerEX)")
const TAG_MAP = {
    // Sensor suhu
    t1: "T1", t2: "T2", t3: "T3", t4: "T4", t5: "T5", t6: "T6",
    th: "TH", tm: "TM", tl: "TL",
    // Tekanan
    p1: "P1", p2: "P2",
    // Conductivity & level air
    // CATATAN: L (VW122) = CONDUCTIVITY, WATER (VW124) = LEVEL AIR
    // Sebelumnya tertukar — sudah dikoreksi per hasil pembacaan ladder logic.
    conductivity: "L",       // VW122 — conductivity
    level: "WATER",          // VW124 — level air
    // F0_VAL (VW220) SENGAJA TIDAK DIBACA: tidak dipakai program PLC (tidak ada
    // satu pun referensi di .awl), nilainya tidak bermakna. F0 dihitung di web.
    // Setpoint / resep aktif di PLC (bukan dari DB)
    ctrlTemp: "CTRL_TEMP",
    sterSet: "STER_SET",
    sterSetTime: "STER_SET_TIME",
    tempSpace: "TEMP_SPACE",
    cool1Temp: "COOL1_TEMP",
    cool2Temp: "COOL2_TEMP",
    alrmPres: "ALRM_PRES",
    // Aktuator / valve (Boolean)
    steam1: "STEAM_1",
    steam2: "STEAM_2",
    steamExhs: "STEAM_EXHS",
    cooling1: "COOLING_1",     // dikonfirmasi dari KEPServer Quick Client: underscore, bukan spasi
    cooling2: "COOLING_2",
    wtrFill: "WTR_FILL",
    wtrDrain: "WTR_DRAIN",
    wtrPump: "WTR_PUMP",
    // Pintu & seal
    doorSeal: "DOOR_SEAL",
    doorRelease: "DOOR_RELEASE",
    doorLock: "DOOR_LOCK",
    opnFrnt: "OPN_FRNT",
    clsFrnt: "CLS_FRNT",
    opnRear: "OPN_REAR",
    clsRear: "CLS_REAR",
    watrIndicator: "WATR_INDICATOR",
    // Kontrol & status umum
    start: "START",
    stop: "STOP",
    runLamp: "RUN_LAMP",
    // Mode kontrol: CTRL_SEL (M15.0) harus false (mode waktu).
    // Kalau true, sterilisasi menunggu sinyal F0 dari luar dan mesin bisa macet.
    // PERHATIAN: nama tag di KEPServerEX harus persis "CTRL_SEL".
    ctrlSel: "CTRL_SEL",
    // ── Ambang batas (BUKAN sinyal alarm) ──
    // OVER_TEMP (VW252) dibandingkan langsung dengan suhu raw (x10) -> dibagi 10.
    // SAFETY_PRESS (VW222) dibandingkan langsung dengan tekanan kPa -> tidak di-scale.
    overTemp: "OVER_TEMP",
    safetyPress: "SAFETY_PRESS",
    // ── Alarm per BIT (tag Boolean baru di KEPServerEX; lihat tabel di bawah) ──
    // Tag word lama (MW8 ALRM_DOR, MW10 WARNING_BUZ, MW17 ALRM_TEMP) dan
    // BUZZER (M10.6) tidak dipakai lagi: word mencampur flag non-alarm
    // (M9.x = SAVE_VMEM, M11.0/M11.1 = tombol pintu) sehingga memicu alarm palsu,
    // dan M10.6 tidak pernah di-set oleh program PLC (selalu 0).
    almM8_0: "ALM_M8_0", almM8_1: "ALM_M8_1", almM8_2: "ALM_M8_2",
    almM8_3: "ALM_M8_3", almM8_4: "ALM_M8_4", almM8_7: "ALM_M8_7",
    // M10.0 dan M10.4 SENGAJA TIDAK DIBACA: itu buzzer pemberitahuan "heating/cooling sudah
    // 5 menit" (30 detik sekali, terkonfirmasi dari pengamatan mesin + operator), bukan alarm.
    almM10_1: "ALM_M10_1", almM10_2: "ALM_M10_2", almM10_3: "ALM_M10_3",
    // Timer / durasi fase (detik)
    heatTime: "HEAT_TIME",     // VW600
    coolTime: "COOL_TIME",     // VW602
    sterTime: "ster_time",     // VW230 (huruf kecil memang nama aslinya di KEPServerEX)
    // Nomor fase proses langsung dari ladder logic PLC (VW98) - TERKONFIRMASI
    processText: "PROCCES_TEXT",  // typo "PROCCES" (bukan "PROCESS") adalah nama asli di KEPServerEX
};

// Tag integer yang perlu dibagi 10. T1-T6/TH/TM/TL sudah KONFIRMASI via
// Quick Client. STER_SET dikonfirmasi ditulis x10 oleh plcWrite, jadi dibaca /10.
// Tag tekanan (p1, p2, alrmPres, safetyPress) TIDAK di-scale: nilai raw PLC sudah
// dalam kPa. Terkonfirmasi dari layar SCADA lama (contoh: "Alarm Pres 240 KPa",
// rentang -100..300, tanpa desimal).
const SCALE_BY_10 = new Set([
    "t1", "t2", "t3", "t4", "t5", "t6", "th", "tm", "tl",
    "ctrlTemp", "sterSet", "tempSpace", "cool1Temp", "cool2Temp",
    "overTemp", // VW252 dibandingkan dengan VW102..VW114 (raw x10), jadi satuannya sama
]);

// Peta nomor fase dari PLC (tag PROCCES_TEXT, VW98) ke label UI
// Semua entry DIKONFIRMASI dari pembacaan kode program ladder logic langsung.
// PERHATIAN: urutan TIDAK naik lurus — kode 7 (Drain) muncul SEBELUM kode 6 (End).
// Sumber kebenaran: .awl export ladder logic PLC (bukan estimasi dari kombinasi valve/timer).
const PHASE_MAP = {
    0: { code: 'idle_door_open', label: 'Idle (pintu belum tertutup)', confirmed: true },
    1: { code: 'idle_ready', label: 'Siap (pintu tertutup)', confirmed: true },
    2: { code: 'filling', label: 'FILLING', confirmed: true },
    3: { code: 'heating', label: 'HEATING', confirmed: true },
    4: { code: 'steril', label: 'STERIL.', confirmed: true },
    5: { code: 'cooling', label: 'COOLING', confirmed: true },
    7: { code: 'drain', label: 'DRAIN', confirmed: true },
    6: { code: 'finished', label: 'END', confirmed: true },
    // Terkonfirmasi dari kode ladder: status "finished" (kode 6) BERTAHAN sampai
    // tombol STOP ditekan — tidak otomatis kembali ke idle.
};

const DEVICE_PREFIX = "S7-200.SiemensS7-200.";

function buildTagIds() {
    return Object.values(TAG_MAP).map((name) => `${DEVICE_PREFIX}${name}`);
}

// Nama tag KEPServerEX -> logical key (kebalikan dari TAG_MAP), buat parsing balik
const NAME_TO_KEY = Object.fromEntries(
    Object.entries(TAG_MAP).map(([key, name]) => [name, key])
);

// Tentukan objek fase dari nilai tag PROCCES_TEXT (VW98).
// Sumber utama: PHASE_MAP (dikonfirmasi dari kode ladder AWL).
// Bila tag gagal dibaca (null), kembalikan 'unknown' — jangan tebak dari valve.
// Alasan: tebakan berbasis valve pernah mengembalikan "PREPARE" saat fase END
// (RUN_LAMP mati di kedua kondisi), dan tidak mengenal fase DRAIN (kode 7).
function resolvePhase(v) {
    const raw = v.processText;

    // Jalur utama: PROCCES_TEXT (VW98) berhasil dibaca
    if (raw !== null && raw !== undefined) {
        const numVal = Number(raw);
        const mapped = PHASE_MAP[numVal];
        if (mapped) {
            return { ...mapped, rawValue: numVal };
        }
        // Nilai di luar 0-7: tidak dikenal di ladder logic kita
        return {
            code: "unknown",
            label: `Fase tidak dikenal (kode ${numVal})`,
            confirmed: false,
            rawValue: numVal,
        };
    }

    // VW98 gagal dibaca — kembalikan unknown, jangan tebak.
    // UI akan menampilkan badge '!' dan START akan diblokir oleh gating fase.
    return {
        code: "unknown",
        label: "Fase tidak terbaca (VW98 null)",
        confirmed: false,
        rawValue: null,
    };
}

// Dummy hanya boleh aktif lewat env eksplisit dan tidak pernah di production.
function dummyAllowed() {
    return (
        process.env.ENABLE_DUMMY_PLC === "true" &&
        process.env.NODE_ENV !== "production"
    );
}

// Snapshot kosong saat PLC tidak terbaca: semua nilai null, tidak ada angka palsu.
// Bentuk field sengaja sama dengan snapshot normal supaya konsumen tidak crash,
// tetapi objek bersarang (valves, door, dst.) bernilai null, bukan false,
// agar valve/pintu tidak tampak "CLOSED" padahal statusnya tidak diketahui.
function getEmptySnapshot() {
    return {
        t1: null, t2: null, t3: null, t4: null, t5: null, t6: null,
        th: null, tm: null, tl: null,
        p1: null, p2: null,
        conductivity: null, level: null,
        valves: null, door: null, alarms: null, limits: null,
        runLamp: null, ctrlSel: null,
        setpoints: null, phase: null, timers: null,
        isDummy: false,
        updatedAt: new Date().toISOString(),
    };
}

// Bit alarm -> true/false, atau null bila tag tidak terbaca. null SENGAJA tidak
// diubah jadi false: "tidak tahu" tidak boleh tampil sebagai "tidak ada alarm".
function bitOrNull(x) {
    return x === null || x === undefined ? null : !!x;
}

// Pembagian grup: lihat tabel di header file. Memindahkan bit dari "review" ke
// "fault" cukup mengubah dua daftar ini, setelah bit itu terbukti tidak menyala
// pada batch normal.
const FAULT_BITS = ["m8_0", "m8_1", "m8_2", "m10_2", "m10_3"];
const REVIEW_BITS = ["m8_3", "m8_4", "m8_7", "m10_1"];

function buildAlarms(v) {
    const bits = {
        m8_0: bitOrNull(v.almM8_0), m8_1: bitOrNull(v.almM8_1), m8_2: bitOrNull(v.almM8_2),
        m8_3: bitOrNull(v.almM8_3), m8_4: bitOrNull(v.almM8_4), m8_7: bitOrNull(v.almM8_7),
        m10_1: bitOrNull(v.almM10_1), m10_2: bitOrNull(v.almM10_2), m10_3: bitOrNull(v.almM10_3),
    };
    const active = FAULT_BITS.some((k) => bits[k] === true);
    const reviewKeys = REVIEW_BITS.filter((k) => bits[k] === true);
    return {
        bits,
        active,                                          // ada kesalahan nyata (grup fault)
        readOk: FAULT_BITS.every((k) => bits[k] !== null), // false = ada bit fault yang gagal dibaca
        reviewActive: reviewKeys.length > 0,             // hanya informasi, JANGAN dijadikan popup
        reviewKeys,
    };
}

// Fungsi internal: fetch raw tag values dari IoT Gateway
async function readPlcTags() {
    const protocol = process.env.IOT_GATEWAY_PROTOCOL || "http";
    const host = process.env.IOT_GATEWAY_HOST;
    const port = process.env.IOT_GATEWAY_PORT;
    const user = process.env.IOT_GATEWAY_USER;
    const pass = process.env.IOT_GATEWAY_PASS;

    if (!host || !port || !user || !pass) {
        throw new Error(
            "Environment variable IOT_GATEWAY_* belum lengkap (cek .env.local)"
        );
    }

    const tagIds = buildTagIds();
    const queryString = tagIds
        .map((id) => `ids=${encodeURIComponent(id)}`)
        .join("&");
    const url = `${protocol}://${host}:${port}/iotgateway/read?${queryString}`;
    const basicAuth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

    const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: basicAuth, Accept: "application/json" },
        // Timeout pendek karena endpoint ini dipanggil tiap 1 detik oleh dashboard -
        // kalau gateway lambat/mati, jangan sampai request numpuk.
        signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
        throw new Error(`IoT Gateway HTTP ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    // Format standar KEPServerEX IoT Gateway REST: { readResults: [{ id, s, r, v, t }] }
    const results = raw.readResults || raw.ReadResults || [];

    const values = {};
    const badTags = [];

    for (const item of results) {
        const tagName = item.id?.replace(DEVICE_PREFIX, "");
        const key = NAME_TO_KEY[tagName];
        if (!key) continue; // tag di response tapi gak kita kenal, skip

        const isGood = item.s === true || item.r === "Success";
        if (!isGood) {
            badTags.push(tagName);
            values[key] = null;
            continue;
        }

        let v = item.v;
        if (SCALE_BY_10.has(key) && typeof v === "number") {
            v = v / 10;
        }
        values[key] = v;
    }

    if (badTags.length > 0) {
        console.warn("[plc] Tag gagal dibaca (cek penamaan di KEPServerEX):", badTags);
    }

    // Cek kualitas: HTTP ke Gateway bisa aja sukses, tapi kalau SEMUA tag
    // quality-nya "bad" (item.s === false), itu tandanya kabel/koneksi
    // Gateway ↔ PLC-nya sendiri yang belum/putus nyambung.
    const totalTags = results.length;
    if (totalTags > 0 && badTags.length === totalTags) {
        throw new Error(
            "Semua tag quality bad - Gateway kebaca, tapi PLC kemungkinan belum tersambung (cek kabel/koneksi ke ODOT)"
        );
    }

    return values;
}

/**
 * Export utama: baca semua tag PLC, terapkan scaling, deteksi fase,
 * dan kembalikan snapshot lengkap yang siap dipakai oleh /api/status
 * maupun trendRecorder.
 *
 * Return shape:
 * {
 *   plcOk: boolean,
 *   plcError: string|null,
 *   t1..t6, th, tm, tl,   (suhu dalam degC, sudah dibagi 10)
 *   p1, p2,               (tekanan dalam kPa — nilai raw PLC, tidak di-scale;
 *                           terkonfirmasi dari layar SCADA lama)
 *   conductivity,         (raw dari tag L/VW122 — TODO: scaling belum dikonfirmasi)
 *   level,                (raw dari tag WATER/VW124 — TODO: scaling belum dikonfirmasi)
 *   valves: { steam1, steam2, steamExhs, cooling1, cooling2,
 *             wtrFill, wtrDrain, wtrPump },
 *   door:   { seal, locked, bypass, clsFrnt, clsRear, opnFrnt, opnRear },
 *             locked = alias lama untuk bypass (M6.0) — dipertahankan agar UI tidak rusak.
 *             bypass = true artinya interlock pintu dilewati (BAHAYA: jangan izinkan START).
 *   alarms: { bits:{m8_0..m10_3}, active (grup fault), readOk, reviewActive, reviewKeys },
 *   limits: { overTemp (°C), safetyPress (kPa) },   (ambang batas, bukan alarm)
 *   runLamp: boolean,
 *   ctrlSel: boolean|null (null kalau gagal dibaca; true = mode F0 = mesin bisa macet),
 *   phase:  { code, label, confirmed, rawValue },
 *   setpoints: { ctrlTemp, sterSet, sterSetTime, tempSpace, cool1Temp, cool2Temp, alrmPres }
 *              (nilai sudah dalam satuan engineering — suhu dalam °C, waktu dalam menit,
 *               alrmPres dalam kPa (tidak di-scale); null bila tag gagal dibaca.
 *               Tidak tersedia di data dummy.)
 *   updatedAt: ISO string,
 * }
 *
 * Kalau PLC gagal dibaca, plcOk=false dan SEMUA field data bernilai null
 * (UI menampilkan "NO DATA"). Data dummy hanya dipakai bila env
 * ENABLE_DUMMY_PLC=true DAN NODE_ENV bukan "production"; snapshot dummy
 * ditandai isDummy=true supaya UI menampilkan banner simulasi.
 */
export async function readPlcSnapshot() {
    let plcOk = true;
    let plcError = null;
    let snapshot;

    try {
        const v = await readPlcTags();
        snapshot = {
            t1: v.t1, t2: v.t2, t3: v.t3, t4: v.t4, t5: v.t5, t6: v.t6,
            th: v.th, tm: v.tm, tl: v.tl,
            p1: v.p1, p2: v.p2,
            conductivity: v.conductivity, // TODO: scaling belum dikonfirmasi (raw dari tag L/VW122)
            level: v.level,               // TODO: scaling belum dikonfirmasi (raw dari tag WATER/VW124)
            valves: {
                // bitOrNull: tag gagal-baca → null (unknown/abu-abu di diagram),
                // bukan false (CLOSED). null SENGAJA tidak diubah jadi false.
                steam1: bitOrNull(v.steam1), steam2: bitOrNull(v.steam2), steamExhs: bitOrNull(v.steamExhs),
                cooling1: bitOrNull(v.cooling1), cooling2: bitOrNull(v.cooling2),
                wtrFill: bitOrNull(v.wtrFill), wtrDrain: bitOrNull(v.wtrDrain), wtrPump: bitOrNull(v.wtrPump),
            },
            door: {
                // locked = alias lama untuk doorLock (M6.0). Dipertahankan agar UI yang ada tidak rusak.
                // PERHATIAN: M6.0 sebenarnya BYPASS interlock, bukan kunci pintu!
                //            Kalau bypass=true, jangan izinkan Start dari web.
                locked: !!v.doorLock,
                bypass: !!v.doorLock, // alias eksplisit untuk logika guard Start
                seal: !!v.doorSeal,
                clsFrnt: !!v.clsFrnt,
                clsRear: !!v.clsRear,
                opnFrnt: !!v.opnFrnt,
                opnRear: !!v.opnRear,
            },
            alarms: buildAlarms(v),
            // Ambang batas dari PLC (bukan alarm). null bila tag gagal dibaca.
            limits: {
                overTemp: v.overTemp ?? null,       // °C (sudah dibagi 10)
                safetyPress: v.safetyPress ?? null, // kPa (tidak di-scale)
            },
            runLamp: !!v.runLamp,
            // ctrlSel: null kalau tag gagal dibaca (kualitas bad), selain itu boolean.
            // ctrlSel=true berarti mode F0 aktif — mesin bisa macet saat sterilisasi.
            // Guard: hanya berlaku kalau plcOk true (data bukan dari dummy).
            ctrlSel: (v.ctrlSel === null || v.ctrlSel === undefined) ? null : !!v.ctrlSel,
            // Setpoint yang sedang aktif di PLC (sudah dalam satuan engineering).
            // null bila tag tidak terbaca. Semua pengguna wajib pakai optional chaining
            // karena field ini tidak tersedia di data dummy (plcOk=false).
            setpoints: {
                ctrlTemp: v.ctrlTemp ?? null,  // °C (sudah dibagi 10)
                sterSet: v.sterSet ?? null,  // °C (sudah dibagi 10)
                sterSetTime: v.sterSetTime ?? null,  // menit (tidak dibagi 10)
                tempSpace: v.tempSpace ?? null,  // °C (sudah dibagi 10)
                cool1Temp: v.cool1Temp ?? null,  // °C (sudah dibagi 10)
                cool2Temp: v.cool2Temp ?? null,  // °C (sudah dibagi 10)
                alrmPres: v.alrmPres ?? null,  // kPa (tidak di-scale; dibandingkan langsung dengan P1 di PLC)
            },
            // phase: object {code, label, confirmed, rawValue}
            // Sumber utama PROCCES_TEXT (VW98). Bila null → unknown (tidak ditebak).
            phase: resolvePhase(v),
            // Durasi tiap fase dari timer PLC (detik, nilai raw — tidak di-scale).
            // null bila tag tidak terbaca. Dipakai oleh trendRecorder untuk mengisi
            // heat_time_min / ster_time_min / cool_time_min di batch_records.
            timers: {
                heatSec: (v.heatTime !== null && v.heatTime !== undefined) ? v.heatTime : null,
                sterSec: (v.sterTime !== null && v.sterTime !== undefined) ? v.sterTime : null,
                coolSec: (v.coolTime !== null && v.coolTime !== undefined) ? v.coolTime : null,
            },
            updatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error("[plc] readPlcSnapshot gagal:", error.message);
        plcOk = false;
        plcError = error.message;
        snapshot = dummyAllowed() ? getDummyStatus() : getEmptySnapshot();
    }

    return { plcOk, plcError, ...snapshot };
}