"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const EMPTY_FORM = {
    batchNo: "",
    loadingNo: "",
    operator: "",
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

    // Ambil daftar formula dari API saat halaman dimuat
    useEffect(() => {
        fetch("/api/formulas")
            .then((r) => r.json())
            .then((data) => {
                setFormulas(Array.isArray(data) ? data : []);
            })
            .catch(() => setFormulas([]))
            .finally(() => setLoadingFormulas(false));
    }, []);

    function handleChange(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
    }

    // Tombol submit disabled jika ada field yang kosong
    const allFilled = Object.values(form).every((v) => String(v).trim() !== "");

    async function handleSubmit(e) {
        e.preventDefault();
        if (!allFilled) return;

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/batch/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    actor: form.operator, // sementara pakai operator sebagai actor
                }),
            });
            const json = await res.json();

            if (!res.ok || json.ok === false) {
                setError(json.error ?? "Terjadi kesalahan, coba lagi.");
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
        "w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors";
    const labelBase = "block text-xs text-slate-400 uppercase mb-1";

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Persiapan Batch Baru</h1>
                <p className="text-sm text-slate-400 mt-1">
                    Super Water Sterilizer — Isi data batch sebelum memulai sterilisasi
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="mb-6 px-4 py-3 bg-red-900 border border-red-700 text-red-200 rounded text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="max-w-2xl">
                <div className="bg-slate-800 rounded-lg p-6 space-y-5">

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

                    {/* Baris 2: Operator & Mach. ID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className={labelBase}>Operator</label>
                            <input
                                type="text"
                                className={inputBase}
                                placeholder="Nama operator"
                                value={form.operator}
                                onChange={(e) => handleChange("operator", e.target.value)}
                            />
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
                            <p className="text-sm text-slate-500 italic">Memuat daftar formula…</p>
                        ) : formulas.length === 0 ? (
                            <p className="text-sm text-red-400">
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
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-700" />

                    {/* Tombol submit */}
                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={!allFilled || submitting}
                            className="flex-1 md:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded font-bold text-base transition-colors"
                        >
                            {submitting ? "Memulai…" : "▶ Mulai Sterilisasi"}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded font-semibold text-sm transition-colors"
                        >
                            Batal
                        </button>
                    </div>

                    {!allFilled && (
                        <p className="text-xs text-slate-500 italic">
                            Semua field harus diisi sebelum memulai sterilisasi.
                        </p>
                    )}
                </div>
            </form>
        </main>
    );
}
