// =============================================================================
// hmiOverrideCatalog.js — Katalog & evaluasi izin HMI override per user
// AMAN dipakai di server maupun komponen "use client" (tidak meng-import pg/db).
//
// Konsep:
//   - Setiap halaman HMI bisa dalam mode "default" atau "custom" per user.
//   - Mode "default" → ikuti RBAC role 100%, kolom hmi_overrides diabaikan.
//   - Mode "custom"  → izin item mengikuti field `items` di override.
//     Item yang tidak ada di `items` → fallback ke RBAC role.
//   - Override bisa "mempromosikan" halaman yang tersembunyi (none di RBAC)
//     menjadi visible, selama ada item dengan level "read" atau "write".
//
// Aturan resolusi (resolveHmiPermission):
//   1. Jika override halaman tidak ada / mode = "default" → pakai RBAC.
//   2. Jika mode = "custom" dan itemKey ada di items → pakai level override.
//   3. Jika mode = "custom" tapi itemKey tidak ada di items → pakai RBAC.
//
// Level override item: "none" | "read" | "write"
//   "none"  → item disembunyikan/disabled (lebih ketat dari RBAC)
//   "read"  → boleh lihat tapi tidak boleh ubah
//   "write" → boleh lihat dan ubah (setara "edit" di RBAC)
// =============================================================================

/** Halaman yang mendukung HMI override. */
export const OVERRIDE_PAGES = ["calibration", "machine_params", "manual_control", "door_operate"];

/**
 * Definisi item per halaman yang bisa di-override.
 * Dikelompokkan ke dalam `groups` untuk kemudahan UI konfigurasi.
 * Key item sesuai dengan key di plcParamCatalog, plcManualCatalog, plcDoorCatalog.
 */
export const OVERRIDE_ITEMS = {
    calibration: {
        temp_group: {
            label: "Sensor Suhu (TH — TL)",
            items: [
                { key: "th",  label: "TH (boiler)" },
                { key: "t1",  label: "T1" },
                { key: "t2",  label: "T2" },
                { key: "t3",  label: "T3" },
                { key: "t4",  label: "T4" },
                { key: "t5",  label: "T5" },
                { key: "t6",  label: "T6" },
                { key: "tm",  label: "TM (rata-rata)" },
                { key: "tl",  label: "TL (referensi)" },
            ],
        },
        pressure_group: {
            label: "Sensor Tekanan (P1, P2)",
            items: [
                { key: "p1", label: "P1 (utama)" },
                { key: "p2", label: "P2" },
            ],
        },
        level_group: {
            label: "Level & Konduktivitas (L, Water)",
            items: [
                { key: "l",     label: "L (konduktivitas)" },
                { key: "water", label: "Water (level air)" },
            ],
        },
    },

    machine_params: {
        process_group: {
            label: "Parameter Proses Umum",
            items: [
                { key: "sterTemp",    label: "Ster. Temp" },
                { key: "ctrlTemp",    label: "Control Temp" },
                { key: "tempSpace",   label: "Temp. Space" },
                { key: "sterTime",    label: "Ster. Time" },
                { key: "foValue",     label: "FO Value" },
                { key: "cool1",       label: "Cool. Temp 1" },
                { key: "cool2",       label: "Cool. Temp 2" },
                { key: "regPress",    label: "Regu. Press" },
                { key: "overTemp",    label: "Over. Temp" },
                { key: "drainTime",   label: "Drain Time" },
                { key: "exhaustTemp", label: "Exhau. Temp" },
            ],
        },
        coef_group: {
            label: "Pressure Coefficient",
            items: [
                { key: "a1",       label: "a1" },
                { key: "b1",       label: "b1" },
                { key: "a2",       label: "a2" },
                { key: "b2",       label: "b2" },
                { key: "heatCoef", label: "Heat Coeff" },
                { key: "sterCoef", label: "Ster Coeff" },
                { key: "coolCoef", label: "Cool Coeff" },
            ],
        },
        safety_group: {
            label: "Parameter Keselamatan ⚠️",
            hint: "Memerlukan action.write_safety_params. Override hanya berlaku bila RBAC juga sudah mengizinkan action tersebut.",
            items: [
                { key: "safetyPress", label: "Safety Press. (interlock pintu)" },
                { key: "alarmPress",  label: "Alarm Press." },
                { key: "selPress",    label: "Select Press" },
            ],
        },
    },

    manual_control: {
        steam_group: {
            label: "Katup Steam",
            items: [
                { key: "steam1", label: "Steam Valve 1 (SV1)" },
                { key: "steam2", label: "Steam Valve 2 (SV2)" },
            ],
        },
        cooling_group: {
            label: "Katup Cooling",
            items: [
                { key: "cooling1", label: "Cooling Water 1 (CWV1)" },
                { key: "cooling2", label: "Cooling Water 2 (CWV2)" },
            ],
        },
        drain_exhaust_group: {
            label: "Drain & Exhaust",
            items: [
                { key: "drain",   label: "Buang Air (DPWV)" },
                { key: "exhaust", label: "Steam Exhaust (SDFC)" },
            ],
        },
        water_air_group: {
            label: "Air & Pompa",
            items: [
                { key: "fill",       label: "Isi Air Murni (PWCV)" },
                { key: "airChamber", label: "Udara ke Chamber" },
                { key: "pump",       label: "Pompa Air" },
            ],
        },
        buzzer_group: {
            label: "Buzzer",
            items: [
                { key: "buzzer", label: "Buzzer (M10.6)" },
            ],
        },
    },

    door_operate: {
        basic_group: {
            label: "Operasi Pintu Dasar",
            items: [
                { key: "seal",    label: "Door Sealing (Q0.5)" },
                { key: "release", label: "Door Release (M1.3)" },
            ],
        },
        drain_group: {
            label: "Water Drain",
            items: [
                { key: "drain", label: "Water Drain (M2.5)" },
            ],
        },
        chain_group: {
            label: "Rantai Maju/Mundur ⚠️",
            hint: "Motor rantai fisik. Rantai terus berputar selama bit aktif — pastikan area aman.",
            items: [
                { key: "chain", label: "Rantai Maju/Mundur (M11.0/M11.1)" },
            ],
        },
        unlock_group: {
            label: "Door Unlock (Bypass Interlock) ⚠️",
            hint: "Bypass syarat tekanan pada pelepasan seal. Hanya untuk kondisi darurat.",
            items: [
                { key: "unlock", label: "Door Unlock (M6.0)" },
            ],
        },
    },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Dapatkan semua item key untuk suatu halaman sebagai array datar. */
export function getAllItemKeys(page) {
    const groups = OVERRIDE_ITEMS[page];
    if (!groups) return [];
    return Object.values(groups).flatMap((g) => g.items.map((i) => i.key));
}

/** Dapatkan semua groups untuk suatu halaman sebagai array [groupKey, groupDef]. */
export function getItemGroups(page) {
    const groups = OVERRIDE_ITEMS[page];
    if (!groups) return [];
    return Object.entries(groups);
}

/**
 * Periksa apakah override user membuat halaman ini "visible" (di navbar).
 * Halaman visible bila mode = "custom" dan setidaknya satu item memiliki level "read" atau "write".
 *
 * @param {object|null} hmiOverrides - kolom hmi_overrides dari DB (atau dari /api/auth/me)
 * @param {string} page - salah satu dari OVERRIDE_PAGES
 * @returns {boolean}
 */
export function hasHmiOverrideAccess(hmiOverrides, page) {
    if (!hmiOverrides || !OVERRIDE_PAGES.includes(page)) return false;
    const pageOverride = hmiOverrides[page];
    if (!pageOverride || pageOverride.mode !== "custom") return false;
    const items = pageOverride.items ?? {};
    return Object.values(items).some((level) => level === "read" || level === "write");
}

/**
 * Evaluasi izin satu item HMI untuk user.
 * Menggabungkan RBAC role dan HMI override dengan aturan:
 *   - mode "default" (atau tidak ada override) → ikuti RBAC
 *   - mode "custom" + item ada di `items` → pakai level override
 *   - mode "custom" + item TIDAK ada di `items` → fallback RBAC
 *
 * @param {object|null} hmiOverrides  - hmi_overrides user (dari DB / sesi)
 * @param {object} rolePerms          - { resource: level } dari RBAC (mis. perms dari /api/auth/me)
 * @param {string} page               - "calibration" | "machine_params" | "manual_control" | "door_operate"
 * @param {string|null} [itemKey]     - key item spesifik, atau null untuk level halaman
 * @returns {{ level: "none"|"read"|"write", source: "role"|"override" }}
 */
export function resolveHmiPermission(hmiOverrides, rolePerms, page, itemKey = null) {
    // Hitung level dari RBAC terlebih dahulu
    const roleLevel = getRoleLevelForPage(rolePerms, page);

    // Jika tidak ada override atau mode default → pakai RBAC
    const pageOverride = hmiOverrides?.[page];
    if (!pageOverride || pageOverride.mode !== "custom") {
        return { level: roleLevel, source: "role" };
    }

    // Mode custom: cek item spesifik
    if (itemKey !== null) {
        const itemLevel = pageOverride.items?.[itemKey];
        if (itemLevel !== undefined && itemLevel !== null) {
            // Override eksplisit untuk item ini
            return { level: itemLevel, source: "override" };
        }
        // Item tidak di-override → fallback ke RBAC untuk item ini
        return { level: roleLevel, source: "role" };
    }

    // Tanpa itemKey: kembalikan level halaman yang paling tinggi dari override
    // (dipakai untuk menentukan visibilitas menu navbar)
    const items = pageOverride.items ?? {};
    const hasAnyAccess = Object.values(items).some((l) => l === "read" || l === "write");
    if (!hasAnyAccess && roleLevel === "none") {
        return { level: "none", source: "override" };
    }
    // Gunakan level RBAC jika lebih tinggi, atau "read" minimal jika ada override
    if (roleLevel !== "none") return { level: roleLevel, source: "role" };
    return { level: "read", source: "override" };
}

/**
 * Konversi level RBAC resource ke level HMI override yang setara.
 * RBAC "edit"  → HMI "write"
 * RBAC "view"  → HMI "read"
 * RBAC "none"  → HMI "none"
 *
 * @param {object} rolePerms - { resource: level } dari RBAC
 * @param {string} page      - halaman yang ingin dievaluasi
 * @returns {"none"|"read"|"write"}
 */
function getRoleLevelForPage(rolePerms, page) {
    // Pemetaan page HMI → resource RBAC
    const resourceMap = {
        calibration:    "calibration",
        machine_params: "machine_params",
        manual_control: "manual_control",
        door_operate:   "manual_control", // door_operate menggunakan resource manual_control
    };
    const resource = resourceMap[page];
    if (!resource || !rolePerms) return "none";
    const rbacLevel = rolePerms[resource];
    if (rbacLevel === "edit") return "write";
    if (rbacLevel === "view") return "read";
    return "none";
}

/**
 * Periksa apakah user boleh MENULIS (write) item tertentu.
 * Shortcut dari resolveHmiPermission untuk logika server-side.
 *
 * @returns {boolean}
 */
export function canWriteHmiItem(hmiOverrides, rolePerms, page, itemKey) {
    const { level } = resolveHmiPermission(hmiOverrides, rolePerms, page, itemKey);
    return level === "write";
}

/**
 * Periksa apakah user boleh MEMBACA (read atau write) item tertentu.
 *
 * @returns {boolean}
 */
export function canReadHmiItem(hmiOverrides, rolePerms, page, itemKey) {
    const { level } = resolveHmiPermission(hmiOverrides, rolePerms, page, itemKey);
    return level === "read" || level === "write";
}

/**
 * Validasi objek hmi_overrides sebelum disimpan ke database.
 * Memastikan struktur dan nilai yang valid.
 *
 * @param {any} data - data yang akan divalidasi
 * @returns {{ ok: true, normalized: object } | { ok: false, error: string }}
 */
export function validateHmiOverrides(data) {
    if (data === null || data === undefined) {
        return { ok: true, normalized: null };
    }
    if (typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: "hmi_overrides harus berupa objek" };
    }

    const VALID_ITEM_LEVELS = ["none", "read", "write"];
    const normalized = {};

    for (const [page, pageData] of Object.entries(data)) {
        if (!OVERRIDE_PAGES.includes(page)) {
            return { ok: false, error: `Halaman tidak dikenal: "${page}"` };
        }
        if (!pageData || typeof pageData !== "object") {
            return { ok: false, error: `Data halaman "${page}" harus berupa objek` };
        }
        const { mode, items } = pageData;
        if (mode !== "default" && mode !== "custom") {
            return { ok: false, error: `Mode halaman "${page}" harus "default" atau "custom"` };
        }

        const normalizedItems = {};
        if (mode === "custom" && items) {
            if (typeof items !== "object" || Array.isArray(items)) {
                return { ok: false, error: `items halaman "${page}" harus berupa objek` };
            }
            const validKeys = new Set(getAllItemKeys(page));
            for (const [itemKey, level] of Object.entries(items)) {
                if (!validKeys.has(itemKey)) {
                    return { ok: false, error: `Item tidak dikenal di "${page}": "${itemKey}"` };
                }
                if (!VALID_ITEM_LEVELS.includes(level)) {
                    return { ok: false, error: `Level tidak valid untuk "${page}.${itemKey}": "${level}"` };
                }
                normalizedItems[itemKey] = level;
            }
        }

        normalized[page] = { mode, items: normalizedItems };
    }

    return { ok: true, normalized };
}

