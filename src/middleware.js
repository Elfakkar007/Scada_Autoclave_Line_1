import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Gunakan jose langsung — edge-compatible, tidak ada dependency non-edge
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload;
    } catch {
        return null;
    }
}

// Path API yang boleh diakses tanpa login
const PUBLIC_API_PATHS = [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/me",
];

export async function middleware(request) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("session_token")?.value ?? null;

    // ── 1. Khusus /login: kalau sudah punya token valid → redirect ke / ───
    if (pathname === "/login") {
        if (token) {
            const payload = await verifyToken(token);
            if (payload) {
                return NextResponse.redirect(new URL("/", request.url));
            }
        }
        return NextResponse.next();
    }

    // ── 2. API auth publik: lewatkan tanpa cek ────────────────────────────
    if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // ── 3. Semua path lain: wajib punya token valid ───────────────────────
    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
        // Token rusak / expired: hapus cookie lalu redirect
        const res = NextResponse.redirect(new URL("/login", request.url));
        res.cookies.delete("session_token");
        return res;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
