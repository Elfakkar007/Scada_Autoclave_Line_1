"use client";

/**
 * ReAuthModal – Popup verifikasi identitas (seperti lock-screen unlock).
 *
 * Cara pakai:
 *   1. Simpan ref: const reAuthRef = useRef(null);
 *   2. Render: <ReAuthModal ref={reAuthRef} username={currentUsername} actionLabel="Simpan perubahan" />
 *   3. Panggil sebelum aksi kritis:
 *        const ok = await reAuthRef.current.prompt("Simpan perubahan role");
 *        if (!ok) return;
 *        // lanjut aksi...
 *
 * Props:
 *   username    – username yang sedang login (ditampilkan di modal, tidak bisa diubah user)
 *
 * Ref methods:
 *   prompt(actionLabel?: string) → Promise<boolean>
 *     Membuka modal, menunggu user memasukkan password.
 *     Resolve true  = password cocok (aksi boleh dilanjutkan)
 *     Resolve false = user membatalkan
 */

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";

// ── Eye icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ off }) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {off ? (
                <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <path d="M1 1l22 22" />
                </>
            ) : (
                <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                </>
            )}
        </svg>
    );
}

// ── LockIcon ──────────────────────────────────────────────────────────────────
function LockIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
const ReAuthModal = forwardRef(function ReAuthModal({ username }, ref) {
    const [open, setOpen] = useState(false);
    const [actionLabel, setActionLabel] = useState("melanjutkan aksi ini");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const resolveRef = useRef(null);
    const inputRef = useRef(null);

    // Expose prompt() ke parent via ref
    useImperativeHandle(ref, () => ({
        prompt(label = "melanjutkan aksi ini") {
            return new Promise((resolve) => {
                resolveRef.current = resolve;
                setActionLabel(label);
                setPassword("");
                setShowPassword(false);
                setError("");
                setLoading(false);
                setOpen(true);
                // Focus dilakukan via onAnimationStart / transitionEnd; fallback timeout
                setTimeout(() => inputRef.current?.focus(), 80);
            });
        },
    }));

    const handleCancel = useCallback(() => {
        setOpen(false);
        resolveRef.current?.(false);
        resolveRef.current = null;
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e?.preventDefault();
        if (!password) {
            setError("Password wajib diisi");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            const json = await res.json().catch(() => null);
            if (res.ok && json?.ok) {
                setOpen(false);
                resolveRef.current?.(true);
                resolveRef.current = null;
            } else {
                setError(json?.error ?? "Password salah, coba lagi.");
                setPassword("");
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setLoading(false);
        }
    }, [password]);

    // Tutup saat klik backdrop
    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) handleCancel();
    }, [handleCancel]);

    // Escape key
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Escape") handleCancel();
    }, [handleCancel]);

    if (!open) return null;

    // Ambil initial username untuk avatar
    const initial = (username ?? "?")[0].toUpperCase();

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reauth-title"
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header strip */}
                <div className="bg-scada-water px-6 py-4 flex items-center gap-3">
                    <div className="text-white opacity-90">
                        <LockIcon />
                    </div>
                    <div>
                        <p id="reauth-title" className="text-white font-semibold text-sm leading-tight">
                            Konfirmasi Identitas
                        </p>
                        <p className="text-white/70 text-xs mt-0.5 leading-tight">
                            Verifikasi diperlukan untuk: <span className="font-medium text-white/90">{actionLabel}</span>
                        </p>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {/* Avatar + username (read-only, tidak bisa diubah) */}
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-scada-water/15 border-2 border-scada-water/30 flex items-center justify-center shrink-0">
                            <span className="text-scada-water font-bold text-sm">{initial}</span>
                        </div>
                        <div>
                            <p className="text-xs text-scada-muted uppercase tracking-wide mb-0.5">Login sebagai</p>
                            <p className="font-mono font-semibold text-scada-ink text-sm">{username ?? "—"}</p>
                        </div>
                    </div>

                    {/* Password input */}
                    <div>
                        <label htmlFor="reauth-pw" className="block text-xs text-scada-muted uppercase mb-1">
                            Password Anda
                        </label>
                        <div className="relative">
                            <input
                                id="reauth-pw"
                                ref={inputRef}
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                placeholder="Masukkan password Anda"
                                disabled={loading}
                                autoComplete="current-password"
                                className="w-full pl-3 pr-10 py-2 text-sm bg-white border border-scada-idle rounded-lg focus:outline-none focus:ring-2 focus:ring-scada-water focus:border-scada-water text-scada-ink placeholder:text-zinc-400 disabled:opacity-60"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                tabIndex={-1}
                                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded text-scada-muted hover:text-scada-ink hover:bg-scada-bg transition-colors"
                            >
                                <EyeIcon off={showPassword} />
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-xs text-scada-stop bg-red-50 border border-red-200 px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="flex-1 py-2 px-4 bg-scada-water hover:bg-scada-water-hover disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Memverifikasi...</span>
                                </>
                            ) : (
                                <>
                                    <span>🔓</span>
                                    <span>Konfirmasi</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={loading}
                            className="px-4 py-2 bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                            Batal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

export default ReAuthModal;
