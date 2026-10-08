"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    // Daftar user aktif untuk dropdown: null = belum dimuat, [] = kosong/gagal
    const [users, setUsers] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/users")
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                if (json.ok === false) throw new Error("gagal");
                setUsers(json.users ?? []);
            })
            .catch(() => {
                if (cancelled) return;
                setUsers([]);
                setError("Gagal memuat daftar user. Muat ulang halaman.");
            });
        return () => { cancelled = true; };
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim(), password }),
            });
            const json = await res.json();

            if (!res.ok || json.ok === false) {
                setError(json.error ?? "Login gagal. Coba lagi.");
                return;
            }

            // Sukses: redirect ke dashboard
            window.location.href = "/";
        } catch {
            setError("Gagal terhubung ke server. Periksa koneksi jaringan.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* ── Logo / judul ── */}
                <div className="text-center mb-8">
                    <h1 className="text-xl font-bold tracking-tight">
                        SCADA Super Water Sterilizer
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">Silakan login</p>
                </div>

                {/* ── Card form ── */}
                <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* Username */}
                        <div>
                            <label className="block text-xs text-slate-400 uppercase mb-1.5">
                                Username
                            </label>
                            <select
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading || users === null}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                            >
                                <option value="">
                                    {users === null ? "Memuat daftar user…" : "Pilih username"}
                                </option>
                                {(users ?? []).map((u) => (
                                    <option key={u.username} value={u.username}>
                                        {u.fullName} ({u.username})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs text-slate-400 uppercase mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                                placeholder="Masukkan password"
                            />
                        </div>

                        {/* Error message */}
                        {error && (
                            <p className="text-sm text-red-400 text-center">
                                {error}
                            </p>
                        )}

                        {/* Tombol submit */}
                        <button
                            type="submit"
                            disabled={loading || !username.trim() || !password}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded font-semibold text-sm transition-colors"
                        >
                            {loading ? "Memproses..." : "Login"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Super Water Sterilizer — SCADA System
                </p>
            </div>
        </main>
    );
}