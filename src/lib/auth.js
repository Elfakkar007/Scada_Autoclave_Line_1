// ==============================================================================
// PERHATIAN: File ini adalah SERVER-ONLY (Node.js runtime).
// JANGAN meng-import file ini dari komponen "use client" atau proxy.js
// (Edge Runtime) — akan error karena menggunakan "pg" untuk query database.
// ==============================================================================
//
// Fase 1 (Role Management):
//  - Peran & izin SELALU dibaca dari database pada setiap request (bukan dari JWT).
//  - session.role tetap berisi KEY role (mis. "admin", "qa") supaya kode lama
//    yang memakai session.role (audit actor_role, dll.) tetap jalan.
//  - requirePermission(...) adalah guard baru. requireAdmin dipertahankan
//    sementara sebagai kompatibilitas (admin saja, seperti perilaku lama) dan
//    DIHAPUS setelah semua pemakaiannya diganti.
// ==============================================================================

import { SignJWT, jwtVerify } from "jose";
import pool from "./db.js";
import { hasLevel, isKnownResource } from "./permissionCatalog.js";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// ── 1. Buat JWT session token ──────────────────────────────────────────────────
// payload: { userId, username, fullName, role }
export async function createSessionToken(payload) {
    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(SECRET);
    return token;
}

// ── 1b. Opsi cookie sesi (item 7) ─────────────────────────────────────────────
// `secure` TIDAK lagi mengikuti NODE_ENV: di produksi yang diakses lewat
// http://IP-lokal, cookie secure ditolak browser sehingga login selalu gagal.
// Sekarang ditentukan env COOKIE_SECURE ("true" hanya bila diakses lewat HTTPS).
// Bila tidak diset, default false.
// Dipakai oleh login (set) dan sebaiknya juga oleh logout (hapus) supaya atributnya sama.
export function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: "lax",
        maxAge: 60 * 60 * 8, // 8 jam, sama dengan masa berlaku JWT
        path: "/",
    };
}

// ── 2. Verifikasi token — return payload atau null ────────────────────────────
export async function verifySessionToken(token) {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload;
    } catch {
        // Token tidak valid, sudah kadaluarsa, atau rusak → return null
        return null;
    }
}

// ── 3. Baca session dari cookie store (next/headers) ─────────────────────────
// Contoh penggunaan di Server Component / Route Handler:
//   import { cookies } from "next/headers";
//   const session = await getSessionFromCookies(await cookies());
export async function getSessionFromCookies(cookieStore) {
    const cookie = cookieStore.get("session_token");
    if (!cookie?.value) return null;
    return verifySessionToken(cookie.value);
}

// ── Helper internal: status akun + role + izin terkini dari database ─────────
// Perubahan role/izin/status oleh admin langsung berlaku tanpa menunggu token
// expired. Return null bila user tidak ada atau query gagal (fail-closed).
// Peta izin kosong ({}) = tolak semua.
async function loadUserAccess(username) {
    try {
        const result = await pool.query(
            `SELECT u.is_active,
                    u.deleted_at,
                    u.role_id,
                    r.key  AS role_key,
                    r.name AS role_name,
                    COALESCE(
                        (SELECT jsonb_object_agg(rp.resource, rp.level)
                           FROM role_permissions rp
                          WHERE rp.role_id = u.role_id),
                        '{}'::jsonb
                    ) AS permissions
               FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
              WHERE u.username = $1`,
            [username]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        // Akun terhapus secara lunak diperlakukan sama seperti tidak ada
        if (row.deleted_at !== null) return null;
        return {
            isActive: row.is_active,
            roleId: row.role_id,
            roleKey: row.role_key,
            roleName: row.role_name,
            permissions: row.permissions ?? {},
        };
    } catch (err) {
        console.error("[auth] Gagal membaca akses user dari database:", err.message);
        return null;
    }
}

// ── 4. Guard: wajib login + aktif di database ─────────────────────────────────
// - Verifikasi JWT (signature + expiry)
// - Query DB: user harus ada dan is_active = true
// - role & izin di session diambil dari DB (bukan dari payload JWT lama)
// Return { session, errorResponse: null } kalau valid,
// atau { session: null, errorResponse } kalau gagal.
//
// session = { ...jwt, role: <key role>, roleKey, roleId, roleName, permissions }
export async function requireAuth(cookieStore) {
    const jwtPayload = await getSessionFromCookies(cookieStore);
    if (!jwtPayload) {
        return {
            session: null,
            errorResponse: Response.json(
                { ok: false, error: "Belum login" },
                { status: 401 }
            ),
        };
    }

    const access = await loadUserAccess(jwtPayload.username);
    if (!access || !access.isActive) {
        return {
            session: null,
            errorResponse: Response.json(
                { ok: false, error: "Akun tidak aktif atau tidak ditemukan" },
                { status: 401 }
            ),
        };
    }

    const session = {
        ...jwtPayload,
        role: access.roleKey ?? "none", // kompatibilitas kode lama
        roleKey: access.roleKey,
        roleId: access.roleId,
        roleName: access.roleName,
        permissions: access.permissions,
    };
    return { session, errorResponse: null };
}

function forbidden(message) {
    return Response.json({ ok: false, error: message }, { status: 403 });
}

// ── 5. Guard baru: wajib login, aktif, DAN punya izin pada resource ───────────
// requirePermission(cookieStore, "formula", "edit")
// Resource harus ada di permissionCatalog (salah ketik = error keras, bukan lolos).
export async function requirePermission(cookieStore, resource, minLevel = "view") {
    if (!isKnownResource(resource)) {
        throw new Error(`requirePermission: resource tidak dikenal "${resource}"`);
    }
    const { session, errorResponse } = await requireAuth(cookieStore);
    if (errorResponse) return { session: null, errorResponse };

    if (!hasLevel(session.permissions, resource, minLevel)) {
        return {
            session: null,
            errorResponse: forbidden("Anda tidak memiliki izin untuk aksi ini"),
        };
    }
    return { session, errorResponse: null };
}

// ── 5b. Lolos bila punya SALAH SATU izin: [["users","view"], ["roles","view"]] ─
export async function requireAnyPermission(cookieStore, options) {
    for (const [resource] of options) {
        if (!isKnownResource(resource)) {
            throw new Error(`requireAnyPermission: resource tidak dikenal "${resource}"`);
        }
    }
    const { session, errorResponse } = await requireAuth(cookieStore);
    if (errorResponse) return { session: null, errorResponse };

    const ok = options.some(([resource, level = "view"]) =>
        hasLevel(session.permissions, resource, level)
    );
    if (!ok) {
        return {
            session: null,
            errorResponse: forbidden("Anda tidak memiliki izin untuk aksi ini"),
        };
    }
    return { session, errorResponse: null };
}

// ── 6. DEPRECATED — requireAdmin ──────────────────────────────────────────────
// Kompatibilitas sementara: hanya role dengan key "admin" (perilaku lama).
// Ganti semua pemakaian dengan requirePermission(...), lalu hapus fungsi ini.
export async function requireAdmin(cookieStore) {
    const { session, errorResponse } = await requireAuth(cookieStore);
    if (errorResponse) return { session: null, errorResponse };

    if (session.roleKey !== "admin") {
        return {
            session: null,
            errorResponse: forbidden("Hanya admin yang diizinkan"),
        };
    }
    return { session, errorResponse: null };
}