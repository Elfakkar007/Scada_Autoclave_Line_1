-- =============================================================================
-- Migrasi 003: Hapus Lunak User (Soft Delete)
-- Dibuat: 2026-10-22
-- Dijalankan secara manual (JANGAN dieksekusi otomatis).
-- Ikuti gaya migrasi 002.
-- =============================================================================
BEGIN;

-- ── 1. Tambah kolom deleted_at ─────────────────────────────────────────────
-- NULL  = user aktif / nonaktif biasa
-- NOT NULL = user terhapus secara lunak; username terkunci selamanya
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- ── 2. Constraint: username tetap terkunci untuk baris terhapus ────────────
-- Unique constraint lama (users_username_key) TETAP berlaku untuk SEMUA baris,
-- termasuk yang terhapus. Tidak dibuat partial index yang mengecualikan baris
-- terhapus, sehingga username tidak bisa didaur-ulang meski sudah "dihapus".
-- (Constraint lama sudah cukup, tidak perlu diubah.)

-- ── 3. Izinkan role_id NULL hanya untuk akun terhapus ─────────────────────
-- Lepas NOT NULL dari role_id (role_id mungkin sudah nullable di DB lama;
-- IF EXISTS pada constraint aman).
ALTER TABLE users
    ALTER COLUMN role_id DROP NOT NULL;

-- Tambah CHECK: akun AKTIF (belum dihapus) wajib punya role_id.
-- Nama constraint mengikuti gaya 002.
ALTER TABLE users
    ADD CONSTRAINT users_role_id_required_if_not_deleted
    CHECK (deleted_at IS NOT NULL OR role_id IS NOT NULL);

-- ── 4. Perbaiki trigger trg_users_sync_legacy_role ─────────────────────────
-- Bila NEW.role_id IS NULL, NEW.role := 'operator'.
-- Selain itu, ambil key dari roles: bila key = 'admin' maka NEW.role := 'admin',
-- selain itu (termasuk role tidak ditemukan) NEW.role := 'operator'.
-- CHECK users_role_check hanya menerima 'operator' atau 'admin' dan sengaja dipertahankan.
CREATE OR REPLACE FUNCTION public.trg_users_sync_legacy_role_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_role_key TEXT;
BEGIN
    IF NEW.role_id IS NULL THEN
        NEW.role := 'operator';
    ELSE
        SELECT key INTO v_role_key FROM roles WHERE id = NEW.role_id;
        IF v_role_key = 'admin' THEN
            NEW.role := 'admin';
        ELSE
            NEW.role := 'operator';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger sudah terpasang dari migrasi 002 memanggil trg_users_sync_legacy_role_fn().
-- Jangan membuat ulang trigger bila sudah ada dengan definisi sama.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_users_sync_legacy_role'
          AND tgrelid = 'users'::regclass
    ) THEN
        CREATE TRIGGER trg_users_sync_legacy_role
            BEFORE INSERT OR UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION public.trg_users_sync_legacy_role_fn();
    END IF;
END;
$$;

-- ── 5. Index untuk query "hanya user aktif/belum terhapus" ────────────────
-- Mempercepat WHERE deleted_at IS NULL (paling sering dipakai).
CREATE INDEX IF NOT EXISTS idx_users_not_deleted
    ON users (id)
    WHERE deleted_at IS NULL;

COMMIT;
