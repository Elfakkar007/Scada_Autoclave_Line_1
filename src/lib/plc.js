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
    // F0
    f0Val: "F0_VAL",
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
    cooling1: "COOLING 1",     // ada spasi di nama aslinya - cek lagi
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
    // Mode kontrol: CTRL SEL (M15.0) harus false (mode waktu).
    // Kalau true, sterilisasi menunggu sinyal F0 dari luar dan mesin bisa macet.
    // PERHATIAN: nama tag di KEPServerEX harus persis "CTRL SEL" (ada spasi) — jangan diubah.
    ctrlSel: "CTRL SEL",
    // Alarm
    buzzer: "BUZZER",
    warningBuz: "WARNING_BUZ",
    alrmTemp: "ALRM_TEMP",
    alrmDor: "ALRM_DOR",
    overTemp: "OVER_TEMP",
    safetyPress: "SAFETY_PRESS",
    // Timer / durasi fase
    heatTime: "HEAT_TIME",
    coolTime: "COOL_TIME",
    sterTime: "ster_time",     // huruf kecil di nama aslinya - cek lagi
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
]);

// Peta nomor fase dari PLC (tag PROCCES_TEXT, VW98) ke label UI
// Semua entry DIKONFIRMASI dari pembacaan kode program ladder logic langsung.
// PERHATIAN: urutan TIDAK naik lurus — kode 7 (Drain) muncul SEBELUM kode 6 (End).
// Sumber kebenaran: .awl export ladder logic PLC (bukan estimasi dari kombinasi valve/timer).
const PHASE_MAP = {
    0: { code: 'idle_door_open', label: 'Idle (pintu belum tertutup)', confirmed: true },
    1: { code: 'idle_ready',     label: 'Siap (pintu tertutup)',        confirmed: true },
    2: { code: 'filling',        label: 'FILLING',                      confirmed: true },
    3: { code: 'heating',        label: 'HEATING',                      confirmed: true },
    4: { code: 'steril',         label: 'STERIL.',                      confirmed: true },
    5: { code: 'cooling',        label: 'COOLING',                      confirmed: true },
    7: { code: 'drain',          label: 'DRAIN',                        confirmed: true },
    6: { code: 'finished',       label: 'END',                          confirmed: true },
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

// Fallback lama, dipakai hanya kalau PROCCES_TEXT (VW98) gagal dibaca dari PLC.
// Logic ini MASIH BEST-GUESS dari kombinasi status valve/timer, belum divalidasi
// ke perilaku mesin asli.
// TODO:
//   1. Filling berhenti karena level (tag L atau WATER) nyampe nilai tertentu,
//      atau karena durasi tetap?
//   2. Heating -> Steril triggernya suhu (TL) nyampe CTRL_TEMP persis,
//      atau ada kondisi lain?
//   3. Ada overlap valve pas transisi antar fase yang perlu ditoleransi?
function detectPhase(v) {
    if (!v.runLamp) return "PREPARE";
    if (v.wtrFill) return "FILLING";
    if ((v.steam1 || v.steam2) && v.tl < v.ctrlTemp) return "HEATING";
    if (v.tl >= v.ctrlTemp && v.sterTime > 0) return "STERIL";
    if (v.cooling1 || v.cooling2) return "COOLING";
    return "END";
}

// Tentukan objek fase dari nilai tag PROCCES_TEXT (VW98).
// Kalau tag berhasil dibaca, pakai PHASE_MAP sebagai sumber utama.
// Kalau tidak (null / gagal), fallback ke detectPhase() berbasis valve.
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

    // Fallback lama, dipakai hanya kalau PROCCES_TEXT (VW98) gagal dibaca dari PLC
    const legacyLabel = detectPhase(v);
    const legacyMap = {
        PREPARE: { code: "prepare", label: "PREPARE" },
        FILLING: { code: "filling", label: "FILLING" },
        HEATING: { code: "heating", label: "HEATING" },
        STERIL:  { code: "steril",  label: "STERIL."  },
        COOLING: { code: "cooling", label: "COOLING" },
        END:     { code: "end",     label: "END"     },
    };
    const fallback = legacyMap[legacyLabel] ?? { code: "unknown", label: legacyLabel };
    return {
        ...fallback,
        confirmed: false,   // fallback selalu unconfirmed karena hanya estimasi
        rawValue: null,     // tidak ada nilai PROCCES_TEXT yang bisa dibaca
    };
}

// Fungsi internal: fetch raw tag values dari IoT Gateway
async function readPlcTags() {
    const protocol = process.env.IOT_GATEWAY_PROTOCOL || "http";
    const host     = process.env.IOT_GATEWAY_HOST;
    const port     = process.env.IOT_GATEWAY_PORT;
    const user     = process.env.IOT_GATEWAY_USER;
    const pass     = process.env.IOT_GATEWAY_PASS;

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
 *   f0Val,
 *   valves: { steam1, steam2, steamExhs, cooling1, cooling2,
 *             wtrFill, wtrDrain, wtrPump },
 *   door:   { seal, locked, bypass, clsFrnt, clsRear, opnFrnt, opnRear },
 *             locked = alias lama untuk bypass (M6.0) — dipertahankan agar UI tidak rusak.
 *             bypass = true artinya interlock pintu dilewati (BAHAYA: jangan izinkan START).
 *   alarms: { buzzer, warningBuz, alrmTemp, alrmDor },
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
 * Kalau PLC gagal dibaca, plcOk=false dan sensor field terisi dari getDummyStatus().
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
            f0Val: v.f0Val,
            valves: {
                steam1: !!v.steam1, steam2: !!v.steam2, steamExhs: !!v.steamExhs,
                cooling1: !!v.cooling1, cooling2: !!v.cooling2,
                wtrFill: !!v.wtrFill, wtrDrain: !!v.wtrDrain, wtrPump: !!v.wtrPump,
            },
            door: {
                // locked = alias lama untuk doorLock (M6.0). Dipertahankan agar UI yang ada tidak rusak.
                // PERHATIAN: M6.0 sebenarnya BYPASS interlock, bukan kunci pintu!
                //            Kalau bypass=true, jangan izinkan Start dari web.
                locked: !!v.doorLock,
                bypass: !!v.doorLock, // alias eksplisit untuk logika guard Start
                seal:    !!v.doorSeal,
                clsFrnt: !!v.clsFrnt,
                clsRear: !!v.clsRear,
                opnFrnt: !!v.opnFrnt,
                opnRear: !!v.opnRear,
            },
            alarms: {
                buzzer: !!v.buzzer, warningBuz: !!v.warningBuz,
                alrmTemp: !!v.alrmTemp, alrmDor: !!v.alrmDor,
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
                ctrlTemp:    v.ctrlTemp    ?? null,  // °C (sudah dibagi 10)
                sterSet:     v.sterSet     ?? null,  // °C (sudah dibagi 10)
                sterSetTime: v.sterSetTime ?? null,  // menit (tidak dibagi 10)
                tempSpace:   v.tempSpace   ?? null,  // °C (sudah dibagi 10)
                cool1Temp:   v.cool1Temp   ?? null,  // °C (sudah dibagi 10)
                cool2Temp:   v.cool2Temp   ?? null,  // °C (sudah dibagi 10)
                alrmPres:    v.alrmPres    ?? null,  // raw (scaling belum dikonfirmasi)
            },
            // phase: object {code, label, confirmed, rawValue}
            // Sumber utama PROCCES_TEXT (VW98), fallback ke detectPhase() berbasis valve.
            phase: resolvePhase(v),
            updatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error("[plc] readPlcSnapshot gagal:", error.message);
        plcOk = false;
        plcError = error.message;
        snapshot = getDummyStatus();
    }

    return { plcOk, plcError, ...snapshot };
}
