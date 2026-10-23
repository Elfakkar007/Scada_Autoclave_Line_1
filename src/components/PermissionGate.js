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
 *   resource  (string)  - nama resource dari permissionCatalog
 *   minLevel  (string)  - level minimum; default "view"
 *   children  (node)    - konten yang dijaga
 */

import { useEffect, useState } from "react";
import { hasLevel } from "@/lib/permissionCatalog";

export default function PermissionGate({ resource, minLevel = "view", children }) {
    const [status, setStatus] = useState("loading"); // "loading" | "ok" | "denied"

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                if (json.ok && hasLevel(json.user?.permissions ?? {}, resource, minLevel)) {
                    setStatus("ok");
                } else {
                    setStatus("denied");
                }
            })
            .catch(() => {
                if (!cancelled) setStatus("denied");
            });
        return () => { cancelled = true; };
    // resource dan minLevel adalah konstanta prop, tidak perlu masuk dependency runtime
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
