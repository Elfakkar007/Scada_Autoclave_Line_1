-- =============================================================================
-- Rollback migrasi 007: HMI Permission Override per User
-- Jalankan ini HANYA bila perlu membatalkan migrasi 007_hmi_overrides.sql.
-- PERHATIAN: semua data override yang sudah dikonfigurasi akan hilang permanen.
-- =============================================================================

ALTER TABLE users
    DROP COLUMN IF EXISTS hmi_overrides;

