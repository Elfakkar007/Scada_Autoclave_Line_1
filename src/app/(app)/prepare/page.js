"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EMPTY_FORM = {
    batchNo: "",
    loadingNo: "",
    machineId: "",
    productName: "",
    productSpec: "",
    formulaNo: "",
};

export default function PreparePage() {
    const router = useRouter();
    const [form, setForm] = useState(EMPTY_FORM);
    const [formulas, setFormulas] = useState([]);
    const [loadingFormulas, setLoadingFormulas] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    // invalidFields dari API (array { field, message }) untuk tampilan daftar di banner
    const [errorFields, setErrorFields] = useState([]);
    const [userFullName, setUserFullName] = useState("");
    // Checkbox konfirmasi keselamatan — wajib dicentang sebelum bisa submit
    const [safetyAck, setSafetyAck] = useState(false);

    // Ambil daftar formula dan info user dari session
    useEffect(() => {
        fetch("/api/formulas")
            .then((r) => r.json())
            .then((data) => setFormulas(Array.isArray(data) ? data : []))
            .catch(() => setFormulas([]))
            .finally(() => setLoadingFormulas(false));

        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (json.ok) setUserFullName(json.user.fullName ?? json.user.username); })
            .catch(() => {});
    }, []);

    function handleChange(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
        setErrorFields([]);
    }

    // Formula yang saat ini dipilih (dengan data validation dari API)
    const selectedFormula = formulas.find((f) => f.formulaNo === form.formulaNo) ?? null;
    const formulaProblems  = selectedFormula?.validation?.problems ?? [];
    const formulaWarnings  = selectedFormula?.validation?.warnings ?? [];
    const formulaInvalid   = selectedFormula !== null && selectedFormula?.validation?.ok === false;
    const formulaHasWarn   = formulaWarnings.length > 0 && !formulaInvalid;

    // Tombol submit disabled jika ada field yang kosong atau formula tidak valid
    const allFilled = Object.values(form).every((v) => String(v).trim() !== "");
    const canSubmit = allFilled && safetyAck && !formulaInvalid;

    async function handleSubmit(e) {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        setError(null);
        setErrorFields([]);

        try {
            const res = await fetch("/api/batch/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form), // operator & actor ditentukan server dari session
            });
            const json = await res.json();

            if (!res.ok || json.ok === false) {
                // Kalau ada invalidFields dari server, simpan untuk daftar di banner
                if (json.invalidFields && Array.isArray(json.invalidFields) && json.invalidFields.length > 0) {
                    setErrorFields(json.invalidFields);
                    setError(json.error ?? "Resep tidak valid.");
                } else {
                    setError(json.error ?? "Terjadi kesalahan, coba lagi.");
                }
                return;
            }

            // Sukses: redirect ke dashboard
            router.push("/");
        } catch {
            setError("Gagal terhubung ke server. Periksa koneksi jaringan.");
        } finally {
            setSubmitting(false);
        }
    }

    const inputBase =
        "w-full bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors";
    const labelBase = "block text-xs text-scada-muted uppercase mb-1";

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Persiapan Batch Baru</h1>
                <p className="text-sm text-scada-muted mt-1">
                    Super Water Sterilizer — Isi data batch sebelum memulai sterilisasi
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mb-6 px-4 py-3 bg-red-50 border border-scada-stop text-scada-stop rounded text-sm font-medium">
                    <p className="font-semibold">{error}</p>
                    {/* Daftar detail invalidFields dari API */}
                    {errorFields.length > 0 && (
                        <ul className="mt-2 list-disc list-inside space-y-0.5 text-xs">
                            {errorFields.map((f, i) => (
                                <li key={i}>{f.message ?? f.field}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="max-w-2xl">
                <div className="bg-scada-card border border-scada-rule rounded shadow-sm p-6 space-y-5">

                    {/* ── Banner peringatan MENULIS KE PLC ── */}
                    <div className="rounded border border-amber-600 bg-amber-950/60 px-4 py-3 flex gap-3">
                        <span className="text-amber-400 text-lg leading-none mt-0.5" aria-hidden="true">⚠️</span>
                        <div className="text-sm text-amber-200 leading-relaxed">
                            <strong className="font-semibold text-amber-300">PERHATIAN — Tulis Langsung ke PLC</strong>
                            <br />
                            Fitur ini akan menulis parameter resep dan memulai proses{" "}
                            <strong>LANGSUNG ke PLC mesin</strong>. Sebagian alamat &amp; scaling
                            parameter <strong>BELUM sepenuhnya terverifikasi</strong> ke program PLC asli.
                            Pastikan Anda mengawasi mesin secara langsung saat menggunakan fitur ini.
                        </div>
                    </div>

                    {/* ── Checkbox konfirmasi keselamatan ── */}
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                        <input
                            id="safety-ack-checkbox"
                            type="checkbox"
                            checked={safetyAck}
                            onChange={(e) => setSafetyAck(e.target.checked)}
                            className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-sm text-amber-200 group-hover:text-amber-100 transition-colors">
                            Saya memahami risiko di atas dan mengawasi mesin secara langsung saat ini
                        </span>
                    </label>

                    <div className="border-t border-scada-rule" />

                    {/* Baris 1: Batch No & Loading No */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelBase}>Batch No.</label>
                            <input
                                type="text"
                                className={inputBase}
                                placeholder="contoh: B-2024-001"
                                value={form.batchNo}
                                onChange={(e) => handleChange("batchNo", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelBase}>Loading No.</label>
                            <input
                                type="text"
                                className={inputBase}
                                placeholder="contoh: L-001"
                                value={form.loadingNo}
                                onChange={(e) => handleChange("loadingNo", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Baris 2: Operator (dari session, read-only) & Mach. ID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelBase}>Operator</label>
                            <div className="px-3 py-2 bg-scada-bg border border-scada-idle rounded text-sm text-scada-ink">
                                {userFullName || <span className="text-scada-muted italic">Memuat…</span>}
                            </div>
                            <p className="mt-1 text-xs text-scada-muted">Diisi otomatis dari akun yang login</p>
                        </div>
                        <div>
                            <label className={labelBase}>Mach. ID</label>
                            <input
                                type="text"
                                className={inputBase}
                                placeholder="contoh: SWS-01"
                                value={form.machineId}
                                onChange={(e) => handleChange("machineId", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Baris 3: Product Name & Specification */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelBase}>Product Name</label>
                            <input
                                type="text"
                                className={inputBase}
                                placeholder="Nama produk"
                                value={form.productName}
                                onChange={(e) => handleChange("productName", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelBase}>Specification</label>
                            <input
                                type="text"
                                className={inputBase}
                                placeholder="Spesifikasi produk"
                                value={form.productSpec}
                                onChange={(e) => handleChange("productSpec", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Baris 4: Pilih Formula */}
                    <div>
                        <label className={labelBase}>Pilih Formula</label>
                        {loadingFormulas ? (
                            <p className="text-sm text-scada-muted italic">Memuat daftar formula…</p>
                        ) : formulas.length === 0 ? (
                            <p className="text-sm text-scada-stop">
                                Tidak ada formula tersedia. Tambahkan di halaman Formula terlebih dahulu.
                            </p>
                        ) : (
                            <select
                                className={inputBase + " cursor-pointer"}
                                value={form.formulaNo}
                                onChange={(e) => handleChange("formulaNo", e.target.value)}
                            >
                                <option value="">-- Pilih Formula --</option>
                                {formulas.map((f) => (
                                    <option key={f.formulaNo} value={f.formulaNo}>
                                        {f.formulaNo} ({f.controlTemp}°C, {f.sterilTime} MIN)
                                        {/* Tanda peringatan di dropdown untuk resep tidak lengkap */}
                                        {f.validation && !f.validation.ok ? " — TIDAK LENGKAP" : ""}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Panel merah: formula tidak valid — tombol dinonaktifkan */}
                        {formulaInvalid && (
                            <div className="mt-2 px-4 py-3 bg-red-50 border border-scada-stop text-scada-stop rounded text-sm">
                                <p className="font-semibold mb-1">Formula ini belum bisa dipakai:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                    {formulaProblems.map((p, i) => (
                                        <li key={i}>{p.message}</li>
                                    ))}
                                </ul>
                                <p className="mt-2 text-xs opacity-70">
                                    Perbaiki formula di halaman Formula, lalu kembali ke sini.
                                </p>
                            </div>
                        )}

                        {/* Catatan kuning: ada warnings tapi masih valid — tombol tetap aktif */}
                        {formulaHasWarn && (
                            <div className="mt-2 px-4 py-3 bg-amber-950/40 border border-amber-600 text-amber-200 rounded text-sm">
                                <p className="font-semibold mb-1">Catatan formula:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                    {formulaWarnings.map((w, i) => (
                                        <li key={i}>{w.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-scada-rule" />

                    {/* Tombol submit */}
                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={!canSubmit || submitting}
                            className="flex-1 md:flex-none px-8 py-3 bg-scada-run hover:bg-scada-run-hover text-white disabled:opacity-40 disabled:cursor-not-allowed rounded font-bold text-base transition-colors"
                        >
                            {submitting ? "Memulai…" : "▶ Mulai Sterilisasi"}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="px-5 py-3 bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink rounded font-semibold text-sm transition-colors"
                        >
                            Batal
                        </button>
                    </div>

                    {(!allFilled || !safetyAck || formulaInvalid) && (
                        <p className="text-xs text-scada-muted italic">
                            {formulaInvalid
                                ? "Formula yang dipilih tidak lengkap — perbaiki terlebih dahulu."
                                : !safetyAck
                                ? "Centang kotak konfirmasi keselamatan di atas sebelum memulai."
                                : "Semua field harus diisi sebelum memulai sterilisasi."}
                        </p>
                    )}
                </div>
            </form>
        </main>
    );
}
