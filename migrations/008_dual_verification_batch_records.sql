-- =============================================================================
-- Migrasi 008: Dual Verification (Four-Eyes Principle) pada Batch Records
-- Tanggal: 2026-11-14
--
-- Menambahkan kolom `verifier` dan `verifier_username` ke tabel `batch_records`
-- untuk mencatat user kedua yang memverifikasi input batch sebelum start.
-- =============================================================================

ALTER TABLE public.batch_records
    ADD COLUMN IF NOT EXISTS verifier text,
    ADD COLUMN IF NOT EXISTS verifier_username text;

COMMENT ON COLUMN public.batch_records.verifier IS 'Nama lengkap user kedua (verifikator) yang memverifikasi data batch';
COMMENT ON COLUMN public.batch_records.verifier_username IS 'Username user kedua (verifikator) yang memverifikasi data batch';
