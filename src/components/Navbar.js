"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
    { href: "/", label: "Dashboard" },
    { href: "/data-report", label: "Data Report" },
    { href: "/trend", label: "Trend" },
    { href: "/alarm", label: "Alarm" },
    { href: "/formula", label: "Formula" },
];

export default function Navbar() {
    const [user, setUser] = useState(null);
    const [fetched, setFetched] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        // Fungsi yang sama dipakai saat mount dan saat polling berkala
        function checkSession() {
            fetch("/api/auth/me")
                .then((r) => r.json())
                .then((json) => {
                    if (json.ok) {
                        setUser(json.user);
                    } else {
                        // Akun nonaktif / token invalid / expired → paksa logout
                        // Gunakan window.location agar semua client state ter-reset total
                        window.location.href = "/login";
                    }
                })
                .catch(() => {
                    // Error jaringan: biarkan saja (jangan redirect, mungkin hanya koneksi sebentar drop)
                })
                .finally(() => setFetched(true));
        }

        // Jalankan sekali saat mount
        checkSession();

        // Polling berkala setiap 60 detik untuk deteksi akun yang dinonaktifkan
        const interval = setInterval(checkSession, 60_000);

        // Cleanup saat komponen unmount
        return () => clearInterval(interval);
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    }

    const isAdmin = user?.role === "admin";

    return (
        <nav className="w-48 shrink-0 h-full bg-scada-ink text-white flex flex-col justify-between py-6 z-10 shadow-lg border-r border-scada-ink">
            {/* ── Menu atas ── */}
            <div className="px-4 flex flex-col gap-1">
                <div className="mb-6 px-2 flex flex-col items-center">
                    {/* Satoria Pharma Logo */}
                    <img src="/satoria-logo.png" alt="Satoria Pharma" className="w-20 -mb-0 object-contain" />

                    <h2 className="text-xl font-bold text-scada-steam tracking-tight text-center">SCADA</h2>
                    <p className="text-[10px] text-scada-idle uppercase tracking-wider mt-0.5 text-center">Control System</p>
                </div>

                {menu.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${isActive
                                ? "bg-white/20 text-white font-medium border-l-2 border-scada-steam"
                                : "text-scada-idle hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}

                {/* Menu khusus admin */}
                {isAdmin && (
                    <>
                        <div className="my-2 border-t border-white/10 mx-2" />
                        <Link
                            href="/audit-log"
                            className={`px-3 py-2 rounded text-sm transition-colors ${pathname === "/audit-log"
                                ? "bg-white/20 text-white font-medium border-l-2 border-scada-steam"
                                : "text-scada-idle hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            Audit Log
                        </Link>
                        <Link
                            href="/users"
                            className={`px-3 py-2 rounded text-sm transition-colors ${pathname === "/users"
                                ? "bg-white/20 text-white font-medium border-l-2 border-scada-steam"
                                : "text-scada-idle hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            Kelola User
                        </Link>
                    </>
                )}
            </div>

            {/* ── Area bawah: info user + tombol logout ── */}
            <div className="px-4">
                {!fetched ? (
                    <div className="h-24 bg-white/5 rounded animate-pulse" />
                ) : user ? (
                    <div className="bg-white/5 border border-white/10 rounded p-3 flex flex-col gap-1">
                        <span className="text-sm font-semibold truncate text-white">{user.fullName}</span>
                        <span className="text-[10px] text-scada-idle font-mono uppercase">
                            Role: {user.role}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                        >
                            Logout
                        </button>
                    </div>
                ) : null}
            </div>
        </nav>
    );
}