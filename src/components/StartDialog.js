/**
 * src/components/StartDialog.js — Dialog START batch dengan Self-Verification.
 *
 * Alur Kerja:
 *   1. Langkah 1 (Operator): Form isian data batch.
 *   2. Langkah 2 (Preview + Konfirmasi): Ringkasan data final yang jelas,
 *      diikuti input password milik user yang sedang login sebagai tanda tangan digital.
 *
 * Props:
 *   open        boolean        — tampilkan modal
 *   onClose     () => void     — tutup modal (batal / setelah sukses)
 *   onStarted   () => void     — callback setelah START berhasil
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { validateBatchNo, BATCH_NO_MAX_LEN, BATCH_NO_RULE_TEXT } from "@/lib/batchNo";
import { describeStartResponse } from "@/lib/plcCommandAlert";
import SearchableCombobox from "@/components/SearchableCombobox";

const EMPTY_FORM = {
    batchNo: "",
    bottleCount: "",
    machineId: "SG-40",
    productName: "",
    productSpec: "",
    formulaNo: "",
};

/** Satu baris label + input di dalam form */
function Field({ label, hint, error, children }) {
    return (
        <div>
            <label className="block text-[11px] text-[#5C6B6A] uppercase tracking-wide mb-1">
                {label}
            </label>
            {children}
            {error && <p className="mt-1 text-[11px] text-[#A23B2E]">{error}</p>}
            {!error && hint && <p className="mt-1 text-[11px] text-[#5C6B6A]">{hint}</p>}
        </div>
    );
}

/** Baris ringkasan label–value di preview */
function Row({ label, value, highlight }) {
    return (
        <div className="flex gap-2 py-1.5 border-b border-[#ECEEF0] last:border-0">
            <span className="text-[#5C6B6A] text-xs w-36 shrink-0">{label}</span>
            <span className={`text-xs break-all font-semibold ${highlight ? "text-[#1C6E74]" : "text-[#1E2A2E]"}`}>
                {value}
            </span>
        </div>
    );
}

const inputCls =
    "w-full bg-white border border-[#D8DEDC] rounded-[3px] px-2.5 py-1.5 text-sm text-[#1E2A2E] " +
    "focus:outline-none focus:border-[#1C6E74] transition-colors placeholder:text-[#B8C0BE]";

export default function StartDialog({ open, onClose, onStarted }) {
    // Tahap: "operator" (1) | "preview" (2 — preview + self-auth)
    const [step, setStep] = useState("operator");
    const [form, setForm] = useState(EMPTY_FORM);
    const [selfPassword, setSelfPassword] = useState("");

    const [formulas, setFormulas] = useState([]);
    const [loadingFormulas, setLoadingFormulas] = useState(true);
    const [productNames, setProductNames] = useState([]);
    const [productSpecs, setProductSpecs] = useState([]);
    const [userFullName, setUserFullName] = useState("");
    const [currentUsername, setCurrentUsername] = useState("");

    const [error, setError] = useState(null);
    const [errorFields, setErrorFields] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [startNotice, setStartNotice] = useState(null);
    const submittingRef = useRef(false);
    const passwordInputRef = useRef(null);

    // Reset ke state awal setiap kali dialog dibuka
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep("operator");
        setForm(EMPTY_FORM);
        setSelfPassword("");
        setError(null);
        setErrorFields([]);
        setSubmitting(false);
        setStartNotice(null);
        submittingRef.current = false;
    }, [open]);

    // Muat formula, master produk, dan sesi pengguna saat dialog dibuka
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoadingFormulas(true);
        fetch("/api/formulas")
            .then((r) => r.json())
            .then((data) => setFormulas(Array.isArray(data) ? data : []))
            .catch(() => setFormulas([]))
            .finally(() => setLoadingFormulas(false));

        fetch("/api/products?active=true")
            .then((r) => r.json())
            .then((data) => setProductNames(Array.isArray(data) ? data : []))
            .catch(() => setProductNames([]));

        fetch("/api/product-specs?active=true")
            .then((r) => r.json())
            .then((data) => setProductSpecs(Array.isArray(data) ? data : []))
            .catch(() => setProductSpecs([]));

        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                if (json.ok) {
                    setUserFullName(json.user.fullName ?? json.user.username);
                    setCurrentUsername(json.user.username ?? "");
                }
            })
            .catch(() => { });
    }, [open]);

    // Fokus ke password saat masuk step preview
    useEffect(() => {
        if (step === "preview") {
            setTimeout(() => passwordInputRef.current?.focus(), 80);
        }
    }, [step]);

    // Tutup dengan Escape jika tidak sedang submit
    useEffect(() => {
        if (!open) return;
        const fn = (e) => { if (e.key === "Escape" && !submitting) onClose(); };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [open, submitting, onClose]);

    function handleOperatorChange(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
        setErrorFields([]);
    }

    // ── Validasi Form ──────────────────────────────────────────────────────────
    const selectedFormula = formulas.find((f) => f.formulaNo === form.formulaNo) ?? null;
    const formulaProblems = selectedFormula?.validation?.problems ?? [];
    const formulaWarnings = selectedFormula?.validation?.warnings ?? [];
    const formulaInvalid = selectedFormula !== null && selectedFormula?.validation?.ok === false;
    const formulaHasWarn = formulaWarnings.length > 0 && !formulaInvalid;

    const allFilled = Object.keys(EMPTY_FORM).every((k) => String(form[k]).trim() !== "");
    const batchCheck = form.batchNo.trim() !== "" ? validateBatchNo(form.batchNo) : null;
    const batchInvalid = batchCheck !== null && !batchCheck.ok;
    const bottleNum = Number(form.bottleCount);
    const bottleInvalid = form.bottleCount.trim() !== "" && (!Number.isInteger(bottleNum) || bottleNum <= 0);
    const canProceed = allFilled && !formulaInvalid && !batchInvalid && !bottleInvalid;

    const isAuthFilled = selfPassword.trim() !== "";

    // ── Eksekusi Akhir START ke Server ─────────────────────────────────────────
    async function handleFinalStart() {
        if (!isAuthFilled || !canProceed || submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        setErrorFields([]);

        let started = false;
        let keepLocked = false;
        try {
            const payload = {
                batchNo: form.batchNo.trim(),
                bottleCount: form.bottleCount.trim(),
                productName: form.productName.trim(),
                productSpec: form.productSpec.trim(),
                machineId: form.machineId.trim(),
                formulaNo: form.formulaNo.trim(),
                // Self-verification: verifikator = user yang sama dengan operator
                verifierUsername: currentUsername,
                verifierPassword: selfPassword,
            };

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
                started = true;
                onStarted?.();
                onClose();
                return;
            }

            if (result.alert) {
                setStartNotice({ alert: result.alert, dismissable: result.dismissable });
                keepLocked = !result.dismissable;
                return;
            }

            if (json?.invalidFields && Array.isArray(json.invalidFields) && json.invalidFields.length > 0) {
                setErrorFields(json.invalidFields);
                setError(json.error ?? "Resep tidak valid.");
            } else {
                setError(json?.error ?? "Terjadi kesalahan, periksa password Anda.");
            }
        } finally {
            if (!started) {
                if (!keepLocked) submittingRef.current = false;
                setSubmitting(false);
            }
        }
    }

    if (!open) return null;

    // ══════════════════════════════════════════════════════════════════════════
    // LANGKAH 2: PREVIEW ISIAN FINAL + INPUT PASSWORD SELF-VERIFICATION
    // ══════════════════════════════════════════════════════════════════════════
    if (step === "preview") {
        const fLabel = selectedFormula
            ? `${selectedFormula.formulaNo} (${selectedFormula.controlTemp}°C, ${selectedFormula.sterilTime} mnt)`
            : form.formulaNo;

        return (
            <DialogOverlay maxWidth="max-w-lg" onClose={!submitting ? onClose : undefined}>
                <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-[#D8DEDC] pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1C6E74] text-white uppercase tracking-wider">
                                    Langkah 2 / Akhir
                                </span>
                                <h2 className="text-base font-bold text-[#1E2A2E]">
                                    Konfirmasi &amp; Verifikasi
                                </h2>
                            </div>
                            <p className="text-xs text-[#5C6B6A] mt-1">
                                Periksa data berikut lalu masukkan password Anda untuk memulai sterilisasi.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[#5C6B6A] hover:text-[#1E2A2E] text-lg leading-none"
                            aria-label="Tutup"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Error banner dari server */}
                    {error && (
                        <div className="rounded-[3px] border border-[#A23B2E] bg-[#FEF2F2] px-3 py-2 text-sm text-[#A23B2E]">
                            <p className="font-semibold">{error}</p>
                            {errorFields.length > 0 && (
                                <ul className="mt-1 list-disc list-inside text-[11px] space-y-0.5">
                                    {errorFields.map((f, i) => <li key={i}>{f.message ?? f.field}</li>)}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Peringatan START kritis */}
                    {startNotice && (
                        <div
                            role="alert"
                            className={`rounded-[3px] border px-3 py-2.5 text-sm space-y-1 ${
                                startNotice.alert.level === "error"
                                    ? "border-[#A23B2E] bg-[#FEF2F2] text-[#A23B2E]"
                                    : "border-[#B9762F] bg-[#FEF9EE] text-[#1E2A2E]"
                            }`}
                        >
                            <p className="font-semibold">{startNotice.alert.title}</p>
                            {startNotice.alert.lines.map((line, i) => (
                                <p key={i} className="text-[11px] leading-snug text-[#5C6B6A]">{line}</p>
                            ))}
                            <div className="flex gap-2 pt-1.5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-3 py-1.5 text-[11px] border border-[#D8DEDC] rounded-[3px] hover:bg-[#F5F7F6] transition-colors"
                                >
                                    Buka Dashboard
                                </button>
                                {startNotice.dismissable && (
                                    <button
                                        type="button"
                                        onClick={() => { setStartNotice(null); submittingRef.current = false; }}
                                        className="px-3 py-1.5 text-[11px] border border-[#D8DEDC] rounded-[3px] text-[#5C6B6A] hover:bg-[#F5F7F6] transition-colors"
                                    >
                                        Sudah dicek, tutup
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Ringkasan Data Final ── */}
                    <div className="rounded-[4px] border border-[#1C6E74]/30 bg-[#F4F9F9] p-4">
                        <p className="text-[11px] font-bold text-[#1C6E74] uppercase tracking-wider mb-2">
                            📋 Data Batch
                        </p>
                        <div className="divide-y divide-[#ECEEF0]">
                            <Row label="Batch No." value={form.batchNo} highlight />
                            <Row label="Amount (Botol)" value={`${Number(form.bottleCount).toLocaleString("id-ID")} Botol`} />
                            <Row label="Produk" value={form.productName} highlight />
                            <Row label="Spesifikasi" value={form.productSpec} />
                            <Row label="Mach. ID" value={form.machineId} />
                            <Row label="Operator" value={`${userFullName || currentUsername} (@${currentUsername})`} />
                            <Row label="Formula" value={fLabel} highlight />
                        </div>

                        {formulaHasWarn && (
                            <div className="mt-3 pt-2 border-t border-[#D8DEDC]">
                                <p className="text-[11px] text-[#B9762F] font-semibold">Catatan formula:</p>
                                <ul className="list-disc list-inside text-[11px] text-[#5C6B6A] space-y-0.5 mt-0.5">
                                    {formulaWarnings.map((w, i) => <li key={i}>{w.message}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* ── Self-Verification: Input Password ── */}
                    <div className="rounded-[4px] border border-[#D8DEDC] bg-white p-4 space-y-2">
                        <p className="text-[11px] font-bold text-[#5C6B6A] uppercase tracking-wider">
                            🔐 Verifikasi Identitas
                        </p>
                        <p className="text-xs text-[#5C6B6A]">
                            Masukkan password akun Anda&nbsp;
                            <strong className="text-[#1E2A2E]">({userFullName || currentUsername})</strong>
                            &nbsp;untuk mengotorisasi batch ini.
                        </p>
                        <input
                            ref={passwordInputRef}
                            type="password"
                            autoComplete="current-password"
                            placeholder="Masukkan password Anda"
                            className={inputCls}
                            value={selfPassword}
                            onChange={(e) => {
                                setSelfPassword(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && isAuthFilled && !submitting) {
                                    handleFinalStart();
                                }
                            }}
                        />
                    </div>

                    {/* Tombol aksi */}
                    <div className="flex gap-2 pt-1 border-t border-[#D8DEDC]">
                        <button
                            type="button"
                            disabled={!isAuthFilled || submitting}
                            onClick={handleFinalStart}
                            className="flex-1 py-2.5 rounded-[3px] bg-[#4F7A52] hover:bg-[#446C47] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            {submitting ? "Memulai Proses Sterilisasi…" : "▶ Ya, Mulai Sterilisasi Sekarang"}
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => { setError(null); setStep("operator"); }}
                            className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                        >
                            ← Ubah Isian
                        </button>
                    </div>
                </div>
            </DialogOverlay>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LANGKAH 1: FORM INISIATOR (OPERATOR)
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <DialogOverlay maxWidth="max-w-md" onClose={!submitting ? onClose : undefined}>
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#D8DEDC] pb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#4F7A52] text-white uppercase tracking-wider">
                                Langkah 1 dari 2
                            </span>
                            <h2 className="text-base font-bold text-[#1E2A2E]">Mulai Batch Baru</h2>
                        </div>
                        <p className="text-xs text-[#5C6B6A] mt-1">
                            Isi data batch. Langkah berikutnya: preview &amp; konfirmasi dengan password Anda.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="text-[#5C6B6A] hover:text-[#1E2A2E] text-lg leading-none"
                        aria-label="Tutup"
                    >
                        ✕
                    </button>
                </div>

                {/* Grid Form Input */}
                <div className="grid grid-cols-2 gap-3">
                    <Field
                        label="Batch No."
                        hint={`${BATCH_NO_RULE_TEXT} Harus unik.`}
                        error={batchInvalid ? batchCheck.error : null}
                    >
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="contoh: B-2024-001"
                            maxLength={BATCH_NO_MAX_LEN}
                            value={form.batchNo}
                            onChange={(e) => handleOperatorChange("batchNo", e.target.value)}
                        />
                    </Field>

                    <Field
                        label="Amount (Jumlah Botol)"
                        hint="Jumlah botol aktual dalam sterilizer."
                        error={bottleInvalid ? "Harus berupa angka bulat positif" : null}
                    >
                        <input
                            type="number"
                            min="1"
                            step="1"
                            className={inputCls}
                            placeholder="contoh: 2400"
                            value={form.bottleCount}
                            onChange={(e) => handleOperatorChange("bottleCount", e.target.value)}
                        />
                    </Field>

                    <Field label="Nama Produk">
                        <SearchableCombobox
                            value={form.productName}
                            onChange={(val) => handleOperatorChange("productName", val)}
                            options={productNames.map((p) => p.name)}
                            placeholder="Pilih produk atau ketik manual"
                        />
                    </Field>

                    <Field label="Spesifikasi Kemasan">
                        <SearchableCombobox
                            value={form.productSpec}
                            onChange={(val) => handleOperatorChange("productSpec", val)}
                            options={productSpecs.map((s) => s.spec)}
                            placeholder="Pilih spesifikasi atau ketik manual"
                        />
                    </Field>

                    <Field label="Mach. ID">
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="SG-40"
                            value={form.machineId}
                            onChange={(e) => handleOperatorChange("machineId", e.target.value)}
                        />
                    </Field>

                    <Field label="Operator">
                        <div className="px-2.5 py-1.5 rounded-[3px] border border-[#D8DEDC] bg-[#F5F7F6] text-sm text-[#1E2A2E] min-h-[34px] flex items-center justify-between">
                            <span>{userFullName || <span className="text-[#B8C0BE] italic">Memuat…</span>}</span>
                            {currentUsername && <span className="text-[11px] text-[#5C6B6A]">@{currentUsername}</span>}
                        </div>
                    </Field>

                    <div className="col-span-2">
                        <Field label="Formula">
                            {loadingFormulas ? (
                                <p className="text-sm text-[#5C6B6A] italic">Memuat daftar formula…</p>
                            ) : formulas.length === 0 ? (
                                <p className="text-sm text-[#A23B2E]">Tidak ada formula. Tambahkan di halaman Formula.</p>
                            ) : (
                                <select
                                    className={inputCls + " cursor-pointer"}
                                    value={form.formulaNo}
                                    onChange={(e) => handleOperatorChange("formulaNo", e.target.value)}
                                >
                                    <option value="">-- Pilih Formula --</option>
                                    {formulas.map((f) => (
                                        <option key={f.formulaNo} value={f.formulaNo}>
                                            {f.formulaNo} ({f.controlTemp}°C, {f.sterilTime} MIN)
                                            {f.validation && !f.validation.ok ? " — TIDAK LENGKAP" : ""}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </Field>
                    </div>
                </div>

                {/* Peringatan formula */}
                {formulaInvalid && (
                    <div className="rounded-[3px] border border-[#A23B2E] bg-[#FEF2F2] px-3 py-2 text-[11px] text-[#A23B2E]">
                        <p className="font-semibold mb-1">Formula ini belum bisa dipakai:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {formulaProblems.map((p, i) => <li key={i}>{p.message}</li>)}
                        </ul>
                    </div>
                )}
                {formulaHasWarn && (
                    <div className="rounded-[3px] border border-[#B9762F] bg-[#FEF9EE] px-3 py-2 text-[11px] text-[#5C6B6A]">
                        <p className="font-semibold text-[#B9762F] mb-1">Catatan formula:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {formulaWarnings.map((w, i) => <li key={i}>{w.message}</li>)}
                        </ul>
                    </div>
                )}

                {/* Tombol aksi */}
                <div className="flex gap-2 pt-1 border-t border-[#D8DEDC]">
                    <button
                        type="button"
                        disabled={!canProceed}
                        onClick={() => { if (canProceed) setStep("preview"); }}
                        title={
                            !canProceed
                                ? formulaInvalid ? "Formula tidak lengkap"
                                    : batchInvalid ? "Format Batch No. salah"
                                        : "Isi semua field dulu"
                                : undefined
                        }
                        className="flex-1 py-2 rounded-[3px] bg-[#1C6E74] hover:bg-[#155358] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                        Lanjut ke Preview &amp; Konfirmasi →
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                    >
                        Batal
                    </button>
                </div>

                {!canProceed && !formulaInvalid && !batchInvalid && (
                    <p className="text-[11px] text-[#5C6B6A] italic -mt-2">Semua field harus diisi sebelum melanjutkan.</p>
                )}
            </div>
        </DialogOverlay>
    );
}

/** Wrapper overlay modal */
function DialogOverlay({ children, onClose, maxWidth = "max-w-md" }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                className={`bg-white rounded-[4px] border border-[#D8DEDC] shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-5 transition-all`}
            >
                {children}
            </div>
        </div>
    );
}
