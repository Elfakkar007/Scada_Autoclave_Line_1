"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateBatchNo, BATCH_NO_MAX_LEN, BATCH_NO_RULE_TEXT } from "@/lib/batchNo";
import { describeStartResponse } from "@/lib/plcCommandAlert";

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
    // Run kosongan (tes tanpa produk): Batch No, Loading, Produk diisi otomatis oleh server
    const [emptyRun, setEmptyRun] = useState(false);
    // Penjaga anti-klik ganda: state React baru berlaku setelah render, ref berlaku seketika
    const submittingRef = useRef(false);
    // Peringatan hasil START yang tidak mulus (item 10): START mungkin tertahan ON, batch gagal
    // dicatat padahal mesin jalan, atau hasil tidak diketahui. Bentuk: { alert, dismissable } atau null.
    // Tidak hilang sendiri; selama ada, tombol Mulai terkunci.
    const [startNotice, setStartNotice] = useState(null);

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
            .catch(() => { });
    }, []);

    function handleChange(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
        setErrorFields([]);
    }

    // Formula yang saat ini dipilih (dengan data validation dari API)
    const selectedFormula = formulas.find((f) => f.formulaNo === form.formulaNo) ?? null;
    const formulaProblems = selectedFormula?.validation?.problems ?? [];
    const formulaWarnings = selectedFormula?.validation?.warnings ?? [];
    const formulaInvalid = selectedFormula !== null && selectedFormula?.validation?.ok === false;
    const formulaHasWarn = formulaWarnings.length > 0 && !formulaInvalid;

    // Tombol submit disabled jika ada field yang kosong atau formula tidak valid
    const requiredKeys = emptyRun ? ["machineId", "formulaNo"] : Object.keys(EMPTY_FORM);
    const allFilled = requiredKeys.every((k) => String(form[k]).trim() !== "");
    // Format Batch No dicek di klien hanya untuk umpan balik cepat; server tetap memvalidasi ulang
    const batchNoCheck = !emptyRun && form.batchNo.trim() !== "" ? validateBatchNo(form.batchNo) : null;
    const batchNoInvalid = batchNoCheck !== null && !batchNoCheck.ok;
    const canSubmit = allFilled && safetyAck && !formulaInvalid && !batchNoInvalid && startNotice === null;

    async function handleSubmit(e) {
        e.preventDefault();
        if (!canSubmit || submittingRef.current) return;
        submittingRef.current = true;

        setSubmitting(true);
        setError(null);
        setErrorFields([]);

        let started = false;
        // true bila mesin sudah/mungkin berjalan: kunci anti-klik ganda TIDAK dilepas
        let keepLocked = false;
        try {
            // operator & actor ditentukan server dari session
            const payload = emptyRun
                ? { emptyRun: true, machineId: form.machineId, formulaNo: form.formulaNo }
                : { ...form, emptyRun: false };

            let json = null;
            let networkError = false;
            try {
                const res = await fetch("/api/batch/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                json = await res.json().catch(() => null);
            } catch {
                networkError = true;
            }

            const result = describeStartResponse({ networkError, json });

            if (result.outcome === "started") {
                // Sukses bersih: redirect ke dashboard. Tombol sengaja TIDAK diaktifkan lagi
                // supaya tidak bisa diklik ulang selama perpindahan halaman.
                started = true;
                router.push("/");
                return;
            }

            if (result.alert) {
                // START tidak mulus (mungkin tertahan ON / batch gagal dicatat / hasil tidak
                // diketahui): tampilkan peringatan permanen dan JANGAN redirect otomatis.
                setStartNotice({ alert: result.alert, dismissable: result.dismissable });
                keepLocked = !result.dismissable;
                return;
            }

            // Ditolak biasa: banner error seperti sebelumnya. Kalau ada invalidFields dari
            // server, simpan untuk daftar di banner.
            if (json.invalidFields && Array.isArray(json.invalidFields) && json.invalidFields.length > 0) {
                setErrorFields(json.invalidFields);
                setError(json.error ?? "Resep tidak valid.");
            } else {
                setError(json.error ?? "Terjadi kesalahan, coba lagi.");
            }
        } finally {
            if (!started) {
                if (!keepLocked) submittingRef.current = false;
                setSubmitting(false);
            }
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

                    {/* ── Run kosongan (tes tanpa produk) ── */}
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            id="empty-run-checkbox"
                            type="checkbox"
                            checked={emptyRun}
                            onChange={(e) => { setEmptyRun(e.target.checked); setError(null); setErrorFields([]); }}
                            className="mt-0.5 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className="text-sm text-scada-ink">
                            <strong className="font-semibold">Run kosongan</strong> (tes mesin tanpa produk)
                        </span>
                    </label>

                    {emptyRun ? (
                        <div className="rounded border border-scada-rule bg-scada-bg px-4 py-3 text-sm text-scada-ink space-y-1">
                            <p>
                                Batch No. diisi otomatis: <span className="font-mono font-semibold">KOSONGAN dd.mm.yy</span>{" "}
                                (akhiran -2, -3 jika sudah ada pada hari yang sama).
                            </p>
                            <p className="text-xs text-scada-muted">
                                Loading No. = N/A; Product Name dan Specification = “-”.
                            </p>
                        </div>
                    ) : (
                        /* Baris 1: Batch No & Loading No */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className={labelBase}>Batch No.</label>
                                <input
                                    type="text"
                                    className={inputBase}
                                    placeholder="contoh: B-2024-001"
                                    maxLength={BATCH_NO_MAX_LEN}
                                    value={form.batchNo}
                                    onChange={(e) => handleChange("batchNo", e.target.value)}
                                />
                                {batchNoInvalid ? (
                                    <p className="mt-1 text-xs text-scada-stop">{batchNoCheck.error}</p>
                                ) : (
                                    <p className="mt-1 text-xs text-scada-muted">{BATCH_NO_RULE_TEXT} Harus unik.</p>
                                )}
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
                    )}

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

                    {/* Baris 3: Product Name & Specification (tidak dipakai pada run kosongan) */}
                    {!emptyRun && (
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
                    )}

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

                    {/* ── Peringatan hasil START (item 10): tepat di atas tombol, tidak hilang sendiri ── */}
                    {startNotice && (
                        <div
                            role="alert"
                            className={`rounded border px-4 py-3 text-sm space-y-1 ${startNotice.alert.level === "error"
                                ? "bg-red-50 border-scada-stop text-scada-stop"
                                : "bg-amber-50 border-amber-600 text-amber-900"
                                }`}
                        >
                            <p className="font-semibold">{startNotice.alert.title}</p>
                            {startNotice.alert.lines.map((line, i) => (
                                <p key={i} className="text-xs leading-snug text-scada-ink">{line}</p>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => router.push("/")}
                                    className="px-4 py-2 bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink rounded font-semibold text-xs transition-colors"
                                >
                                    Buka Dashboard
                                </button>
                                {startNotice.dismissable && (
                                    <button
                                        type="button"
                                        onClick={() => { setStartNotice(null); submittingRef.current = false; }}
                                        className="px-4 py-2 bg-white border border-scada-idle hover:bg-scada-bg text-scada-muted rounded text-xs transition-colors"
                                    >
                                        Sudah dicek, tutup
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

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

                    {(!allFilled || !safetyAck || formulaInvalid || batchNoInvalid) && (
                        <p className="text-xs text-scada-muted italic">
                            {formulaInvalid
                                ? "Formula yang dipilih tidak lengkap — perbaiki terlebih dahulu."
                                : batchNoInvalid
                                    ? "Perbaiki format Batch No. terlebih dahulu."
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