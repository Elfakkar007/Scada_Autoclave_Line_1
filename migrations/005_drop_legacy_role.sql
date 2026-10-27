-- =============================================================================
-- Migrasi 005: Hapus kolom lama users.role dan perlengkapannya (Fase 1 / 13.4b)
-- Dibuat: 2026-10-27
-- Dijalankan secara manual di pgAdmin (JANGAN dieksekusi otomatis).
--
-- SEBELUM MENJALANKAN:
--   1. Backup DB dulu (pgAdmin: klik kanan scada-atv1 -> Backup).
--   2. Kode aplikasi TIDAK membaca/menulis users.role (diverifikasi dengan grep
--      dan pemeriksaan INSERT/UPDATE users, 27 Okt). Aman dijalankan saat server
--      jalan; kunci tabel hanya sesaat.
--   3. Jangan jalankan dua kali: pemeriksaan awal akan membatalkan dengan pesan jelas.
--
-- AKIBAT: rollback 002 dan 003 TIDAK bisa dipakai lagi setelah ini.
--         Jalan mundur = 005_drop_legacy_role_rollback.sql (atau restore backup).
--
-- YANG DIHAPUS (semuanya terverifikasi dari DB, 27 Okt):
--   - trigger  trg_users_sync_legacy_role           (di tabel users)
--   - fungsi   trg_users_sync_legacy_role_fn()      (dipakai trigger di atas)
--   - fungsi   users_sync_legacy_role()             (yatim: tidak dipakai trigger mana pun)
--   - CHECK    users_role_check
--   - kolom    users.role                           (text NOT NULL DEFAULT 'operator')
-- TIDAK disentuh: roles_block_system_delete + trigger-nya (milik tabel roles),
--                 audit_log + trigger-nya, users_role_id_fkey,
--                 users_role_id_required_if_not_deleted, idx_users_*.
-- =============================================================================
BEGIN;

-- ── 0. Pemeriksaan awal: batalkan seluruh migrasi bila ada kejutan ───────────
DO $$
DECLARE
    v_attnum smallint;
    v_n      integer;
BEGIN
    SELECT attnum INTO v_attnum
      FROM pg_attribute
     WHERE attrelid = 'public.users'::regclass AND attname = 'role' AND NOT attisdropped;
    IF v_attnum IS NULL THEN
        RAISE EXCEPTION '005 dibatalkan: kolom users.role tidak ada (005 sudah pernah dijalankan?)';
    END IF;

    -- Trigger di users selain yang akan dihapus
    SELECT count(*) INTO v_n
      FROM pg_trigger
     WHERE tgrelid = 'public.users'::regclass
       AND NOT tgisinternal
       AND tgname <> 'trg_users_sync_legacy_role';
    IF v_n > 0 THEN
        RAISE EXCEPTION '005 dibatalkan: ada % trigger lain di tabel users; periksa dulu', v_n;
    END IF;

    -- Trigger lain (tabel mana pun) yang memakai kedua fungsi yang akan dihapus
    SELECT count(*) INTO v_n
      FROM pg_trigger
     WHERE NOT tgisinternal
       AND tgname <> 'trg_users_sync_legacy_role'
       AND tgfoid IN (to_regprocedure('public.trg_users_sync_legacy_role_fn()'),
                      to_regprocedure('public.users_sync_legacy_role()'));
    IF v_n > 0 THEN
        RAISE EXCEPTION '005 dibatalkan: ada % trigger lain yang memakai fungsi sinkron role', v_n;
    END IF;

    -- Objek lain yang bergantung pada kolom role (selain default dan users_role_check)
    SELECT count(*) INTO v_n
      FROM pg_depend d
      LEFT JOIN pg_constraint c
             ON d.classid = 'pg_constraint'::regclass AND c.oid = d.objid
     WHERE d.refclassid = 'pg_class'::regclass
       AND d.refobjid = 'public.users'::regclass
       AND d.refobjsubid = v_attnum
       AND NOT ( d.classid = 'pg_attrdef'::regclass
              OR (d.classid = 'pg_constraint'::regclass AND c.conname = 'users_role_check') );
    IF v_n > 0 THEN
        RAISE EXCEPTION '005 dibatalkan: ada % objek (view/index/constraint lain) yang bergantung pada users.role', v_n;
    END IF;

    -- Fungsi lain di schema public yang menyebut NEW.role / OLD.role / users.role / u.role
    SELECT count(*) INTO v_n
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname NOT IN ('trg_users_sync_legacy_role_fn', 'users_sync_legacy_role')
       AND p.prosrc ~* '((new|old)\.role\M|users\.role\M|\mu\.role\M)';
    IF v_n > 0 THEN
        RAISE EXCEPTION '005 dibatalkan: ada % fungsi lain yang menyebut kolom users.role', v_n;
    END IF;

    RAISE NOTICE '005: pemeriksaan awal lolos';
END;
$$;

-- ── 1. Trigger dulu, baru fungsinya ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_users_sync_legacy_role ON public.users;
DROP FUNCTION IF EXISTS public.trg_users_sync_legacy_role_fn();
DROP FUNCTION IF EXISTS public.users_sync_legacy_role();

-- ── 2. Constraint lalu kolom ─────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP COLUMN role;

COMMIT;

-- Verifikasi (jalankan terpisah setelah COMMIT; harapan: 0 baris untuk ketiganya):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='users' AND column_name='role';
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.users'::regclass AND NOT tgisinternal;   -- harus kosong
-- SELECT proname FROM pg_proc WHERE proname IN ('trg_users_sync_legacy_role_fn','users_sync_legacy_role');
