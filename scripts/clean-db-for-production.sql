-- =============================================================
-- clean-db-for-production.sql
-- Bersihkan semua data dummy/development dari database.
-- Jalankan di pgAdmin Query Tool atau psql pada database: scada-atv1
--
-- EFEK:
--   - Semua record tabel transaksi dikosongkan (TRUNCATE CASCADE)
--   - Semua user dihapus KECUALI 1 admin placeholder
--   - Data master (roles, role_permissions) dipertahankan
--   - Sequences di-reset ke 1
-- =============================================================

BEGIN;

-- -------------------------------------------------------
-- 1. Kosongkan tabel transaksi (urutan dari child ke parent)
-- -------------------------------------------------------
TRUNCATE TABLE
    public.alarm_log,
    public.audit_log,
    public.batch_trend,
    public.batch_records
CASCADE;

-- -------------------------------------------------------
-- 3. Kosongkan semua user
-- -------------------------------------------------------
DELETE FROM public.users;

-- -------------------------------------------------------
-- 4. Buat 1 user admin placeholder
--    Username : admin
--    Password : Admin1234!
--    (Ganti password segera setelah login pertama!)
--
--    Hash bcrypt untuk "Admin1234!" (cost=10):
--    Kalau mau hash password lain, jalankan:
--      node scripts/hash-password.js "PasswordBaru123!"
-- -------------------------------------------------------
INSERT INTO public.users (username, password_hash, full_name, role_id)
VALUES (
    'admin',
    '$2b$10$WxoQd3Ki8CJEvrjvHEfPL.mYXR.aCGNyw1.qsYYr15DBdf.aBAr2a',  -- Admin1234!
    'Administrator',
    (SELECT id FROM public.roles WHERE key = 'admin')
);

-- -------------------------------------------------------
-- 5. Reset sequences supaya ID mulai dari 1 lagi
-- -------------------------------------------------------
SELECT setval(pg_get_serial_sequence('public.alarm_log',    'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.audit_log',    'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.batch_records','id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.batch_trend',  'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.users',        'id'), 1, false);

COMMIT;

-- Verifikasi
SELECT 'alarm_log'    AS tabel, COUNT(*) AS baris FROM public.alarm_log
UNION ALL
SELECT 'audit_log',    COUNT(*) FROM public.audit_log
UNION ALL
SELECT 'batch_records',COUNT(*) FROM public.batch_records
UNION ALL
SELECT 'batch_trend',  COUNT(*) FROM public.batch_trend
UNION ALL
SELECT 'users',        COUNT(*) FROM public.users;
