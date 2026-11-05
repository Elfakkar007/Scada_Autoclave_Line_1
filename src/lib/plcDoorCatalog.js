// ==============================================================================
// Katalog Door Operate (layar "Front Door Operate" di HMI). Hanya import dari modul
// murni lain: aman di klien maupun server.
//
// Logika PLC (jaringan idle M3.0 di SBR0, export_atv.awl) yang menjadi dasar pagar di bawah:
//  - SEMUA perintah pintu hanya berefek saat mesin idle (M3.0). Fase boleh = 0 dan 1.
//  - Door Sealing M1.2 : `S Q0.5` bila I0.2 ∧ I0.3 ∧ M1.2, dibaca sebagai LEVEL tiap scan.
//      Bila M1.2 tertahan 1, seal disegel ulang tiap scan dan Door Release tidak berguna
//      (S dieksekusi sesudah R). Maka Sealing ditulis sebagai PULSA dan Release hanya
//      boleh saat M1.2 = 0.
//  - Door Release M1.3 : melepas seal (R Q0.5) bila (P1 <= VW222 ∨ M6.0). Di fase END (6)
//      M1.3 juga berarti "kembali ke idle" (SBR6), jadi web hanya mengizinkannya di fase 0/1;
//      dari fase END, Reset dulu di Dashboard.
//  - Door Unlock M6.0 (DOOR_LOCK) : bypass syarat tekanan pada pelepasan seal dan bypass
//      syarat suhu/pintu-lawan pada pembukaan pintu. Pagar web: P1 <= Safety Press.
//  - Water Drain M2.5 : Q1.4 = M2.5 ∧ ¬Q0.5 ∧ ¬I0.2 ∧ ¬I0.3 (seal lepas, kedua pintu TIDAK tertutup).
//      Bit yang sama dipakai perintah drain di mode manual (SBR9), jadi saat M5.0 aktif
//      halaman ini menolak (dua penulis ke bit yang sama).
//  - Rantai M11.0 maju / M11.1 mundur : dibaca sebagai LEVEL.
//      Q3.4 maju  = (I1.7 ∨ M11.0) ∧ ¬I2.0 ∧ ¬Q0.5 ∧ ¬I0.3 ∧ ¬Q3.5
//      Q3.5 mundur = (I2.0 ∨ M11.1) ∧ ¬I1.7 ∧ ¬Q0.5 ∧ ¬I0.2 ∧ ¬Q3.4
// ==============================================================================

import { MANUAL_MODE_TAG } from "./plcManualCatalog.js";

// Fase VW98 saat perintah pintu boleh dinyalakan: 0 idle (pintu belum tertutup), 1 siap.
export const IDLE_PHASES_DOOR = [0, 1];

// Waktu (ms). RELEASE_PULSE_MS adalah tebakan [BELUM] durasi tahan tombol di HMI;
// ubah di sini setelah dites di mesin.
export const SEAL_PULSE_MS = 1500;
export const RELEASE_PULSE_MS = 3000;
export const DEADMAN_TIMEOUT_MS = 1000; // rantai mati sendiri bila tak ada sinyal "tahan" selama ini
export const AUTO_OFF_MS = 60_000;      // Water Drain dan Door Unlock mati sendiri

// Tag perintah (nama persis di KEPServerEX)
export const DOOR_CMD_TAGS = {
    seal: "DOOR_SEAL_CMD",   // M1.2  (BARU, lihat SiemensS7-200_pintu_NANTI.csv)
    release: "DOOR_RELEASE", // M1.3  (ada)
    fwd: "CHAIN_FWD",        // M11.0 (BARU)
    bwd: "CHAIN_BWD",        // M11.1 (BARU)
    drain: "MAN_WTR_DRAIN",  // M2.5  (dari CSV manual)
    unlock: "DOOR_LOCK",     // M6.0  (ada)
};

// Tag yang WAJIB ada. Tanpa salah satunya semua perintah ON ditolak (fail-closed).
export const REQUIRED_TAGS = [
    ...Object.values(DOOR_CMD_TAGS),
    MANUAL_MODE_TAG,
    "PROCCES_TEXT", "CLS_FRNT", "CLS_REAR", "DOOR_SEAL", "P1", "SAFETY_PRESS",
];
// Tag tambahan hanya untuk tampilan; boleh belum ada.
export const OPTIONAL_TAGS = [
    "OPN_FRNT", "OPN_REAR", "WATR_INDICATOR",
    "CHAIN_FWD_OUT", "CHAIN_BWD_OUT", "DOOR_REL_OUT", "WTR_DRAIN",
];
export const ALL_STATE_TAGS = [...REQUIRED_TAGS, ...OPTIONAL_TAGS];

const toBool = (v) => (v === null || v === undefined ? null : !!v);
const toNum = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Ubah nilai mentah hasil readPlcRaw menjadi keadaan pintu. Nilai tak terbaca = null.
 * @param {Record<string, any>} values
 * @param {string[]} bad  nama tag yang gagal dibaca
 */
export function buildDoorState(values, bad = []) {
    const v = values ?? {};
    return {
        phase: toNum(v.PROCCES_TEXT),
        manualMode: toBool(v[MANUAL_MODE_TAG]),
        doors: {
            clsFrnt: toBool(v.CLS_FRNT), opnFrnt: toBool(v.OPN_FRNT),
            clsRear: toBool(v.CLS_REAR), opnRear: toBool(v.OPN_REAR),
            seal: toBool(v.DOOR_SEAL),
        },
        waterLevel: toBool(v.WATR_INDICATOR),
        p1: toNum(v.P1),
        safetyPress: toNum(v.SAFETY_PRESS),
        commands: {
            seal: toBool(v[DOOR_CMD_TAGS.seal]),
            release: toBool(v[DOOR_CMD_TAGS.release]),
            fwd: toBool(v[DOOR_CMD_TAGS.fwd]),
            bwd: toBool(v[DOOR_CMD_TAGS.bwd]),
            drain: toBool(v[DOOR_CMD_TAGS.drain]),
            unlock: toBool(v[DOOR_CMD_TAGS.unlock]),
        },
        outputs: {
            fwd: toBool(v.CHAIN_FWD_OUT), bwd: toBool(v.CHAIN_BWD_OUT),
            release: toBool(v.DOOR_REL_OUT), drain: toBool(v.WTR_DRAIN),
        },
        missingTags: REQUIRED_TAGS.filter((t) => bad.includes(t)),
    };
}

/** P1 dan Safety Press harus terbaca dan P1 <= Safety Press. Tak terbaca = tidak aman. */
export function pressureSafe(state) {
    return state?.p1 !== null && state?.p1 !== undefined
        && state?.safetyPress !== null && state?.safetyPress !== undefined
        && state.p1 <= state.safetyPress;
}

/**
 * Pagar web untuk MENYALAKAN satu perintah (fail-closed: nilai null = tolak).
 * Mematikan perintah (OFF/stop) tidak pernah lewat sini dan tidak pernah ditolak.
 *
 * @param {"seal"|"release"|"drain"|"unlock"|"fwd"|"bwd"} action
 * @param {ReturnType<typeof buildDoorState>} state
 * @returns {string|null} pesan penolakan, atau null bila boleh
 */
export function checkDoorCommand(action, state) {
    if (!state) return "Keadaan mesin tidak terbaca.";
    if (state.missingTags?.length) {
        return `Tag belum ada di KEPServerEX: ${state.missingTags.join(", ")}. Impor CSV tag pintu dan manual dulu.`;
    }
    if (state.phase === null || state.phase === undefined) return "Fase mesin tidak terbaca dari PLC.";
    if (!IDLE_PHASES_DOOR.includes(state.phase)) {
        return "Perintah pintu hanya saat mesin idle. Bila siklus sudah END, tekan Reset di Dashboard dulu.";
    }
    if (state.manualMode !== false) {
        return "Mode manual aktif atau tidak terbaca. Keluar dari mode manual dulu (bit perintah dipakai bersama).";
    }

    const d = state.doors ?? {};
    const c = state.commands ?? {};

    switch (action) {
        case "seal":
            if (d.clsFrnt !== true || d.clsRear !== true) return "Door Sealing butuh pintu depan dan belakang tertutup.";
            if (d.seal !== false) return "Seal pintu sudah aktif.";
            if (c.release !== false) return "Door Release sedang aktif; tunggu selesai.";
            if (c.fwd !== false || c.bwd !== false) return "Rantai sedang bergerak. Hentikan dulu.";
            return null;
        case "release": {
            // Door Release dibebaskan dari syarat "pintu harus tertutup" dan "seal harus aktif":
            // - Bila pintu terbuka (atau fase 0), tekanan chamber dijamin aman (atmosfir/minus) sehingga selalu boleh ditekan.
            // - Bila kedua pintu tertutup (atau fase 1), pastikan tekanan chamber aman (P1 <= Safety Press) sebelum melepas seal.
            const isClosed = (d.clsFrnt === true && d.clsRear === true) || state.phase === 1;
            if (isClosed && !pressureSafe(state)) {
                return "Tekanan chamber (P1) melebihi Safety Press atau tidak terbaca. Door Release ditolak.";
            }
            if (c.seal !== false) return "Perintah Door Sealing masih aktif; tunggu selesai.";
            return null;
        }
        case "drain":
            if (d.seal !== false) return "Water Drain butuh seal pintu sudah lepas.";
            if (d.clsFrnt !== false || d.clsRear !== false) return "Water Drain hanya bila kedua pintu tidak tertutup.";
            return null;
        case "unlock":
            if (!pressureSafe(state)) {
                return "Tekanan chamber (P1) melebihi Safety Press atau tidak terbaca. Door Unlock ditolak.";
            }
            return null;
        case "fwd":
            if (d.seal !== false) return "Rantai butuh seal pintu sudah lepas.";
            if (d.clsRear !== false) return "Rantai maju diblokir: pintu belakang tertutup.";
            if (c.bwd !== false) return "Arah mundur sedang aktif.";
            return null;
        case "bwd":
            if (d.seal !== false) return "Rantai butuh seal pintu sudah lepas.";
            if (d.clsFrnt !== false) return "Rantai mundur diblokir: pintu depan tertutup.";
            if (c.fwd !== false) return "Arah maju sedang aktif.";
            return null;
        default:
            return "Perintah tidak dikenal";
    }
}
