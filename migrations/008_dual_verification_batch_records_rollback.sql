-- =============================================================================
-- Rollback Migrasi 008: Dual Verification pada Batch Records
-- =============================================================================

ALTER TABLE public.batch_records
    DROP COLUMN IF EXISTS verifier,
    DROP COLUMN IF EXISTS verifier_username;
