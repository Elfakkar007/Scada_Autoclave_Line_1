"use client";

import { useEffect, useState } from "react";
import { hasLevel } from "@/lib/permissionCatalog";

function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [initialSettings, setInitialSettings] = useState(null);
    const [canEdit, setCanEdit] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [reason, setReason] = useState("");
    const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }

    useEffect(() => {
        let active = true;
        Promise.all([
            fetch("/api/settings").then((r) => r.json()),
            fetch("/api/auth/me").then((r) => r.json()),
        ])
            .then(([resSettings, resMe]) => {
                if (!active) return;
                if (!resSettings.ok) {
                    setLoadError(resSettings.error ?? "Gagal memuat konfigurasi sistem");
                    return;
                }
                setLoadError("");
                // Ekstrak nilai value murni
                const vals = {};
                for (const [k, obj] of Object.entries(resSettings.settings)) {
                    vals[k] = obj.value;
                }
                setSettings(vals);
                setInitialSettings(vals);
                setCanEdit(
                    Boolean(resMe?.ok) &&
                    (resMe.user?.role === "admin" || hasLevel(resMe.user?.permissions, "settings", "edit"))
                );
            })
            .catch(() => {
                if (active) setLoadError("Tidak dapat terhubung ke server");
            });

        return () => {
            active = false;
        };
    }, []);

    const handleChange = (key, val) => {
        setSettings((prev) => ({ ...prev, [key]: val }));
    };

    // Deteksi apakah ada perbedaan antara form dan initial
    const isDirty =
        settings &&
        initialSettings &&
        Object.keys(settings).some((k) => settings[k] !== initialSettings[k]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!isDirty) return;
        if (!reason.trim() || reason.trim().length < 3) {
            setMsg({
                type: "err",
                text: "Alasan perubahan wajib diisi (minimal 3 karakter) untuk kepatuhan jejak audit GMP.",
            });
            return;
        }

        setSaving(true);
        setMsg(null);

        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settings,
                    reason: reason.trim(),
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setMsg({ type: "ok", text: data.message || "Konfigurasi sistem berhasil disimpan dan diterapkan." });
                const newVals = {};
                for (const [k, obj] of Object.entries(data.settings)) {
                    newVals[k] = obj.value;
                }
                setSettings(newVals);
                setInitialSettings(newVals);
                setReason("");
            } else {
                setMsg({ type: "err", text: data.error || "Gagal menyimpan konfigurasi." });
            }
        } catch {
            setMsg({ type: "err", text: "Terjadi kesalahan jaringan saat menyimpan konfigurasi." });
        } finally {
            setSaving(false);
        }
    };

    if (loadError) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold text-scada-ink mb-3">Konfigurasi Sistem</h1>
                <div className="p-4 rounded border border-red-300 bg-red-50 text-red-700 text-sm">
                    {loadError}
                </div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold text-scada-ink mb-3">Konfigurasi Sistem</h1>
                <p className="text-sm text-scada-muted">Memuat data konfigurasi...</p>
            </div>
        );
    }

    const card = "bg-scada-card border border-scada-rule rounded p-5 flex flex-col gap-4";
    const inputNumber =
        "border border-scada-rule rounded px-3 py-1.5 text-sm bg-white text-scada-ink focus:outline-none focus:ring-1 focus:ring-scada-steam disabled:bg-gray-100 disabled:cursor-not-allowed";
    const pillBtn = (active) =>
        `px-2.5 py-1 text-xs rounded border transition-colors ${
            active
                ? "bg-scada-steam text-white border-scada-steam font-semibold"
                : "bg-white text-scada-ink border-scada-rule hover:bg-gray-50"
        } disabled:opacity-50`;

    return (
        <div className="p-6 flex flex-col gap-6 w-full">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-scada-rule pb-4">
                <div>
                    <h1 className="text-xl font-bold text-scada-ink flex items-center gap-2">
                        <svg
                            className="w-5 h-5 text-scada-steam"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        Konfigurasi Sistem
                    </h1>
                    <p className="text-xs text-scada-muted mt-1">
                        Pengaturan masa berlaku sesi login, auto-lockscreen layar diam, dan kriteria penghentian batch record.
                    </p>
                </div>
                <div>
                    {canEdit ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            Akses Edit (Admin)
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                            Hanya Baca (Viewer)
                        </span>
                    )}
                </div>
            </div>

            {/* ── Status Message Banner ── */}
            {msg && (
                <div
                    className={`text-sm rounded px-3 py-2 border flex items-center justify-between ${
                        msg.type === "ok"
                            ? "border-green-300 text-green-800 bg-green-50"
                            : "border-red-300 text-red-700 bg-red-50"
                    }`}
                >
                    <span>{msg.text}</span>
                    <button
                        type="button"
                        onClick={() => setMsg(null)}
                        className="text-xs font-bold ml-3 hover:opacity-70"
                    >
                        ✕
                    </button>
                </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-6 w-full">
                {/* ── Grid 2 Kolom untuk Seksi 1 & Seksi 2 pada Layar Lebar ── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {/* ── SEKSI 1: KEAMANAN & SESI ── */}
                    <section className={card}>
                        <div className="border-b border-scada-rule pb-2">
                            <h2 className="text-sm font-bold text-scada-ink flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-scada-steam"></span>
                                Keamanan & Sesi
                            </h2>
                            <p className="text-xs text-scada-muted mt-0.5">
                                Kontrol batas waktu otentikasi dan penguncian antarmuka untuk mencegah akses tidak sah.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Masa Berlaku Token Sesi Login */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-scada-ink">
                                    Masa Berlaku Sesi Login (Jam)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="72"
                                        step="1"
                                        className={`${inputNumber} w-28`}
                                        value={settings.session_timeout_hours ?? 8}
                                        onChange={(e) =>
                                            handleChange("session_timeout_hours", parseInt(e.target.value, 10) || 1)
                                        }
                                        disabled={!canEdit || saving}
                                    />
                                    <span className="text-xs text-scada-muted">Jam</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {[1, 4, 8, 12, 24].map((hrs) => (
                                        <button
                                            key={hrs}
                                            type="button"
                                            disabled={!canEdit || saving}
                                            className={pillBtn(settings.session_timeout_hours === hrs)}
                                            onClick={() => handleChange("session_timeout_hours", hrs)}
                                        >
                                            {hrs} Jam
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-scada-muted mt-0.5">
                                    Cookie dan token sesi JWT akan kedaluwarsa setelah durasi ini, mewajibkan operator login kembali.
                                </p>
                            </div>

                            {/* Durasi Auto-Lockscreen Layar Diam */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-scada-ink">
                                    Durasi Auto-Lockscreen (Menit)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        step="1"
                                        className={`${inputNumber} w-28`}
                                        value={settings.lockscreen_idle_minutes ?? 7}
                                        onChange={(e) =>
                                            handleChange("lockscreen_idle_minutes", parseInt(e.target.value, 10) || 1)
                                        }
                                        disabled={!canEdit || saving}
                                    />
                                    <span className="text-xs text-scada-muted">Menit</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {[1, 3, 5, 7, 10, 15].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            disabled={!canEdit || saving}
                                            className={pillBtn(settings.lockscreen_idle_minutes === mins)}
                                            onClick={() => handleChange("lockscreen_idle_minutes", mins)}
                                        >
                                            {mins} Menit
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-scada-muted mt-0.5">
                                    Jika tidak ada aktivitas ketukan keyboard atau klik mouse selama durasi ini, layar terkunci otomatis.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ── SEKSI 2: PENGHENTIAN OTOMATIS BATCH RECORD ── */}
                    <section className={card}>
                        <div className="border-b border-scada-rule pb-2">
                            <h2 className="text-sm font-bold text-scada-ink flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                Penghentian Otomatis Batch Record (Auto-Stop)
                            </h2>
                            <p className="text-xs text-scada-muted mt-0.5">
                                Menentukan kapan rekaman batch dan kurva sterilisasi secara otomatis dinyatakan selesai dan difinalisasi.
                            </p>
                        </div>

                        {/* Mode Penghentian */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-scada-ink">
                                Kriteria Pemicu Auto-Stop
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div
                                    onClick={() => canEdit && !saving && handleChange("batch_stop_mode", "pressure_zero")}
                                    className={`border rounded p-3 cursor-pointer transition-all ${
                                        settings.batch_stop_mode === "pressure_zero"
                                            ? "border-scada-steam bg-teal-50/50 ring-1 ring-scada-steam"
                                            : "border-scada-rule bg-white hover:bg-gray-50"
                                    } ${!canEdit || saving ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="batch_stop_mode"
                                            checked={settings.batch_stop_mode === "pressure_zero"}
                                            onChange={() => handleChange("batch_stop_mode", "pressure_zero")}
                                            disabled={!canEdit || saving}
                                            className="text-scada-steam focus:ring-scada-steam"
                                        />
                                        <span className="text-xs font-bold text-scada-ink">
                                            Tekanan P1 & P2 ≤ Ambang Batas (Disarankan)
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-scada-muted mt-1.5 ml-5 leading-relaxed">
                                        Batch berhenti otomatis begitu sterilisasi selesai dan tekanan chamber (P1) serta jacket (P2) sudah kembali terbuang ke ≤ 0 kPa (tekanan aman atmosfer).
                                    </p>
                                </div>

                                <div
                                    onClick={() => canEdit && !saving && handleChange("batch_stop_mode", "idle_timeout")}
                                    className={`border rounded p-3 cursor-pointer transition-all ${
                                        settings.batch_stop_mode === "idle_timeout"
                                            ? "border-scada-steam bg-teal-50/50 ring-1 ring-scada-steam"
                                            : "border-scada-rule bg-white hover:bg-gray-50"
                                    } ${!canEdit || saving ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="batch_stop_mode"
                                            checked={settings.batch_stop_mode === "idle_timeout"}
                                            onChange={() => handleChange("batch_stop_mode", "idle_timeout")}
                                            disabled={!canEdit || saving}
                                            className="text-scada-steam focus:ring-scada-steam"
                                        />
                                        <span className="text-xs font-bold text-scada-ink">
                                            Hanya Berdasarkan Waktu Idle PLC
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-scada-muted mt-1.5 ml-5 leading-relaxed">
                                        Batch baru difinalisasi setelah operator menekan tombol stop manual atau saat status PLC kembali Idle selama batas waktu cadangan.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-dashed border-scada-rule">
                            {/* Ambang Batas Tekanan */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-scada-ink">
                                    Ambang Batas Tekanan Auto-Stop (kPa)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="-20"
                                        max="50"
                                        step="0.5"
                                        className={`${inputNumber} w-28`}
                                        value={settings.batch_stop_pressure_threshold ?? 0}
                                        onChange={(e) =>
                                            handleChange(
                                                "batch_stop_pressure_threshold",
                                                parseFloat(e.target.value) || 0
                                            )
                                        }
                                        disabled={!canEdit || saving || settings.batch_stop_mode !== "pressure_zero"}
                                    />
                                    <span className="text-xs text-scada-muted">kPa</span>
                                </div>
                                <p className="text-[11px] text-scada-muted">
                                    Default 0 kPa. Batch berhenti jika P1 dan P2 ≤ nilai ini stabil selama 10 detik setelah melewati fase sterilisasi.
                                </p>
                            </div>

                            {/* Batas Waktu Idle Cadangan */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold text-scada-ink">
                                    Batas Waktu Idle Cadangan (Detik)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="30"
                                        max="600"
                                        step="10"
                                        className={`${inputNumber} w-28`}
                                        value={settings.batch_stop_idle_fallback_sec ?? 120}
                                        onChange={(e) =>
                                            handleChange(
                                                "batch_stop_idle_fallback_sec",
                                                parseInt(e.target.value, 10) || 120
                                            )
                                        }
                                        disabled={!canEdit || saving}
                                    />
                                    <span className="text-xs text-scada-muted">Detik ({Math.round((settings.batch_stop_idle_fallback_sec ?? 120) / 60)} Menit)</span>
                                </div>
                                <p className="text-[11px] text-scada-muted">
                                    Pengaman cadangan jika sensor tekanan mengalami offset atau jika mode idle aktif.
                                </p>
                            </div>
                        </div>

                        {/* Kirim Pulsa STOP ke PLC */}
                        <div className="pt-2 border-t border-dashed border-scada-rule">
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={Boolean(settings.batch_stop_pulse_plc)}
                                    onChange={(e) => handleChange("batch_stop_pulse_plc", e.target.checked)}
                                    disabled={!canEdit || saving}
                                    className="mt-0.5 rounded text-scada-steam focus:ring-scada-steam border-scada-rule"
                                />
                                <div>
                                    <span className="text-xs font-bold text-scada-ink">
                                        Otomatis Kirim Pulsa STOP ke Mesin PLC saat Batch Selesai
                                    </span>
                                    <p className="text-[11px] text-scada-muted mt-0.5">
                                        Mengirimkan sinyal pulsa STOP (M1.5) ke PLC untuk mematikan status END dan buzzer/lampu di mesin secara otomatis saat auto-stop terpicu.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </section>
                </div>

                {/* ── SEKSI 3: KONFIRMASI PERUBAHAN & AUDIT TRAIL ── */}
                {canEdit && (
                    <section className="bg-white border border-scada-rule rounded p-5 flex flex-col gap-4 shadow-sm">
                        <div className="border-b border-scada-rule pb-2">
                            <h2 className="text-sm font-bold text-scada-ink flex items-center gap-2">
                                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Jejak Audit Perubahan (FDA 21 CFR Part 11)
                            </h2>
                            <p className="text-xs text-scada-muted mt-0.5">
                                Setiap modifikasi parameter sistem wajib disertai alasan tertulis yang akan direkam permanen ke database Audit Log.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-scada-ink flex items-center justify-between">
                                <span>Alasan Perubahan Konfigurasi <span className="text-red-500">*</span></span>
                                <span className="text-[11px] text-scada-muted font-normal">Minimal 3 karakter</span>
                            </label>
                            <input
                                type="text"
                                className="border border-scada-rule rounded px-3 py-2 text-sm bg-white text-scada-ink placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-scada-steam disabled:bg-gray-100"
                                placeholder="Contoh: Penyesuaian batas auto-stop tekanan nol sesuai instruksi QA"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={!isDirty || saving}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <div className="text-xs text-scada-muted">
                                {isDirty ? (
                                    <span className="text-amber-600 font-medium">● Ada perubahan konfigurasi yang belum disimpan.</span>
                                ) : (
                                    <span>Tidak ada perubahan yang tertunda.</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSettings(initialSettings);
                                        setReason("");
                                        setMsg(null);
                                    }}
                                    disabled={!isDirty || saving}
                                    className="px-4 py-2 rounded text-sm border border-scada-rule text-scada-ink hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                >
                                    Batalkan
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isDirty || saving || reason.trim().length < 3}
                                    className="px-5 py-2 rounded text-sm font-semibold text-white bg-scada-steam hover:opacity-90 disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                            </svg>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        "Simpan Konfigurasi"
                                    )}
                                </button>
                            </div>
                        </div>
                    </section>
                )}
            </form>
        </div>
    );
}
