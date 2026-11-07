"use client";

/**
 * src/components/PermissionGate.js
 *
 * Bungkus children dengan penjaga izin sisi klien.
 * - Fetch /api/auth/me SEKALI saat mount.
 * - Selama memuat: tampilkan indikator "Memuat..." — children TIDAK di-mount.
 * - Bila izin terpenuhi: render children.
 * - Bila izin kurang ATAU fetch gagal: tampilkan pesan akses ditolak (fail-closed).
 *   Tidak redirect supaya tidak menyebabkan loop dan kebocoran konteks.
 *
 * Props:
 *   resource          (string)  - nama resource dari permissionCatalog
 *   minLevel          (string)  - level minimum; default "view"
 *   hmiOverridePage   (string)  - opsional: nama page HMI override (dari OVERRIDE_PAGES).
 *                                 Bila ada, halaman juga lolos bila user punya override aktif
 *                                 untuk page tersebut (mendukung use-case foreman).
 *   children          (node)    - konten yang dijaga
 */

import { useEffect, useState } from "react";
import { hasLevel } from "@/lib/permissionCatalog";
import { hasHmiOverrideAccess } from "@/lib/hmiOverrideCatalog";

export default function PermissionGate({ resource, minLevel = "view", hmiOverridePage, children }) {
    const [status, setStatus] = useState("loading"); // "loading" | "ok" | "denied"

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                const perms = json.user?.permissions ?? {};
                const hmiOverrides = json.user?.hmiOverrides ?? null;
                const hasRbac = json.ok && hasLevel(perms, resource, minLevel);
                // Halaman juga lolos bila user punya HMI override aktif untuk page ini
                const hasOverride = hmiOverridePage
                    ? hasHmiOverrideAccess(hmiOverrides, hmiOverridePage)
                    : false;
                if (hasRbac || hasOverride) {
                    setStatus("ok");
                } else {
                    setStatus("denied");
                }
            })
            .catch(() => {
                if (!cancelled) setStatus("denied");
            });
        return () => { cancelled = true; };
    // resource, minLevel, hmiOverridePage adalah konstanta prop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (status === "loading") {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "200px",
                color: "#94a3b8",
                fontSize: "14px",
            }}>
                Memuat…
            </div>
        );
    }

    if (status === "denied") {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "200px",
                color: "#ef4444",
                fontSize: "15px",
                fontWeight: 500,
            }}>
                Anda tidak punya akses ke halaman ini.
            </div>
        );
    }

    return children;
}
