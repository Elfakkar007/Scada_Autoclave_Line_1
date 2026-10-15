/**
 * src/components/StartDialog.js — Dialog START batch (item 17a).
 *
 * Menggantikan halaman /prepare. Muncul sebagai modal overlay saat
 * tombol START di dashboard diklik. Alur:
 *   1. Form isian (batch no, loading, machine, produk, formula)
 *   2. Konfirmasi akhir ("Yakin memulai?") sebelum request dikirim ke PLC
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

const EMPTY_FORM = {
    batchNo: "",
    loadingNo: "",
    machineId: "SG-40",       // default SG-40 sesuai ROADMAP item 17a
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

const inputCls =
    "w-full bg-white border border-[#D8DEDC] rounded-[3px] px-2.5 py-1.5 text-sm text-[#1E2A2E] " +
    "focus:outline-none focus:border-[#1C6E74] transition-colors placeholder:text-[#B8C0BE]";

export default function StartDialog({ open, onClose, onStarted }) {
    const [step, setStep] = useState("form");   // "form" | "confirm"
    const [form, setForm] = useState(EMPTY_FORM);
    const [formulas, setFormulas] = useState([]);
    const [loadingFormulas, setLoadingFormulas] = useState(true);
    const [productNames, setProductNames] = useState([]);
    const [productSpecs, setProductSpecs] = useState([]);
    const [userFullName, setUserFullName] = useState("");
    const [error, setError] = useState(null);
    const [errorFields, setErrorFields] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [startNotice, setStartNotice] = useState(null);
    const submittingRef = useRef(false);

    // Reset ke state awal setiap kali dialog dibuka
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep("form");
        setForm(EMPTY_FORM);
        setError(null);
        setErrorFields([]);
        setSubmitting(false);
        setStartNotice(null);
        submittingRef.current = false;
    }, [open]);

    // Muat formula dan nama pengguna saat dialog pertama kali dibuka
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
            .then((json) => { if (json.ok) setUserFullName(json.user.fullName ?? json.user.username); })
            .catch(() => { });
    }, [open]);

    // Tutup dengan Escape
    useEffect(() => {
        if (!open) return;
        const fn = (e) => { if (e.key === "Escape" && !submitting) onClose(); };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [open, submitting, onClose]);

    function handleChange(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
        setErrorFields([]);
    }

    // ── Validasi form ──────────────────────────────────────────────────────────
    const selectedFormula = formulas.find((f) => f.formulaNo === form.formulaNo) ?? null;
    const formulaProblems = selectedFormula?.validation?.problems ?? [];
    const formulaWarnings = selectedFormula?.validation?.warnings ?? [];
    const formulaInvalid = selectedFormula !== null && selectedFormula?.validation?.ok === false;
    const formulaHasWarn = formulaWarnings.length > 0 && !formulaInvalid;

    const allFilled = Object.keys(EMPTY_FORM).every((k) => String(form[k]).trim() !== "");
    const batchNoCheck = form.batchNo.trim() !== "" ? validateBatchNo(form.batchNo) : null;
    const batchNoInvalid = batchNoCheck !== null && !batchNoCheck.ok;
    const canProceed = allFilled && !formulaInvalid && !batchNoInvalid && startNotice === null;

    // ── Request START ke server ────────────────────────────────────────────────
    async function handleConfirm() {
        if (!canProceed || submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        setErrorFields([]);

        let started = false;
        let keepLocked = false;
        try {
            const payload = { ...form };

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
                // START tidak mulus (stuckRisk, batch gagal dicatat, dll) — tampilkan peringatan
                setStartNotice({ alert: result.alert, dismissable: result.dismissable });
                keepLocked = !result.dismissable;
                setStep("form");   // kembali ke form agar operator bisa baca peringatan
                return;
            }

            // Ditolak biasa
            if (json?.invalidFields && Array.isArray(json.invalidFields) && json.invalidFields.length > 0) {
                setErrorFields(json.invalidFields);
                setError(json.error ?? "Resep tidak valid.");
            } else {
                setError(json?.error ?? "Terjadi kesalahan, coba lagi.");
            }
            setStep("form");
        } finally {
            if (!started) {
                if (!keepLocked) submittingRef.current = false;
                setSubmitting(false);
            }
        }
    }

    if (!open) return null;

    // ── Konfirmasi akhir (langkah 2) ──────────────────────────────────────────
    if (step === "confirm") {
        const fLabel = selectedFormula
            ? `${selectedFormula.formulaNo} (${selectedFormula.controlTemp}°C, ${selectedFormula.sterilTime} mnt)`
            : form.formulaNo;
        return (
            <DialogOverlay onClose={!submitting ? onClose : undefined}>
                <div className="flex flex-col gap-4">
                    <h2 className="text-base font-bold text-[#1E2A2E]">Konfirmasi Mulai Sterilisasi</h2>

                    <div className="rounded-[3px] border border-[#D8DEDC] bg-[#F5F7F6] px-3 py-3 space-y-1.5 text-sm">
                        <Row label="Batch No." value={form.batchNo} />
                        <Row label="Loading No." value={form.loadingNo} />
                        <Row label="Produk" value={form.productName} />
                        <Row label="Spesifikasi" value={form.productSpec} />
                        <Row label="Mach. ID" value={form.machineId} />
                        <Row label="Operator" value={userFullName || "—"} />
                        <Row label="Formula" value={fLabel} />
                        {formulaHasWarn && (
                            <div className="pt-1 border-t border-[#D8DEDC]">
                                <p className="text-[11px] text-[#B9762F] font-semibold">Catatan formula:</p>
                                <ul className="list-disc list-inside text-[11px] text-[#5C6B6A] space-y-0.5">
                                    {formulaWarnings.map((w, i) => <li key={i}>{w.message}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-[#1E2A2E]">
                        Setpoint akan <strong>ditulis langsung ke PLC</strong> dan mesin akan mulai proses.
                        Pastikan mesin dalam kondisi aman dan operator hadir di lokasi.
                    </p>

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleConfirm}
                            className="flex-1 py-2 rounded-[3px] bg-[#4F7A52] hover:bg-[#446C47] active:bg-[#3A5C3D] text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Memulai…" : "▶ Ya, Mulai Sekarang"}
                        </button>
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setStep("form")}
                            className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors disabled:opacity-50"
                        >
                            Ubah
                        </button>
                    </div>
                </div>
            </DialogOverlay>
        );
    }

    // ── Langkah 1: Form isian ─────────────────────────────────────────────────
    return (
        <DialogOverlay onClose={!submitting ? onClose : undefined}>
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-[#1E2A2E]">Mulai Batch Baru</h2>
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

                {/* Error dari server */}
                {error && (
                    <div className="rounded-[3px] border border-[#A23B2E] bg-[#FEF2F2] px-3 py-2 text-sm text-[#A23B2E]">
                        <p className="font-semibold">{error}</p>
                        {errorFields.length > 0 && (
                            <ul className="mt-1.5 list-disc list-inside text-[11px] space-y-0.5">
                                {errorFields.map((f, i) => <li key={i}>{f.message ?? f.field}</li>)}
                            </ul>
                        )}
                    </div>
                )}

                {/* Peringatan START tidak mulus (item 10) */}
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

                <div className="grid grid-cols-2 gap-3">
                    <Field
                        label="Batch No."
                        hint={`${BATCH_NO_RULE_TEXT} Harus unik.`}
                        error={batchNoInvalid ? batchNoCheck.error : null}
                    >
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="contoh: B-2024-001"
                            maxLength={BATCH_NO_MAX_LEN}
                            value={form.batchNo}
                            onChange={(e) => handleChange("batchNo", e.target.value)}
                        />
                    </Field>
                    <Field label="Loading No.">
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="contoh: L-001"
                            value={form.loadingNo}
                            onChange={(e) => handleChange("loadingNo", e.target.value)}
                        />
                    </Field>
                    <Field label="Nama Produk">
                        {productNames.length > 0 && (
                            <select
                                className={inputCls + " mb-1.5 cursor-pointer bg-[#F8FAFC] text-xs font-semibold"}
                                onChange={(e) => {
                                    if (e.target.value) handleChange("productName", e.target.value);
                                }}
                                value=""
                            >
                                <option value="">-- Pilih dari Master Produk --</option>
                                {productNames.map((p) => (
                                    <option key={p.id} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="Nama produk (atau ketik manual)"
                            value={form.productName}
                            onChange={(e) => handleChange("productName", e.target.value)}
                        />
                    </Field>

                    <Field label="Spesifikasi Kemasan">
                        {productSpecs.length > 0 && (
                            <select
                                className={inputCls + " mb-1.5 cursor-pointer bg-[#F8FAFC] text-xs font-semibold"}
                                onChange={(e) => {
                                    if (e.target.value) handleChange("productSpec", e.target.value);
                                }}
                                value=""
                            >
                                <option value="">-- Pilih dari Master Spesifikasi --</option>
                                {productSpecs.map((s) => (
                                    <option key={s.id} value={s.spec}>
                                        {s.spec}
                                    </option>
                                ))}
                            </select>
                        )}
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="Spesifikasi (atau ketik manual)"
                            value={form.productSpec}
                            onChange={(e) => handleChange("productSpec", e.target.value)}
                        />
                    </Field>
                </div>

                {/* Baris Operator & Mach. ID */}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Operator">
                        <div className="px-2.5 py-1.5 rounded-[3px] border border-[#D8DEDC] bg-[#F5F7F6] text-sm text-[#1E2A2E] min-h-[34px]">
                            {userFullName || <span className="text-[#B8C0BE] italic">Memuat…</span>}
                        </div>
                    </Field>
                    <Field label="Mach. ID">
                        <input
                            type="text"
                            className={inputCls}
                            placeholder="SG-40"
                            value={form.machineId}
                            onChange={(e) => handleChange("machineId", e.target.value)}
                        />
                    </Field>
                </div>

                {/* Pilih Formula */}
                <Field label="Formula">
                    {loadingFormulas ? (
                        <p className="text-sm text-[#5C6B6A] italic">Memuat daftar formula…</p>
                    ) : formulas.length === 0 ? (
                        <p className="text-sm text-[#A23B2E]">Tidak ada formula. Tambahkan di halaman Formula.</p>
                    ) : (
                        <select
                            className={inputCls + " cursor-pointer"}
                            value={form.formulaNo}
                            onChange={(e) => handleChange("formulaNo", e.target.value)}
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

                    {formulaInvalid && (
                        <div className="mt-1.5 rounded-[3px] border border-[#A23B2E] bg-[#FEF2F2] px-3 py-2 text-[11px] text-[#A23B2E]">
                            <p className="font-semibold mb-1">Formula ini belum bisa dipakai:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {formulaProblems.map((p, i) => <li key={i}>{p.message}</li>)}
                            </ul>
                        </div>
                    )}
                    {formulaHasWarn && (
                        <div className="mt-1.5 rounded-[3px] border border-[#B9762F] bg-[#FEF9EE] px-3 py-2 text-[11px] text-[#5C6B6A]">
                            <p className="font-semibold text-[#B9762F] mb-1">Catatan formula:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {formulaWarnings.map((w, i) => <li key={i}>{w.message}</li>)}
                            </ul>
                        </div>
                    )}
                </Field>

                {/* Tombol aksi */}
                <div className="flex gap-2 pt-1 border-t border-[#D8DEDC]">
                    <button
                        type="button"
                        disabled={!canProceed}
                        onClick={() => canProceed && setStep("confirm")}
                        title={
                            !canProceed
                                ? formulaInvalid ? "Formula tidak lengkap"
                                    : batchNoInvalid ? "Format Batch No. salah"
                                        : "Isi semua field dulu"
                                : undefined
                        }
                        className="flex-1 py-2 rounded-[3px] bg-[#4F7A52] hover:bg-[#446C47] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Lanjut →
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                    >
                        Batal
                    </button>
                </div>

                {!canProceed && !formulaInvalid && !batchNoInvalid && (
                    <p className="text-[11px] text-[#5C6B6A] italic -mt-2">Semua field harus diisi sebelum melanjutkan.</p>
                )}
            </div>
        </DialogOverlay>
    );
}

/** Wrapper overlay modal */
function DialogOverlay({ children, onClose }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="bg-white rounded-[4px] border border-[#D8DEDC] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5"
            >
                {children}
            </div>
        </div>
    );
}

/** Baris label–value di panel ringkasan konfirmasi */
function Row({ label, value }) {
    return (
        <div className="flex gap-2 text-[12px]">
            <span className="text-[#5C6B6A] w-24 shrink-0">{label}</span>
            <span className="text-[#1E2A2E] font-medium break-all">{value}</span>
        </div>
    );
}
