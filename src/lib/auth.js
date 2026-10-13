// ==============================================================================
// PERHATIAN: File ini adalah SERVER-ONLY (Node.js runtime).
// JANGAN meng-import file ini dari komponen "use client" atau proxy.js
// (Edge Runtime) — akan error karena menggunakan "pg" untuk query database.
// ==============================================================================

import { SignJWT, jwtVerify } from "jose";
import pool from "./db.js";

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

// ── Helper internal: cek is_active & ambil role terkini dari database ─────────
// Memastikan perubahan role/status oleh admin langsung berlaku tanpa menunggu
// token expired. Return { dbRole, isActive } atau null kalau user tidak ada.
async function checkUserInDB(username) {
    try {
        const result = await pool.query(
            "SELECT is_active, role FROM users WHERE username = $1",
            [username]
        );
        if (result.rows.length === 0) return null;
        return { dbRole: result.rows[0].role, isActive: result.rows[0].is_active };
    } catch {
        return null;
    }
}

// ── 4. Guard: wajib login + aktif di database ─────────────────────────────────
// - Verifikasi JWT (signature + expiry)
// - Query DB: user harus ada dan is_active = true
// - role di session diambil dari DB (bukan dari payload JWT lama)
// Return { session, errorResponse: null } kalau valid,
// atau { session: null, errorResponse } kalau gagal.
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

    // Cek ke database: is_active dan role terkini
    const dbUser = await checkUserInDB(jwtPayload.username);
    if (!dbUser || !dbUser.isActive) {
        return {
            session: null,
            errorResponse: Response.json(
                { ok: false, error: "Akun tidak aktif atau tidak ditemukan" },
                { status: 401 }
            ),
        };
    }

    // Gabungkan payload JWT dengan data DB terkini
    // (role dari DB dipakai, bukan dari token lama)
    const session = { ...jwtPayload, role: dbUser.dbRole };
    return { session, errorResponse: null };
}

// ── 5. Guard: wajib login, aktif, DAN role "admin" di database ───────────────
export async function requireAdmin(cookieStore) {
    const { session, errorResponse } = await requireAuth(cookieStore);
    if (errorResponse) return { session: null, errorResponse };

    // role sudah diambil dari DB di requireAuth — tidak pakai token lama
    if (session.role !== "admin") {
        return {
            session: null,
            errorResponse: Response.json(
                { ok: false, error: "Hanya admin yang diizinkan" },
                { status: 403 }
            ),
        };
    }
    return { session, errorResponse: null };
}