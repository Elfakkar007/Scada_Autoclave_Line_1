"use client";

import { useState, useEffect, useCallback } from "react";

// ──────────────────────────────────────────────
// Nilai default untuk entry formula baru
// ──────────────────────────────────────────────
const DEFAULT_FORM = {
    formulaNo: "",
    controlTemp: 0,
    spaceTemp: 0,
    sterilTemp: 0,
    sterilTime: 0,
    alarmPres: 0,
    coolingTemp1: 0,
    coolingTemp2: 0,
    foValSetting: 0,
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
        "w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors";
    const disabledClass = "opacity-60 cursor-not-allowed";

    if (field.type === "select") {
        return (
            <div className="flex items-center gap-2">
                <label className="w-36 text-xs text-slate-400 uppercase shrink-0">
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
            <label className="w-36 text-xs text-slate-400 uppercase shrink-0">
                {field.label}
                {field.unit && (
                    <span className="ml-1 text-slate-500 normal-case">({field.unit})</span>
                )}
            </label>
            <input
                type="number"
                step={field.type === "integer" ? "1" : "0.1"}
                min="0"
                className={inputBase + (disabled ? " " + disabledClass : "")}
                value={value}
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
    function validate(checkFormulaNo = false) {
        const errs = {};

        if (checkFormulaNo) {
            const no = String(form.formulaNo).trim();
            if (!no) errs.formulaNo = "Formula No tidak boleh kosong.";
        }

        const numericKeys = [
            "controlTemp", "spaceTemp", "sterilTemp", "sterilTime",
            "alarmPres", "coolingTemp1", "coolingTemp2", "foValSetting",
        ];
        for (const key of numericKeys) {
            const val = parseFloat(form[key]);
            if (isNaN(val) || val < 0) errs[key] = "Harus >= 0";
        }

        const sterilTimeVal = parseFloat(form.sterilTime);
        if (!errs.sterilTime && !Number.isInteger(sterilTimeVal))
            errs.sterilTime = "Harus bilangan bulat";

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
                        foValSetting: parseFloat(form.foValSetting),
                    }),
                });
                const json = await res.json();
                if (!res.ok || json.ok === false) {
                    showToast(json.error ?? "Gagal menyimpan formula.", "error");
                    return;
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
                    foValSetting: parseFloat(form.foValSetting),
                }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                showToast(json.error ?? "Gagal menyimpan perubahan.", "error");
                return;
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
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Formula</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Super Water Sterilizer — Resep &amp; Parameter Sterilisasi
                    </p>
                </div>
                {/* Tombol + Formula Baru: hanya tampil untuk admin */}
                {isAdmin && (
                    <button
                        onClick={handleAddNew}
                        disabled={isNewEntry}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
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
                    <div className="bg-slate-800 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-slate-700 text-xs text-slate-300 uppercase font-semibold tracking-wider">
                            Daftar Formula
                        </div>
                        {loading ? (
                            <p className="px-4 py-6 text-sm text-slate-500 text-center">
                                Memuat…
                            </p>
                        ) : formulas.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-slate-500 text-center">
                                Belum ada formula.
                            </p>
                        ) : (
                            <ul>
                                {formulas.map((f, idx) => (
                                    <li key={f.formulaNo === "" ? `__new__${idx}` : f.formulaNo}>
                                        <button
                                            onClick={() => handleSelect(f)}
                                            className={`w-full text-left px-4 py-3 text-sm border-b border-slate-700 last:border-0 transition-colors ${
                                                selectedNo === f.formulaNo
                                                    ? "bg-blue-700 text-white font-semibold"
                                                    : "hover:bg-slate-700 text-slate-300"
                                            }`}
                                        >
                                            <span className="block font-mono text-base">
                                                {f.formulaNo === "" ? (
                                                    <span className="italic text-blue-300">Baru…</span>
                                                ) : f.formulaNo}
                                            </span>
                                            <span className="block text-xs opacity-70 mt-0.5">
                                                {f.formulaNo === "" ? "isi & Save" : `${f.sterilTemp}°C · ${f.sterilTime} MIN`}
                                            </span>
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
                    <div className="bg-slate-800 rounded-lg p-6">
                        {/* Formula No */}
                        <div className="mb-5 flex items-center gap-3">
                            <label className="text-xs text-slate-400 uppercase shrink-0 w-28">
                                Formula No
                            </label>
                            <input
                                type="text"
                                placeholder="Masukkan nomor formula"
                                className={`w-36 bg-slate-700 border rounded px-3 py-1.5 text-sm font-mono font-bold focus:outline-none transition-colors ${
                                    errors.formulaNo
                                        ? "border-red-500 focus:border-red-400"
                                        : "border-slate-600 focus:border-blue-500"
                                } ${isNewEntry ? "text-slate-100" : "text-slate-400 cursor-default"}`}
                                value={isNewEntry ? form.formulaNo : (selectedNo ?? "")}
                                readOnly={!isNewEntry}
                                onChange={(e) =>
                                    isNewEntry && handleFieldChange("formulaNo", e.target.value)
                                }
                            />
                            {errors.formulaNo && (
                                <span className="text-xs text-red-400">{errors.formulaNo}</span>
                            )}
                            {isNewEntry && (
                                <span className="text-xs text-blue-400 italic">
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
                        <div className="mt-6 border-t border-slate-700" />

                        {/* Tombol aksi: hanya untuk admin */}
                        <div className="mt-4 flex flex-wrap gap-3">
                            {isAdmin ? (
                                <>
                                    <button
                                        onClick={handleSave}
                                        disabled={(selectedNo === null && !isNewEntry) || saving}
                                        className="px-5 py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {saving ? "Menyimpan…" : "Save"}
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={(selectedNo === null && !isNewEntry) || saving}
                                        className="px-5 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <p className="text-xs text-slate-500 italic">
                                    Hanya admin yang bisa mengubah atau menghapus formula.
                                </p>
                            )}
                        </div>
                        {selectedNo === null && !isNewEntry && (
                            <p className="mt-2 text-xs text-slate-500 italic">
                                Pilih formula di daftar kiri untuk melihat parameter.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}