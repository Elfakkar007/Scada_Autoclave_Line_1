/**
 * src/lib/plcWrite.js — Modul reusable penulisan tag ke PLC via KEPServerEX IoT Gateway.
 *
 * PERINGATAN: Fitur tulis ke PLC ini BELUM sepenuhnya terverifikasi ke ladder logic PLC asli.
 * Beberapa asumsi scaling & alamat tag masih berdasarkan pola dari layar HMI lama.
 * Gunakan hanya dengan pengawasan langsung di lapangan sampai ada konfirmasi lebih lanjut.
 *
 * Pola koneksi & auth SAMA PERSIS dengan src/lib/plc.js (Basic Auth, /iotgateway/write,
 * env vars IOT_GATEWAY_*).
 */

const DEVICE_PREFIX = "S7-200.SiemensS7-200.";

/**
 * Daftar tag setpoint suhu yang WAJIB dikali 10 sebelum ditulis ke PLC.
 * Pola ini TERKONFIRMASI dari Quick Client (raw 1210 = 121.0°C).
 *
 * CATATAN YANG SENGAJA TIDAK MASUK DAFTAR INI:
 * - STER_SET_TIME: satuan menit, ditulis apa adanya. TERKONFIRMASI dari ladder logic.
 * - ALRM_PRES: scaling tekanan BELUM JELAS — belum divalidasi ke ladder logic PLC.
 *   Ditulis apa adanya sampai ada konfirmasi dari lapangan.
 */
export const SETPOINT_SCALE_X10 = [
    "CTRL_TEMP",
    "STER_SET",
    "TEMP_SPACE",
    "COOL1_TEMP",
    "COOL2_TEMP",
];

/**
 * Tulis satu atau lebih tag ke PLC lewat KEPServerEX IoT Gateway.
 *
 * @param {Array<{tag: string, value: number|boolean}>} tagValuePairs
 *   Array pasangan tag-nilai. Value sudah dalam bentuk RAW/mentah (sudah di-scale
 *   oleh pemanggil). Fungsi ini TIDAK melakukan scaling apapun.
 *   Contoh: [{ tag: 'CTRL_TEMP', value: 1210 }, { tag: 'START', value: true }]
 *
 * @returns {Promise<{ok: boolean, results: Array}>}
 *   ok = true HANYA kalau SEMUA item di writeResults dari gateway punya s === true.
 *   Kalau ada satu saja yang gagal, ok = false beserta detail kegagalan di results.
 */
export async function writePlcTags(tagValuePairs) {
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

    // Bangun payload sesuai format KEPServerEX IoT Gateway REST write
    const writeBody = tagValuePairs.map(({ tag, value }) => ({
        id: `${DEVICE_PREFIX}${tag}`,
        v:  value,
    }));

    const url = `${protocol}://${host}:${port}/iotgateway/write`;
    const basicAuth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: basicAuth,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(writeBody),
        signal: AbortSignal.timeout(5000), // sedikit lebih longgar dari read karena write
    });

    if (!response.ok) {
        throw new Error(
            `IoT Gateway write HTTP ${response.status} ${response.statusText}`
        );
    }

    const raw = await response.json();
    // Format standar KEPServerEX IoT Gateway REST write: { writeResults: [{ id, s }] }
    const writeResults = raw.writeResults || raw.WriteResults || [];

    // ── Fail-closed: jumlah hasil HARUS sama dengan jumlah tag yang dikirim ──
    // Kalau gateway mengembalikan lebih sedikit hasil dari yang dikirim
    // (termasuk array kosong), ok = false. Ini mencegah silent partial-write.
    const sentCount     = tagValuePairs.length;
    const receivedCount = writeResults.length;

    if (receivedCount !== sentCount) {
        console.error(
            `[plcWrite] Jumlah hasil write berbeda dari yang dikirim: ` +
            `dikirim=${sentCount}, diterima=${receivedCount}. Anggap gagal semua.`
        );
    }

    // Bangun map id -> hasil dari gateway untuk pencarian cepat
    const resultMap = new Map(writeResults.map((item) => [item.id, item]));

    // Susun hasil lengkap — satu entri per tag yang kita kirim
    const fullResults = tagValuePairs.map(({ tag }) => {
        const fullId = `${DEVICE_PREFIX}${tag}`;
        const item   = resultMap.get(fullId);
        if (!item) {
            // Tag ini tidak ada di respons gateway sama sekali
            return {
                id:      fullId,
                tag,
                success: false,
                error:   "Tidak ada hasil dari gateway",
            };
        }
        return {
            id:      item.id,
            tag:     item.id?.replace(DEVICE_PREFIX, "") ?? item.id,
            success: item.s === true,
            error:   item.s !== true ? (item.r ?? "Unknown error") : undefined,
        };
    });

    // ok = true HANYA kalau jumlah cocok DAN semua item berhasil
    const failures = fullResults.filter((r) => !r.success);
    const ok       = receivedCount === sentCount && failures.length === 0;

    if (!ok && receivedCount === sentCount) {
        // Jumlah cocok tapi ada yang gagal — log biasa
        console.warn(
            "[plcWrite] Sebagian tag gagal ditulis:",
            failures.map((f) => f.tag)
        );
    }

    return { ok, results: fullResults };
}

/**
 * Tulis tag PLC sebagai PULSA: true → tunggu holdMs → false (selalu, di finally).
 *
 * Latar belakang: Tag START (M1.4) dan STOP (M1.5) dibaca PLC sebagai LEVEL, bukan edge.
 * Kalau dibiarkan true, STOP akan menahan mesin di Idle terus dan START bisa memicu
 * siklus baru sendiri. Karena itu keduanya WAJIB ditulis sebagai pulsa.
 *
 * Alur:
 *   1. Tulis { tag, value: true } lewat writePlcTags.
 *   2. Kalau berhasil, tunggu holdMs milidetik.
 *   3. Di blok finally (apapun hasilnya, termasuk exception), SELALU coba tulis
 *      { tag, value: false } — maksimal 3 percobaan dengan jeda 500 ms antar percobaan.
 *
 * @param {string} tag - Nama tag di KEPServerEX (tanpa prefix device), misal "START".
 * @param {{ holdMs?: number }} [options]
 * @returns {Promise<{ ok, wroteOn, wroteOff, stuckRisk, error }>}
 *   ok        = true hanya kalau wroteOn && wroteOff.
 *   stuckRisk = true kalau tag mungkin tertahan aktif di PLC (wroteOn sukses/tidak pasti,
 *               tapi wroteOff gagal). Kondisi ini perlu dicek manual di lapangan.
 */
export async function pulsePlcTag(tag, { holdMs = 1500 } = {}) {
    let wroteOn  = false;
    let wroteOff = false;
    let errorMsg = null;

    // ── Langkah 1: Tulis true ──────────────────────────────────────────────────
    try {
        const onResult = await writePlcTags([{ tag, value: true }]);
        wroteOn = onResult.ok;
        if (!wroteOn) {
            errorMsg = `Gagal menulis ${tag}=true: ${JSON.stringify(onResult.results.filter((r) => !r.success))}`;
        }
    } catch (err) {
        errorMsg = `Exception saat menulis ${tag}=true: ${err.message}`;
        // wroteOn tetap false — tetap masuk blok retry OFF di bawah
    }

    // ── Langkah 2: Tahan selama holdMs (hanya kalau ON berhasil) ──────────────
    if (wroteOn) {
        await new Promise((resolve) => setTimeout(resolve, holdMs));
    }

    // ── Langkah 3: SELALU coba tulis false, max 3x, jeda 500 ms antar percobaan ─
    const MAX_OFF_ATTEMPTS = 3;
    const OFF_RETRY_DELAY  = 500; // ms

    for (let attempt = 1; attempt <= MAX_OFF_ATTEMPTS; attempt++) {
        try {
            const offResult = await writePlcTags([{ tag, value: false }]);
            if (offResult.ok) {
                wroteOff = true;
                break; // berhasil, tidak perlu retry
            }
            // Gateway menjawab tapi write gagal — coba lagi kalau masih ada sisa
            if (attempt < MAX_OFF_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, OFF_RETRY_DELAY));
            }
        } catch (_offErr) {
            // Exception (timeout, jaringan, dll) — coba lagi
            if (attempt < MAX_OFF_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, OFF_RETRY_DELAY));
            }
        }
    }

    // ── Evaluasi stuckRisk ────────────────────────────────────────────────────
    // stuckRisk = true kalau ada kemungkinan tag sudah aktif tapi tidak berhasil dimatikan.
    // Juga mencakup kasus errorMsg !== null karena status tulis ON tidak pasti.
    const stuckRisk = !wroteOff && (wroteOn || errorMsg !== null);

    if (stuckRisk) {
        console.error(
            `[plcWrite] ⚠ STUCK RISK: Tag "${tag}" kemungkinan TERTAHAN AKTIF di PLC! ` +
            `wroteOn=${wroteOn}, wroteOff=${wroteOff}. ` +
            `PERLU DICEK MANUAL DI LAPANGAN — tulis ${tag}=false lewat KEPServerEX atau panel operator.`
        );
    }

    return {
        ok: wroteOn && wroteOff,
        wroteOn,
        wroteOff,
        stuckRisk,
        error: errorMsg,
    };
}
