-- Rollback Migration 006: Hapus kolom bottle_count pada tabel batch_records

ALTER TABLE public.batch_records
DROP COLUMN IF EXISTS bottle_count;

