import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAllSettings, invalidateSettingsCache } from "@/lib/settings";
import { tryAudit } from "@/lib/auditLog";

const ALLOWED_KEYS = new Set([
    "session_timeout_hours",
    "lockscreen_idle_minutes",
    "batch_stop_mode",
    "batch_stop_pressure_threshold",
    "batch_stop_pulse_plc",
    "batch_stop_idle_fallback_sec",
]);

export async function GET() {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "settings", "view");
        if (errorResponse) return errorResponse;

        const settings = await getAllSettings(true);
        return Response.json({
            ok: true,
            settings,
            canEdit: session.role === "admin" || session.permissions?.settings === "edit",
        });
    } catch (err) {
        console.error("[GET /api/settings]", err);
        return Response.json({ ok: false, error: "Gagal memuat konfigurasi sistem" }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "settings", "edit");
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const { settings: newSettings, reason } = body;

        if (!newSettings || typeof newSettings !== "object") {
            return Response.json({ ok: false, error: "Payload konfigurasi tidak valid" }, { status: 400 });
        }

        if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
            return Response.json(
                { ok: false, error: "Alasan perubahan wajib diisi (minimal 3 karakter) untuk jejak audit GMP" },
                { status: 400 }
            );
        }

        // Ambil data lama untuk audit trail
        const currentSettings = await getAllSettings(true);
        const oldValues = {};
        const updatedValues = {};

        // Validasi masing-masing item
        for (const [key, val] of Object.entries(newSettings)) {
            if (!ALLOWED_KEYS.has(key)) continue;

            if (key === "session_timeout_hours") {
                const n = Number(val);
                if (!Number.isInteger(n) || n < 1 || n > 72) {
                    return Response.json(
                        { ok: false, error: "Masa berlaku sesi harus berupa angka bulat antara 1 hingga 72 jam" },
                        { status: 400 }
                    );
                }
                updatedValues[key] = n;
            } else if (key === "lockscreen_idle_minutes") {
                const n = Number(val);
                if (!Number.isInteger(n) || n < 1 || n > 60) {
                    return Response.json(
                        { ok: false, error: "Durasi auto-lockscreen harus berupa angka bulat antara 1 hingga 60 menit" },
                        { status: 400 }
                    );
                }
                updatedValues[key] = n;
            } else if (key === "batch_stop_mode") {
                if (val !== "pressure_zero" && val !== "idle_timeout") {
                    return Response.json(
                        { ok: false, error: "Mode auto-stop harus bernilai 'pressure_zero' atau 'idle_timeout'" },
                        { status: 400 }
                    );
                }
                updatedValues[key] = val;
            } else if (key === "batch_stop_pressure_threshold") {
                const n = Number(val);
                if (!Number.isFinite(n) || n < -50 || n > 200) {
                    return Response.json(
                        { ok: false, error: "Ambang batas tekanan harus berupa angka antara -50 hingga 200 kPa" },
                        { status: 400 }
                    );
                }
                updatedValues[key] = Math.round(n * 10) / 10;
            } else if (key === "batch_stop_pulse_plc") {
                updatedValues[key] = Boolean(val);
            } else if (key === "batch_stop_idle_fallback_sec") {
                const n = Number(val);
                if (!Number.isInteger(n) || n < 10 || n > 3600) {
                    return Response.json(
                        { ok: false, error: "Batas idle cadangan harus berupa angka bulat antara 10 hingga 3600 detik" },
                        { status: 400 }
                    );
                }
                updatedValues[key] = n;
            }

            if (currentSettings[key]) {
                oldValues[key] = currentSettings[key].value;
            }
        }

        if (Object.keys(updatedValues).length === 0) {
            return Response.json({ ok: false, error: "Tidak ada konfigurasi yang diubah" }, { status: 400 });
        }

        // Simpan ke database dalam satu transaksi
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            for (const [key, val] of Object.entries(updatedValues)) {
                await client.query(
                    `UPDATE system_settings
                     SET value = $1::jsonb,
                         updated_at = now(),
                         updated_by = $2
                     WHERE key = $3`,
                    [JSON.stringify(val), session.username, key]
                );
            }
            await client.query("COMMIT");
        } catch (dbErr) {
            await client.query("ROLLBACK");
            throw dbErr;
        } finally {
            client.release();
        }

        invalidateSettingsCache();

        // Rekam ke Audit Log
        await tryAudit(
            {
                actor: session.username,
                actorRole: session.role,
                action: "settings_update",
                entityType: "system_settings",
                entityId: "global",
                oldValue: oldValues,
                newValue: updatedValues,
                description: `Konfigurasi sistem diperbarui oleh ${session.username}. Alasan: ${reason.trim()}`,
            },
            "api/settings"
        );

        return Response.json({
            ok: true,
            message: "Konfigurasi sistem berhasil disimpan dan diterapkan",
            settings: await getAllSettings(true),
        });
    } catch (err) {
        console.error("[PUT /api/settings]", err);
        return Response.json({ ok: false, error: "Gagal memperbarui konfigurasi sistem" }, { status: 500 });
    }
}
