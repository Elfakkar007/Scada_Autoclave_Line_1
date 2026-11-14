-- Rollback Migration 009: Hapus tabel system_settings dan izin terkait.

DELETE FROM role_permissions WHERE resource = 'settings';
DROP TABLE IF EXISTS system_settings;
