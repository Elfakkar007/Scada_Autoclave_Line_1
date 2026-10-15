"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// Durasi pasif sebelum layar terkunci: 7 menit
const LOCK_TIMEOUT_MS = 7 * 60 * 1000;

function EyeIcon({ off }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
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

export default function ScreenLock() {
    const [isLocked, setIsLocked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [user, setUser] = useState(null);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const lastActivityRef = useRef(0);
    const isLockedRef = useRef(false);
    const passwordInputRef = useRef(null);

    // Ambil info user aktif saat mount
    useEffect(() => {
        let active = true;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                if (active && json.ok) {
                    setUser(json.user);
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    // Listener interaksi user: hanya klik & ketik keyboard yang mereset timer (bukan sekadar geser mouse)
    const handleUserInteraction = useCallback(() => {
        if (!isLockedRef.current) {
            lastActivityRef.current = Date.now();
        }
    }, []);

    useEffect(() => {
        // Inisialisasi waktu aktivitas pertama kali
        lastActivityRef.current = Date.now();

        window.addEventListener("pointerdown", handleUserInteraction, { capture: true });
        window.addEventListener("keydown", handleUserInteraction, { capture: true });

        // Interval pengecekan pasif 7 menit (tiap 1 detik)
        const intervalId = setInterval(() => {
            if (!isLockedRef.current && lastActivityRef.current > 0) {
                const elapsed = Date.now() - lastActivityRef.current;
                if (elapsed >= LOCK_TIMEOUT_MS) {
                    isLockedRef.current = true;
                    setIsLocked(true);
                }
            }
        }, 1000);

        return () => {
            window.removeEventListener("pointerdown", handleUserInteraction, { capture: true });
            window.removeEventListener("keydown", handleUserInteraction, { capture: true });
            clearInterval(intervalId);
        };
    }, [handleUserInteraction]);

    // Saat layar terkunci dan user mengklik layar
    function handleScreenClick(e) {
        e.preventDefault();
        e.stopPropagation();
        setError("");
        setPassword("");
        setShowPassword(false);
        setShowModal(true);
        setTimeout(() => {
            passwordInputRef.current?.focus();
        }, 50);
    }

    // Submit unlock
    async function handleUnlock(e) {
        if (e) e.preventDefault();
        if (!password) {
            setError("Masukkan password Anda");
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

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.ok) {
                // Berhasil buka kunci
                isLockedRef.current = false;
                lastActivityRef.current = Date.now();
                setIsLocked(false);
                setShowModal(false);
                setPassword("");
                setShowPassword(false);
                setError("");
                if (data.user) {
                    setUser(data.user);
                }
            } else if (data.expired || data.deactive) {
                // Sesi habis atau user dinonaktifkan
                router.push("/login");
            } else {
                setError(data.error || "Password salah, silakan coba lagi");
                passwordInputRef.current?.select();
            }
        } catch {
            setError("Gagal menghubungi server");
        } finally {
            setLoading(false);
        }
    }

    // Logout / Ganti akun
    async function handleLogout() {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } finally {
            router.push("/login");
        }
    }

    if (!isLocked) return null;

    return (
        <>
            {/* ── 1. Barrier / Transparent Overlay Penjaga Layar ── */}
            {/* Mengintercept semua klik agar tombol (STOP, START, menu) tidak terpencet saat terkunci */}
            <div
                id="screen-lock-barrier"
                onClick={handleScreenClick}
                className="fixed inset-0 z-50 cursor-pointer bg-black/10 select-none transition-colors"
                title="Layar terkunci. Klik di mana saja untuk membuka kunci."
            />

            {/* ── 2. Badge Status Terkunci (Mengambang di pojok kanan bawah) ── */}
            {!showModal && (
                <div
                    onClick={handleScreenClick}
                    className="fixed bottom-6 right-6 z-55 flex items-center gap-2.5 px-4 py-2.5 bg-scada-ink text-white rounded-xl shadow-2xl border border-scada-muted/40 cursor-pointer hover:scale-105 transition-transform"
                >
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                    </span>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
                            🔒 Layar Terkunci (Pasif 7 Menit)
                        </span>
                        <span className="text-[10px] text-zinc-300">
                            Klik di mana saja untuk membuka
                        </span>
                    </div>
                </div>
            )}

            {/* ── 3. Pop-up Modal Re-Autentikasi (Buka Kunci) ── */}
            {showModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-scada-rule max-w-sm w-full p-6 text-scada-ink relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-scada-bg flex items-center justify-center text-scada-ink border border-scada-rule shrink-0 text-xl shadow-xs">
                                🔒
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-scada-ink leading-snug">
                                    Layar Terkunci
                                </h2>
                                <p className="text-xs text-scada-muted">
                                    Sesi pasif 7 menit. Masukkan password untuk melanjutkan.
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleUnlock} className="flex flex-col gap-3.5">
                            {/* Info User / Operator Aktif */}
                            <div>
                                <label className="block text-xs font-semibold text-scada-muted mb-1">
                                    Operator Aktif
                                </label>
                                <div className="flex items-center justify-between px-3 py-2 bg-scada-bg/80 border border-scada-rule rounded-lg text-sm">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-scada-ink text-xs">
                                            {user?.fullName || user?.username || "Operator"}
                                        </span>
                                        <span className="text-[11px] text-scada-muted">
                                            @{user?.username || "—"}
                                        </span>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-scada-rule/80 text-scada-ink">
                                        {user?.role || "OPERATOR"}
                                    </span>
                                </div>
                            </div>

                            {/* Input Password */}
                            <div>
                                <label
                                    htmlFor="lock-password-input"
                                    className="block text-xs font-semibold text-scada-muted mb-1"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="lock-password-input"
                                        ref={passwordInputRef}
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Masukkan password Anda"
                                        disabled={loading}
                                        autoComplete="current-password"
                                        autoFocus
                                        className="w-full pl-3 pr-10 py-2 text-sm bg-white border border-scada-rule rounded-lg focus:outline-none focus:ring-2 focus:ring-scada-water focus:border-scada-water text-scada-ink placeholder:text-zinc-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                        aria-pressed={showPassword}
                                        tabIndex={-1}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded text-scada-muted hover:text-scada-ink hover:bg-scada-bg transition-colors cursor-pointer"
                                    >
                                        <EyeIcon off={showPassword} />
                                    </button>
                                </div>
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div className="text-xs text-scada-stop bg-red-50 border border-red-200 px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium">
                                    <span>⚠️</span>
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Tombol Aksi */}
                            <div className="flex flex-col gap-2 mt-1">
                                <button
                                    type="submit"
                                    disabled={loading || !password}
                                    className="w-full py-2.5 px-4 bg-scada-water hover:bg-scada-water-hover disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Memverifikasi...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>🔓</span>
                                            <span>Buka Kunci</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full py-1.5 text-xs text-scada-muted hover:text-scada-stop transition-colors cursor-pointer text-center"
                                >
                                    Bukan akun Anda? <span className="underline">Ganti Akun / Logout</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
