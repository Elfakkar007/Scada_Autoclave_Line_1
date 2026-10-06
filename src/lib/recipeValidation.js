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
 *                                     control_type harus persis "Time". Default: false.
 *
 * fo_val_setting OPSIONAL: kosong boleh; bila diisi harus angka positif bebas
 * (tidak ada batas atas/bawah selain > 0). Ia hanya "wadah" angka dari QA per produk
 * dan tidak dipakai untuk vonis lulus/gagal.
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

// Control Type dikunci ke "Time": mode F0 tidak pernah dipakai produksi
// (bit PLC M13.2 tidak pernah di-set). Diekspor agar route/halaman memakai konstanta yang sama.
export const ALLOWED_CONTROL_TYPE = "Time";

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

    // ── fo_val_setting (opsional) ─────────────────────────────────────────────
    // Kosong = boleh. Bila diisi: harus angka > 0. Saat strict → problem; tidak strict → warning.
    const fovRaw = recipe?.fo_val_setting;
    const fovEmpty = fovRaw === null || fovRaw === undefined || String(fovRaw).trim() === "";
    if (!fovEmpty) {
        const fovNum = Number(fovRaw);
        if (!Number.isFinite(fovNum) || fovNum <= 0) {
            const item = { field: "fo_val_setting", message: "fo_val_setting harus angka positif (atau dikosongkan)" };
            if (strict) problems.push(item); else warnings.push(item);
        }
    }

    // ── control_type: hanya "Time" ────────────────────────────────────────────
    const ct = recipe?.control_type;
    const ctEmpty = ct === null || ct === undefined || String(ct).trim() === "";
    if (strict) {
        if (ctEmpty) {
            problems.push({ field: "control_type", message: "control_type wajib diisi" });
        } else if (String(ct).trim() !== ALLOWED_CONTROL_TYPE) {
            problems.push({ field: "control_type", message: `control_type harus "${ALLOWED_CONTROL_TYPE}"` });
        }
    } else if (!ctEmpty && String(ct).trim() !== ALLOWED_CONTROL_TYPE) {
        warnings.push({ field: "control_type", message: `control_type bukan "${ALLOWED_CONTROL_TYPE}"` });
    }

    // ── Validasi teks tambahan (hanya saat strict) ────────────────────────────
    if (strict) {
        // formula_no wajib teks tidak kosong
        const fno = recipe?.formula_no;
        if (fno === null || fno === undefined || String(fno).trim() === "") {
            problems.push({ field: "formula_no", message: "formula_no wajib diisi" });
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
