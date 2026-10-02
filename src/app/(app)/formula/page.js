"use client";

import { useState, useEffect, useCallback } from "react";

// ── Helper: petakan nama field snake_case dari API ke camelCase key form ──────
// Dipakai saat menampilkan error invalidFields dari server per-field di form.
const SNAKE_TO_CAMEL = {
    formula_no:      "formulaNo",
    control_temp:    "controlTemp",
    space_temp:      "spaceTemp",
    steril_temp:     "sterilTemp",
    steril_time_min: "sterilTime",
    alarm_pres:      "alarmPres",
    cooling_temp1:   "coolingTemp1",
    cooling_temp2:   "coolingTemp2",
    fo_val_setting:  "foValSetting",
    control_type:    "controlType",
    steril_material: "sterilMaterial",
};
function snakeToCamelField(snakeKey) {
    return SNAKE_TO_CAMEL[snakeKey] ?? null;
}

// ──────────────────────────────────────────────
// Nilai default untuk entry formula baru
// ──────────────────────────────────────────────
const DEFAULT_FORM = {
    formulaNo: "",
    controlTemp:  "",
    spaceTemp:    "",
    sterilTemp:   "",
    sterilTime:   "",
    alarmPres:    "",
    coolingTemp1: "",
    coolingTemp2: "",
    foValSetting: "",
    controlType: "Time",
    sterilMaterial: "Soft bottle",
};

// ──────────────────────────────────────────────
// Konfigurasi field form (urutan, label, tipe)
// ──────────────────────────────────────────────
const LEFT_FIELDS = [
    { key: "controlTemp",    label: "Control Temp",     unit: "°C",  type: "number" },
    { key: "spaceTemp",      label: "Space Temp",       unit: "°C",  type: "number" },
    { key: "sterilTemp",     label: "Steril. Temp",     unit: "°C",  type: "number" },
    { key: "sterilTime",     label: "Steril. Time",     unit: "MIN", type: "integer" },
    { key: "controlType",    label: "Control Type",     unit: "",    type: "select",
      options: ["Time", "Level"] },
];

const RIGHT_FIELDS = [
    { key: "alarmPres",      label: "Alarm Pres.",      unit: "KPa", type: "number" },
    { key: "coolingTemp1",   label: "Cooling Temp1",    unit: "°C",  type: "number" },
    { key: "coolingTemp2",   label: "Cooling Temp2",    unit: "°C",  type: "number" },
    { key: "foValSetting",   label: "FOVal Setting",    unit: "MIN", type: "number" },
    { key: "sterilMaterial", label: "Steril. Material", unit: "",    type: "select",
      options: ["Soft bottle", "Hard bottle"] },
];

// ──────────────────────────────────────────────
// Komponen satu baris field
// ──────────────────────────────────────────────
function FieldRow({ field, value, onChange, disabled }) {
    const inputBase =
        "w-full bg-white border border-scada-idle rounded px-3 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors";
    const disabledClass = "opacity-60 cursor-not-allowed bg-scada-bg";

    if (field.type === "select") {
        return (
            <div className="flex items-center gap-2">
                <label className="w-36 text-xs text-scada-muted uppercase shrink-0">
                    {field.label}
                </label>
                <select
                    className={inputBase + " cursor-pointer" + (disabled ? " " + disabledClass : "")}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => !disabled && onChange(field.key, e.target.value)}
                >
                    {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <label className="w-36 text-xs text-scada-muted uppercase shrink-0">
                {field.label}
                {field.unit && (
                    <span className="ml-1 text-scada-muted opacity-80 normal-case">({field.unit})</span>
                )}
            </label>
            <input
                type="number"
                step={field.type === "integer" ? "1" : "0.1"}
                min="0"
                required
                className={inputBase + (disabled ? " " + disabledClass : "")}
                // value ?? "" mencegah React warning "value prop should not be null"
                // dan mencegah komponen berubah dari controlled → uncontrolled
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => !disabled && onChange(field.key, e.target.value)}
            />
        </div>
    );
}

// ──────────────────────────────────────────────
// Komponen utama halaman
// ──────────────────────────────────────────────
export default function FormulaPage() {
    const [formulas, setFormulas]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [selectedNo, setSelectedNo]   = useState(null);
    const [form, setForm]               = useState(DEFAULT_FORM);
    const [isNewEntry, setIsNewEntry]   = useState(false);
    const [toast, setToast]             = useState(null);
    const [errors, setErrors]           = useState({});
    const [saving, setSaving]           = useState(false);
    const [userRole, setUserRole]       = useState(null); // "admin" | "operator" | null

    // ── Fetch semua formula dari API ──────────
    const fetchFormulas = useCallback(async () => {
        try {
            const res = await fetch("/api/formulas");
            const data = await res.json();
            setFormulas(Array.isArray(data) ? data : []);
        } catch {
            showToast("Gagal memuat daftar formula dari server.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFormulas();
        // Fetch role user untuk RBAC UI
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (json.ok) setUserRole(json.user.role); })
            .catch(() => {});
    }, [fetchFormulas]);

    const isAdmin = userRole === "admin";

    // ── Helper: tampilkan toast 2 detik ──────
    function showToast(msg, type = "success") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 2500);
    }

    // ── Helper: update satu field di form ───
    function handleFieldChange(key, rawValue) {
        setForm((prev) => ({ ...prev, [key]: rawValue }));
        setErrors((prev) => ({ ...prev, [key]: undefined }));
    }

    // ── Pilih formula dari list ───────────────
    function handleSelect(formula) {
        if (isNewEntry) {
            // Batalkan entry baru yang belum disimpan
            setFormulas((prev) => prev.filter((f) => f.formulaNo !== ""));
        }
        setSelectedNo(formula.formulaNo);
        setForm({ ...formula });
        setIsNewEntry(false);
        setErrors({});
    }

    // ── Validasi form (client-side awal) ─────
    // Sesuai rentang di recipeValidation.js agar pesan konsisten dengan server.
    function validate(checkFormulaNo = false) {
        const errs = {};

        if (checkFormulaNo) {
            const no = String(form.formulaNo).trim();
            if (!no) errs.formulaNo = "Formula No tidak boleh kosong.";
        }

        // Rentang per field (mirroring recipeValidation.js RANGE)
        const fieldRanges = [
            { key: "controlTemp",  min: 100,  max: 150,  unit: "°C",    integer: false },
            { key: "spaceTemp",    min: 0.1,  max: 20,   unit: "°C",    integer: false },
            { key: "sterilTemp",   min: 100,  max: 150,  unit: "°C",    integer: false },
            { key: "sterilTime",   min: 1,    max: 500,  unit: "menit", integer: true  },
            { key: "alarmPres",    min: 100,  max: 300,  unit: "kPa",   integer: true  },
            { key: "coolingTemp1", min: 30,   max: 130,  unit: "°C",    integer: false },
            { key: "coolingTemp2", min: 20,   max: 130,  unit: "°C",    integer: false },
            { key: "foValSetting", min: 1,    max: 100,  unit: "menit", integer: false },
        ];

        for (const { key, min, max, unit, integer } of fieldRanges) {
            const raw = form[key];
            // Cek kosong dulu (sebelum Number()) agar tidak lolos seperti Number(null)=0
            if (raw === "" || raw === null || raw === undefined) {
                errs[key] = `Wajib diisi (${min}–${max} ${unit})`;
                continue;
            }
            const val = Number(raw);
            if (!Number.isFinite(val)) {
                errs[key] = "Harus angka valid";
                continue;
            }
            if (val < min || val > max) {
                errs[key] = `Harus ${min}–${max} ${unit}`;
                continue;
            }
            if (integer && !Number.isInteger(val)) {
                errs[key] = "Harus bilangan bulat";
            }
        }

        // Pengecekan antar-field
        const ct2 = Number(form.coolingTemp2);
        const ct1 = Number(form.coolingTemp1);
        const st  = Number(form.sterilTemp);
        if (!errs.coolingTemp2 && !errs.coolingTemp1 && ct2 >= ct1) {
            errs.coolingTemp2 = `Cooling Temp2 (${ct2}) harus < Cooling Temp1 (${ct1})`;
        }
        if (!errs.coolingTemp1 && !errs.sterilTemp && ct1 >= st) {
            errs.coolingTemp1 = `Cooling Temp1 (${ct1}) harus < Steril Temp (${st})`;
        }

        return errs;
    }

    // ── Tombol "+ Formula Baru" (di header) ───
    function handleAddNew() {
        const newEntry = { ...DEFAULT_FORM };
        setFormulas((prev) => [...prev, newEntry]);
        setSelectedNo("");   // string kosong sebagai penanda entry baru
        setForm(newEntry);
        setIsNewEntry(true);
        setErrors({});
    }

    // ── Tombol SAVE ───────────────────────────
    async function handleSave() {
        // Mode entry baru: POST ke /api/formulas
        if (isNewEntry) {
            const errs = validate(true);
            if (Object.keys(errs).length > 0) {
                setErrors(errs);
                showToast("Ada field yang tidak valid.", "error");
                return;
            }

            setSaving(true);
            try {
                const res = await fetch("/api/formulas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...form,
                        formulaNo:    String(form.formulaNo).trim(),
                        controlTemp:  parseFloat(form.controlTemp),
                        spaceTemp:    parseFloat(form.spaceTemp),
                        sterilTemp:   parseFloat(form.sterilTemp),
                        sterilTime:   parseInt(form.sterilTime, 10),
                        alarmPres:    parseFloat(form.alarmPres),
                        coolingTemp1: parseFloat(form.coolingTemp1),
                        coolingTemp2: parseFloat(form.coolingTemp2),
                        foValSetting: form.foValSetting !== "" ? parseFloat(form.foValSetting) : null,
                    }),
                });
                const json = await res.json();
                if (!res.ok || json.ok === false) {
                    // Kalau server kirim invalidFields, set error per-field
                    if (json.invalidFields && Array.isArray(json.invalidFields)) {
                        const fieldMap = {};
                        const unknown = [];
                        for (const p of json.invalidFields) {
                            // Petakan snake_case field ke camelCase key form
                            const camel = snakeToCamelField(p.field);
                            if (camel && DEFAULT_FORM[camel] !== undefined) {
                                fieldMap[camel] = p.message;
                            } else {
                                unknown.push(p.message);
                            }
                        }
                        setErrors(fieldMap);
                        if (unknown.length > 0) {
                            showToast(unknown.join("; "), "error");
                        } else {
                            showToast("Ada field yang tidak valid — lihat tanda merah di bawah input.", "error");
                        }
                    } else {
                        showToast(json.error ?? "Gagal menyimpan formula.", "error");
                    }
                    return; // form tidak ditutup
                }
                const trimmedNo = String(form.formulaNo).trim();
                setIsNewEntry(false);
                setSelectedNo(trimmedNo);
                showToast(`Formula ${trimmedNo} berhasil ditambahkan.`);
                await fetchFormulas();
            } catch {
                showToast("Gagal terhubung ke server.", "error");
            } finally {
                setSaving(false);
            }
            return;
        }

        // Mode edit formula yang sudah ada: PUT ke /api/formulas/[formulaNo]
        if (selectedNo === null) {
            showToast("Pilih formula terlebih dahulu.", "error");
            return;
        }

        const errs = validate(false);
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            showToast("Ada field yang tidak valid.", "error");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/formulas/${encodeURIComponent(selectedNo)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    controlTemp:  parseFloat(form.controlTemp),
                    spaceTemp:    parseFloat(form.spaceTemp),
                    sterilTemp:   parseFloat(form.sterilTemp),
                    sterilTime:   parseInt(form.sterilTime, 10),
                    alarmPres:    parseFloat(form.alarmPres),
                    coolingTemp1: parseFloat(form.coolingTemp1),
                    coolingTemp2: parseFloat(form.coolingTemp2),
                    foValSetting: form.foValSetting !== "" ? parseFloat(form.foValSetting) : null,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                // Kalau server kirim invalidFields, set error per-field
                if (json.invalidFields && Array.isArray(json.invalidFields)) {
                    const fieldMap = {};
                    const unknown = [];
                    for (const p of json.invalidFields) {
                        const camel = snakeToCamelField(p.field);
                        if (camel && DEFAULT_FORM[camel] !== undefined) {
                            fieldMap[camel] = p.message;
                        } else {
                            unknown.push(p.message);
                        }
                    }
                    setErrors(fieldMap);
                    if (unknown.length > 0) {
                        showToast(unknown.join("; "), "error");
                    } else {
                        showToast("Ada field yang tidak valid — lihat tanda merah di bawah input.", "error");
                    }
                } else {
                    showToast(json.error ?? "Gagal menyimpan perubahan.", "error");
                }
                return; // form tidak ditutup
            }
            showToast(`Formula ${selectedNo} berhasil disimpan.`);
            await fetchFormulas();
        } catch {
            showToast("Gagal terhubung ke server.", "error");
        } finally {
            setSaving(false);
        }
    }

    // ── Tombol DELETE ─────────────────────────
    async function handleDelete() {
        if (selectedNo === null && !isNewEntry) {
            showToast("Pilih formula terlebih dahulu.", "error");
            return;
        }

        // Kalau masih entry baru (belum disimpan), cukup buang dari list lokal
        if (isNewEntry) {
            setFormulas((prev) => prev.filter((f) => f.formulaNo !== ""));
            setSelectedNo(null);
            setIsNewEntry(false);
            setForm(DEFAULT_FORM);
            setErrors({});
            showToast("Entry baru dibatalkan.");
            return;
        }

        if (!window.confirm(`Yakin hapus formula ${selectedNo}? Tindakan ini tidak bisa dibatalkan.`)) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/formulas/${encodeURIComponent(selectedNo)}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actor: "unknown" }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                showToast(json.error ?? "Gagal menghapus formula.", "error");
                return;
            }
            showToast(`Formula ${selectedNo} berhasil dihapus.`);
            setSelectedNo(null);
            setForm(DEFAULT_FORM);
            setErrors({});
            await fetchFormulas();
        } catch {
            showToast("Gagal terhubung ke server.", "error");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Formula</h1>
                    <p className="text-sm text-scada-muted mt-1">
                        Super Water Sterilizer — Resep &amp; Parameter Sterilisasi
                    </p>
                </div>
                {/* Tombol + Formula Baru: hanya tampil untuk admin */}
                {isAdmin && (
                    <button
                        onClick={handleAddNew}
                        disabled={isNewEntry}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-scada-water hover:bg-scada-water-hover text-white disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                    >
                        <span className="text-lg leading-none">+</span>
                        Formula Baru
                    </button>
                )}
            </div>

            {/* ── Toast notifikasi ── */}
            {toast && (
                <div
                    className={`mb-4 px-4 py-2 rounded text-sm font-medium transition-all ${
                        toast.type === "error"
                            ? "bg-red-900 border border-red-700 text-red-200"
                            : "bg-green-900 border border-green-700 text-green-200"
                    }`}
                >
                    {toast.msg}
                </div>
            )}

            <div className="flex gap-6 flex-col lg:flex-row">
                {/* ════════════════════════════════════
                    KIRI: Daftar Formula
                ════════════════════════════════════ */}
                <div className="lg:w-56 shrink-0">
                    <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm overflow-hidden">
                        <div className="px-4 py-2 bg-scada-bg border-b border-scada-rule text-xs text-scada-ink uppercase font-semibold tracking-wider">
                            Daftar Formula
                        </div>
                        {loading ? (
                            <p className="px-4 py-6 text-sm text-scada-muted text-center">
                                Memuat…
                            </p>
                        ) : formulas.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-scada-muted text-center">
                                Belum ada formula.
                            </p>
                        ) : (
                            <ul>
                                {formulas.map((f, idx) => (
                                    <li key={f.formulaNo === "" ? `__new__${idx}` : f.formulaNo}>
                                        <button
                                            onClick={() => handleSelect(f)}
                                            className={`w-full text-left px-4 py-3 text-sm border-b border-scada-rule last:border-0 transition-colors ${
                                                selectedNo === f.formulaNo
                                                    ? "bg-scada-water text-white font-semibold"
                                                    : "hover:bg-scada-bg text-scada-ink"
                                            }`}
                                        >
                                            <span className="block font-mono text-base">
                                                {f.formulaNo === "" ? (
                                                    <span className="italic opacity-80">Baru…</span>
                                                ) : f.formulaNo}
                                            </span>
                                            <span className="block text-xs opacity-70 mt-0.5">
                                                {f.formulaNo === "" ? "isi & Save" : `${f.sterilTemp}°C · ${f.sterilTime} MIN`}
                                            </span>
                                            {/* Badge "Tidak lengkap" untuk resep dengan validation.ok false */}
                                            {f.formulaNo !== "" && f.validation && !f.validation.ok && (
                                                <span
                                                    className="inline-block mt-1 px-1.5 py-0.5 bg-scada-stop text-white text-xs rounded leading-none"
                                                    title={f.validation.problems.map((p) => p.message).join("\n")}
                                                >
                                                    Tidak lengkap
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* ════════════════════════════════════
                    KANAN: Form Parameter
                ════════════════════════════════════ */}
                <div className="flex-1">
                    <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-6">
                        {/* Formula No */}
                        <div className="mb-5 flex items-center gap-3">
                            <label className="text-xs text-scada-muted uppercase shrink-0 w-28">
                                Formula No
                            </label>
                            <input
                                type="text"
                                placeholder="Masukkan nomor formula"
                                className={`w-36 bg-white border rounded px-3 py-1.5 text-sm font-mono font-bold focus:outline-none transition-colors ${
                                    errors.formulaNo
                                        ? "border-scada-stop focus:border-red-400"
                                        : "border-scada-idle focus:border-scada-water"
                                } ${isNewEntry ? "text-scada-ink" : "text-scada-muted cursor-default bg-scada-bg"}`}
                                value={isNewEntry ? form.formulaNo : (selectedNo ?? "")}
                                readOnly={!isNewEntry}
                                onChange={(e) =>
                                    isNewEntry && handleFieldChange("formulaNo", e.target.value)
                                }
                            />
                            {errors.formulaNo && (
                                <span className="text-xs text-scada-stop">{errors.formulaNo}</span>
                            )}
                            {isNewEntry && (
                                <span className="text-xs text-scada-water italic">
                                    Ketik nomor, isi field, lalu klik Save
                                </span>
                            )}
                        </div>

                        {/* Grid 2 kolom field */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                            {/* Kolom kiri */}
                            <div className="flex flex-col gap-3">
                                {LEFT_FIELDS.map((field) => (
                                    <div key={field.key}>
                                        <FieldRow
                                            field={field}
                                            value={form[field.key]}
                                            onChange={handleFieldChange}
                                            disabled={!isAdmin}
                                        />
                                        {errors[field.key] && (
                                            <p className="mt-0.5 ml-[9.5rem] text-xs text-red-400">
                                                {errors[field.key]}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Kolom kanan */}
                            <div className="flex flex-col gap-3">
                                {RIGHT_FIELDS.map((field) => (
                                    <div key={field.key}>
                                        <FieldRow
                                            field={field}
                                            value={form[field.key]}
                                            onChange={handleFieldChange}
                                            disabled={!isAdmin}
                                        />
                                        {errors[field.key] && (
                                            <p className="mt-0.5 ml-[9.5rem] text-xs text-red-400">
                                                {errors[field.key]}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="mt-6 border-t border-scada-rule" />

                        {/* Tombol aksi: hanya untuk admin */}
                        <div className="mt-4 flex flex-wrap gap-3">
                            {isAdmin ? (
                                <>
                                    <button
                                        onClick={handleSave}
                                        disabled={(selectedNo === null && !isNewEntry) || saving}
                                        className="px-5 py-2 bg-scada-run hover:bg-scada-run-hover active:bg-scada-run-active text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {saving ? "Menyimpan…" : "Save"}
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={(selectedNo === null && !isNewEntry) || saving}
                                        className="px-5 py-2 bg-scada-stop hover:bg-scada-stop-hover active:bg-scada-stop-active text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <p className="text-xs text-scada-muted italic">
                                    Hanya admin yang bisa mengubah atau menghapus formula.
                                </p>
                            )}
                        </div>
                        {selectedNo === null && !isNewEntry && (
                            <p className="mt-2 text-xs text-scada-muted italic">
                                Pilih formula di daftar kiri untuk melihat parameter.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}