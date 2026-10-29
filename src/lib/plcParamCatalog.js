// ==============================================================================
// Katalog field PLC yang boleh dibaca/ditulis dari halaman HMI-web.
// AMAN dipakai di server maupun komponen "use client" (tanpa import apa pun).
//
// Ini SATU-SATUNYA daftar tag yang boleh ditulis oleh /api/plc-params.
// 60 tag lama di KEPServerEX masih R/W, jadi pagar sebenarnya ada di sini:
// tag di luar daftar ini tidak bisa ditulis lewat endpoint tsb.
//
// kind:
//   "int"   : integer 16-bit bertanda (Short). Nilai teknik = raw / scale.
//   "float" : Float 32-bit (VD). Nilai teknik = raw.
//   "bool"  : bit. Nilai teknik = true/false.
// Batas min/max di bawah adalah PAGAR SERVER (bukan batas HMI). Ubah di sini bila
// QA menetapkan rentang lain; tidak ada logika lain yang perlu disentuh.
// ==============================================================================

export const SAFETY_ACTION = "action.write_safety_params";

export const PLC_GROUPS = {
    param1:      { title: "Parameter Setting 1",  resource: "machine_params" },
    param2:      { title: "Parameter Setting 2",  resource: "machine_params" },
    coef:        { title: "Pressure Coefficient", resource: "machine_params" },
    calibration: { title: "Calibration",          resource: "calibration", writeAction: "action.write_calibration" },
};

// Fase VW98 yang dianggap "mesin tidak sedang memproses": 0 idle, 1 siap, 6 selesai (menunggu STOP).
export const IDLE_PHASES_PARAMS = [0, 1, 6];

const temp = (key, tag, label, min, max, extra = {}) => ({
    kind: "int", scale: 10, unit: "°C", decimals: 1, min, max, key, tag, label, ...extra,
});
const kpa = (key, tag, label, min, max, extra = {}) => ({
    kind: "int", scale: 1, unit: "kPa", decimals: 0, min, max, key, tag, label, ...extra,
});
const flt = (key, tag, label, unit, min, max, extra = {}) => ({
    kind: "float", unit, decimals: 2, min, max, key, tag, label, ...extra,
});

const RECIPE_NOTE =
    "Ditimpa dengan nilai resep setiap kali START dari web. Perubahan di sini hanya bertahan untuk start dari HMI.";

export const PLC_FIELDS = {
    // ── Parameter Setting 1 ────────────────────────────────────────────────────
    param1: [
        temp("sterTemp", "STER_SET", "Ster. Temp", 100, 150, { recipeDriven: true, hint: RECIPE_NOTE }),
        temp("ctrlTemp", "CTRL_TEMP", "Control Temp", 100, 150, { recipeDriven: true, hint: RECIPE_NOTE }),
        temp("tempSpace", "TEMP_SPACE", "Temp. Space", 0.1, 20, { recipeDriven: true, hint: RECIPE_NOTE }),
        { kind: "int", scale: 1, unit: "MIN", decimals: 0, min: 1, max: 500, key: "sterTime", tag: "STER_SET_TIME",
          label: "Ster. Time", recipeDriven: true, hint: RECIPE_NOTE },
        kpa("alarmPress", "ALRM_PRES", "Alarm Press.", 100, 300, {
            restricted: SAFETY_ACTION, recipeDriven: true,
            hint: "P1 ≥ nilai ini membuka katup exhaust (Q1.5). " + RECIPE_NOTE,
        }),
        temp("cool1", "COOL1_TEMP", "Cool. Temp 1", 30, 130, { recipeDriven: true, hint: RECIPE_NOTE }),
        temp("cool2", "COOL2_TEMP", "Cool. Temp 2", 20, 130, { recipeDriven: true, hint: RECIPE_NOTE }),
        {
            kind: "bool", key: "ctrlSel", tag: "CTRL_SEL", label: "Control Select", readOnly: true,
            options: [
                { value: false, label: "TIME" },
                { value: true, label: "F0 (menunggu sinyal eksternal)" },
            ],
            hint: "Dikunci ke TIME. Mode F0 menunggu sinyal eksternal yang tidak pernah datang, sehingga mesin bisa macet.",
        },
    ],

    // ── Parameter Setting 2 ────────────────────────────────────────────────────
    param2: [
        kpa("safetyPress", "SAFETY_PRESS", "Safety Press.", 0, 50, {
            restricted: SAFETY_ACTION, danger: true,
            hint: "INTERLOCK PINTU: pintu hanya boleh dibuka bila P1 ≤ nilai ini. Juga dasar alarm M8.0 dan akhir drain. Menaikkan nilai ini memperbolehkan pintu dibuka pada tekanan lebih tinggi.",
        }),
        kpa("regPress", "REG_PRESS", "Regu. Press", -50, 50, {
            hint: "Offset bertanda yang ditambahkan ke target tekanan (VW214).",
        }),
        temp("overTemp", "OVER_TEMP", "Over. Temp", 100, 150, {
            hint: "Suhu fase steril di atas nilai ini memicu alarm M10.3. Harus lebih besar dari Ster. Temp yang aktif di PLC.",
        }),
        { kind: "int", scale: 10, unit: "s", decimals: 1, min: 1, max: 120, key: "drainTime", tag: "DRAIN_TIME",
          label: "Drain Time", hint: "Disimpan PLC dalam satuan 100 ms (200 = 20.0 s)." },
        temp("exhaustTemp", "EXHAUST_TEMP", "Exhau. Temp", 50, 130),
        {
            kind: "bool", key: "selPress", tag: "SEL_PRESU", label: "Select Press", restricted: SAFETY_ACTION, danger: true,
            options: [
                { value: false, label: "0 — P1 dibaca dari kanal AIW12 (P2 dari AIW14)" },
                { value: true, label: "1 — P1 dibaca dari kanal AIW14 (P2 tidak diperbarui)" },
            ],
            hint: "Memilih kanal analog yang menjadi P1 (dasar interlock pintu). Pemetaan 0/1 ke tampilan HMI belum diverifikasi.",
        },
    ],

    // ── Pressure Coefficient ───────────────────────────────────────────────────
    coef: [
        flt("a1", "A1_VALUE", "a1", "°C", 40, 130, { decimals: 1, hint: "Ambang suhu kurva tekanan heating/steril (VD1004)." }),
        flt("b1", "B1_VALUE", "b1", "kPa", 0, 300, { decimals: 1, hint: "Tekanan dasar kurva heating/steril (VD1020)." }),
        flt("a2", "A2_VALUE", "a2", "°C", 40, 130, { decimals: 1, hint: "Ambang suhu kurva tekanan cooling (VD1304)." }),
        flt("b2", "B2_VALUE", "b2", "kPa", 0, 300, { decimals: 1, hint: "Tekanan dasar kurva cooling (VD1320)." }),
        flt("heatCoef", "HEAT_COEF", "Heat Coeff", "kPa/°C", 0, 10, { hint: "Kemiringan kurva pada fase heating." }),
        flt("sterCoef", "STER_COEF", "Ster Coeff", "kPa/°C", 0, 10, { hint: "Kemiringan kurva pada fase steril." }),
        flt("coolCoef", "COOL_COEF", "Cool Coeff", "kPa/°C", 0, 10, { hint: "Kemiringan kurva pada fase cooling." }),
        {
            kind: "bool", key: "selProg", tag: "SEL_PROG", label: "Select Prog", readOnly: true,
            options: [
                { value: false, label: "0 — kurva linear (a, b, Coeff di atas berlaku)" },
                { value: true, label: "1 — rumus uap (a, b, Coeff TIDAK dipakai)" },
            ],
            hint: "Hanya dibaca. Diatur dari HMI.",
        },
    ],

    // ── Calibration (offset ditambahkan ke nilai sensor, bertanda) ─────────────
    calibration: [
        ...["TH", "T1", "T2", "T3", "T4", "T5", "T6", "TM", "TL"].map((n) =>
            temp(n.toLowerCase(), `CAL_${n}`, n, -10, 10, { hint: `Offset yang ditambahkan ke sensor ${n}.` })
        ),
        kpa("p1", "CAL_P1", "P1", -50, 50, { hint: "Offset yang ditambahkan ke P1 (VW118)." }),
        kpa("p2", "CAL_P2", "P2", -50, 50, { hint: "Offset yang ditambahkan ke P2 (VW120)." }),
        { kind: "int", scale: 1, unit: "raw", decimals: 0, min: -500, max: 500, key: "l", tag: "CAL_L", label: "L",
          hint: "Offset konduktivitas dalam satuan mentah PLC (skala ke µS belum diverifikasi)." },
    ],
};

// ── Helper ───────────────────────────────────────────────────────────────────

export function getFields(group) {
    return PLC_FIELDS[group] ?? [];
}

export function getField(group, key) {
    return getFields(group).find((f) => f.key === key) ?? null;
}

/** raw dari PLC → nilai teknik. null/undefined → null. */
export function rawToValue(def, raw) {
    if (raw === null || raw === undefined) return null;
    if (def.kind === "bool") return !!raw;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return def.kind === "int" ? n / def.scale : n;
}

/** Bandingkan dua nilai RAW menurut jenisnya (float memakai toleransi float32). */
export function rawEqualsKind(kind, a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    if (kind === "bool") return !!a === !!b;
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (kind === "float") return Math.abs(x - y) <= 1e-4 * Math.max(1, Math.abs(x));
    return x === y;
}

export function rawEquals(def, a, b) {
    return rawEqualsKind(def.kind, a, b);
}

/**
 * Validasi satu input pengguna terhadap definisi field.
 * @returns {{ok: true, value, raw} | {ok: false, error: string}}
 */
export function validateField(def, input) {
    if (def.readOnly) return { ok: false, error: `${def.label} hanya dibaca dan tidak bisa diubah dari web` };

    if (def.kind === "bool") {
        let b = null;
        if (input === true || input === "true" || input === 1 || input === "1") b = true;
        else if (input === false || input === "false" || input === 0 || input === "0") b = false;
        if (b === null) return { ok: false, error: `${def.label} harus bernilai 0 atau 1` };
        return { ok: true, value: b, raw: b };
    }

    if (input === null || input === undefined || String(input).trim() === "") {
        return { ok: false, error: `${def.label} wajib diisi` };
    }
    const n = Number(String(input).trim().replace(",", "."));
    if (!Number.isFinite(n)) return { ok: false, error: `${def.label} bukan angka valid` };
    if (n < def.min || n > def.max) {
        return { ok: false, error: `${def.label} harus ${def.min} s.d. ${def.max} ${def.unit}` };
    }
    if (def.kind === "int") {
        const raw = Math.round(n * def.scale);
        if (Math.abs(raw - n * def.scale) > 1e-6) {
            return {
                ok: false,
                error: def.decimals === 0
                    ? `${def.label} harus bilangan bulat`
                    : `${def.label} maksimal ${def.decimals} angka desimal`,
            };
        }
        return { ok: true, value: raw / def.scale, raw };
    }
    return { ok: true, value: n, raw: n }; // float
}

/**
 * Pemeriksaan antar-field. values = nilai teknik gabungan (nilai PLC saat ini + perubahan).
 * ctx.sterSet = Ster. Temp yang aktif di PLC (dipakai grup param2).
 * @returns {string[]} daftar pesan masalah (kosong = lolos)
 */
export function crossCheck(group, values, ctx = {}) {
    const problems = [];
    const has = (v) => v !== null && v !== undefined;
    if (group === "param1") {
        const { sterTemp, cool1, cool2 } = values;
        if (has(cool1) && has(cool2) && cool2 >= cool1) {
            problems.push(`Cool. Temp 2 (${cool2}) harus lebih kecil dari Cool. Temp 1 (${cool1})`);
        }
        if (has(cool1) && has(sterTemp) && cool1 >= sterTemp) {
            problems.push(`Cool. Temp 1 (${cool1}) harus lebih kecil dari Ster. Temp (${sterTemp})`);
        }
    }
    if (group === "param2") {
        const { overTemp } = values;
        if (has(overTemp) && has(ctx.sterSet) && overTemp <= ctx.sterSet) {
            problems.push(`Over. Temp (${overTemp}) harus lebih besar dari Ster. Temp yang aktif di PLC (${ctx.sterSet})`);
        }
    }
    return problems;
}

/** Format tampilan nilai teknik. */
export function formatValue(def, value) {
    if (value === null || value === undefined) return "—";
    if (def.kind === "bool") {
        const opt = def.options?.find((o) => o.value === value);
        return opt ? opt.label : String(value);
    }
    const d = def.decimals ?? 0;
    const s = Number(value).toFixed(d);
    return def.kind === "int" && def.min < 0 && Number(value) > 0 ? `+${s}` : s;
}
