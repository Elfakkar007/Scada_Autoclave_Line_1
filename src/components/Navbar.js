"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { hasLevel } from "@/lib/permissionCatalog";
import { hasHmiOverrideAccess } from "@/lib/hmiOverrideCatalog";

// Tiap menu terikat ke satu resource izin. Menu tampil bila levelnya >= "view";
// level "none" (atau resource tanpa baris izin) = menu tersembunyi.
// Ini hanya merapikan tampilan. Data tetap dijaga di API (requirePermission).
const mainMenu = [
    { href: "/", label: "Dashboard", resource: "dashboard" },
    { href: "/data-report", label: "Data Report", resource: "data_report" },
    { href: "/trend", label: "Trend", resource: "trend" },
    { href: "/alarm", label: "Alarm", resource: "alarm" },
    { href: "/formula", label: "Formula", resource: "formula" },
    { href: "/products", label: "Master Produk", resource: "products" },
];

// Menu fitur HMI (baca/ubah nilai PLC). Terikat ke resource izin masing-masing.
const machineMenu = [
    { href: "/machine-params", label: "Parameter Mesin", resource: "machine_params" },
    { href: "/calibration", label: "Kalibrasi", resource: "calibration" },
    { href: "/plc-clock", label: "Jam PLC", resource: "plc_clock" },
    { href: "/manual", label: "Kontrol Manual", resource: "manual_control" },
    { href: "/door-operate", label: "Door Operate", resource: "manual_control" },
];

const adminMenu = [
    { href: "/audit-log", label: "Audit Log", resource: "audit_log" },
    { href: "/users", label: "Kelola User", resource: "users" },
    { href: "/roles", label: "Role Management", resource: "roles" },
    { href: "/backup", label: "Backup", resource: "backup" },
];

// Komponen di luar Navbar supaya tidak dibuat ulang tiap render.
function NavLink({ item, pathname }) {
    const isActive = pathname === item.href;
    return (
        <Link
            href={item.href}
            className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${isActive
                ? "bg-white/20 text-white font-medium border-l-2 border-scada-steam"
                : "text-scada-idle hover:bg-white/10 hover:text-white"
                }`}
        >
            {item.label}
        </Link>
    );
}

export default function Navbar() {
    const [user, setUser] = useState(null);
    const [fetched, setFetched] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

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
                        router.push("/login");
                    }
                })
                .catch(() => {
                    // Error jaringan: biarkan saja (jangan redirect, mungkin hanya koneksi sebentar drop)
                })
                .finally(() => setFetched(true));
        }

        // Jalankan sekali saat mount
        checkSession();

        // Polling berkala setiap 60 detik: deteksi akun nonaktif DAN perubahan role/izin
        const interval = setInterval(checkSession, 60_000);

        // Cleanup saat komponen unmount
        return () => clearInterval(interval);
    }, [router]);

    async function handleLogout() {
        try {
            localStorage.removeItem("scada_screen_locked");
            localStorage.removeItem("scada_last_activity");
            localStorage.removeItem("scada_lock_user");
        } catch {}
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    }

    // Menu tampil bila RBAC >= view ATAU ada HMI override aktif untuk resource ini.
    // HMI override hanya relevan untuk menu mesin (machineMenu) yang memiliki page override.
    // Pemetaan item.resource → page override (door_operate memakai resource manual_control di RBAC
    // tapi page override terpisah — keduanya cukup dicek lewat hasHmiOverrideAccess).
    const HMI_OVERRIDE_PAGE = {
        machine_params: "machine_params",
        calibration:    "calibration",
        manual_control: "manual_control",
    };
    const canSee = (item) => {
        if (hasLevel(user?.permissions, item.resource, "view")) return true;
        // Cek HMI override: menu muncul jika user punya override aktif pada halaman terkait
        const overridePage = HMI_OVERRIDE_PAGE[item.resource] ?? item.resource;
        if (hasHmiOverrideAccess(user?.hmiOverrides, overridePage)) return true;
        // door-operate (/door-operate) berbagi resource manual_control di RBAC,
        // tapi bisa punya override "door_operate" tersendiri.
        if (item.href === "/door-operate" && hasHmiOverrideAccess(user?.hmiOverrides, "door_operate")) return true;
        return false;
    };
    const visibleMain = user ? mainMenu.filter(canSee) : [];
    const visibleMachine = user ? machineMenu.filter(canSee) : [];
    const visibleAdmin = user ? adminMenu.filter(canSee) : [];

    return (
        <nav className="w-48 shrink-0 h-full bg-scada-ink text-white flex flex-col justify-between py-4 z-10 shadow-lg border-r border-scada-ink">
            {/* ── Menu atas ── */}
            <div className="px-4 flex flex-col gap-1 min-h-0 overflow-y-auto no-scrollbar">
                <div className="mb-3 px-2 flex flex-col items-center">
                    {/* Satoria Pharma Logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/satoria-logo.png" alt="Satoria Pharma" className="w-20 -mb-1 object-contain" />

                    <h2 className="text-xl font-bold text-scada-steam tracking-tight text-center">SCADA</h2>
                    <p className="text-[10px] text-scada-idle uppercase tracking-wider mt-0.5 text-center">Control System</p>
                </div>

                {/* Menu muncul setelah izin user terbaca dari /api/auth/me */}
                {fetched && !user && (
                    <p className="px-3 text-xs text-scada-idle">
                        Menu tidak tersedia. Muat ulang halaman.
                    </p>
                )}

                {visibleMain.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                ))}

                {/* Menu mesin (parameter, kalibrasi, jam, manual): hanya yang izinnya >= view */}
                {visibleMachine.length > 0 && (
                    <>
                        <div className="my-2 border-t border-white/10 mx-2" />
                        {visibleMachine.map((item) => (
                            <NavLink key={item.href} item={item} pathname={pathname} />
                        ))}
                    </>
                )}

                {/* Menu administrasi: hanya yang izinnya >= view */}
                {visibleAdmin.length > 0 && (
                    <>
                        <div className="my-2 border-t border-white/10 mx-2" />
                        {visibleAdmin.map((item) => (
                            <NavLink key={item.href} item={item} pathname={pathname} />
                        ))}
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
                        <span className="text-[10px] text-scada-idle font-mono uppercase truncate">
                            Role: {user.roleName ?? user.role}
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