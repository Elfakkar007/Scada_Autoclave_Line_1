/**
 * src/lib/recipeSnapshot.js — Snapshot resep per batch (item 6).
 *
 * Fungsi murni, TANPA import, supaya aman dimuat dari route handler maupun
 * custom server (CommonJS). Disimpan di batch_records.recipe_snapshot (jsonb).
 *
 * Isi snapshot = nilai resep yang dipakai START (yang ditulis dan diverifikasi
 * ke PLC). Nama field camelCase, sama dengan objek formula di API /api/formulas.
 */

export const RECIPE_SNAPSHOT_VERSION = 1;

/** Angka atau null. null/undefined/"" → null (BUKAN 0), non-finite → null. */
export function toNumberOrNull(v) {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Bangun snapshot dari satu baris tabel recipes (snake_case, nilai numeric dari
 * pg masih berupa string, jadi dikonversi eksplisit).
 *
 * @param {object} row        - baris recipes (SELECT *)
 * @param {Date}   [capturedAt]
 */
export function buildRecipeSnapshot(row, capturedAt = new Date()) {
    return {
        version: RECIPE_SNAPSHOT_VERSION,
        capturedAt: capturedAt.toISOString(),
        recipeId: row.id ?? null,
        formulaNo: row.formula_no ?? null,
        recipeUpdatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        controlTemp: toNumberOrNull(row.control_temp),
        spaceTemp: toNumberOrNull(row.space_temp),
        sterilTemp: toNumberOrNull(row.steril_temp),
        sterilTimeMin: toNumberOrNull(row.steril_time_min),
        alarmPres: toNumberOrNull(row.alarm_pres),
        coolingTemp1: toNumberOrNull(row.cooling_temp1),
        coolingTemp2: toNumberOrNull(row.cooling_temp2),
        foValSetting: toNumberOrNull(row.fo_val_setting), // opsional → null bila kosong
        controlType: row.control_type ?? null,
        sterilMaterial: row.steril_material ?? null,
    };
}

/** Ambil satu nilai angka dari snapshot (jsonb hasil pg sudah berupa objek). */
export function snapshotNumber(snapshot, key) {
    return toNumberOrNull(snapshot?.[key]);
}
