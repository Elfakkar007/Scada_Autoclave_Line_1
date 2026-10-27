import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { insertAudit, tryAudit } from "@/lib/auditLog";

// ── Batas percobaan login (item 7) ────────────────────────────────────────────
// 5 percobaan gagal per username dalam 15 menit. Dihitung dari audit_log
// (action = 'login_failed'), jadi tahan restart server. Login berhasil mereset hitungan.
// Efek samping yang disadari: siapa pun di PC ini bisa mengunci sebuah username selama
// maksimal 15 menit. Yang terkunci hanya LOGIN BARU; sesi yang sudah login tidak terganggu.
const WINDOW_MIN = 15;
const MAX_FAILS = 5;

const MAX_USERNAME_LEN = 64;
const MAX_PASSWORD_LEN = 200;

const GENERIC_ERROR = "Username atau password salah";
// Hanya ditampilkan bila username ada, belum dihapus, akun nonaktif, DAN password benar
// (jadi tidak bisa dipakai menebak status akun tanpa tahu password).
const INACTIVE_ERROR = "Akun Anda dinonaktifkan. Hubungi administrator.";
const BLOCKED_ERROR = "Terlalu banyak percobaan login gagal. Coba lagi beberapa menit lagi.";

// Hash palsu: supaya waktu respons untuk username yang tidak ada mirip dengan yang ada.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

/** @returns {Promise<{blocked: boolean, retryAfter?: number}>} */
async function checkThrottle(username) {
    const r = await pool.query(
        `WITH s AS (
            SELECT GREATEST(
                now() - make_interval(mins => $2::int),
                COALESCE(
                    (SELECT max(event_time) FROM audit_log
                      WHERE action = 'login' AND actor = $1),
                    '-infinity'::timestamptz
                )
            ) AS since
         )
         SELECT
            count(*) AS fails,
            EXTRACT(EPOCH FROM (min(event_time) + make_interval(mins => $2::int) - now())) AS retry
         FROM audit_log
         WHERE action = 'login_failed'
           AND actor = $1
           AND event_time > (SELECT since FROM s)`,
        [username, WINDOW_MIN]
    );
    const row = r.rows[0];
    if (parseInt(row.fails, 10) < MAX_FAILS) return { blocked: false };
    const retry = Number(row.retry);
    return { blocked: true, retryAfter: Number.isFinite(retry) ? Math.max(1, Math.ceil(retry)) : WINDOW_MIN * 60 };
}

export async function POST(request) {
    try {
        const body = await request.json().catch(() => null);
        const rawUsername = body?.username;
        const rawPassword = body?.password;

        // Validasi tipe dan panjang (sebelumnya username non-string menyebabkan 500)
        if (
            typeof rawUsername !== "string" || typeof rawPassword !== "string" ||
            !rawUsername.trim() || !rawPassword
        ) {
            return Response.json(
                { ok: false, error: "Username dan password wajib diisi" },
                { status: 400 }
            );
        }
        if (rawUsername.length > MAX_USERNAME_LEN || rawPassword.length > MAX_PASSWORD_LEN) {
            return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
        }

        const username = rawUsername.trim();

        // ── Cek batas percobaan SEBELUM memeriksa password ────────────────────
        const throttle = await checkThrottle(username);
        if (throttle.blocked) {
            // Cukup satu baris login_blocked per username per jendela waktu (cegah banjir audit_log)
            const already = await pool.query(
                `SELECT 1 FROM audit_log
                  WHERE action = 'login_blocked' AND actor = $1
                    AND event_time > now() - make_interval(mins => $2::int)
                  LIMIT 1`,
                [username, WINDOW_MIN]
            );
            if (already.rows.length === 0) {
                await tryAudit({
                    actor: username,
                    actorRole: null,
                    action: "login_blocked",
                    entityType: "user",
                    entityId: username,
                    newValue: { windowMin: WINDOW_MIN, maxFails: MAX_FAILS, retryAfterSec: throttle.retryAfter },
                    description: `Login ${username} diblokir sementara setelah ${MAX_FAILS} percobaan gagal`,
                }, "auth/login");
            }
            return Response.json(
                { ok: false, error: BLOCKED_ERROR },
                { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } }
            );
        }

        // ── Ambil user (aktif ATAU nonaktif; yang terhapus-lunak dianggap tidak ada) ──
        // + role dari tabel roles. Status aktif diperiksa SESUDAH password cocok (lihat bawah).
        // Kolom lama users.role TIDAK dipakai lagi (hanya disinkronkan trigger untuk rollback).
        const result = await pool.query(
            `SELECT u.id, u.username, u.full_name, u.password_hash, u.role_id, u.is_active,
                    r.key AS role_key, r.name AS role_name
               FROM users u
               LEFT JOIN roles r ON r.id = u.role_id
              WHERE u.username = $1 AND u.deleted_at IS NULL`,
            [username]
        );
        const user = result.rows[0] ?? null;

        // Selalu jalankan bcrypt (async, tidak memblokir event loop), ada user atau tidak
        const passwordMatch = await bcrypt.compare(rawPassword, user ? user.password_hash : DUMMY_HASH);

        if (!user || !passwordMatch) {
            // Alasan sebenarnya HANYA ke audit_log; klien selalu menerima pesan generik.
            await tryAudit({
                actor: username,
                actorRole: null,
                action: "login_failed",
                entityType: "user",
                entityId: username,
                newValue: { reason: user ? "wrong_password" : "unknown_user" },
                description: `Login gagal untuk username "${username}"`,
            }, "auth/login");
            return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
        }

        // Password benar tetapi akun dinonaktifkan: beri pesan informatif.
        // Tetap dicatat sebagai login_failed (ikut hitungan batas percobaan, seperti sebelumnya).
        if (!user.is_active) {
            await tryAudit({
                actor: username,
                actorRole: null,
                action: "login_failed",
                entityType: "user",
                entityId: username,
                newValue: { reason: "inactive_account" },
                description: `Login ditolak: akun "${username}" nonaktif`,
            }, "auth/login");
            return Response.json({ ok: false, error: INACTIVE_ERROR }, { status: 403 });
        }

        // ── Login berhasil ─────────────────────────────────────────────────────
        await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);

        // Key role dari DB. "none" = user tanpa role (izin kosong = semua ditolak, lihat auth.js).
        const roleKey = user.role_key ?? "none";
        const roleName = user.role_name ?? roleKey;

        await insertAudit(pool, {
            actor: user.username,
            actorRole: roleKey,
            action: "login",
            entityType: "user",
            entityId: user.username,
            description: `User ${user.username} login berhasil`,
        });

        const token = await createSessionToken({
            userId: user.id,
            username: user.username,
            fullName: user.full_name,
            // Hanya untuk kompatibilitas kode lama. Hak akses sebenarnya selalu dibaca
            // dari DB per request oleh requireAuth, bukan dari isi token ini.
            role: roleKey,
        });

        const cookieStore = await cookies();
        cookieStore.set("session_token", token, sessionCookieOptions());

        return Response.json({
            ok: true,
            user: {
                username: user.username,
                fullName: user.full_name,
                role: roleKey,
                roleId: user.role_id,
                roleName,
            },
        });
    } catch (error) {
        console.error("[POST /api/auth/login]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan server" }, { status: 500 });
    }
}