// Jalankan: node src/lib/auditActionLabels.test.mjs
import { AUDIT_ACTIONS, auditActionLabel, auditActionTone } from "./auditActionLabels.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error("GAGAL:", msg); } };

// Seluruh aksi yang dicatat kode (inventaris audit 2026-11-02 + INSERT mentah: plc_reset_stop, export_*; + backup_*).
const KODE = [
    "login", "login_failed", "login_blocked", "logout", "unlock_screen", "unlock_screen_failed",
    "create_user", "update_user", "user_role_change", "deactivate_user", "delete_user", "reset_password",
    "role_create", "role_update", "role_permissions_update", "role_delete",
    "start_batch_critical", "plc_setpoints_written", "stop_requested", "stop_batch", "batch_auto_finalize",
    "plc_reset_requested", "plc_reset_stop",
    "plc_clock_write_requested", "plc_clock_write_failed", "plc_clock_written",
    "plc_manual_command", "plc_manual_command_failed",
    "plc_parameter_write_requested", "plc_parameter_write_failed", "plc_parameter_written",
    "plc_calibration_write_requested", "plc_calibration_write_failed", "plc_calibration_written",
    "plc_door_command", "plc_door_command_failed", "plc_door_chain",
    "export_audit_log", "export_batch_records",
    "backup_created", "backup_failed", "backup_settings_update", "backup_downloaded",
    "create", "update", "delete", "create_product_name", "delete_product_name", "update_product_spec",
    "start_batch", "batch_adopted",
    "update_product_name", "create_product_spec", "delete_product_spec", "start_batch_rejected",
];
const TONES = new Set(["run", "water", "steam", "stop", "idle", "plain"]);

for (const a of KODE) {
    ok(AUDIT_ACTIONS[a], `aksi ${a} belum punya label`);
    ok(AUDIT_ACTIONS[a]?.label && AUDIT_ACTIONS[a].label !== a, `label ${a} kosong atau sama dengan kodenya`);
    ok(TONES.has(AUDIT_ACTIONS[a]?.tone), `tone ${a} tidak valid`);
}
const extra = Object.keys(AUDIT_ACTIONS).filter((k) => !KODE.includes(k));
ok(extra.length === 0, `kamus punya aksi yang tidak ada di daftar kode: ${extra.join(", ")}`);
const labels = Object.values(AUDIT_ACTIONS).map((v) => v.label);
ok(new Set(labels).size === labels.length, "ada label ganda (dua aksi tampil sama di layar)");

ok(auditActionLabel("aksi_baru_xyz") === "aksi_baru_xyz", "aksi tak dikenal harus tampil apa adanya");
ok(auditActionTone("aksi_baru_xyz") === "plain", "tone aksi tak dikenal harus plain");
ok(auditActionLabel(null) === "" && auditActionLabel("") === "" && auditActionLabel(undefined) === "", "null/kosong -> string kosong");
ok(auditActionLabel("constructor") === "constructor", "kunci prototipe tidak boleh dianggap aksi");

console.log(fail === 0 ? `Semua lolos (${pass} lolos)` : `${fail} GAGAL, ${pass} lolos`);
process.exit(fail === 0 ? 0 : 1);
