/**
 * src/lib/recipeValidation.js — Validasi nilai resep sterilisasi.
 *
 * Tidak ada import agar aman dimuat dari mana pun (route handler, trendRecorder, dll).
 * Export tunggal: validateRecipe(recipe, options) → { ok, problems, warnings }
 *
 * "recipe" adalah object dengan field snake_case langsung dari DB:
 *   control_temp, space_temp, steril_temp, steril_time_min, alarm_pres,
 *   cooling_temp1, cooling_temp2, fo_val_setting
 *   (+ formula_no, control_type, steril_material bila strict: true)
 *
 * @param {object}  recipe           - Object dengan field DB (snake_case).
 * @param {object}  [options]        - Opsi validasi.
 * @param {boolean} [options.strict] - Bila true: formula_no / control_type /
 *                                     steril_material wajib teks tidak kosong, dan
 *                                     fo_val_setting wajib angka dalam rentang
 *                                     FO_VAL_MIN..FO_VAL_MAX. Default: false.
 */

// ── Rentang valid per field — sesuaikan dengan QA ────────────────────────────
// Semua batas ini bisa diubah di sini tanpa menyentuh logika validasi.
const RANGE = {
    control_temp:    { min: 100,  max: 150,  unit: "°C",    integer: false },
    steril_temp:     { min: 100,  max: 150,  unit: "°C",    integer: false },
    space_temp:      { min: 0.1,  max: 20,   unit: "°C",    integer: false },
    steril_time_min: { min: 1,    max: 500,  unit: "menit", integer: true  },
    alarm_pres:      { min: 100,  max: 300,  unit: "kPa",   integer: true  },
    cooling_temp1:   { min: 30,   max: 130,  unit: "°C",    integer: false },
    cooling_temp2:   { min: 20,   max: 130,  unit: "°C",    integer: false },
};

// Rentang fo_val_setting saat strict — sesuaikan dengan QA
const FO_VAL_MIN = 1;   // menit F0 minimum yang dianggap valid
const FO_VAL_MAX = 100; // menit F0 maksimum yang dianggap valid

// Field wajib numerik yang divalidasi pada semua mode
const REQUIRED_FIELDS = Object.keys(RANGE);

/**
 * Validasi satu resep.
 *
 * @param {object}  recipe
 * @param {{ strict?: boolean }} [options]
 * @returns {{ ok: boolean, problems: Array<{field, message}>, warnings: Array<{field, message}> }}
 */
export function validateRecipe(recipe, { strict = false } = {}) {
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

    // ── fo_val_setting ────────────────────────────────────────────────────────
    // Saat strict: wajib angka dalam rentang FO_VAL_MIN..FO_VAL_MAX → problem.
    // Saat tidak strict: kosong/0 → warning saja (tidak memblokir).
    const fovRaw = recipe?.fo_val_setting;
    const fovEmpty = fovRaw === null || fovRaw === undefined || String(fovRaw).trim() === "";
    const fovNum  = fovEmpty ? NaN : Number(fovRaw);

    if (strict) {
        if (fovEmpty) {
            problems.push({
                field:   "fo_val_setting",
                message: `fo_val_setting wajib diisi (${FO_VAL_MIN}-${FO_VAL_MAX} menit)`,
            });
        } else if (!Number.isFinite(fovNum) || fovNum < FO_VAL_MIN || fovNum > FO_VAL_MAX) {
            problems.push({
                field:   "fo_val_setting",
                message: `fo_val_setting harus ${FO_VAL_MIN}-${FO_VAL_MAX} menit`,
            });
        }
    } else {
        // Mode biasa: kosong atau 0 hanya menghasilkan warning
        if (fovEmpty || fovNum === 0) {
            warnings.push({
                field:   "fo_val_setting",
                message: "fo_val_setting kosong: hasil sterilisasi akan 'pending'",
            });
        }
    }

    // ── Validasi teks tambahan (hanya saat strict) ────────────────────────────
    if (strict) {
        // formula_no wajib teks tidak kosong
        const fno = recipe?.formula_no;
        if (fno === null || fno === undefined || String(fno).trim() === "") {
            problems.push({ field: "formula_no", message: "formula_no wajib diisi" });
        }

        // control_type wajib teks tidak kosong
        const ct = recipe?.control_type;
        if (ct === null || ct === undefined || String(ct).trim() === "") {
            problems.push({ field: "control_type", message: "control_type wajib dipilih" });
        }

        // steril_material wajib teks tidak kosong
        const sm = recipe?.steril_material;
        if (sm === null || sm === undefined || String(sm).trim() === "") {
            problems.push({ field: "steril_material", message: "steril_material wajib dipilih" });
        }
    }

    return {
        ok: problems.length === 0,
        problems,
        warnings,
    };
}
