/**
 * /api/status — versi REAL (baca PLC via KEPServerEX IoT Gateway)
 * Pola koneksi & auth SAMA PERSIS dengan /api/plc-test yang sudah terbukti
 * jalan (Basic Auth, endpoint /iotgateway/read, env vars IOT_GATEWAY_*).
 *
 * CATATAN PENTING SEBELUM DIPAKAI:
 * 1. TAG_MAP di bawah pakai nama tag PERSIS seperti kolom "Nama Tag
 *    (KepServerEX)" di file tag_address_clean.xlsx. Beberapa nama TIDAK
 *    konsisten (ada yang pakai spasi, ada underscore, ada huruf kecil) —
 *    ini bukan typo dari kita, itu memang nama asli yang ke-config di
 *    KEPServerEX. Kalau salah satu tag gagal dibaca (cek field `r` di
 *    response, harusnya "Success"), cek ulang penamaan persis di project
 *    KEPServerEX-nya langsung.
 * 2. SCALING: kita sudah KONFIRMASI dari Quick Client bahwa T1-T6/TH/TM/TL
 *    perlu dibagi 10 (raw 355 → 35.5°C). Untuk P1/P2/ALRM_PRES/SAFETY_PRESS
 *    scaling BELUM dikonfirmasi — untuk sementara aku terapkan asumsi yang
 *    sama (bagi 10), tapi ini WAJIB divalidasi juga pas mesin jalan sungguhan
 *    (lihat SCALE_BY_10 di bawah, gampang di-toggle per tag).
 * 3. PHASE DETECTION masih best-guess (lihat komentar di detectPhase()) —
 *    belum divalidasi ke perilaku mesin asli. Ini prioritas berikutnya
 *    untuk didiskusikan/dites bareng.
 */

import { getDummyStatus } from "@/lib/dummyData";
import pool from "@/lib/db";

// ── Tag map: logical key -> nama tag PERSIS di KEPServerEX ────────────────
// (sumber: tag_address_clean.xlsx, kolom "Nama Tag (KepServerEX)")
const TAG_MAP = {
    // Sensor suhu
    t1: "T1", t2: "T2", t3: "T3", t4: "T4", t5: "T5", t6: "T6",
    th: "TH", tm: "TM", tl: "TL",
    // Tekanan & level air
    p1: "P1", p2: "P2",
    level: "L", water: "WATER",
    // F0
    f0Val: "F0_VAL",
    // Setpoint / resep aktif di PLC (bukan dari DB — ini yang PLC pakai saat itu)
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
    cooling1: "COOLING 1",     // ⚠️ ada spasi di nama aslinya — cek lagi
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
    sterTime: "ster_time",     // ⚠️ huruf kecil di nama aslinya — cek lagi
    // Nomor fase proses langsung dari ladder logic PLC (VW98) — TERKONFIRMASI
    processText: "PROCCES_TEXT",  // ⚠️ typo "PROCCES" (bukan "PROCESS") adalah nama asli di KEPServerEX
};

// Tag integer yang perlu dibagi 10. T1-T6/TH/TM/TL sudah KONFIRMASI via
// Quick Client. Sisanya (tekanan) masih ASUMSI — validasi pas ke mesin.
const SCALE_BY_10 = new Set([
    "t1", "t2", "t3", "t4", "t5", "t6", "th", "tm", "tl",
    "ctrlTemp", "tempSpace", "cool1Temp", "cool2Temp",
    "p1", "p2", "alrmPres", "safetyPress", // ⚠️ belum divalidasi
]);

// ── Peta nomor fase dari PLC (tag PROCCES_TEXT, VW98) ke label UI ─────────────
// Nilai 0–4 TERKONFIRMASI dari ladder logic. Nilai 5–7 masih DUGAAN.
// Sumber kebenaran: ladder logic PLC (bukan estimasi dari kombinasi valve/timer).
const PHASE_MAP = {
    0: { code: 'prepare',  label: 'PREPARE',  confirmed: true  },
    1: { code: 'prepare',  label: 'PREPARE',  confirmed: true  },
    2: { code: 'filling',  label: 'FILLING',  confirmed: true  },
    3: { code: 'heating',  label: 'HEATING',  confirmed: true  },
    4: { code: 'steril',   label: 'STERIL.',  confirmed: true  },
    5: { code: 'cooling',  label: 'COOLING',  confirmed: false }, // ⚠️ belum dikonfirmasi ke ladder logic
    6: { code: 'drain',    label: 'DRAIN',    confirmed: false }, // ⚠️ belum dikonfirmasi ke ladder logic
    7: { code: 'end',      label: 'END',      confirmed: false }, // ⚠️ belum dikonfirmasi ke ladder logic
};

const DEVICE_PREFIX = "S7-200.SiemensS7-200.";

function buildTagIds() {
    return Object.values(TAG_MAP).map((name) => `${DEVICE_PREFIX}${name}`);
}

// Nama tag KEPServerEX -> logical key (kebalikan dari TAG_MAP), buat parsing balik
const NAME_TO_KEY = Object.fromEntries(
    Object.entries(TAG_MAP).map(([key, name]) => [name, key])
);

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
        // Timeout pendek karena endpoint ini dipanggil tiap 1 detik oleh dashboard —
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
        console.warn("[status] Tag gagal dibaca (cek penamaan di KEPServerEX):", badTags);
    }

    // Cek kualitas: HTTP ke Gateway bisa aja sukses, tapi kalau SEMUA tag
    // quality-nya "bad" (item.s === false), itu tandanya kabel/koneksi
    // Gateway ↔ PLC-nya sendiri yang belum/putus nyambung — bukan sekadar
    // "beberapa tag salah nama". Kita anggap ini setara gagal konek, biar
    // indikator "Communication" di dashboard jujur mencerminkan status PLC,
    // bukan cuma status Gateway-nya doang.
    const totalTags = results.length;
    if (totalTags > 0 && badTags.length === totalTags) {
        throw new Error(
            "Semua tag quality bad — Gateway kebaca, tapi PLC kemungkinan belum tersambung (cek kabel/koneksi ke ODOT)"
        );
    }

    return values;
}

// Fallback lama, dipakai hanya kalau PROCCES_TEXT (VW98) gagal dibaca dari PLC.
// Logic ini MASIH BEST-GUESS dari kombinasi status valve/timer, belum divalidasi
// ke perilaku mesin asli. Sekarang hanya dipanggil jika tag processText tidak
// tersedia atau quality-nya bad.
// TODO (perlu jawaban dari observasi lapangan sebelum bisa difinalisasi):
//   1. Filling berhenti karena level (tag L atau WATER) nyampe nilai tertentu,
//      atau karena durasi tetap?
//   2. Heating -> Steril triggernya suhu (TL) nyampe CTRL_TEMP persis,
//      atau ada kondisi lain (mis. harus stabil X detik dulu)?
//   3. Ada overlap valve pas transisi antar fase (misal steam & cooling
//      nyala bareng sebentar) yang perlu ditoleransi di logic ini?
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

    // ── Jalur utama: PROCCES_TEXT (VW98) berhasil dibaca ──────────────────────
    if (raw !== null && raw !== undefined) {
        const numVal = Number(raw);
        const mapped = PHASE_MAP[numVal];
        if (mapped) {
            return { ...mapped, rawValue: numVal };
        }
        // Nilai di luar 0–7: tidak dikenal di ladder logic kita
        return {
            code: 'unknown',
            label: `Fase tidak dikenal (kode ${numVal})`,
            confirmed: false,
            rawValue: numVal,
        };
    }

    // ── Fallback lama, dipakai hanya kalau PROCCES_TEXT (VW98) gagal dibaca dari PLC ──
    const legacyLabel = detectPhase(v);
    // Normalkan hasil detectPhase ke format object yang sama
    const legacyMap = {
        PREPARE: { code: 'prepare', label: 'PREPARE' },
        FILLING: { code: 'filling', label: 'FILLING' },
        HEATING: { code: 'heating', label: 'HEATING' },
        STERIL:  { code: 'steril',  label: 'STERIL.'  },
        COOLING: { code: 'cooling', label: 'COOLING' },
        END:     { code: 'end',     label: 'END'     },
    };
    const fallback = legacyMap[legacyLabel] ?? { code: 'unknown', label: legacyLabel };
    return {
        ...fallback,
        confirmed: false,   // fallback selalu unconfirmed karena hanya estimasi
        rawValue: null,     // tidak ada nilai PROCCES_TEXT yang bisa dibaca
    };
}

export async function GET() {
    let sensorData;
    let plcOk = true;
    let plcError = null;

    try {
        const v = await readPlcTags();
        sensorData = {
            t1: v.t1, t2: v.t2, t3: v.t3, t4: v.t4, t5: v.t5, t6: v.t6,
            th: v.th, tm: v.tm, tl: v.tl,
            p1: v.p1, p2: v.p2,
            level: v.level, water: v.water,
            f0Val: v.f0Val,
            valves: {
                steam1: !!v.steam1, steam2: !!v.steam2, steamExhs: !!v.steamExhs,
                cooling1: !!v.cooling1, cooling2: !!v.cooling2,
                wtrFill: !!v.wtrFill, wtrDrain: !!v.wtrDrain, wtrPump: !!v.wtrPump,
            },
            door: {
                seal: !!v.doorSeal, locked: !!v.doorLock,
                opnFrnt: !!v.opnFrnt, opnRear: !!v.opnRear,
            },
            alarms: {
                buzzer: !!v.buzzer, warningBuz: !!v.warningBuz,
                alrmTemp: !!v.alrmTemp, alrmDor: !!v.alrmDor,
            },
            runLamp: !!v.runLamp,
            // phase sekarang object {code, label, confirmed, rawValue}.
            // Sumber utama: PROCCES_TEXT (VW98). Fallback: detectPhase() berbasis valve.
            phase: resolvePhase(v),
            updatedAt: new Date().toISOString(),
        };
    } catch (error) {
        // PLC gak kebaca (gateway mati, network putus, dll) — fallback ke dummy
        // biar dashboard tetap hidup, sama seperti pola error DB di bawah.
        console.error("[GET /api/status] PLC read error:", error.message);
        plcOk = false;
        plcError = error.message;
        sensorData = getDummyStatus();
    }

    try {
        const result = await pool.query(
            `SELECT
                br.batch_no,
                br.operator,
                br.product_name,
                br.machine_id,
                br.run_begin,
                r.formula_no
             FROM batch_records br
             LEFT JOIN recipes r ON br.recipe_id = r.id
             WHERE br.status = 'running'
             ORDER BY br.run_begin DESC
             LIMIT 1`
        );

        if (result.rows.length > 0) {
            const row = result.rows[0];
            return Response.json({
                ...sensorData,
                plcOk, plcError,
                running: true,
                batchNo: row.batch_no,
                operator: row.operator,
                productName: row.product_name,
                machineId: row.machine_id,
                formulaNo: row.formula_no,
                runBegin: row.run_begin,
            });
        }

        return Response.json({
            ...sensorData,
            plcOk, plcError,
            running: false,
            batchNo: null, operator: null, productName: null,
            machineId: null, formulaNo: null, runBegin: null,
        });
    } catch (error) {
        console.error("[GET /api/status] DB error:", error);
        return Response.json({
            ...sensorData,
            plcOk, plcError,
            running: false,
            dbError: error.message,
        });
    }
}