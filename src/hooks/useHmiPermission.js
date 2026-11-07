"use client";
// =============================================================================
// useHmiPermission — hook client-side untuk evaluasi izin HMI override per item
//
// Mengambil user dari /api/auth/me (di-cache oleh Navbar polling).
// Menggabungkan RBAC permissions + hmiOverrides menjadi level efektif per item.
//
// Penggunaan:
//   const { canRead, canWrite, loading } = useHmiPermission("calibration", "th");
//   // atau tanpa itemKey, untuk level halaman:
//   const { canRead, canWrite } = useHmiPermission("manual_control");
// =============================================================================

import { useState, useEffect } from "react";
import { resolveHmiPermission } from "@/lib/hmiOverrideCatalog";

/**
 * Hook untuk mengevaluasi izin satu item HMI dari sudut pandang klien.
 *
 * @param {string} page     - "calibration" | "machine_params" | "manual_control" | "door_operate"
 * @param {string} [itemKey]- key item spesifik, atau null untuk level halaman
 * @returns {{ canRead: boolean, canWrite: boolean, level: string, source: string, loading: boolean, user: object|null }}
 */
export function useHmiPermission(page, itemKey = null) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (!cancelled && json.ok) setUser(json.user); })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    if (loading || !user) {
        return { canRead: false, canWrite: false, level: "none", source: "role", loading, user };
    }

    const { level, source } = resolveHmiPermission(
        user.hmiOverrides ?? null,
        user.permissions ?? {},
        page,
        itemKey
    );

    return {
        canRead: level === "read" || level === "write",
        canWrite: level === "write",
        level,
        source,
        loading,
        user,
    };
}

/**
 * Hook untuk mendapatkan fungsi evaluasi izin semua item dalam satu halaman sekaligus.
 * Lebih efisien dari memanggil useHmiPermission berkali-kali karena fetch hanya 1x.
 *
 * @param {string} page - halaman yang akan dievaluasi
 * @returns {{
 *   resolveItem: (itemKey: string) => { canRead: boolean, canWrite: boolean, level: string, source: string },
 *   resolveAll: () => { canRead: boolean, canWrite: boolean, level: string, source: string },
 *   user: object|null,
 *   loading: boolean
 * }}
 */
export function useHmiPagePermissions(page) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (!cancelled && json.ok) setUser(json.user); })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    function resolve(itemKey) {
        if (!user) return { canRead: false, canWrite: false, level: "none", source: "role" };
        const { level, source } = resolveHmiPermission(
            user.hmiOverrides ?? null,
            user.permissions ?? {},
            page,
            itemKey
        );
        return {
            canRead: level === "read" || level === "write",
            canWrite: level === "write",
            level,
            source,
        };
    }

    return {
        resolveItem: resolve,
        resolveAll: () => resolve(null),
        user,
        loading,
    };
}

