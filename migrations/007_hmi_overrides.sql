-- =============================================================================
-- Migrasi 007: HMI Permission Override per User
-- Tanggal: 2026-11-07
--
-- Menambahkan kolom `hmi_overrides` (JSONB) ke tabel `users`.
-- Format JSON:
--   {
--     "calibration":    { "mode": "default"|"custom", "items": { <itemKey>: "none"|"read"|"write" } },
--     "machine_params": { "mode": "default"|"custom", "items": { <itemKey>: "none"|"read"|"write" } },
--     "manual_control": { "mode": "default"|"custom", "items": { <itemKey>: "none"|"read"|"write" } },
--     "door_operate":   { "mode": "default"|"custom", "items": { <itemKey>: "none"|"read"|"write" } }
--   }
--
-- `mode`: "default" = ikuti RBAC role (kolom diabaikan), "custom" = pakai `items`
-- `items`: hanya berisi key yang di-override; key yang tidak ada = ikuti RBAC
-- Kolom NULL = semua halaman dalam mode "default" (perilaku identik dengan RBAC saja).
--
-- Halaman yang bisa di-override dan item key-nya:
--   calibration    : th, t1, t2, t3, t4, t5, t6, tm, tl, p1, p2, l, water
--   machine_params : sterTemp, ctrlTemp, tempSpace, sterTime, foValue, cool1, cool2,
--                    regPress, overTemp, drainTime, exhaustTemp, alarmPress, safetyPress,
--                    selPress, a1, b1, a2, b2, heatCoef, sterCoef, coolCoef
--   manual_control : steam1, steam2, cooling1, cooling2, airChamber, drain, exhaust,
--                    fill, pump, buzzer
--   door_operate   : seal, release, drain, unlock, chain
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hmi_overrides JSONB DEFAULT NULL;

COMMENT ON COLUMN users.hmi_overrides IS
    'Override izin HMI per halaman per user. NULL = semua default (ikuti RBAC). '
    'Format: { "<page>": { "mode": "default"|"custom", "items": { "<key>": "none"|"read"|"write" } } }';

