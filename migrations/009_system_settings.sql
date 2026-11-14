-- Migration 009: Tabel system_settings untuk konfigurasi sesi, auto-lockscreen, dan auto-stop batch.
-- Kompatibel dengan PostgreSQL.

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    label VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by VARCHAR(64)
);

-- Seed konfigurasi default
INSERT INTO system_settings (key, value, label, category, description, updated_by)
VALUES
    (
        'session_timeout_hours',
        '8'::jsonb,
        'Masa Berlaku Sesi Login (Jam)',
        'security',
        'Durasi masa berlaku cookie dan token JWT sebelum user otomatis logout (1 - 72 jam).',
        'system'
    ),
    (
        'lockscreen_idle_minutes',
        '7'::jsonb,
        'Durasi Auto-Lockscreen (Menit)',
        'security',
        'Durasi layar diam (tanpa klik/ketik) sebelum layar SCADA terkunci otomatis (1 - 60 menit).',
        'system'
    ),
    (
        'batch_stop_mode',
        '"pressure_zero"'::jsonb,
        'Metode Auto-Stop Batch Record',
        'batch',
        'Kriteria auto-stop batch: "pressure_zero" (P1 dan P2 <= ambang batas setelah fase sterilisasi) atau "idle_timeout" (hanya berbasis durasi idle PLC).',
        'system'
    ),
    (
        'batch_stop_pressure_threshold',
        '0'::jsonb,
        'Ambang Batas Tekanan Auto-Stop (kPa)',
        'batch',
        'Batas tekanan P1 dan P2 (dalam kPa) untuk memicu auto-stop setelah fase sterilisasi selesai.',
        'system'
    ),
    (
        'batch_stop_pulse_plc',
        'true'::jsonb,
        'Kirim Pulsa STOP ke PLC Saat Auto-Stop',
        'batch',
        'Kirim pulsa sinyal STOP ke PLC untuk mematikan status END dan mengembalikan mesin ke idle saat batch difinalisasi.',
        'system'
    ),
    (
        'batch_stop_idle_fallback_sec',
        '120'::jsonb,
        'Batas Waktu Idle Cadangan (Detik)',
        'batch',
        'Batas waktu tunggu idle sebelum auto-finalize darurat jika kondisi tekanan tidak terpicu.',
        'system'
    )
ON CONFLICT (key) DO NOTHING;

-- Daftarkan izin 'settings' ke tabel role_permissions
-- Role admin mendapatkan izin edit
INSERT INTO role_permissions (role_id, resource, level)
SELECT r.id, 'settings', 'edit'
FROM roles r
WHERE r.key = 'admin'
ON CONFLICT (role_id, resource) DO UPDATE SET level = 'edit';

-- Role supervisor dan qa mendapatkan izin view
INSERT INTO role_permissions (role_id, resource, level)
SELECT r.id, 'settings', 'view'
FROM roles r
WHERE r.key IN ('supervisor', 'qa')
ON CONFLICT (role_id, resource) DO UPDATE SET level = 'view';
