/**
 * src/components/StartDialog.js — Dialog START batch dengan Verifikasi 2 Langkah & Overwrite.
 *
 * Alur Kerja (Four-Eyes Principle dengan Fleksibilitas Overwrite):
 *   1. Langkah 1 (Operator / User 1): Form isian data batch awal.
 *   2. Langkah 2 (Verifikasi Berdampingan / Side-by-Side):
 *      - Panel Kiri: Isian awal Operator (User 1) sebagai referensi (read-only).
 *      - Panel Kanan: Form Verifikasi User 2 (pre-filled dari User 1) dengan hak overwrite/koreksi bila ada kesalahan.
 *   3. Langkah 3 (Preview Isian Final): Tampilan ringkasan data akhir dari Verifikator sebelum eksekusi.
 *   4. Langkah 4 (Otentikasi Kredensial Verifikator): Pop-up pilihan akun verifikator dari daftar User Management
 *      (selain User 1) & input password verifikator sebagai tanda tangan digital akhir.
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
    bottleCount: "",          // Jumlah botol / amount yang diisi manual oleh operator
    machineId: "SG-40",       // default SG-40 sesuai ROADMAP item 17a
    productName: "",
    productSpec: "",
    formulaNo: "",
};

const EMPTY_AUTH = {
    username: "",
    password: "",
};

/** Satu baris label + input di dalam form */
function Field({ label, hint, error, badge, children }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] text-[#5C6B6A] uppercase tracking-wide">
                    {label}
                </label>
                {badge && <div>{badge}</div>}
            </div>
            {children}
            {error && <p className="mt-1 text-[11px] text-[#A23B2E]">{error}</p>}
            {!error && hint && <p className="mt-1 text-[11px] text-[#5C6B6A]">{hint}</p>}
        </div>
    );
}

/** Baris nilai read-only untuk panel User 1 */
function ReadOnlyField({ label, value }) {
    return (
        <div>
            <label className="block text-[11px] text-[#5C6B6A] uppercase tracking-wide mb-1">
                {label}
            </label>
            <div className="w-full bg-[#FFFFFF] border border-[#D8DEDC] rounded-[3px] px-2.5 py-1.5 text-sm text-[#1E2A2E] min-h-[34px] flex items-center">
                {value || <span className="text-[#B8C0BE] italic">—</span>}
            </div>
        </div>
    );
}

/** Baris ringkasan label–value */
function Row({ label, value }) {
    return (
        <div className="flex gap-2 text-[12px]">
            <span className="text-[#5C6B6A] w-28 shrink-0">{label}</span>
            <span className="text-[#1E2A2E] font-medium break-all">{value}</span>
        </div>
    );
}

const inputCls =
    "w-full bg-white border border-[#D8DEDC] rounded-[3px] px-2.5 py-1.5 text-sm text-[#1E2A2E] " +
    "focus:outline-none focus:border-[#1C6E74] transition-colors placeholder:text-[#B8C0BE]";

export default function StartDialog({ open, onClose, onStarted }) {
    // Tahap: "operator" (1) | "verifier" (2) | "preview" (3) | "auth" (4)
    const [step, setStep] = useState("operator");
    const [form, setForm] = useState(EMPTY_FORM);
    const [verifierForm, setVerifierForm] = useState(EMPTY_FORM);
    const [verifierAuth, setVerifierAuth] = useState(EMPTY_AUTH);

    const [formulas, setFormulas] = useState([]);
    const [loadingFormulas, setLoadingFormulas] = useState(true);
    const [productNames, setProductNames] = useState([]);
    const [productSpecs, setProductSpecs] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [userFullName, setUserFullName] = useState("");
    const [currentUsername, setCurrentUsername] = useState("");

    const [error, setError] = useState(null);
    const [errorFields, setErrorFields] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [startNotice, setStartNotice] = useState(null);
    const submittingRef = useRef(false);

    // Reset ke state awal setiap kali dialog dibuka
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStep("operator");
        setForm(EMPTY_FORM);
        setVerifierForm(EMPTY_FORM);
        setVerifierAuth(EMPTY_AUTH);
        setError(null);
        setErrorFields([]);
        setSubmitting(false);
        setStartNotice(null);
        submittingRef.current = false;
    }, [open]);

    // Muat formula, master produk, daftar user, dan sesi pengguna saat dialog dibuka
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

        fetch("/api/auth/users")
            .then((r) => r.json())
            .then((json) => {
                if (json.ok && Array.isArray(json.users)) {
                    setAvailableUsers(json.users);
                }
            })
            .catch(() => setAvailableUsers([]));

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

    function handleVerifierChange(key, value) {
        setVerifierForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
        setErrorFields([]);
    }

    // ── Validasi Form User 1 (Operator Inisiator) ──────────────────────────────
    const selectedFormulaOp = formulas.find((f) => f.formulaNo === form.formulaNo) ?? null;
    const formulaProblemsOp = selectedFormulaOp?.validation?.problems ?? [];
    const formulaWarningsOp = selectedFormulaOp?.validation?.warnings ?? [];
    const formulaInvalidOp = selectedFormulaOp !== null && selectedFormulaOp?.validation?.ok === false;
    const formulaHasWarnOp = formulaWarningsOp.length > 0 && !formulaInvalidOp;

    const opAllFilled = Object.keys(EMPTY_FORM).every((k) => String(form[k]).trim() !== "");
    const opBatchCheck = form.batchNo.trim() !== "" ? validateBatchNo(form.batchNo) : null;
    const opBatchInvalid = opBatchCheck !== null && !opBatchCheck.ok;
    const opBottleNum = Number(form.bottleCount);
    const opBottleInvalid = form.bottleCount.trim() !== "" && (!Number.isInteger(opBottleNum) || opBottleNum <= 0);
    const opCanProceed = opAllFilled && !formulaInvalidOp && !opBatchInvalid && !opBottleInvalid;

    // ── Validasi Form User 2 (Verifikator Final) ────────────────────────────────
    const selectedFormulaV = formulas.find((f) => f.formulaNo === verifierForm.formulaNo) ?? null;
    const formulaProblemsV = selectedFormulaV?.validation?.problems ?? [];
    const formulaWarningsV = selectedFormulaV?.validation?.warnings ?? [];
    const formulaInvalidV = selectedFormulaV !== null && selectedFormulaV?.validation?.ok === false;
    const formulaHasWarnV = formulaWarningsV.length > 0 && !formulaInvalidV;

    const vAllFilled = Object.keys(EMPTY_FORM).every((k) => String(verifierForm[k]).trim() !== "");
    const vBatchCheck = verifierForm.batchNo.trim() !== "" ? validateBatchNo(verifierForm.batchNo) : null;
    const vBatchInvalid = vBatchCheck !== null && !vBatchCheck.ok;
    const vBottleNum = Number(verifierForm.bottleCount);
    const vBottleInvalid = verifierForm.bottleCount.trim() !== "" && (!Number.isInteger(vBottleNum) || vBottleNum <= 0);
    const vCanProceed = vAllFilled && !formulaInvalidV && !vBatchInvalid && !vBottleInvalid;

    // Deteksi field yang di-overwrite oleh verifikator
    const isBatchNoOverwritten = verifierForm.batchNo.trim() !== form.batchNo.trim();
    const isBottleCountOverwritten = String(verifierForm.bottleCount).trim() !== String(form.bottleCount).trim();
    const isProductNameOverwritten = verifierForm.productName.trim() !== form.productName.trim();
    const isProductSpecOverwritten = verifierForm.productSpec.trim() !== form.productSpec.trim();
    const isMachineIdOverwritten = verifierForm.machineId.trim() !== form.machineId.trim();
    const isFormulaNoOverwritten = verifierForm.formulaNo.trim() !== form.formulaNo.trim();

    const overwrittenList = [];
    if (isBatchNoOverwritten) overwrittenList.push("Batch No");
    if (isBottleCountOverwritten) overwrittenList.push("Amount (Jumlah Botol)");
    if (isProductNameOverwritten) overwrittenList.push("Nama Produk");
    if (isProductSpecOverwritten) overwrittenList.push("Spesifikasi Kemasan");
    if (isMachineIdOverwritten) overwrittenList.push("Mach. ID");
    if (isFormulaNoOverwritten) overwrittenList.push("Formula");

    // Filter daftar user agar operator yang sedang login tidak muncul di dropdown
    const eligibleVerifiers = availableUsers.filter(
        (u) => u.username.toLowerCase() !== currentUsername.toLowerCase()
    );

    const isAuthFilled =
        verifierAuth.username.trim() !== "" &&
        verifierAuth.password.trim() !== "";

    // ── Eksekusi Akhir START ke Server ─────────────────────────────────────────
    async function handleFinalStart() {
        if (!isAuthFilled || !vCanProceed || submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        setErrorFields([]);

        let started = false;
        let keepLocked = false;
        try {
            const payload = {
                // Data final dari verifierForm yang dipakai PLC dan DB
                batchNo: verifierForm.batchNo.trim(),
                bottleCount: verifierForm.bottleCount.trim(),
                productName: verifierForm.productName.trim(),
                productSpec: verifierForm.productSpec.trim(),
                machineId: verifierForm.machineId.trim(),
                formulaNo: verifierForm.formulaNo.trim(),
                // Jejak data awal dari operator User 1
                initiatorForm: {
                    batchNo: form.batchNo.trim(),
                    bottleCount: form.bottleCount.trim(),
                    productName: form.productName.trim(),
                    productSpec: form.productSpec.trim(),
                    machineId: form.machineId.trim(),
                    formulaNo: form.formulaNo.trim(),
                },
                // Kredensial verifikator
                verifierUsername: verifierAuth.username.trim(),
                verifierPassword: verifierAuth.password,
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

            // Ditolak (password salah, hak akses tidak cukup, atau error database)
            if (json?.invalidFields && Array.isArray(json.invalidFields) && json.invalidFields.length > 0) {
                setErrorFields(json.invalidFields);
                setError(json.error ?? "Resep tidak valid.");
            } else {
                setError(json?.error ?? "Terjadi kesalahan, periksa password verifikator.");
            }
        } finally {
            if (!started) {
                if (!keepLocked) submittingRef.current = false;
                setSubmitting(false);
            }
        }
    }

    if (!open) return null;

    // Helper badge penanda koreksi overwrite
    const overwriteBadge = (
        <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-semibold tracking-normal">
            Dikoreksi Verifikator
        </span>
    );

    // ══════════════════════════════════════════════════════════════════════════
    // LANGKAH 4: POP-UP OTENTIKASI KREDENSIAL VERIFIKATOR (DIGITAL SIGNATURE)
    // ══════════════════════════════════════════════════════════════════════════
    if (step === "auth") {
        return (
            <DialogOverlay maxWidth="max-w-md" onClose={!submitting ? onClose : undefined}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2 border-b border-[#D8DEDC] pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1C6E74] text-white uppercase tracking-wider">
                                    Langkah 4 / Akhir
                                </span>
                                <h2 className="text-base font-bold text-[#1E2A2E]">
                                    Otentikasi User Verifikator
                                </h2>
                            </div>
                            <p className="text-xs text-[#5C6B6A] mt-1">
                                Pilih akun Anda dan masukkan password untuk menandatangani otorisasi mulai batch ini.
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

                    {/* Info inisiator */}
                    <div className="bg-[#F5F7F6] p-2.5 rounded-[3px] border border-[#D8DEDC] text-xs flex items-center justify-between">
                        <span className="text-[#5C6B6A]">Operator Inisiator:</span>
                        <strong className="text-[#1E2A2E]">{userFullName || currentUsername} (@{currentUsername})</strong>
                    </div>

                    <div className="space-y-3">
                        <Field label="Pilih Akun Verifikator (User Berbeda)">
                            <select
                                className={inputCls + " cursor-pointer"}
                                value={verifierAuth.username}
                                onChange={(e) => {
                                    setVerifierAuth((prev) => ({ ...prev, username: e.target.value }));
                                    setError(null);
                                }}
                            >
                                <option value="">-- Pilih User Verifikator --</option>
                                {eligibleVerifiers.map((u) => (
                                    <option key={u.username} value={u.username}>
                                        {u.fullName} (@{u.username})
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Password Verifikator">
                            <input
                                type="password"
                                autoFocus
                                autoComplete="current-password"
                                placeholder="Masukkan password verifikator"
                                className={inputCls}
                                value={verifierAuth.password}
                                onChange={(e) => {
                                    setVerifierAuth((prev) => ({ ...prev, password: e.target.value }));
                                    setError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && isAuthFilled && !submitting) {
                                        handleFinalStart();
                                    }
                                }}
                            />
                        </Field>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#D8DEDC]">
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
                            onClick={() => setStep("preview")}
                            className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                        >
                            ← Kembali
                        </button>
                    </div>
                </div>
            </DialogOverlay>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LANGKAH 3: PREVIEW ISIAN FINAL DARI VERIFIKATOR
    // ══════════════════════════════════════════════════════════════════════════
    if (step === "preview") {
        const fLabel = selectedFormulaV
            ? `${selectedFormulaV.formulaNo} (${selectedFormulaV.controlTemp}°C, ${selectedFormulaV.sterilTime} mnt)`
            : verifierForm.formulaNo;

        return (
            <DialogOverlay maxWidth="max-w-lg" onClose={!submitting ? onClose : undefined}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2 border-b border-[#D8DEDC] pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#B9762F] text-white uppercase tracking-wider">
                                    Langkah 3 dari 4
                                </span>
                                <h2 className="text-base font-bold text-[#1E2A2E]">
                                    Preview Isian Final Sterilisasi
                                </h2>
                            </div>
                            <p className="text-xs text-[#5C6B6A] mt-1">
                                Periksa ringkasan data akhir berikut. Data ini yang akan ditulis ke PLC dan dicatat ke batch records.
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

                    {/* Ringkasan data final */}
                    <div className="rounded-[4px] border border-[#D8DEDC] bg-[#F8FAFA] p-3.5 space-y-2 text-sm">
                        <Row label="Batch No." value={verifierForm.batchNo} />
                        <Row label="Amount (Botol)" value={`${Number(verifierForm.bottleCount).toLocaleString("id-ID")} Botol`} />
                        <Row label="Produk" value={verifierForm.productName} />
                        <Row label="Spesifikasi" value={verifierForm.productSpec} />
                        <Row label="Mach. ID" value={verifierForm.machineId} />
                        <Row label="Operator (User 1)" value={`${userFullName || currentUsername} (@${currentUsername})`} />
                        <Row label="Formula Final" value={fLabel} />

                        {formulaHasWarnV && (
                            <div className="pt-2 border-t border-[#D8DEDC]">
                                <p className="text-[11px] text-[#B9762F] font-semibold">Catatan formula:</p>
                                <ul className="list-disc list-inside text-[11px] text-[#5C6B6A] space-y-0.5">
                                    {formulaWarningsV.map((w, i) => <li key={i}>{w.message}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Box catatan jika ada koreksi overwrite oleh verifikator */}
                    {overwrittenList.length > 0 && (
                        <div className="rounded-[3px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <p className="font-bold flex items-center gap-1">
                                <span>✏️</span> Catatan Koreksi Verifikator:
                            </p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                                Verifikator telah mengoreksi / memperbarui field: <strong>{overwrittenList.join(", ")}</strong>. Data yang dipakai untuk proses sterilisasi adalah data final di atas.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-[#D8DEDC]">
                        <button
                            type="button"
                            onClick={() => setStep("auth")}
                            className="flex-1 py-2.5 rounded-[3px] bg-[#1C6E74] hover:bg-[#155358] text-white text-sm font-bold transition-colors shadow-sm"
                        >
                            Konfirmasi & Verifikasi Kredensial →
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep("verifier")}
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
    // LANGKAH 2: DUA PANEL BERDAMPINGAN (SIDE-BY-SIDE DENGAN HAK OVERWRITE)
    // ══════════════════════════════════════════════════════════════════════════
    if (step === "verifier") {
        const selectedFLabelOp = selectedFormulaOp
            ? `${selectedFormulaOp.formulaNo} (${selectedFormulaOp.controlTemp}°C, ${selectedFormulaOp.sterilTime} mnt)`
            : form.formulaNo;

        return (
            <DialogOverlay maxWidth="max-w-5xl" onClose={!submitting ? onClose : undefined}>
                <div className="flex flex-col gap-4">
                    {/* Header modal langkah 2 */}
                    <div className="flex items-start justify-between gap-2 border-b border-[#D8DEDC] pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1C6E74] text-white uppercase tracking-wider">
                                    Langkah 2 dari 4
                                </span>
                                <h2 className="text-base font-bold text-[#1E2A2E]">
                                    Verifikasi & Koreksi Data Batch (User 2)
                                </h2>
                            </div>
                            <p className="text-xs text-[#5C6B6A] mt-1">
                                Panel kiri menampilkan data awal inisiator. Panel kanan adalah form verifikasi User 2 yang dapat diedit / di-overwrite bila ada kesalahan sebelum diproses.
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

                    {/* Layout dua panel berdampingan */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                        {/* ── PANEL KIRI: Data Awal Inisiator (User 1) Read-Only ── */}
                        <div className="rounded-[4px] border border-[#D8DEDC] bg-[#F5F7F6] p-4 space-y-3">
                            <div className="pb-2 border-b border-[#D8DEDC] flex items-center justify-between">
                                <span className="text-xs font-bold text-[#5C6B6A] uppercase tracking-wider">
                                    Data Awal Operator (User 1)
                                </span>
                                <span className="text-[11px] font-semibold text-[#1E2A2E] bg-white px-2 py-0.5 rounded border border-[#D8DEDC]">
                                    {userFullName || currentUsername} (@{currentUsername})
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <ReadOnlyField label="Batch No." value={form.batchNo} />
                                <ReadOnlyField label="Amount (Jumlah Botol)" value={form.bottleCount ? `${Number(form.bottleCount).toLocaleString("id-ID")} Botol` : "—"} />
                                <ReadOnlyField label="Nama Produk" value={form.productName} />
                                <ReadOnlyField label="Spesifikasi Kemasan" value={form.productSpec} />
                                <ReadOnlyField label="Mach. ID" value={form.machineId} />
                                <ReadOnlyField label="Operator Inisiator" value={userFullName || currentUsername} />
                                <div className="col-span-2">
                                    <ReadOnlyField label="Formula Terpilih" value={selectedFLabelOp} />
                                </div>
                            </div>
                        </div>

                        {/* ── PANEL KANAN: Form Verifikasi & Koreksi (User 2) ── */}
                        <div className="rounded-[4px] border border-[#1C6E74]/40 bg-white p-4 space-y-3 shadow-sm">
                            <div className="pb-2 border-b border-[#D8DEDC] flex items-center justify-between">
                                <span className="text-xs font-bold text-[#1C6E74] uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🔍</span> Form Verifikasi & Koreksi (User 2)
                                </span>
                                <span className="text-[11px] text-[#5C6B6A] italic">
                                    Dapat diedit / overwrite
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field
                                    label="Batch No."
                                    badge={isBatchNoOverwritten && overwriteBadge}
                                    error={vBatchInvalid ? vBatchCheck.error : null}
                                >
                                    <input
                                        type="text"
                                        className={inputCls}
                                        placeholder="contoh: B-2024-001"
                                        maxLength={BATCH_NO_MAX_LEN}
                                        value={verifierForm.batchNo}
                                        onChange={(e) => handleVerifierChange("batchNo", e.target.value)}
                                    />
                                </Field>

                                <Field
                                    label="Amount (Jumlah Botol)"
                                    badge={isBottleCountOverwritten && overwriteBadge}
                                    error={vBottleInvalid ? "Harus berupa angka bulat positif" : null}
                                >
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className={inputCls}
                                        placeholder="contoh: 2400"
                                        value={verifierForm.bottleCount}
                                        onChange={(e) => handleVerifierChange("bottleCount", e.target.value)}
                                    />
                                </Field>

                                <Field
                                    label="Nama Produk"
                                    badge={isProductNameOverwritten && overwriteBadge}
                                >
                                    <SearchableCombobox
                                        value={verifierForm.productName}
                                        onChange={(val) => handleVerifierChange("productName", val)}
                                        options={productNames.map((p) => p.name)}
                                        placeholder="Pilih produk atau ketik manual"
                                    />
                                </Field>

                                <Field
                                    label="Spesifikasi Kemasan"
                                    badge={isProductSpecOverwritten && overwriteBadge}
                                >
                                    <SearchableCombobox
                                        value={verifierForm.productSpec}
                                        onChange={(val) => handleVerifierChange("productSpec", val)}
                                        options={productSpecs.map((s) => s.spec)}
                                        placeholder="Pilih spesifikasi atau ketik manual"
                                    />
                                </Field>

                                <Field
                                    label="Mach. ID"
                                    badge={isMachineIdOverwritten && overwriteBadge}
                                >
                                    <input
                                        type="text"
                                        className={inputCls}
                                        placeholder="SG-40"
                                        value={verifierForm.machineId}
                                        onChange={(e) => handleVerifierChange("machineId", e.target.value)}
                                    />
                                </Field>

                                <div className="col-span-2">
                                    <Field
                                        label="Formula"
                                        badge={isFormulaNoOverwritten && overwriteBadge}
                                    >
                                        <select
                                            className={inputCls + " cursor-pointer"}
                                            value={verifierForm.formulaNo}
                                            onChange={(e) => handleVerifierChange("formulaNo", e.target.value)}
                                        >
                                            <option value="">-- Pilih Formula --</option>
                                            {formulas.map((f) => (
                                                <option key={f.formulaNo} value={f.formulaNo}>
                                                    {f.formulaNo} ({f.controlTemp}°C, {f.sterilTime} MIN)
                                                    {f.validation && !f.validation.ok ? " — TIDAK LENGKAP" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                            </div>

                            {formulaInvalidV && (
                                <div className="rounded-[3px] border border-[#A23B2E] bg-[#FEF2F2] px-3 py-2 text-[11px] text-[#A23B2E]">
                                    <p className="font-semibold mb-1">Formula ini belum bisa dipakai:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        {formulaProblemsV.map((p, i) => <li key={i}>{p.message}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tombol aksi langkah 2 */}
                    <div className="flex gap-2 pt-2 border-t border-[#D8DEDC]">
                        <button
                            type="button"
                            disabled={!vCanProceed}
                            onClick={() => vCanProceed && setStep("preview")}
                            className="flex-1 py-2.5 rounded-[3px] bg-[#1C6E74] hover:bg-[#155358] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            Lanjut ke Preview Final →
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep("operator")}
                            className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                        >
                            ← Kembali ke Form User 1
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            </DialogOverlay>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LANGKAH 1: FORM INISIATOR (USER 1 / OPERATOR)
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <DialogOverlay maxWidth="max-w-md" onClose={!submitting ? onClose : undefined}>
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#D8DEDC] pb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#4F7A52] text-white uppercase tracking-wider">
                                Langkah 1 dari 4
                            </span>
                            <h2 className="text-base font-bold text-[#1E2A2E]">Mulai Batch Baru</h2>
                        </div>
                        <p className="text-xs text-[#5C6B6A] mt-1">
                            Operator mengisi data batch awal. Setelah selesai, user kedua akan memverifikasi.
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

                {/* Grid Form Input User 1 */}
                <div className="grid grid-cols-2 gap-3">
                    <Field
                        label="Batch No."
                        hint={`${BATCH_NO_RULE_TEXT} Harus unik.`}
                        error={opBatchInvalid ? opBatchCheck.error : null}
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
                        error={opBottleInvalid ? "Harus berupa angka bulat positif" : null}
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

                    <Field label="Operator (User 1)">
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

                {/* Catatan / Error Formula (jika ada) */}
                {formulaInvalidOp && (
                    <div className="rounded-[3px] border border-[#A23B2E] bg-[#FEF2F2] px-3 py-2 text-[11px] text-[#A23B2E]">
                        <p className="font-semibold mb-1">Formula ini belum bisa dipakai:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {formulaProblemsOp.map((p, i) => <li key={i}>{p.message}</li>)}
                        </ul>
                    </div>
                )}
                {formulaHasWarnOp && (
                    <div className="rounded-[3px] border border-[#B9762F] bg-[#FEF9EE] px-3 py-2 text-[11px] text-[#5C6B6A]">
                        <p className="font-semibold text-[#B9762F] mb-1">Catatan formula:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {formulaWarningsOp.map((w, i) => <li key={i}>{w.message}</li>)}
                        </ul>
                    </div>
                )}

                {/* Tombol aksi langkah 1 */}
                <div className="flex gap-2 pt-1 border-t border-[#D8DEDC]">
                    <button
                        type="button"
                        disabled={!opCanProceed}
                        onClick={() => {
                            if (opCanProceed) {
                                // Pre-fill data verifierForm dari form User 1
                                setVerifierForm({ ...form });
                                setStep("verifier");
                            }
                        }}
                        title={
                            !opCanProceed
                                ? formulaInvalidOp ? "Formula tidak lengkap"
                                    : opBatchInvalid ? "Format Batch No. salah"
                                        : "Isi semua field dulu"
                                : undefined
                        }
                        className="flex-1 py-2 rounded-[3px] bg-[#1C6E74] hover:bg-[#155358] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                        Lanjut ke Verifikasi (User 2) →
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-[3px] border border-[#D8DEDC] text-[#5C6B6A] text-sm hover:bg-[#F5F7F6] transition-colors"
                    >
                        Batal
                    </button>
                </div>

                {!opCanProceed && !formulaInvalidOp && !opBatchInvalid && (
                    <p className="text-[11px] text-[#5C6B6A] italic -mt-2">Semua field harus diisi sebelum melanjutkan ke langkah verifikasi.</p>
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
