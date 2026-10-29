-- Migration 006: Tambah kolom bottle_count pada tabel batch_records
-- Untuk mencatat amount / jumlah botol yang diisi manual oleh operator saat START batch.

ALTER TABLE public.batch_records
ADD COLUMN IF NOT EXISTS bottle_count integer;

COMMENT ON COLUMN public.batch_records.bottle_count IS 'Jumlah botol (amount) yang diisi manual oleh operator saat start batch';

