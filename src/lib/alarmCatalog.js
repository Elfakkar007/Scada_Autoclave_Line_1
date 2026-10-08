/**
 * src/lib/alarmCatalog.js — Katalog alarm grup "fault" (data murni, tanpa import).
 *
 * Dipakai oleh alarmMonitor.js (isi kolom alarm_log) dan route /api/alarms/active (teks popup).
 *
 * !! TEKS = DRAF. "cause" disusun dari logika program PLC (export_atv.awl, SBR12).
 * "action" adalah saran konservatif dari logika interlock, BUKAN prosedur resmi.
 * Semua entri bertanda confirmed:false sampai teknisi/QA mengoreksi dan mengubahnya
 * menjadi true. Popup menampilkan tanda "draf" selama confirmed:false.
 *
 * kind:
 *   "bit"      -> alarm_value "1", recovery_value "0", limit_value "1" (format sama dengan SCADA lama: 1.0/0.0/1.0)
 *   "measured" -> alarm_value = nilai ukur saat onset, limit_value = ambang, recovery_value kosong
 */

export const ALARM_CATALOG = {
    m8_0: {
        tag: "ALM_M8_0",
        kind: "measured",
        alarmType: "Buka pintu saat tekanan tinggi",
        title: "Pintu dicoba dibuka saat tekanan masih tinggi",
        cause:
            "Tombol buka pintu atau release ditekan saat tekanan chamber masih di atas batas aman (SAFETY_PRESS).",
        action:
            "Jangan memaksa membuka pintu. Tunggu tekanan chamber turun di bawah batas aman, lalu coba lagi.",
        confirmed: false,
    },
    m8_1: {
        tag: "ALM_M8_1",
        kind: "bit",
        alarmType: "START: kedua pintu belum tertutup",
        title: "START ditolak: pintu depan dan belakang belum tertutup",
        cause:
            "START ditekan padahal sensor pintu depan dan pintu belakang sama-sama tidak mendeteksi pintu tertutup.",
        action: "Tutup kedua pintu sampai terdeteksi tertutup, lalu tekan START lagi.",
        confirmed: false,
    },
    m8_2: {
        tag: "ALM_M8_2",
        kind: "bit",
        alarmType: "START: seal pintu belum aktif",
        title: "START ditolak: seal pintu belum aktif",
        cause: "START ditekan padahal output seal pintu (Q0.5) tidak aktif.",
        action:
            "Pastikan pintu tertutup rapat dan seal aktif, lalu coba START lagi. Bila seal tidak mau aktif, hubungi teknisi.",
        confirmed: false,
    },
    m10_2: {
        tag: "ALM_M10_2",
        kind: "measured",
        alarmType: "Suhu steril di bawah setpoint",
        title: "Suhu sterilisasi di bawah setpoint",
        cause:
            "Pada fase sterilisasi, minimal satu sensor (T1–T6 atau TM) turun di bawah suhu sterilisasi (STER_SET).",
        action:
            "Periksa suplai steam dan kondisi mesin. Keputusan melanjutkan atau menghentikan proses mengikuti SOP/QA.",
        confirmed: false,
    },
    m10_3: {
        tag: "ALM_M10_3",
        kind: "measured",
        alarmType: "Suhu steril melewati batas atas",
        title: "Suhu sterilisasi melewati batas atas",
        cause:
            "Pada fase sterilisasi, minimal satu sensor (T1–T6 atau TM) melewati batas suhu atas (OVER_TEMP).",
        action:
            "Periksa sumber steam dan kontrol suhu, lalu ikuti SOP untuk kondisi suhu berlebih.",
        confirmed: false,
    },
};

// Urutan tetap; harus sama dengan FAULT_BITS di plc.js.
export const FAULT_KEYS = Object.keys(ALARM_CATALOG);
