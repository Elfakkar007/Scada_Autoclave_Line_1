// ==============================================================================
// Katalog kontrol manual (SBR9 di export_atv.awl). Tanpa import: aman di klien dan server.
//
// Cara kerja PLC (terbukti dari kode, bukan dugaan):
//  - Saat M5.0 (MANUAL_OPER) = 1, SBR9 dipanggil TANPA syarat fase mesin. PLC sendiri
//    TIDAK menolak perintah manual ketika siklus sedang berjalan. Pagar itu harus ada di web.
//  - Tiap bit perintah (M2.x / M4.0) langsung menggerakkan output Qx.x terkait.
//  - Keluar mode manual = TEPI TURUN M5.0 → PLC mereset semua output proses dan kembali idle.
//  - Tombol STOP (M1.5) mereset output sesaat, tetapi M5.0 dan bit M2.x tetap 1, sehingga
//    SBR9 menyalakannya lagi di scan berikutnya. STOP BUKAN cara keluar dari mode manual.
//  - Isi air (M4.0 → Q2.0) diblokir PLC bila indikator level air I0.0 aktif.
//  - Pompa (Q3.0) butuh timer T160 (I2.5 aktif 5 dtk) dan I1.1 tidak aktif; keduanya tidak
//    terbaca web, jadi lihat kolom "Output aktual" untuk tahu pompa benar-benar menyala.
// ==============================================================================

export const MANUAL_MODE_TAG = "MANUAL_OPER"; // M5.0

// Fase VW98 saat kontrol manual boleh dimulai: 0 idle (pintu belum tertutup), 1 siap.
export const IDLE_PHASES_MANUAL = [0, 1];

export const MANUAL_ITEMS = [
    { key: "steam1",   cmdTag: "MAN_STEAM_1",    outTag: "STEAM_1",    label: "Steam Valve 1 (SV1)",   family: "steam" },
    { key: "steam2",   cmdTag: "MAN_STEAM_2",    outTag: "STEAM_2",    label: "Steam Valve 2 (SV2)",   family: "steam" },
    { key: "cooling1", cmdTag: "MAN_COOLING_1",  outTag: "COOLING_1",  label: "Cooling Water 1 (CWV1)", family: "cooling" },
    { key: "cooling2", cmdTag: "MAN_COOLING_2",  outTag: "COOLING_2",  label: "Cooling Water 2 (CWV2)", family: "cooling" },
    { key: "airChamber", cmdTag: "MAN_AIR_CMBR", outTag: "AIR_CMBR",   label: "Udara ke chamber",      family: null },
    { key: "drain",    cmdTag: "MAN_WTR_DRAIN",  outTag: "WTR_DRAIN",  label: "Buang air (DPWV)",      family: null },
    { key: "exhaust",  cmdTag: "MAN_STEAM_EXHS", outTag: "STEAM_EXHS", label: "Steam exhaust (SDFC)",  family: null },
    { key: "fill",     cmdTag: "MAN_WTR_FILL",   outTag: "WTR_FILL",   label: "Isi air murni (PWCV)",  family: null,
      note: "Diblokir PLC bila indikator level air (I0.0) aktif." },
    { key: "pump",     cmdTag: "MAN_WTR_PUMP",   outTag: "WTR_PUMP",   label: "Pompa air",             family: null,
      note: "PLC baru menyalakan pompa bila syarat I1.1 dan timer T160 terpenuhi. Cek output aktual." },
    { key: "buzzer",   cmdTag: "MAN_BUZZER",     outTag: null,         label: "Buzzer",                family: null,
      note: "Bit M10.6; pemetaan ke tombol HMI belum diverifikasi." },
];

export const MANUAL_COMMAND_TAGS = MANUAL_ITEMS.map((i) => i.cmdTag);

export function getManualItem(key) {
    return MANUAL_ITEMS.find((i) => i.key === key) ?? null;
}

/**
 * Pagar web untuk MENYALAKAN satu perintah. Mematikan perintah tidak pernah ditolak.
 * state = { doors: {clsFrnt, clsRear, seal}, commands: {key: bool|null} }
 * @returns {string|null} pesan penolakan, atau null bila boleh
 */
export function checkManualCommand(key, value, state) {
    if (value !== true) return null;
    const item = getManualItem(key);
    if (!item) return "Perintah tidak dikenal";

    if (item.family === "steam") {
        const d = state?.doors ?? {};
        if (d.clsFrnt !== true || d.clsRear !== true || d.seal !== true) {
            return "Katup steam hanya boleh dibuka saat pintu depan dan belakang tertutup dan seal pintu aktif.";
        }
        const coolingOn = MANUAL_ITEMS.some((i) => i.family === "cooling" && state?.commands?.[i.key] === true);
        if (coolingOn) return "Matikan katup cooling dulu sebelum membuka katup steam.";
    }
    if (item.family === "cooling") {
        const steamOn = MANUAL_ITEMS.some((i) => i.family === "steam" && state?.commands?.[i.key] === true);
        if (steamOn) return "Matikan katup steam dulu sebelum membuka katup cooling.";
    }
    return null;
}
