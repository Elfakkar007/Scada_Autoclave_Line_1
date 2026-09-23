// ==============================================================================
// PERHATIAN: File ini adalah SERVER-ONLY.
// JANGAN meng-import file ini dari komponen "use client" — akan error.
// ==============================================================================

import { SignJWT, jwtVerify } from "jose";

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

// ── 4. Guard: wajib login ─────────────────────────────────────────────────────
// Return { session, errorResponse: null } kalau valid,
// atau { session: null, errorResponse } kalau tidak login
export async function requireAuth(cookieStore) {
    const session = await getSessionFromCookies(cookieStore);
    if (!session) {
        return {
            session: null,
            errorResponse: Response.json(
                { ok: false, error: "Belum login" },
                { status: 401 }
            ),
        };
    }
    return { session, errorResponse: null };
}

// ── 5. Guard: wajib login DAN role "admin" ────────────────────────────────────
export async function requireAdmin(cookieStore) {
    const { session, errorResponse } = await requireAuth(cookieStore);
    if (errorResponse) return { session: null, errorResponse };
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
