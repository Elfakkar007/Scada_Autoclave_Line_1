/**
 * src/lib/plcCommandAlert.js — teks peringatan hasil perintah STOP / reset (item 10).
 *
 * Fungsi murni (tanpa React, tanpa fetch) supaya bisa dites dengan `node --test`.
 * Dipakai dashboard (`(app)/page.js`) dan halaman Prepare (`(app)/prepare/page.js`) untuk
 * menampilkan hasil perintah ke PLC yang TIDAK berjalan mulus, terutama:
 *   - STOP tidak sampai ke mesin, atau
 *   - STOP / reset / START mungkin tertahan aktif di PLC (stuckRisk, lihat plcWrite.js),
 *   - START yang hasilnya tidak diketahui atau gagal dicatat di database (item 10).
 *
 * Bentuk keluaran: { level: "error" | "warn", title: string, lines: string[] }
 * atau null bila tidak ada yang perlu diperingatkan.
 *
 * Teks hanya memakai flag dari server (plcStopWritten, plcStuckRisk, plcPulse, pulse),
 * TIDAK pernah menampilkan error.message mentah.
 */

const PHYSICAL_STOP =
    "Bila mesin harus berhenti sekarang, tekan tombol STOP fisik di panel mesin.";

const RELEASE_STOP =
    "Segera tulis STOP = false lewat KEPServerEX (Quick Client) atau panel operator, lalu pastikan nilainya 0.";

/**
 * Hasil POST /api/batch/stop.
 *
 * @param {object} p
 * @param {boolean} [p.networkError] fetch sendiri gagal (server web tidak terjangkau)
 * @param {number}  [p.status]       HTTP status (0 bila tidak ada)
 * @param {object|null} [p.json]     body JSON, atau null bila bukan JSON valid
 */
export function describeStopResponse({ networkError = false, status = 0, json = null } = {}) {
    if (networkError) {
        return {
            level: "error",
            title: "Perintah STOP tidak terkirim",
            lines: ["Server web tidak dapat dijangkau, jadi STOP tidak diproses.", PHYSICAL_STOP],
        };
    }

    // Respons bukan JSON (mis. sesi berakhir lalu dialihkan ke halaman login) atau ok != true.
    if (!json || json.ok !== true) {
        const invalid = !json;
        const text = invalid
            ? "Respons server tidak valid (sesi login mungkin berakhir). Muat ulang halaman."
            : (typeof json.error === "string" && json.error ? json.error : "STOP ditolak server.");
        const serious = invalid || status === 401 || status >= 500;
        if (!serious) {
            // 400/409: penolakan biasa (mis. tidak ada batch berjalan), bukan bahaya.
            return { level: "warn", title: "STOP ditolak", lines: [text] };
        }
        return {
            level: "error",
            title: "STOP gagal diproses",
            lines: [text, "Perintah STOP belum tentu sampai ke mesin.", PHYSICAL_STOP],
        };
    }

    // ok = true: batch sudah ditutup di sistem. Yang diperiksa: nasib pulsa STOP di PLC.
    if (json.plcStuckRisk === true) {
        const reached = json.plcPulse?.wroteOn === true;
        return {
            level: "error",
            title: "STOP mungkin tertahan aktif di PLC",
            lines: [
                reached
                    ? "Perintah STOP sampai ke PLC, tetapi pelepasannya (ON lalu OFF) tidak terkonfirmasi."
                    : "Status perintah STOP tidak pasti: tidak terkonfirmasi sampai ke PLC dan pelepasannya gagal.",
                "STOP yang tertahan ON menahan mesin di Idle.",
                RELEASE_STOP,
                "Batch sudah ditutup di sistem.",
            ],
        };
    }

    if (json.plcStopWritten !== true) {
        return {
            level: "error",
            title: "STOP TIDAK sampai ke mesin",
            lines: [
                "Batch sudah ditutup di sistem, tetapi perintah STOP gagal ditulis ke PLC. Mesin kemungkinan masih berjalan.",
                PHYSICAL_STOP,
                "Periksa koneksi PLC dan KEPServerEX.",
            ],
        };
    }

    return null;
}

/**
 * Hasil POST /api/plc/reset yang gagal karena PULSA (bukan karena guard 409/503).
 * Mengembalikan null bila respons bukan kegagalan pulsa; pemanggil lalu memakai
 * json.error biasa.
 *
 * @param {object|null} json
 */
export function describeResetPulse(json) {
    const pulse = json?.pulse;
    if (!pulse || json.ok !== false) return null;

    if (pulse.stuckRisk === true) {
        return {
            level: "error",
            title: "Reset: STOP mungkin tertahan aktif di PLC",
            lines: [
                pulse.wroteOn === true
                    ? "Perintah STOP sampai ke PLC, tetapi pelepasannya (ON lalu OFF) tidak terkonfirmasi."
                    : "Status perintah STOP tidak pasti: tidak terkonfirmasi sampai ke PLC dan pelepasannya gagal.",
                "STOP yang tertahan ON menahan mesin di Idle.",
                RELEASE_STOP,
            ],
        };
    }

    return {
        level: "error",
        title: "Reset gagal: STOP tidak sampai ke mesin",
        lines: [
            "Perintah STOP gagal ditulis ke PLC. Mesin masih berstatus Selesai.",
            "Periksa koneksi PLC dan KEPServerEX, lalu coba lagi.",
        ],
    };
}

const RELEASE_START =
    "Setelah mesin aman, tulis START = false lewat KEPServerEX (Quick Client) atau panel operator, lalu pastikan nilainya 0.";

/**
 * Hasil POST /api/batch/start (halaman Prepare).
 *
 * Mengembalikan { outcome, alert, dismissable }:
 *   outcome "started"        : START bersih -> halaman boleh langsung ke dashboard; alert null.
 *   outcome "rejected"       : START ditolak sebelum/tanpa menjalankan mesin (validasi, guard,
 *                              setpoint, PLC tidak mulai). alert null -> pakai banner error biasa
 *                              (json.error dan invalidFields).
 *   outcome "started_warn"   : batch tercatat dan mesin jalan, tetapi START mungkin tertahan ON.
 *   outcome "critical"       : mesin sudah jalan tetapi batch GAGAL dicatat di database.
 *   outcome "rejected_stuck" : PLC tidak masuk fase proses, tetapi tag START mungkin tertahan ON.
 *   outcome "unknown"        : hasil tidak diketahui (koneksi putus / respons bukan JSON).
 *
 * dismissable = true bila operator boleh menutup peringatan dan mencoba lagi di halaman ini.
 */
export function describeStartResponse({ networkError = false, json = null } = {}) {
    if (networkError || !json) {
        return {
            outcome: "unknown",
            dismissable: true,
            alert: {
                level: "warn",
                title: "Hasil START tidak diketahui",
                lines: [
                    networkError
                        ? "Koneksi ke server terputus sebelum jawaban diterima."
                        : "Respons server tidak valid (sesi login mungkin berakhir).",
                    "Mesin mungkin sudah mulai berjalan. Buka Dashboard dan periksa status mesin sebelum mencoba START lagi.",
                ],
            },
        };
    }

    if (json.ok === true) {
        const risky = json.stuckRisk === true || (typeof json.warning === "string" && json.warning !== "");
        if (!risky) return { outcome: "started", dismissable: false, alert: null };
        return {
            outcome: "started_warn",
            dismissable: false,
            alert: {
                level: "error",
                title: "Batch dimulai, tetapi START mungkin tertahan aktif di PLC",
                lines: [
                    "Batch tercatat dan mesin sudah masuk fase proses.",
                    "START yang tertahan ON dapat memicu siklus baru dengan sendirinya.",
                    "Pantau mesin selama proses berjalan.",
                    RELEASE_START,
                ],
            },
        };
    }

    if (json.critical === true) {
        return {
            outcome: "critical",
            dismissable: false,
            alert: {
                level: "error",
                title: "PLC sudah berjalan, tetapi batch GAGAL dicatat",
                lines: [
                    typeof json.error === "string" && json.error
                        ? json.error
                        : "PLC sudah mulai berjalan, tetapi batch gagal dicatat di database.",
                    "Tombol STOP di dashboard tidak akan berfungsi karena tidak ada batch aktif di database. Bila mesin harus dihentikan, tekan tombol STOP fisik di panel mesin.",
                    "Catat data proses secara manual dan hubungi admin. Jangan menekan START lagi.",
                ],
            },
        };
    }

    if (json.stuckRisk === true) {
        return {
            outcome: "rejected_stuck",
            dismissable: true,
            alert: {
                level: "error",
                title: "START tidak dimulai, tetapi tag START mungkin tertahan aktif",
                lines: [
                    "PLC tidak masuk fase proses setelah START dikirim.",
                    "START yang tertahan ON dapat menjalankan mesin sendiri nanti, tanpa batch di sistem.",
                    RELEASE_START,
                    "Setelah itu periksa pintu, seal, dan input pengaman sebelum mencoba lagi.",
                ],
            },
        };
    }

    return { outcome: "rejected", dismissable: false, alert: null };
}   