import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit, tryAudit } from "@/lib/auditLog";
import {
    DOOR_CMD_TAGS, IDLE_PHASES_DOOR, SEAL_PULSE_MS, checkDoorCommand,
} from "@/lib/plcDoorCatalog";
import {
    withPlcLocks, checkMachineIdle, writeAndVerify, verifyRaw,
} from "@/lib/plcAccess";
import { pulsePlcTag } from "@/lib/plcWrite";
import { readDoorState, getDoorSafety } from "@/lib/plcDeadman";
import { canWriteHmiItem } from "@/lib/hmiOverrideCatalog";

const PLC_DOOR_ACTIONS = ["seal", "release", "drain", "unlock", "chain"];
// Aksi yang diizinkan lewat jalur kedua (dashboard + action.batch_control).
// chain dan unlock TIDAK termasuk — keduanya memerlukan manual_control:edit
// atau override HMI eksplisit, karena risikonya lebih tinggi (K3 fisik).
const BATCH_CTRL_ALLOWED_ACTIONS = ["seal", "release", "drain"];
const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";
const PLC_DOWN = "PLC tidak terbaca. Periksa koneksi KEPServerEX dan PLC.";

// Bit boolean di PLC merespons dalam satu scan ladder (~10ms).
// Verifikasi cepat cukup — tidak perlu tunggu 4,5 detik seperti setpoint suhu/tekanan.
const BOOL_VERIFY = { timeoutMs: 800, intervalMs: 100 };

function badRequest(error) {
    return Response.json({ ok: false, error }, { status: 400 });
}

// ── GET /api/plc-door — manual_control >= view ────────────────────────────────
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, "manual_control", "view");
        if (errorResponse) return errorResponse;

        const safety = getDoorSafety().status();
        try {
            // readDoorState sudah membaca PROCCES_TEXT bersama semua tag pintu dalam 1 round-trip.
            // Hitung idle dari state tersebut + DB check paralel — hindari round-trip PLC kedua.
            const [state, dbResult] = await Promise.all([
                readDoorState(),
                pool.query("SELECT batch_no FROM batch_records WHERE status = 'running' LIMIT 1"),
            ]);
            const phase = state.phase;
            let idle;
            if (phase === null || phase === undefined) {
                idle = { ok: false, phase: null, reason: "Fase mesin tidak terbaca dari PLC." };
            } else if (!IDLE_PHASES_DOOR.includes(phase)) {
                idle = { ok: false, phase, reason: "Mesin sedang menjalankan proses (fase aktif). Tunggu sampai selesai atau tekan STOP di mesin." };
            } else if (dbResult.rows.length > 0) {
                idle = { ok: false, phase, reason: `Batch ${dbResult.rows[0].batch_no} masih berstatus berjalan. Selesaikan atau hentikan batch dulu.` };
            } else {
                idle = { ok: true, phase, reason: null };
            }
            return Response.json({
                ok: true, plcOk: true, ...state, idle,
                chain: { dir: safety.chainDir, stuck: safety.chainStuck },
                autoOff: safety.autoOff,
            });
        } catch (err) {
            console.error("[GET /api/plc-door] PLC tidak terbaca:", err.message);
            return Response.json({ ok: true, plcOk: false, plcError: PLC_DOWN });
        }
    } catch (error) {
        console.error("[GET /api/plc-door]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── POST /api/plc-door — manual_control >= edit ───────────────────────────────
// Jalur kedua: hanya aksi seal/release/drain yang lolos bagi pemegang dashboard >= edit
// DAN action.batch_control = edit. Chain dan unlock memerlukan manual_control:edit
// atau override HMI eksplisit (Fase 2 — izin per user).
// Body:
//   { action: "seal" }                                  pulsa Door Sealing
//   { action: "release", value: true|false }            toggle Door Release (ON=lepas seal, OFF=diam)
//   { action: "drain",  value: true|false }             toggle Water Drain (auto-OFF 60 dtk)
//   { action: "unlock", value: true|false }             toggle Door Unlock (auto-OFF 60 dtk)
//   { action: "chain",  mode: "run"|"stop", dir: "fwd"|"bwd" }   deadman Forward/Backward
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const primary = await requirePermission(cookieStore, "manual_control", "edit");

        // Body dibaca sebelum keputusan izin hanya untuk mengetahui aksinya; JSON rusak baru
        // ditolak SESUDAH izin lolos (tamu tanpa izin tidak boleh membedakan 400 dari 403).
        let body;
        let bodyInvalid = false;
        try { body = await request.json(); } catch { bodyInvalid = true; }

        let session = primary.session;
        if (primary.errorResponse) {
            // Jalur kedua untuk aksi DASAR pintu (seal, release, drain).
            // Chain dan unlock TIDAK diizinkan lewat jalur ini — risikonya lebih tinggi:
            //   - chain: motor rantai fisik berputar, tidak ada watchdog hardware di PLC S7-200
            //   - unlock: bypass interlock tekanan, hanya untuk kondisi darurat
            // Perbaikan keamanan: membatasi BATCH_CTRL_ALLOWED_ACTIONS (bug lama: semua aksi lolos)
            const action = body?.action;
            if (!BATCH_CTRL_ALLOWED_ACTIONS.includes(action)) return primary.errorResponse;
            const dash = await requirePermission(cookieStore, "dashboard", "edit");
            if (dash.errorResponse) return primary.errorResponse;
            const batch = await requirePermission(cookieStore, "action.batch_control", "edit");
            if (batch.errorResponse) return primary.errorResponse;
            session = dash.session;
        }
        if (bodyInvalid) return badRequest("Body bukan JSON valid");
        const action = body?.action;
        if (!PLC_DOOR_ACTIONS.includes(action)) return badRequest("Aksi tidak dikenal");

        // Guard tambahan untuk chain dan unlock: cek HMI override per user
        // (manual_control:edit sudah lolos di atas, tapi bisa dibatasi per item via override)
        if (action === "chain" || action === "unlock") {
            const itemKey = action; // "chain" | "unlock"
            const hmiOverrides = session.hmiOverrides ?? null;
            const perms = session.permissions ?? {};
            // canWriteHmiItem: false bila override user melarang item ini
            if (!canWriteHmiItem(hmiOverrides, perms, "door_operate", itemKey)) {
                return Response.json(
                    { ok: false, error: "Anda tidak memiliki izin untuk aksi ini" },
                    { status: 403 }
                );
            }
        }

        const actor = { actor: session.username, actorRole: session.role, entityType: "plc", entityId: "door" };
        const safety = getDoorSafety();

        // ── RANTAI (deadman) ─────────────────────────────────────────────────
        if (action === "chain") {
            if (body.mode === "stop") {
                const r = await safety.chainStop("tombol dilepas");
                return Response.json(r.ok ? { ok: true } : { ok: false, error: r.error }, { status: r.status });
            }
            if (body.mode !== "run") return badRequest("mode harus run atau stop");
            if (body.dir !== "fwd" && body.dir !== "bwd") return badRequest("dir harus fwd atau bwd");
            const label = body.dir === "fwd" ? "Forward" : "Backward";
            const r = await safety.chainRun(body.dir, {
                // Audit di awal sesi (fail-closed): gagal = rantai tidak jalan.
                onStart: () => insertAudit(pool, {
                    ...actor, action: "plc_door_chain",
                    newValue: { direction: body.dir, event: "start" },
                    description: `Rantai ${label} dijalankan oleh ${session.username} menggunakan SCADA (ditahan, berhenti otomatis bila dilepas).`,
                }),
                // Audit akhir sesi (best-effort: mematikan tidak boleh diblokir audit).
                onEnd: (info) => tryAudit({
                    ...actor, action: "plc_door_chain",
                    newValue: { direction: info.dir, event: "end", durationMs: info.durationMs, reason: info.reason, offVerified: info.ok },
                    description: `Rantai ${label} (SCADA) berhenti setelah ${(info.durationMs / 1000).toFixed(1)} dtk (${info.reason})${info.ok ? "" : " — TIDAK terverifikasi mati, periksa mesin"}.`,
                }, "plc-door"),
            });
            return Response.json(r.ok ? { ok: true, active: r.active } : { ok: false, error: r.error }, { status: r.status });
        }

        // ── OFF Water Drain / Door Unlock / Door Release: tidak pernah ditolak aturan fase/pintu ──
        if ((action === "drain" || action === "unlock" || action === "release") && body.value === false) {
            const tag = DOOR_CMD_TAGS[action];
            const label = action === "drain" ? "Water Drain" : action === "unlock" ? "Door Unlock" : "Door Release";
            let w;
            try {
                w = await writeAndVerify([{ tag, raw: false, kind: "bool" }], BOOL_VERIFY);
            } catch (err) {
                console.error("[POST /api/plc-door] OFF gagal (gateway):", err.message);
                return Response.json({ ok: false, error: `${PLC_DOWN} ${label} belum tentu mati; matikan dari HMI bila perlu.` }, { status: 502 });
            }
            // Timer auto-OFF tetap dibiarkan bila OFF gagal (jaring pengaman kedua).
            if (w.ok && (action === "drain" || action === "unlock")) safety.disarmAutoOff(action);
            await tryAudit({
                ...actor, action: w.ok ? "plc_door_command" : "plc_door_command_failed",
                newValue: { command: tag, value: false },
                description: `${label} dimatikan oleh ${session.username} menggunakan SCADA${w.ok ? "" : " (TIDAK terverifikasi)"}.`,
            }, "plc-door");
            if (!w.ok) {
                return Response.json({ ok: false, error: `${label} OFF tidak terverifikasi di PLC. Periksa mesin; matikan dari HMI bila perlu.` }, { status: 502 });
            }
            return Response.json({ ok: true });
        }

        // ── Perintah yang MENYALAKAN sesuatu: kunci, mesin idle, pagar, audit sebelum menulis ──
        if ((action === "drain" || action === "unlock") && body.value !== true) return badRequest("value harus true atau false");
        if (action === "release" && body.value !== true && body.value !== false) return badRequest("value harus true atau false");

        const spec = {
            seal: { label: "Door Sealing", tag: DOOR_CMD_TAGS.seal },
            release: { label: "Door Release", tag: DOOR_CMD_TAGS.release },
            drain: { label: "Water Drain", tag: DOOR_CMD_TAGS.drain },
            unlock: { label: "Door Unlock", tag: DOOR_CMD_TAGS.unlock },
        }[action];

        /** Tulis perintah; { ok, error? }. Dipanggil setelah semua pagar dan audit lolos. */
        async function perform() {
            if (action === "seal") {
                const pulse = await pulsePlcTag(spec.tag, { holdMs: SEAL_PULSE_MS });
                if (!pulse.ok) {
                    return {
                        ok: false,
                        error: pulse.stuckRisk
                            ? `Pulsa ${spec.label} mungkin TERTAHAN aktif di PLC. Cek ${spec.tag} di mesin atau KEPServerEX dan matikan.`
                            : `Perintah ${spec.label} gagal dikirim ke PLC.`,
                    };
                }
                // Verifikasi hasil nyata: seal harus aktif setelah perintah sealing.
                const v = await verifyRaw([{ tag: "DOOR_SEAL", raw: true, kind: "bool" }]);
                if (!v.ok) {
                    return { ok: false, error: "Seal belum aktif setelah perintah. Periksa pintu dan mesin." };
                }
                return { ok: true };
            }

            if (action === "release") {
                // Door Release M1.3 adalah TOGGLE seperti HMI: 1 kali tekan → aktif (lepas seal),
                // 1 kali tekan lagi → nonaktif. Tidak menggunakan pulsa agar tampilan web konsisten
                // dengan status bit nyata di PLC. M1.3 mengendalikan R Q0.5 (reset coil); Q0.5
                // tetap ter-reset meski M1.3 kembali ke 0, jadi aman untuk toggle kapan saja.
                const w = await writeAndVerify([{ tag: spec.tag, raw: true, kind: "bool" }], BOOL_VERIFY);
                if (!w.ok) {
                    return { ok: false, error: "Door Release tidak terverifikasi di PLC. Periksa mesin." };
                }
                return { ok: true };
            }

            // drain / unlock: tulis ON, baca-balik, lalu pasang auto-OFF
            const w = await writeAndVerify([{ tag: spec.tag, raw: true, kind: "bool" }], BOOL_VERIFY);
            if (!w.ok) return { ok: false, error: `${spec.label} tidak terverifikasi di PLC. Periksa mesin.` };
            safety.armAutoOff(action, spec.tag, {
                onEnd: (info) => tryAudit({
                    ...actor, action: info.ok ? "plc_door_command" : "plc_door_command_failed",
                    newValue: { command: info.tag, value: false, auto: true },
                    description: `${spec.label} dimatikan otomatis oleh SCADA setelah 60 dtk${info.ok ? "" : " (TIDAK terverifikasi, periksa mesin)"}.`,
                }, "plc-door"),
            });
            return { ok: true };
        }

        let outcome;
        try {
            outcome = await withPlcLocks(async () => {
                const idle = await checkMachineIdle(IDLE_PHASES_DOOR);
                if (!idle.ok) {
                    return { status: 409, body: { ok: false, error: `${idle.reason} Perintah pintu hanya saat mesin idle.` } };
                }
                const state = await readDoorState();
                const refuse = checkDoorCommand(action, state);
                if (refuse) return { status: 409, body: { ok: false, error: refuse } };

                try {
                    await insertAudit(pool, {
                        ...actor, action: "plc_door_command",
                        newValue: { command: spec.tag, value: body.value ?? true, via: "scada", p1: state.p1, safetyPress: state.safetyPress },
                        description: `${spec.label} ${action === "release" ? "AKTIF (ON)" : "dijalankan"} oleh ${session.username} menggunakan SCADA.`,
                    });
                } catch (auditErr) {
                    console.error("[POST /api/plc-door] Gagal catat audit, dibatalkan:", auditErr.message);
                    return { status: 500, body: { ok: false, error: "Gagal mencatat audit sehingga perintah tidak dikirim. Hubungi admin." } };
                }

                const res = await perform();
                if (!res.ok) {
                    await tryAudit({
                        ...actor, action: "plc_door_command_failed",
                        newValue: { command: spec.tag, value: true },
                        description: `${spec.label}: ${res.error}`,
                    }, "plc-door");
                    return { status: 502, body: { ok: false, error: res.error } };
                }
                return { status: 200, body: { ok: true } };
            });
        } catch (err) {
            console.error("[POST /api/plc-door] PLC/gateway gagal:", err.message);
            return Response.json({ ok: false, error: PLC_DOWN }, { status: 502 });
        }

        if (!outcome.locked) {
            return Response.json(
                { ok: false, error: "Ada penulisan PLC lain atau proses START yang sedang berjalan. Tunggu sebentar lalu coba lagi." },
                { status: 409 }
            );
        }
        return Response.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        console.error("[POST /api/plc-door]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
