/**
 * POST /api/plc/reset
 *
 * Mengirim pulsa STOP ke PLC ketika mesin masih berstatus Selesai (VW98 = 6)
 * tapi tidak ada batch running di database.
 *
 * Kasus penggunaan:
 *   - STOP fisik ditekan dari panel tapi web tidak tahu (tidak ada batch running di DB)
 *   - Penulisan STOP dari web sebelumnya gagal di tengah jalan
 *   - Mesin stuck di fase Finished dan perlu direset ke Idle sebelum batch baru
 *
 * Hanya admin atau operator yang boleh mengakses endpoint ini.
 */

import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readPlcSnapshot } from "@/lib/plc";
import { pulsePlcTag } from "@/lib/plcWrite";
import { tryAudit } from "@/lib/auditLog";

export async function POST() {
    try {
        // Proteksi server-side: wajib login (admin atau operator boleh)
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        // ── Guard: jangan reset kalau ada batch running di database ───────────
        // Kalau ada batch running, gunakan tombol Stop batch yang biasa (/api/batch/stop).
        const runningCheck = await pool.query(
            "SELECT COUNT(*) FROM batch_records WHERE status = 'running'"
        );
        if (parseInt(runningCheck.rows[0].count, 10) > 0) {
            return Response.json(
                {
                    ok: false,
                    error: "Masih ada batch yang berstatus running di database. Gunakan tombol Stop Batch untuk menyelesaikannya.",
                },
                { status: 409 }
            );
        }

        // ── Baca snapshot PLC ─────────────────────────────────────────────────
        const snapshot = await readPlcSnapshot();

        if (!snapshot.plcOk) {
            return Response.json(
                {
                    ok: false,
                    error: "PLC tidak terhubung, tidak bisa melakukan reset. Pastikan koneksi PLC aktif.",
                },
                { status: 503 }
            );
        }

        const rawPhase = snapshot.phase?.rawValue;
        const phaseLabel = snapshot.phase?.label ?? `kode ${rawPhase}`;

        // ── Mesin sudah Idle (kode 0 atau 1): tidak perlu kirim STOP ─────────
        if (rawPhase === 0 || rawPhase === 1) {
            return Response.json({
                ok: true,
                message: "Mesin sudah Idle, tidak perlu reset.",
                phase: snapshot.phase,
            });
        }

        // ── Hanya kirim STOP kalau fase = 6 (Finished) ────────────────────────
        // Fase lain (2=filling, 3=heating, 4=steril, 5=cooling, 7=drain):
        // membatalkan siklus aktif harus lewat prosedur lain (Stop Batch + konfirmasi operator).
        if (rawPhase !== 6) {
            return Response.json(
                {
                    ok: false,
                    error: `Reset otomatis hanya bisa dilakukan saat fase Selesai (kode 6). Fase saat ini: ${phaseLabel}. Untuk membatalkan siklus yang sedang berjalan, gunakan prosedur Stop Batch.`,
                    phase: snapshot.phase,
                },
                { status: 409 }
            );
        }

        // ── Audit SEBELUM pulsa reset (item 7) ────────────────────────────────
        // Reset adalah tindakan keselamatan: bila audit gagal, pulsa TETAP dikirim.
        await tryAudit({
            actor: session.username,
            actorRole: session.role,
            action: "plc_reset_requested",
            entityType: "plc",
            entityId: null,
            oldValue: { phaseBefore: rawPhase, phaseBeforeLabel: phaseLabel },
            description: `Reset STOP diminta oleh ${session.username}. Fase sebelum: ${phaseLabel} (kode ${rawPhase}); pulsa STOP akan dikirim`,
        }, "plc/reset");

        // ── Kirim STOP sebagai pulsa (fase = 6, tidak ada batch running) ─────
        // STOP (M1.5) dibaca PLC sebagai LEVEL — wajib ditulis sebagai pulsa.
        const pulse = await pulsePlcTag("STOP");

        // Baca ulang snapshot setelah pulsa untuk kembalikan fase terbaru
        let snapshotAfter = null;
        try {
            snapshotAfter = await readPlcSnapshot();
        } catch (_err) {
            // Gagal baca ulang tidak fatal — pulsa sudah dikirim
        }

        // ── Tulis audit log ───────────────────────────────────────────────────
        try {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username,
                    session.role,
                    "plc_reset_stop",
                    "plc",
                    null,
                    JSON.stringify({
                        phaseBefore: rawPhase,
                        phaseBeforeLabel: phaseLabel,
                        pulseOk: pulse.ok,
                        stuckRisk: pulse.stuckRisk,
                        // phaseAfter hanya dicatat kalau snapshot pasca-pulsa valid
                        phaseAfter: (snapshotAfter?.plcOk === true)
                            ? snapshotAfter.phase?.rawValue ?? null
                            : null,
                    }),
                    "web",
                    `Reset STOP dikirim oleh ${session.username}. Fase sebelum: ${phaseLabel} (kode ${rawPhase}). ` +
                    `Pulsa ok=${pulse.ok}, stuckRisk=${pulse.stuckRisk}. ` +
                    `Fase setelah: ${snapshotAfter?.plcOk === true
                        ? (snapshotAfter.phase?.label ?? "tidak diketahui")
                        : "tidak terbaca (PLC offline pasca-pulsa)"
                    }`,
                ]
            );
        } catch (auditErr) {
            // Audit log gagal tidak fatal — sudah kirim pulsa, log ke console saja
            console.error("[plc/reset] Gagal catat audit plc_reset_stop:", auditErr.message);
        }

        return Response.json({
            ok: pulse.ok,
            pulse: {
                wroteOn: pulse.wroteOn,
                wroteOff: pulse.wroteOff,
                stuckRisk: pulse.stuckRisk,
                error: pulse.error,
            },
            // phaseAfter hanya berisi data nyata jika snapshot pasca-pulsa berhasil dibaca
            phaseAfter: (snapshotAfter?.plcOk === true) ? snapshotAfter.phase : null,
        });
    } catch (error) {
        console.error("[POST /api/plc/reset]", error);
        return Response.json({ ok: false, error: "Terjadi kesalahan di server. Hubungi admin." }, { status: 500 });
    }
}