// Kamus label tampilan untuk kolom "aksi" pada audit_log.
//
// Nilai `action` di database TIDAK diubah (tetap kode mentah: dipakai filter, ekspor JSON, dan
// pencarian). Modul ini hanya menerjemahkannya untuk tampilan: halaman Audit Log, halaman cetak,
// dan ekspor Excel. Aksi yang belum terdaftar di sini ditampilkan apa adanya (kode mentah),
// jadi aksi baru tidak pernah hilang dari layar, hanya belum punya label.
//
// tone = warna badge: run (hijau) | water (biru) | steam (oranye) | stop (merah) | idle (abu) | plain.

const A = (label, tone = "plain") => ({ label, tone });

export const AUDIT_ACTIONS = {
    // ── Sesi ──
    login: A("Login", "plain"),
    login_failed: A("Login gagal", "stop"),
    login_blocked: A("Login diblokir", "stop"),
    logout: A("Logout", "idle"),
    unlock_screen: A("Buka kunci layar", "plain"),
    unlock_screen_failed: A("Buka kunci layar gagal", "stop"),

    // ── User ──
    create_user: A("Buat user", "run"),
    update_user: A("Ubah user", "water"),
    user_role_change: A("Ubah role user", "water"),
    deactivate_user: A("Ubah status aktif user", "water"), // handler [username]/route.js; arah (aktif/nonaktif) ada di deskripsi
    delete_user: A("Hapus user", "stop"),
    reset_password: A("Reset password", "steam"),

    // ── Role ──
    role_create: A("Buat role", "run"),
    role_update: A("Ubah role", "water"),
    role_permissions_update: A("Ubah izin role", "water"),
    role_delete: A("Hapus role", "stop"),

    // ── Batch ──
    start_batch_critical: A("START batch", "steam"),
    plc_setpoints_written: A("Setpoint resep ditulis ke PLC", "water"),
    stop_requested: A("STOP batch diminta", "idle"),
    stop_batch: A("STOP batch", "stop"),
    batch_auto_finalize: A("Batch ditutup otomatis", "idle"),

    // ── PLC: reset ──
    plc_reset_requested: A("Reset PLC diminta", "idle"),
    plc_reset_stop: A("Reset PLC (STOP dikirim)", "steam"),

    // ── PLC: jam ──
    plc_clock_write_requested: A("Set jam PLC diminta", "idle"),
    plc_clock_written: A("Jam PLC diubah", "water"),
    plc_clock_write_failed: A("Set jam PLC gagal", "stop"),

    // ── PLC: kontrol manual ──
    plc_manual_command: A("Kontrol manual", "water"),
    plc_manual_command_failed: A("Kontrol manual gagal", "stop"),

    // ── PLC: parameter mesin ──
    plc_parameter_write_requested: A("Tulis parameter mesin diminta", "idle"),
    plc_parameter_written: A("Parameter mesin diubah", "water"),
    plc_parameter_write_failed: A("Tulis parameter mesin gagal", "stop"),

    // ── PLC: kalibrasi ──
    plc_calibration_write_requested: A("Tulis kalibrasi diminta", "idle"),
    plc_calibration_written: A("Kalibrasi diubah", "water"),
    plc_calibration_write_failed: A("Tulis kalibrasi gagal", "stop"),

    // ── PLC: pintu ──
    plc_door_command: A("Kontrol pintu", "water"),
    plc_door_command_failed: A("Kontrol pintu gagal", "stop"),
    plc_door_chain: A("Rantai pintu", "water"),
};

/** Label tampilan; aksi tak dikenal dikembalikan apa adanya. */
export function auditActionLabel(action) {
    if (action === null || action === undefined || action === "") return "";
    return AUDIT_ACTIONS[action]?.label ?? String(action);
}

/** Warna badge; aksi tak dikenal = "plain". */
export function auditActionTone(action) {
    return AUDIT_ACTIONS[action]?.tone ?? "plain";
}
