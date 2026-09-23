"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const menu = [
    { href: "/",            label: "Dashboard"   },
    { href: "/data-report", label: "Data Report" },
    { href: "/trend",       label: "Trend"       },
    { href: "/alarm",       label: "Alarm"       },
    { href: "/formula",     label: "Formula"     },
];

export default function Navbar() {
    const [user, setUser]       = useState(null);
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (json.ok) setUser(json.user); })
            .catch(() => {})
            .finally(() => setFetched(true));
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    }

    const isAdmin = user?.role === "admin";

    return (
        <nav className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
            {/* ── Menu kiri ── */}
            <div className="flex items-center gap-6">
                {menu.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="text-sm text-slate-300 hover:text-white font-medium transition-colors"
                    >
                        {item.label}
                    </Link>
                ))}
                {/* Menu Audit Log: hanya tampil untuk admin, tidak ada di DOM untuk operator */}
                {isAdmin && (
                    <Link
                        href="/audit-log"
                        className="text-sm text-slate-300 hover:text-white font-medium transition-colors"
                    >
                        Audit Log
                    </Link>
                )}
            </div>

            {/* ── Area kanan: info user + tombol logout ── */}
            <div className="flex items-center gap-3">
                {!fetched ? (
                    <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
                ) : user ? (
                    <>
                        <span className="text-sm text-slate-300">{user.fullName}</span>
                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded uppercase font-semibold">
                            {user.role}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-red-400 hover:text-red-300 transition-colors ml-1"
                        >
                            Logout
                        </button>
                    </>
                ) : null}
            </div>
        </nav>
    );
}