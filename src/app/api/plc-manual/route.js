import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit, tryAudit } from "@/lib/auditLog";
import {
    MANUAL_MODE_TAG, MANUAL_ITEMS, MANUAL_COMMAND_TAGS, IDLE_PHASES_MANUAL,
    getManualItem, checkManualCommand,
} from "@/lib/plcManualCatalog";
import { readPlcRaw, withPlcLocks, checkMachineIdle, writeAndVerify } from "@/lib/plcAccess";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";

const OUTPUT_TAGS = MANUAL_ITEMS.map((i) => i.outTag).filter(Boolean);
const CONTEXT_TAGS = ["PROCCES_TEXT", "CLS_FRNT", "CLS_REAR", "DOOR_SEAL", "WATR_INDICATOR", "P1", "SAFETY_PRESS"];
const ALL_TAGS = [MANUAL_MODE_TAG, ...MANUAL_COMMAND_TAGS, ...OUTPUT_TAGS, ...CONTEXT_TAGS];

const bool = (v) => (v === null || v === undefined ? null : !!v);

function badRequest(error) {
    return Response.json({ ok: false, error }, { status: 400 });
}

/** Baca seluruh keadaan manual + konteks keselamatan dalam satu panggilan. */
async function readManualState() {
    const { values: v, bad } = await readPlcRaw(ALL_TAGS);
    const commands = {};
    const outputs = {};
    for (const item of MANUAL_ITEMS) {
        commands[item.key] = bool(v[item.cmdTag]);
        outputs[item.key] = item.outTag ? bool(v[item.outTag]) : null;
    }
    const missingTags = [MANUAL_MODE_TAG, ...MANUAL_COMMAND_TAGS].filter((t) => bad.includes(t));
    return {
        modeOn: bool(v[MANUAL_MODE_TAG]),
        commands,
        outputs,
        phase: v.PROCCES_TEXT === null || v.PROCCES_TEXT === undefined ? null : Number(v.PROCCES_TEXT),
        doors: { clsFrnt: bool(v.CLS_FRNT), clsRear: bool(v.CLS_REAR), seal: bool(v.DOOR_SEAL) },
        waterIndicator: bool(v.WATR_INDICATOR),
        p1: v.P1 ?? null,
        safetyPress: v.SAFETY_PRESS ?? null,
        missingTags,
    };
}

// ── GET /api/plc-manual — manual_control >= view ──────────────────────────────
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "manual_control", "view");
        if (errorResponse) return errorResponse;

        try {
            const state = await readManualState();
            const idle = await checkMachineIdle(IDLE_PHASES_MANUAL);
            return Response.json({ ok: true, plcOk: true, ...state, idle });
        } catch (err) {
            console.error("[GET /api/plc-manual] PLC tidak terbaca:", err.message);
            return Response.json({
                ok: true, plcOk: false,
                plcError: "PLC tidak terbaca. Periksa koneksi KEPServerEX dan PLC.",
            });
        }
    } catch (error) {
        console.error("[GET /api/plc-manual]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── POST /api/plc-manual — manual_control >= edit ─────────────────────────────
// Body: { action: "enter" | "exit" | "set", key?, value?, reason? }
//   enter : mulai mode manual (mesin harus idle; semua bit perintah dipastikan 0 dulu)
//   exit  : matikan semua perintah LALU keluar mode manual (selalu boleh: aksi keselamatan)
//   set   : nyalakan/matikan satu perintah. MENYALAKAN butuh mesin idle + pagar pintu/seal.
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, "manual_control", "edit");
        if (errorResponse) return errorResponse;

        let body;
        try { body = await request.json(); } catch { return badRequest("Body bukan JSON valid"); }
        const action = body?.action;
        if (!["enter", "exit", "set"].includes(action)) return badRequest("Aksi tidak dikenal");

        const actor = { actor: session.username, actorRole: session.role, entityType: "plc", entityId: "manual" };
        const allOff = MANUAL_COMMAND_TAGS.map((tag) => ({ tag, raw: false, kind: "bool" }));

        // ── EXIT: tanpa kunci dan tanpa syarat fase — harus selalu bisa dipakai ──
        if (action === "exit") {
            // 1. Matikan semua perintah saat mode manual masih aktif (katup menutup)
            const off = await writeAndVerify(allOff);
            // 2. Baru turunkan M5.0 (tepi turun → PLC mereset semua output proses)
            const mode = await writeAndVerify([{ tag: MANUAL_MODE_TAG, raw: false, kind: "bool" }]);
            const ok = off.ok && mode.ok;
            await tryAudit({
                ...actor, action: ok ? "plc_manual_command" : "plc_manual_command_failed",
                newValue: { command: "exit", allCommandsOff: off.ok, modeOff: mode.ok },
                description: ok
                    ? `Mode manual dikeluarkan oleh ${session.username} (semua perintah dimatikan).`
                    : `KELUAR mode manual oleh ${session.username} tidak sepenuhnya terverifikasi (perintah off: ${off.ok}, mode off: ${mode.ok}). Periksa mesin.`,
            }, "plc-manual");
            if (!ok) {
                return Response.json(
                    { ok: false, error: "Keluar mode manual tidak terverifikasi di PLC. Periksa mesin dan coba lagi; bila gagal, matikan dari HMI." },
                    { status: 502 }
                );
            }
            return Response.json({ ok: true });
        }

        // ── SET OFF: mematikan perintah tidak pernah ditolak oleh aturan fase/pintu ──
        if (action === "set" && body.value === false) {
            const item = getManualItem(body.key);
            if (!item) return badRequest("Perintah tidak dikenal");
            const w = await writeAndVerify([{ tag: item.cmdTag, raw: false, kind: "bool" }]);
            await tryAudit({
                ...actor, action: w.ok ? "plc_manual_command" : "plc_manual_command_failed",
                newValue: { command: item.cmdTag, value: false },
                description: `${item.label} dimatikan oleh ${session.username}${w.ok ? "" : " (TIDAK terverifikasi)"}.`,
            }, "plc-manual");
            if (!w.ok) {
                return Response.json({ ok: false, error: "Perintah OFF tidak terverifikasi di PLC. Periksa mesin; gunakan Keluar Mode Manual bila perlu." }, { status: 502 });
            }
            return Response.json({ ok: true });
        }

        // ── ENTER dan SET ON: butuh kunci, mesin idle, audit sebelum menulis ──
        if (action === "set") {
            if (body.value !== true) return badRequest("Nilai harus true atau false");
            if (!getManualItem(body.key)) return badRequest("Perintah tidak dikenal");
        }
        const reason = String(body.reason ?? "").trim();
        if (action === "enter") {
            if (reason.length < 3) return badRequest("Alasan masuk mode manual wajib diisi (minimal 3 karakter)");
            if (reason.length > 200) return badRequest("Alasan terlalu panjang (maksimal 200 karakter)");
        }

        const outcome = await withPlcLocks(async () => {
            const idle = await checkMachineIdle(IDLE_PHASES_MANUAL);
            if (!idle.ok) {
                return { status: 409, body: { ok: false, error: idle.reason + " Kontrol manual hanya saat mesin idle." } };
            }

            const state = await readManualState();
            if (state.missingTags.length > 0) {
                return {
                    status: 409,
                    body: { ok: false, error: `Tag manual belum ada di KEPServerEX: ${state.missingTags.join(", ")}. Impor SiemensS7-200_manual_NANTI.csv dulu.` },
                };
            }

            if (action === "enter") {
                if (state.modeOn === true) return { status: 409, body: { ok: false, error: "Mode manual sudah aktif." } };
                try {
                    await insertAudit(pool, {
                        ...actor, action: "plc_manual_command",
                        newValue: { command: "enter", reason },
                        description: `${session.username} masuk mode manual. Alasan: ${reason}`,
                    });
                } catch (auditErr) {
                    console.error("[POST /api/plc-manual] Gagal catat audit, dibatalkan:", auditErr.message);
                    return { status: 500, body: { ok: false, error: "Gagal mencatat audit sehingga mode manual tidak diaktifkan. Hubungi admin." } };
                }
                // Pastikan semua bit perintah 0 SEBELUM M5.0 dinaikkan (bit sisa akan langsung menyalakan output)
                const off = await writeAndVerify(allOff);
                if (!off.ok) {
                    return { status: 502, body: { ok: false, error: "Gagal memastikan semua perintah manual dalam keadaan mati. Mode manual tidak diaktifkan." } };
                }
                const on = await writeAndVerify([{ tag: MANUAL_MODE_TAG, raw: true, kind: "bool" }]);
                if (!on.ok) {
                    await tryAudit({ ...actor, action: "plc_manual_command_failed", newValue: { command: "enter" },
                        description: "Masuk mode manual tidak terverifikasi di PLC." }, "plc-manual");
                    return { status: 502, body: { ok: false, error: "Mode manual tidak terverifikasi di PLC. Periksa mesin." } };
                }
                return { status: 200, body: { ok: true } };
            }

            // action === "set", value true
            const item = getManualItem(body.key);
            if (state.modeOn !== true) {
                return { status: 409, body: { ok: false, error: "Mode manual belum aktif. Masuk mode manual dulu." } };
            }
            const refuse = checkManualCommand(item.key, true, state);
            if (refuse) return { status: 409, body: { ok: false, error: refuse } };

            try {
                await insertAudit(pool, {
                    ...actor, action: "plc_manual_command",
                    newValue: { command: item.cmdTag, value: true },
                    description: `${item.label} dinyalakan oleh ${session.username} (mode manual).`,
                });
            } catch (auditErr) {
                console.error("[POST /api/plc-manual] Gagal catat audit, dibatalkan:", auditErr.message);
                return { status: 500, body: { ok: false, error: "Gagal mencatat audit sehingga perintah tidak dikirim. Hubungi admin." } };
            }
            const w = await writeAndVerify([{ tag: item.cmdTag, raw: true, kind: "bool" }]);
            if (!w.ok) {
                await tryAudit({ ...actor, action: "plc_manual_command_failed", newValue: { command: item.cmdTag, value: true },
                    description: `${item.label}: perintah ON tidak terverifikasi di PLC.` }, "plc-manual");
                return { status: 502, body: { ok: false, error: "Perintah tidak terverifikasi di PLC. Periksa mesin." } };
            }
            return { status: 200, body: { ok: true } };
        });

        if (!outcome.locked) {
            return Response.json(
                { ok: false, error: "Ada penulisan PLC lain atau proses START yang sedang berjalan. Tunggu sebentar lalu coba lagi." },
                { status: 409 }
            );
        }
        return Response.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        console.error("[POST /api/plc-manual]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
