/**
 * src/lib/recipeValidation.js — Validasi nilai resep sterilisasi.
 *
 * Tidak ada import agar aman dimuat dari mana pun (route handler, trendRecorder, dll).
 * Export tunggal: validateRecipe(recipe) → { ok, problems, warnings }
 *
 * "recipe" adalah object dengan field snake_case langsung dari DB:
 *   control_temp, space_temp, steril_temp, steril_time_min, alarm_pres,
 *   cooling_temp1, cooling_temp2, fo_val_setting
 */

// ── Rentang valid per field — sesuaikan dengan QA ────────────────────────────
// Semua batas ini bisa diubah di sini tanpa menyentuh logika validasi.
const RANGE = {
    control_temp:    { min: 100,  max: 150,  unit: "°C",  integer: false },
    steril_temp:     { min: 100,  max: 150,  unit: "°C",  integer: false },
    space_temp:      { min: 0.1,  max: 20,   unit: "°C",  integer: false },
    steril_time_min: { min: 1,    max: 500,  unit: "menit", integer: true  },
    alarm_pres:      { min: 100,  max: 300,  unit: "kPa", integer: true  },
    cooling_temp1:   { min: 30,   max: 130,  unit: "°C",  integer: false },
    cooling_temp2:   { min: 20,   max: 130,  unit: "°C",  integer: false },
};

// Field wajib yang divalidasi (fo_val_setting hanya menghasilkan warning)
const REQUIRED_FIELDS = Object.keys(RANGE);

/**
 * Validasi satu resep.
 *
 * @param {object} recipe - Object dengan field DB (snake_case). Nilai boleh null/undefined.
 * @returns {{ ok: boolean, problems: Array<{field, message}>, warnings: Array<{field, message}> }}
 */
export function validateRecipe(recipe) {
    const problems = [];
    const warnings = [];

    // Map field → angka valid atau null (null = tidak bisa diproses)
    const nums = {};

    for (const field of REQUIRED_FIELDS) {
        const raw = recipe?.[field];

        // 1. Cek null/undefined/string kosong SEBELUM Number() ─────────────────
        //    Number(null) = 0, Number("") = 0 — keduanya lolos cek isFinite
        //    tapi bukan nilai yang disengaja operator, sehingga harus ditolak lebih awal.
        if (raw === null || raw === undefined || String(raw).trim() === "") {
            problems.push({ field, message: `${field} wajib diisi` });
            nums[field] = null;
            continue;
        }

        // 2. Konversi ke angka dan cek finite ──────────────────────────────────
        const n = Number(raw);
        if (!Number.isFinite(n)) {
            problems.push({ field, message: `${field} bukan angka valid` });
            nums[field] = null;
            continue;
        }

        // 3. Cek nilai 0 tidak lolos untuk field manapun ───────────────────────
        //    STER_SET = 0 membuat PLC menganggap Heating selesai seketika (berbahaya).
        if (n === 0) {
            const r = RANGE[field];
            problems.push({ field, message: `${field} harus ${r.min}-${r.max} ${r.unit} (tidak boleh 0)` });
            nums[field] = null;
            continue;
        }

        // 4. Cek rentang ───────────────────────────────────────────────────────
        const r = RANGE[field];
        if (n < r.min || n > r.max) {
            problems.push({ field, message: `${field} harus ${r.min}-${r.max} ${r.unit}` });
            nums[field] = null;
            continue;
        }

        // 5. Cek bilangan bulat (untuk steril_time_min dan alarm_pres) ─────────
        if (r.integer && !Number.isInteger(n)) {
            problems.push({ field, message: `${field} harus bilangan bulat ${r.unit}` });
            nums[field] = null;
            continue;
        }

        nums[field] = n;
    }

    // ── Pengecekan antar-field (hanya bila semua angka valid) ─────────────────
    // cooling_temp2 < cooling_temp1 < steril_temp
    const allNumsValid =
        nums.cooling_temp2 !== null &&
        nums.cooling_temp1 !== null &&
        nums.steril_temp   !== null;

    if (allNumsValid) {
        if (nums.cooling_temp2 >= nums.cooling_temp1) {
            problems.push({
                field:   "cooling_temp2",
                message: `cooling_temp2 (${nums.cooling_temp2}) harus lebih kecil dari cooling_temp1 (${nums.cooling_temp1})`,
            });
        }
        if (nums.cooling_temp1 >= nums.steril_temp) {
            problems.push({
                field:   "cooling_temp1",
                message: `cooling_temp1 (${nums.cooling_temp1}) harus lebih kecil dari steril_temp (${nums.steril_temp})`,
            });
        }
    }

    // ── fo_val_setting: warning kalau kosong, bukan problem ───────────────────
    const fov = recipe?.fo_val_setting;
    if (fov === null || fov === undefined || String(fov).trim() === "" || Number(fov) === 0) {
        warnings.push({
            field:   "fo_val_setting",
            message: "fo_val_setting kosong: hasil sterilisasi akan 'pending'",
        });
    }

    return {
        ok: problems.length === 0,
        problems,
        warnings,
    };
}
