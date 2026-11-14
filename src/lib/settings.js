/**
 * src/lib/settings.js — Helper pembacaan dan pembaruan tabel system_settings.
 *
 * ATURAN IMPORT:
 * File ini WAJIB menggunakan import relatif dengan ekstensi .js (mis. "./db.js")
 * karena ikut dimuat oleh trendRecorder.js di custom server.
 */

import pool from "./db.js";

// Cache in-memory dengan TTL pendek (10 detik) untuk efisiensi
let cachedSettings = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 10_000;

/**
 * Ambil semua data konfigurasi sistem dalam bentuk map key -> { value, label, category, description, updatedAt, updatedBy }.
 * @param {boolean} forceRefresh - jika true, lewati cache dan baca langsung dari database
 */
export async function getAllSettings(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedSettings && now < cacheExpiry) {
        return cachedSettings;
    }

    try {
        const res = await pool.query(
            `SELECT key, value, label, category, description, updated_at, updated_by
             FROM system_settings
             ORDER BY category, key`
        );

        const map = {};
        for (const row of res.rows) {
            map[row.key] = {
                value: row.value,
                label: row.label,
                category: row.category,
                description: row.description,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by,
            };
        }

        cachedSettings = map;
        cacheExpiry = now + CACHE_TTL_MS;
        return map;
    } catch (err) {
        console.error("[settings] Gagal mengambil konfigurasi dari database:", err.message);
        if (cachedSettings) return cachedSettings;
        return {};
    }
}

/**
 * Ambil satu nilai setting berdasarkan key.
 * @param {string} key
 * @param {any} defaultValue
 */
export async function getSetting(key, defaultValue = null) {
    const all = await getAllSettings();
    if (all[key] !== undefined && all[key].value !== undefined) {
        return all[key].value;
    }
    return defaultValue;
}

/**
 * Hapus cache konfigurasi agar pembacaan berikutnya langsung menyentuh DB.
 */
export function invalidateSettingsCache() {
    cachedSettings = null;
    cacheExpiry = 0;
}
