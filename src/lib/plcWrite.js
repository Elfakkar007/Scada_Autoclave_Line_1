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

    // Cek apakah semua item berhasil
    const failures = writeResults.filter((item) => item.s !== true);
    const ok = failures.length === 0;

    if (!ok) {
        console.warn(
            "[plcWrite] Sebagian tag gagal ditulis:",
            failures.map((f) => f.id)
        );
    }

    return {
        ok,
        results: writeResults.map((item) => ({
            id:      item.id,
            tag:     item.id?.replace(DEVICE_PREFIX, "") ?? item.id,
            success: item.s === true,
            // Sertakan error message dari gateway kalau ada
            error:   item.s !== true ? (item.r ?? "Unknown error") : undefined,
        })),
    };
}
