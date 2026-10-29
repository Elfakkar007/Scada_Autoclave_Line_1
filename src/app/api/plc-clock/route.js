import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit, tryAudit } from "@/lib/auditLog";
import { writePlcTags, pulsePlcTag } from "@/lib/plcWrite";
import { IDLE_PHASES_PARAMS } from "@/lib/plcParamCatalog";
import { readPlcRaw, withPlcLocks, checkMachineIdle } from "@/lib/plcAccess";
import {
    CLOCK_READ_TAGS, CLOCK_TRIGGER_TAG,
    validateClockInput, encodeClockWrites, decodeClock,
    clockToNaiveMs, partsFromDate, formatClock,
} from "@/lib/plcClock";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";
const VERIFY_TOLERANCE_SEC = 6; // jam PLC disalin tiap 0,5 dtk dan dibaca gateway tiap 1 dtk

function badRequest(error) {
    return Response.json({ ok: false, error }, { status: 400 });
}

async function readPlcClock() {
    const { values } = await readPlcRaw(CLOCK_READ_TAGS);
    return decodeClock(values);
}

// ── GET /api/plc-clock — plc_clock >= view ────────────────────────────────────
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "plc_clock", "view");
        if (errorResponse) return errorResponse;

        const server = partsFromDate(new Date());
        let plcOk = true;
        let plc = null;
        let plcError = null;
        let idle = null;
        try {
            plc = await readPlcClock();
            idle = await checkMachineIdle(IDLE_PHASES_PARAMS);
            if (!plc) plcError = "Jam PLC terbaca tetapi bukan tanggal/waktu BCD yang valid.";
        } catch (err) {
            console.error("[GET /api/plc-clock] PLC tidak terbaca:", err.message);
            plcOk = false;
            plcError = "PLC tidak terbaca. Periksa koneksi KEPServerEX dan PLC.";
        }
        const diffSec = plc ? Math.round((clockToNaiveMs(plc) - clockToNaiveMs(server)) / 1000) : null;
        return Response.json({ ok: true, plcOk, plcError, plc, server, diffSec, idle });
    } catch (error) {
        console.error("[GET /api/plc-clock]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── PUT /api/plc-clock — plc_clock >= edit ────────────────────────────────────
// Body: { year, month, day, hour, minute, second, reason }
export async function PUT(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "plc_clock", "edit");
        if (errorResponse) return errorResponse;

        let body;
        try { body = await request.json(); } catch { return badRequest("Body bukan JSON valid"); }

        const v = validateClockInput(body);
        if (!v.ok) return badRequest(v.error);
        const target = v.value;

        const reason = String(body.reason ?? "").trim();
        if (reason.length < 3) return badRequest("Alasan perubahan wajib diisi (minimal 3 karakter)");
        if (reason.length > 200) return badRequest("Alasan terlalu panjang (maksimal 200 karakter)");

        const outcome = await withPlcLocks(async () => {
            const idle = await checkMachineIdle(IDLE_PHASES_PARAMS);
            if (!idle.ok) return { status: 409, body: { ok: false, error: idle.reason } };

            const before = await readPlcClock();

            try {
                await insertAudit(pool, {
                    actor: session.username,
                    actorRole: session.role,
                    action: "plc_clock_write_requested",
                    entityType: "plc",
                    entityId: "clock",
                    oldValue: before ? { time: formatClock(before) } : null,
                    newValue: { time: formatClock(target), reason },
                    description: `Jam PLC: ${session.username} akan mengubah ${before ? formatClock(before) : "(tidak terbaca)"} → ${formatClock(target)}. Alasan: ${reason}`,
                });
            } catch (auditErr) {
                console.error("[PUT /api/plc-clock] Gagal catat audit, tulis dibatalkan:", auditErr.message);
                return {
                    status: 500,
                    body: { ok: false, error: "Gagal mencatat audit sehingga jam PLC tidak diubah. Hubungi admin lalu coba lagi." },
                };
            }

            // 1. Tulis 6 byte BCD ke VB3000..VB3005 (belum berlaku sampai ada tepi naik M31.0)
            const wr = await writePlcTags(encodeClockWrites(target));
            if (!wr.ok) {
                console.error("[PUT /api/plc-clock] Gagal menulis buffer jam:", wr.results);
                await tryAudit({
                    actor: session.username, actorRole: session.role, action: "plc_clock_write_failed",
                    entityType: "plc", entityId: "clock",
                    newValue: { time: formatClock(target), stage: "write" },
                    description: "Jam PLC: gagal menulis buffer jam (VB3000..VB3005). Jam PLC tidak diubah.",
                }, "plc-clock");
                return { status: 502, body: { ok: false, error: "Gagal menulis buffer jam ke PLC. Jam PLC tidak diubah." } };
            }

            // 2. Pulsa ENTER_RTC (M31.0): PLC membaca TEPI NAIK lalu menjalankan TODW.
            const tPulse = Date.now();
            const pulse = await pulsePlcTag(CLOCK_TRIGGER_TAG);

            // 3. Baca-balik: jam PLC harus ≈ target + waktu yang sudah berlalu sejak pulsa
            const deadline = Date.now() + 6000;
            let after = null;
            let diffSec = null;
            let matched = false;
            while (Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 600));
                try {
                    after = await readPlcClock();
                } catch { continue; }
                if (!after) continue;
                const expectedMs = clockToNaiveMs(target) + (Date.now() - tPulse);
                diffSec = Math.round((clockToNaiveMs(after) - expectedMs) / 1000);
                if (Math.abs(diffSec) <= VERIFY_TOLERANCE_SEC) { matched = true; break; }
            }

            const stuck = pulse.stuckRisk
                ? " PERINGATAN: tag ENTER_RTC (M31.0) mungkin tertahan aktif di PLC; periksa di KEPServerEX."
                : "";

            if (!matched) {
                await tryAudit({
                    actor: session.username, actorRole: session.role, action: "plc_clock_write_failed",
                    entityType: "plc", entityId: "clock",
                    newValue: { time: formatClock(target), stage: "verify", readBack: after ? formatClock(after) : null, pulseOk: pulse.ok, stuckRisk: pulse.stuckRisk },
                    description: `Jam PLC: setelah pulsa ENTER_RTC jam PLC (${after ? formatClock(after) : "tidak terbaca"}) tidak sesuai target ${formatClock(target)}.${stuck}`,
                }, "plc-clock");
                return {
                    status: 502,
                    body: {
                        ok: false,
                        error:
                            "Jam PLC tidak berubah sesuai target setelah perintah set jam. " +
                            "Kemungkinan PLC menolak buffer (byte hari-dalam-minggu VB3007 belum terisi/tidak valid) — hubungi admin." + stuck,
                        plc: after,
                        stuckRisk: pulse.stuckRisk,
                    },
                };
            }

            const auditOk = await tryAudit({
                actor: session.username, actorRole: session.role, action: "plc_clock_written",
                entityType: "plc", entityId: "clock",
                oldValue: before ? { time: formatClock(before) } : null,
                newValue: { time: formatClock(target), reason, readBack: formatClock(after) },
                description: `Jam PLC: ${session.username} mengubah ${before ? formatClock(before) : "(tidak terbaca)"} → ${formatClock(target)} dan terverifikasi baca-balik (${formatClock(after)}). Alasan: ${reason}`,
            }, "plc-clock");

            return {
                status: 200,
                body: {
                    ok: true, before, plc: after, auditOk,
                    ...(pulse.ok ? {} : { warning: "Pulsa ENTER_RTC tidak sempurna." + stuck, stuckRisk: pulse.stuckRisk }),
                },
            };
        });

        if (!outcome.locked) {
            return Response.json(
                { ok: false, error: "Ada penulisan PLC lain atau proses START yang sedang berjalan. Tunggu sebentar lalu coba lagi." },
                { status: 409 }
            );
        }
        return Response.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        console.error("[PUT /api/plc-clock]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
