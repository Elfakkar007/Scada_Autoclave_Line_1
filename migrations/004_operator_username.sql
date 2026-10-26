-- 004_operator_username.sql
-- Fase 1 / 3B: simpan USERNAME pembuat batch (operator = nama tampilan, tidak cukup
-- untuk mengenali akun yang sudah dihapus-lunak).
-- Tanpa FK, tanpa backfill: baris lama = NULL = "tidak diketahui" = tanpa badge.
-- Idempoten: aman bila terjalankan dua kali.
-- JALANKAN SEBELUM kode baru (batch/start). Backup DB dulu.

BEGIN;

ALTER TABLE public.batch_records
    ADD COLUMN IF NOT EXISTS operator_username text NULL;

COMMENT ON COLUMN public.batch_records.operator_username IS
    'Username akun yang menekan START (dari sesi server). NULL = tidak diketahui (data lama, batch adopsi EXT-/system).';

COMMIT;

-- Verifikasi (jalankan terpisah setelah COMMIT):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'batch_records' AND column_name = 'operator_username';
