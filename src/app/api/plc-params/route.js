import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { insertAudit, tryAudit } from "@/lib/auditLog";
import {
    PLC_GROUPS, PLC_FIELDS, IDLE_PHASES_PARAMS,
    getField, rawToValue, rawEquals, validateField, crossCheck, formatValue,
} from "@/lib/plcParamCatalog";
import { readPlcRaw, withPlcLocks, checkMachineIdle, writeAndVerify } from "@/lib/plcAccess";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";

function badRequest(error, extra = {}) {
    return Response.json({ ok: false, error, ...extra }, { status: 400 });
}

// ── GET /api/plc-params?group=param1|param2|coef|calibration ─────────────────
// Izin: resource grup >= view. Mengembalikan nilai PLC saat ini + status mesin idle.
export async function GET(request) {
    try {
        const group = new URL(request.url).searchParams.get("group");
        const meta = PLC_GROUPS[group];
        if (!meta) return badRequest("Grup tidak dikenal");

        const cookieStore = await cookies();
        const { errorResponse } = await requirePermission(cookieStore, meta.resource, "view");
        if (errorResponse) return errorResponse;

        const fields = PLC_FIELDS[group];
        let plcOk = true;
        let plcError = null;
        const values = {};
        let idle = null;
        let liveValues = null;
        try {
            const { values: raws } = await readPlcRaw(fields.map((f) => f.tag));
            for (const f of fields) {
                const raw = raws[f.tag] ?? null;
                values[f.key] = { raw, value: rawToValue(f, raw) };
            }
            idle = await checkMachineIdle(IDLE_PHASES_PARAMS);

            // Untuk grup kalibrasi: baca juga nilai suhu/tekanan sensor aktual
            // agar halaman web bisa menampilkan nilai seperti di HMI (suhu + offset).
            if (group === "calibration") {
                const LIVE_TAGS = {
                    th: "TH", t1: "T1", t2: "T2", t3: "T3",
                    t4: "T4", t5: "T5", t6: "T6", tm: "TM", tl: "TL",
                    p1: "P1", p2: "P2",
                };
                const LIVE_SCALE_10 = new Set(["th","t1","t2","t3","t4","t5","t6","tm","tl"]);
                const { values: liveRaws } = await readPlcRaw(Object.values(LIVE_TAGS));
                liveValues = {};
                for (const [key, tag] of Object.entries(LIVE_TAGS)) {
                    const raw = liveRaws[tag] ?? null;
                    liveValues[key] = raw !== null
                        ? (LIVE_SCALE_10.has(key) ? raw / 10 : raw)
                        : null;
                }
            }
        } catch (err) {
            console.error("[GET /api/plc-params] PLC tidak terbaca:", err.message);
            plcOk = false;
            plcError = "PLC tidak terbaca. Periksa koneksi KEPServerEX dan PLC.";
        }
        return Response.json({ ok: true, group, plcOk, plcError, values, idle, liveValues });
    } catch (error) {
        console.error("[GET /api/plc-params]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── PUT /api/plc-params ───────────────────────────────────────────────────────
// Body: { group, changes: { <key>: <nilai> }, reason }
// Izin: resource grup >= edit; kalibrasi juga action.write_calibration; field "restricted"
//       (Safety Press, Alarm Press, Select Press) juga action.write_safety_params.
export async function PUT(request) {
    try {
        let body;
        try { body = await request.json(); } catch { return badRequest("Body bukan JSON valid"); }
        const { group, changes } = body ?? {};
        const meta = PLC_GROUPS[group];
        if (!meta) return badRequest("Grup tidak dikenal");

        const cookieStore = await cookies();
        const { session, errorResponse } = await requirePermission(cookieStore, meta.resource, "edit");
        if (errorResponse) return errorResponse;
        if (meta.writeAction) {
            const { errorResponse: errAction } = await requirePermission(cookieStore, meta.writeAction, "edit");
            if (errAction) return errAction;
        }

        if (!changes || typeof changes !== "object" || Array.isArray(changes) || Object.keys(changes).length === 0) {
            return badRequest("Tidak ada nilai yang dikirim");
        }

        // ── Validasi tiap field (kunci wajib ada di katalog, tidak read-only, dalam rentang) ──
        const requested = []; // { def, value, raw }
        const restrictedActions = new Set();
        for (const [key, input] of Object.entries(changes)) {
            const def = getField(group, key);
            if (!def) return badRequest(`Field "${key}" tidak dikenal`);
            const v = validateField(def, input);
            if (!v.ok) return badRequest(v.error, { field: key });
            if (def.restricted) restrictedActions.add(def.restricted);
            requested.push({ def, value: v.value, raw: v.raw });
        }
        for (const action of restrictedActions) {
            const { errorResponse: errR } = await requirePermission(cookieStore, action, "edit");
            if (errR) return errR;
        }

        const reason = String(body.reason ?? "").trim();
        if (reason.length < 3) return badRequest("Alasan perubahan wajib diisi (minimal 3 karakter)");
        if (reason.length > 200) return badRequest("Alasan terlalu panjang (maksimal 200 karakter)");

        const isCalibration = group === "calibration";
        const auditBase = isCalibration ? "plc_calibration" : "plc_parameter";

        const outcome = await withPlcLocks(async () => {
            // 1. Mesin harus idle dan tidak ada batch berjalan
            const idle = await checkMachineIdle(IDLE_PHASES_PARAMS);
            if (!idle.ok) return { status: 409, body: { ok: false, error: idle.reason } };

            // 2. Nilai PLC saat ini (untuk "nilai lama", deteksi perubahan, dan cek antar-field)
            const fields = PLC_FIELDS[group];
            const tagsToRead = fields.map((f) => f.tag);
            if (group === "param2") tagsToRead.push("STER_SET");
            const { values: raws } = await readPlcRaw(tagsToRead);

            const current = {};
            for (const f of fields) current[f.key] = raws[f.tag] ?? null;

            const changed = [];
            for (const r of requested) {
                const cur = current[r.def.key];
                if (cur === null) {
                    return { status: 502, body: { ok: false, error: `Nilai ${r.def.label} saat ini tidak terbaca dari PLC. Tulis dibatalkan.` } };
                }
                if (!rawEquals(r.def, r.raw, cur)) changed.push({ ...r, oldRaw: cur, oldValue: rawToValue(r.def, cur) });
            }
            if (changed.length === 0) {
                return { status: 400, body: { ok: false, error: "Tidak ada perubahan nilai." } };
            }

            // 3. Cek antar-field pada nilai gabungan (nilai PLC saat ini + perubahan)
            const merged = {};
            for (const f of fields) merged[f.key] = rawToValue(f, current[f.key]);
            for (const c of changed) merged[c.def.key] = c.value;
            const sterSet = raws.STER_SET !== undefined && raws.STER_SET !== null ? Number(raws.STER_SET) / 10 : null;
            const problems = crossCheck(group, merged, { sterSet });
            if (problems.length > 0) {
                return { status: 400, body: { ok: false, error: problems.join("; ") } };
            }

            const oldValue = Object.fromEntries(changed.map((c) => [c.def.tag, c.oldValue]));
            const newValue = Object.fromEntries(changed.map((c) => [c.def.tag, c.value]));
            const summary = changed
                .map((c) => `${c.def.label} ${formatValue(c.def, c.oldValue)} → ${formatValue(c.def, c.value)} ${c.def.unit ?? ""}`.trim())
                .join("; ");

            // 4. Audit SEBELUM menulis (fail-closed): tidak ada perubahan PLC tanpa jejak.
            try {
                await insertAudit(pool, {
                    actor: session.username,
                    actorRole: session.role,
                    action: `${auditBase}_write_requested`,
                    entityType: "plc",
                    entityId: group,
                    oldValue,
                    newValue: { ...newValue, reason },
                    description: `${meta.title}: ${session.username} akan menulis ke PLC — ${summary}. Alasan: ${reason}`,
                });
            } catch (auditErr) {
                console.error("[PUT /api/plc-params] Gagal catat audit, tulis dibatalkan:", auditErr.message);
                return {
                    status: 500,
                    body: { ok: false, error: "Gagal mencatat audit sehingga tidak ada yang ditulis ke PLC. Hubungi admin lalu coba lagi." },
                };
            }

            // 5. Tulis + baca-balik
            const w = await writeAndVerify(changed.map((c) => ({ tag: c.def.tag, raw: c.raw, kind: c.def.kind })));
            if (!w.ok) {
                await tryAudit({
                    actor: session.username,
                    actorRole: session.role,
                    action: `${auditBase}_write_failed`,
                    entityType: "plc",
                    entityId: group,
                    oldValue,
                    newValue: { ...newValue, stage: w.stage, failed: w.failed ?? null, mismatch: w.mismatch ?? null, readBack: w.readBack ?? null },
                    description: `${meta.title}: tulis ke PLC GAGAL pada tahap ${w.stage} (${summary}). Nilai di PLC mungkin sebagian berubah; cek di layar.`,
                }, "plc-params");
                return {
                    status: 502,
                    body: {
                        ok: false,
                        error: w.stage === "write"
                            ? "Gagal menulis ke PLC. Tidak ada jaminan nilai di PLC; cek ulang nilainya."
                            : "Nilai di PLC tidak cocok setelah ditulis. Cek ulang nilainya di halaman ini dan di HMI.",
                        stage: w.stage,
                        failed: w.failed ?? undefined,
                        mismatch: w.mismatch ?? undefined,
                    },
                };
            }

            // 6. Audit hasil (tidak melempar: perubahan sudah terjadi dan terverifikasi)
            const written = changed.map((c) => ({
                key: c.def.key,
                label: c.def.label,
                unit: c.def.unit ?? "",
                oldValue: c.oldValue,
                newValue: c.value,
                readBackValue: rawToValue(c.def, w.readBack[c.def.tag]),
            }));
            const auditOk = await tryAudit({
                actor: session.username,
                actorRole: session.role,
                action: `${auditBase}_written`,
                entityType: "plc",
                entityId: group,
                oldValue,
                newValue: { ...newValue, reason, readBack: Object.fromEntries(written.map((x, i) => [changed[i].def.tag, x.readBackValue])) },
                description: `${meta.title}: ${session.username} menulis ke PLC dan terverifikasi baca-balik — ${summary}. Alasan: ${reason}`,
            }, "plc-params");

            return { status: 200, body: { ok: true, written, auditOk } };
        });

        if (!outcome.locked) {
            return Response.json(
                { ok: false, error: "Ada penulisan PLC lain atau proses START yang sedang berjalan. Tunggu sebentar lalu coba lagi." },
                { status: 409 }
            );
        }
        return Response.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        console.error("[PUT /api/plc-params]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
