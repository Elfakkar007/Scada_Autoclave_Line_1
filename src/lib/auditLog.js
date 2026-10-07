/**
 * src/lib/auditLog.js — helper penulisan audit_log yang dipakai bersama (item 7).
 *
 * Dua fungsi tulis dengan perilaku BERBEDA saat gagal:
 *   - insertAudit : MELEMPAR error. Dipakai bila audit wajib ada sebelum aksi
 *                   (contoh: sebelum pulsa START).
 *   - tryAudit    : TIDAK melempar; mengembalikan true/false. Dipakai bila aksi
 *                   tidak boleh diblokir oleh kegagalan database
 *                   (contoh: STOP dan reset, yang bersifat keselamatan).
 *
 * Kolom actor_name (nama lengkap) diisi otomatis oleh trigger di database
 * (lihat item7b_migration.sql), jadi tidak perlu dikirim dari sini.
 * Kolom ip_address dan user_agent tidak dipakai (web berjalan di satu PC lokal).
 */

import pool from "./db.js";

function clip(value, max) {
    if (value === null || value === undefined) return null;
    const s = String(value);
    return s.length > max ? s.slice(0, max) : s;
}

/**
 * Tulis satu baris audit_log. MELEMPAR error bila gagal.
 *
 * @param {{query: Function}} db - pool atau client pg
 * @param {object} e
 * @param {string|null} e.actor
 * @param {string|null} e.actorRole
 * @param {string} e.action
 * @param {string} e.entityType
 * @param {string|null} [e.entityId]
 * @param {object|null} [e.oldValue]
 * @param {object|null} [e.newValue]
 * @param {string|null} [e.description]
 */
export async function insertAudit(db, e) {
    await db.query(
        `INSERT INTO audit_log
            (actor, actor_role, action, entity_type, entity_id,
             old_value, new_value, source, description)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'web', $8)`,
        [
            clip(e.actor, 64),
            e.actorRole ?? null,
            e.action,
            e.entityType,
            e.entityId === undefined || e.entityId === null ? null : clip(e.entityId, 200),
            e.oldValue ? JSON.stringify(e.oldValue) : null,
            e.newValue ? JSON.stringify(e.newValue) : null,
            clip(e.description, 2000),
        ]
    );
}

/**
 * Seperti insertAudit tetapi tidak pernah melempar. Mengembalikan true bila tersimpan.
 * Kegagalan dicatat ke console supaya tetap terlihat di log server.
 */
export async function tryAudit(e, label = "audit") {
    try {
        await insertAudit(pool, e);
        return true;
    } catch (err) {
        console.error(`[${label}] Gagal menulis audit_log (${e.action}):`, err.message);
        return false;
    }
}