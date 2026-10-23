-- =============================================================================
-- Rollback migrasi 003: Hapus Lunak User (Soft Delete)
-- Dibuat: 2026-10-22
-- Dijalankan secara manual HANYA untuk membalik 003_soft_delete_users.sql.
-- =============================================================================
--
-- PERINGATAN: Bila ada baris dengan deleted_at IS NOT NULL (user sudah dihapus
-- secara lunak), TIDAK BISA langsung mengembalikan NOT NULL pada role_id karena
-- baris tersebut memiliki role_id = NULL. Sebelum menjalankan rollback ini:
--   1. Pastikan tidak ada baris dengan deleted_at IS NOT NULL, ATAU
--   2. Berikan role_id sementara yang valid kepada baris tersebut terlebih dulu:
--      UPDATE users SET role_id = <id_role_fallback> WHERE deleted_at IS NOT NULL;
-- Perilaku: jika masih ada baris terhapus (role_id NULL), ALTER COLUMN ... SET NOT NULL
-- akan GAGAL dengan error -- ini aman (rollback gagal daripada data rusak).
-- =============================================================================
BEGIN;

-- ── 1. Hapus index partial ─────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_users_not_deleted;

-- ── 2. Kembalikan fungsi trigger ke versi migrasi 002 ───────────────────────
-- Kembalikan fungsi ke logika versi 002 (tanpa cabang NULL) dan biarkan trigger tetap terpasang.
CREATE OR REPLACE FUNCTION public.trg_users_sync_legacy_role_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_role_key TEXT;
BEGIN
    SELECT key INTO v_role_key FROM roles WHERE id = NEW.role_id;
    IF v_role_key = 'admin' THEN
        NEW.role := 'admin';
    ELSE
        NEW.role := 'operator';
    END IF;
    RETURN NEW;
END;
$$;

-- ── 3. Hapus CHECK constraint yang ditambahkan ─────────────────────────────
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_id_required_if_not_deleted;

-- ── 4. Kembalikan NOT NULL pada role_id ────────────────────────────────────
-- Akan GAGAL bila ada baris dengan role_id = NULL (user terhapus).
-- Ini disengaja: lihat peringatan di atas.
ALTER TABLE users
    ALTER COLUMN role_id SET NOT NULL;

-- ── 5. Hapus kolom deleted_at ──────────────────────────────────────────────
-- Data deleted_at HILANG permanen setelah ini.
ALTER TABLE users
    DROP COLUMN IF EXISTS deleted_at;

COMMIT;
