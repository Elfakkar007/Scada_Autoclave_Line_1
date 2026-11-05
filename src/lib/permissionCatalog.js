// ==============================================================================
// Katalog izin — AMAN dipakai di server maupun komponen "use client"
// (tidak meng-import pg/db). Sumber kebenaran daftar resource dan level yang sah.
// Isi seed di database harus sejalan dengan katalog ini (lihat 002_role_management.sql).
//
// Level: none (tersembunyi/ditolak) < view (lihat) < edit (lihat + ubah)
// Resource "action.*" adalah KUNCI AKSI KRITIS: hanya none atau edit.
// Tidak ada baris izin untuk sebuah resource = none (default tolak).
// ==============================================================================

export const LEVELS = ["none", "view", "edit"];
const RANK = { none: 0, view: 1, edit: 2 };

export const LEVEL_LABELS = {
    none: "Tersembunyi",
    view: "Lihat",
    edit: "Lihat & ubah",
};

const PAGE = ["none", "view", "edit"];
const ACTION = ["none", "edit"];

export const RESOURCES = [
    // ── Halaman ──────────────────────────────────────────────────────────────
    { key: "dashboard",      group: "page", label: "Dashboard (START/STOP/Reset)", levels: PAGE },
    { key: "trend",          group: "page", label: "Trend",                        levels: PAGE },
    { key: "data_report",    group: "page", label: "Data Report",                  levels: PAGE },
    { key: "alarm",          group: "page", label: "Alarm",                        levels: PAGE },
    { key: "formula",        group: "page", label: "Formula (resep)",              levels: PAGE },
    { key: "products",       group: "page", label: "Produk dan spesifikasi",       levels: PAGE },
    { key: "audit_log",      group: "page", label: "Audit Log (lihat + ekspor)",   levels: ["none", "view"] },
    { key: "users",          group: "page", label: "Kelola User",                  levels: PAGE },
    { key: "roles",          group: "page", label: "Role Management",              levels: PAGE },
    { key: "calibration",    group: "page", label: "Kalibrasi",                    levels: PAGE },
    { key: "machine_params", group: "page", label: "Parameter Mesin",              levels: PAGE },
    { key: "plc_clock",      group: "page", label: "Pengaturan jam PLC",           levels: PAGE },
    { key: "manual_control", group: "page", label: "Kontrol manual",               levels: PAGE },
    { key: "backup",         group: "page", label: "Backup data (buat, jadwal, unduh)", levels: PAGE },
    // ── Kunci aksi kritis ────────────────────────────────────────────────────
    { key: "action.batch_control",       group: "action", label: "START / STOP batch",                    levels: ACTION },
    { key: "action.write_calibration",   group: "action", label: "Tulis offset kalibrasi ke PLC",         levels: ACTION },
    { key: "action.write_safety_params", group: "action", label: "Tulis Safety Press & Alarm Press",      levels: ACTION },
];

const BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));

export function getResource(key) {
    return BY_KEY.get(key) ?? null;
}

export function isKnownResource(key) {
    return BY_KEY.has(key);
}

export function isValidLevel(level) {
    return Object.prototype.hasOwnProperty.call(RANK, level);
}

/** Apakah level ini sah untuk resource tsb (mis. audit_log tidak punya edit). */
export function isLevelAllowed(resourceKey, level) {
    const r = BY_KEY.get(resourceKey);
    return !!r && r.levels.includes(level);
}

/**
 * Cek izin. perms = { resource: level }. Resource tak dikenal / tak ada baris = tolak.
 * Resource "action.*" hanya dianggap lolos bila levelnya "edit".
 */
export function hasLevel(perms, resourceKey, minLevel = "view") {
    if (!perms || !isKnownResource(resourceKey) || !isValidLevel(minLevel)) return false;
    const have = perms[resourceKey];
    if (!isValidLevel(have)) return false;
    return RANK[have] >= RANK[minLevel];
}

/** Peta lengkap semua resource katalog; yang tak ada → "none". Buang kunci asing. */
export function normalizePermissions(perms) {
    const out = {};
    for (const r of RESOURCES) {
        const v = perms?.[r.key];
        out[r.key] = isValidLevel(v) && r.levels.includes(v) ? v : "none";
    }
    return out;
}
