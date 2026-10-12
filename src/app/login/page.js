"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const MONO = "font-[family-name:var(--font-plex-mono)]";

/* ── Ilustrasi mesin (SVG inline, tanpa file gambar) ── */
function SterilizerIllustration() {
    const line = "#D8DEDC";
    const dim = "#8FA09E";
    return (
        <svg
            viewBox="0 0 660 440"
            role="img"
            aria-label="Ilustrasi mesin super water sterilizer"
            className="w-full h-auto max-w-[640px]"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {/* lantai */}
            <path d="M20 400H640" stroke={dim} strokeWidth="1.5" />
            <path d="M20 400H640" stroke={dim} strokeWidth="6" strokeDasharray="1 11" opacity=".35" transform="translate(0 8)" />

            {/* kaki penyangga */}
            <path d="M170 330V400M230 330V400M150 400H250" stroke={line} strokeWidth="2" />
            <path d="M420 330V400M480 330V400M400 400H500" stroke={line} strokeWidth="2" />
            <path d="M170 372H230M420 372H480" stroke={line} strokeWidth="1.5" opacity=".6" />

            {/* bejana utama */}
            <rect x="110" y="190" width="420" height="140" rx="70" fill="#243236" stroke={line} strokeWidth="2.5" />
            {/* cincin penguat */}
            <path d="M250 190V330M390 190V330" stroke={line} strokeWidth="1.5" opacity=".55" />
            {/* sorotan */}
            <path d="M190 212H450" stroke={line} strokeWidth="1.5" opacity=".25" />

            {/* pintu */}
            <rect x="98" y="208" width="22" height="104" rx="5" fill="#1E2A2E" stroke={line} strokeWidth="2" />
            <circle cx="109" cy="222" r="2.5" fill={line} />
            <circle cx="109" cy="260" r="2.5" fill={line} />
            <circle cx="109" cy="298" r="2.5" fill={line} />
            <path d="M98 232H84M98 288H84M84 228V292" stroke={line} strokeWidth="2" />

            {/* nama mesin pada bodi */}
            <text
                x="320"
                y="266"
                textAnchor="middle"
                fill={line}
                opacity=".75"
                fontSize="11"
                letterSpacing="3.5"
                fontFamily="var(--font-plex-mono), monospace"
            >
                SUPER WATER STERILIZER
            </text>

            {/* manometer */}
            <path d="M320 190V158" stroke={line} strokeWidth="2.5" />
            <circle cx="320" cy="128" r="30" fill="#1E2A2E" stroke={line} strokeWidth="2.5" />
            <circle cx="320" cy="128" r="22" stroke={dim} strokeWidth="1" opacity=".6" />
            <path
                d="M304 144L300 148M296 128H300M304 112L301 109M320 104V108M336 112L339 109M344 128H340M336 144L340 148"
                stroke={dim}
                strokeWidth="1.5"
            />
            <path d="M320 128L334 112" stroke="#B9762F" strokeWidth="2.5" />
            <circle cx="320" cy="128" r="3.5" fill="#B9762F" />

            {/* katup pengaman + uap buang */}
            <rect x="394" y="166" width="12" height="24" fill="#1E2A2E" stroke={line} strokeWidth="2" />
            <path d="M388 166H412" stroke={line} strokeWidth="3" />
            <path
                d="M400 152c-8-9 8-14 0-24s8-14 0-24"
                stroke={line}
                strokeWidth="1.5"
                strokeDasharray="3 5"
                opacity=".5"
            />

            {/* pipa uap */}
            <path d="M470 190V100H592" stroke="#B9762F" strokeWidth="6" />
            <path d="M462 134L478 152V134L462 152Z" fill="#1E2A2E" stroke="#B9762F" strokeWidth="2" />
            <path d="M470 134V118M462 118H478" stroke="#B9762F" strokeWidth="2" />

            {/* pipa air */}
            <path d="M300 330V372H60" stroke="#1C6E74" strokeWidth="6" />
            <path d="M292 346L308 364V346L292 364Z" fill="#1E2A2E" stroke="#1C6E74" strokeWidth="2" />
            <path d="M300 346V338" stroke="#1C6E74" strokeWidth="2" />

            {/* kabinet kontrol */}
            <rect x="556" y="236" width="76" height="164" rx="3" fill="#243236" stroke={line} strokeWidth="2.5" />
            <rect x="566" y="248" width="56" height="38" rx="2" fill="#1E2A2E" stroke={dim} strokeWidth="1.5" />
            <path d="M571 276L580 266L588 272L597 258L606 264L616 254" stroke="#1C6E74" strokeWidth="2" />
            <circle cx="577" cy="308" r="5" fill="#4F7A52" />
            <circle cx="594" cy="308" r="5" fill="#B9762F" />
            <circle cx="611" cy="308" r="5" fill="#A23B2E" />
            <rect x="566" y="330" width="56" height="8" rx="2" stroke={dim} strokeWidth="1.5" />
            <rect x="566" y="348" width="56" height="8" rx="2" stroke={dim} strokeWidth="1.5" />
            <path d="M556 272H534" stroke={dim} strokeWidth="1.5" strokeDasharray="3 4" />

            {/* label */}
            <g fill={dim} fontSize="10" letterSpacing="1.8" fontFamily="var(--font-plex-mono), monospace">
                <text x="500" y="86">UAP MASUK</text>
                <text x="60" y="360">AIR MASUK</text>
                <text x="594" y="226" textAnchor="middle">PANEL KONTROL</text>
                <text x="190" y="72">MANOMETER</text>
            </g>
            <path d="M246 78L292 110" stroke={dim} strokeWidth="1" />
        </svg>
    );
}

function EyeIcon({ off }) {
    return (
        <svg
            width="18"
            height="18"
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

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
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
            router.push("/");
        } catch {
            setError("Gagal terhubung ke server. Periksa koneksi jaringan.");
        } finally {
            setLoading(false);
        }
    }

    const fieldClass =
        "w-full h-11 bg-scada-card border border-scada-rule rounded-md px-3.5 text-sm text-scada-ink placeholder:text-scada-muted/70 " +
        "outline-none transition-colors hover:border-scada-idle focus:border-scada-water focus:ring-2 focus:ring-scada-water/20 " +
        "disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <main className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] bg-scada-bg text-scada-ink">
            {/* ── Kiri: ilustrasi mesin ── */}
            <section
                className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-scada-ink text-scada-bg p-12 xl:p-16"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(216,222,220,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(216,222,220,.05) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }}
            >
                <header>
                    <p className={`${MONO} text-xs tracking-[0.2em] uppercase text-scada-idle`}>
                        SCADA
                    </p>
                    <h1 className="mt-3 text-3xl xl:text-4xl font-semibold tracking-tight leading-tight">
                        Super Water
                        <br />
                        Sterilizer
                    </h1>
                    <p className="mt-3 text-sm text-scada-idle max-w-xs">
                        Monitoring dan kontrol mesin sterilizer.
                    </p>
                </header>

                <div className="flex justify-center py-8">
                    <SterilizerIllustration />
                </div>

                <footer className={`${MONO} flex items-center gap-6 text-xs text-scada-idle`}>
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-[3px] bg-scada-steam" />
                        Uap
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-[3px] bg-scada-water" />
                        Air
                    </span>
                </footer>
            </section>

            {/* ── Kanan: form login ── */}
            <section className="flex items-center justify-center p-6 sm:p-10">
                <div className="w-full max-w-sm">
                    {/* judul ringkas untuk layar kecil (panel ilustrasi disembunyikan) */}
                    <div className="lg:hidden mb-10">
                        <p className={`${MONO} text-xs tracking-[0.2em] uppercase text-scada-muted`}>
                            SCADA
                        </p>
                        <p className="mt-1 text-lg font-semibold tracking-tight">
                            Super Water Sterilizer
                        </p>
                    </div>

                    <h2 className="text-2xl font-semibold tracking-tight">Masuk</h2>
                    <p className="mt-2 text-sm text-scada-muted">
                        Pilih akun Anda lalu masukkan password untuk melanjutkan.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                        {/* Username */}
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium mb-1.5"
                            >
                                Username
                            </label>
                            <div className="relative">
                                <select
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={loading || users === null}
                                    className={`${fieldClass} appearance-none pr-10 ${username ? "" : "text-scada-muted"}`}
                                >
                                    <option value="">
                                        {users === null ? "Memuat daftar user…" : "Pilih username"}
                                    </option>
                                    {(users ?? []).map((u) => (
                                        <option key={u.username} value={u.username} className="text-scada-ink">
                                            {u.fullName} ({u.username})
                                        </option>
                                    ))}
                                </select>
                                <svg
                                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-scada-muted"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium mb-1.5"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    className={`${fieldClass} pr-11`}
                                    placeholder="Masukkan password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                    aria-pressed={showPassword}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded text-scada-muted hover:text-scada-ink hover:bg-scada-bg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-scada-water/40"
                                >
                                    <EyeIcon off={showPassword} />
                                </button>
                            </div>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div
                                role="alert"
                                className="flex items-start gap-2.5 rounded-md border border-scada-stop/30 bg-scada-stop/5 px-3.5 py-2.5 text-sm text-scada-stop"
                            >
                                <svg
                                    className="mt-0.5 shrink-0"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Tombol submit */}
                        <button
                            type="submit"
                            disabled={loading || !username.trim() || !password}
                            className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-md bg-scada-water hover:bg-scada-water-hover text-white text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-scada-water/40 focus-visible:ring-offset-2 focus-visible:ring-offset-scada-bg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading && (
                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".3" />
                                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                            )}
                            {loading ? "Memproses..." : "Login"}
                        </button>
                    </form>

                    <p className={`${MONO} mt-10 text-xs text-scada-muted`}>
                        Super Water Sterilizer — SCADA System
                    </p>
                </div>
            </section>
        </main>
    );
}