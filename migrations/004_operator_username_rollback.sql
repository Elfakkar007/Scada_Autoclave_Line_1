-- 004_operator_username_rollback.sql
-- Membuang kolom operator_username. Data di kolom ini ikut hilang.
-- Pasang kembali kode lama (batch/start tanpa operator_username) SEBELUM menjalankan ini.

BEGIN;

ALTER TABLE public.batch_records
    DROP COLUMN IF EXISTS operator_username;

COMMIT;
