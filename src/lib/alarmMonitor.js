/**
 * src/lib/alarmMonitor.js — Pemantau alarm PLC (proses background, Item 8a).
 *
 * Dijalankan oleh server.js lewat startAlarmMonitor(): tiap 1 detik membaca snapshot PLC
 * dan menulis alarm_log. Berjalan walaupun dashboard tidak dibuka. Web HANYA MEMBACA PLC;
 * buzzer dan interlock PLC tetap pengaman utama.
 *
 * Model log (mengikuti layar ALARM MESSAGE SCADA lama; alarm_log append-only, tanpa UPDATE):
 *   alarm_active     baris saat alarm mulai   (alarm_date = onset, event_date kosong)
 *   alarm_recovery   baris saat alarm pulih   (alarm_date = onset yang sama, event_date = waktu pulih)
 *   server_start     server/pemantau dimulai (padanan "启动" di SCADA lama)
 *   monitor_gap      pemantauan sempat mati (PC/server mati); kejadian pada rentang itu TIDAK terekam
 *   communication_abnormal / communication_normal   komunikasi PLC putus / pulih
 * Baris alarm_active dan alarm_recovery satu episode berbagi episode_id.
 *
 * Hanya bit grup "fault" (FAULT_KEYS). Bit grup "review" TIDAK dicatat dan tidak memicu popup.
 *
 * ATURAN IMPORT: import relatif + ekstensi .js (dimuat dari custom server CommonJS).
 */

import { randomUUID } from "node:crypto";
import pool from "./db.js";
import { readPlcSnapshot } from "./plc.js";
import { ALARM_CATALOG, FAULT_KEYS } from "./alarmCatalog.js";
import { createBitState, evaluateBit, onsetValues, recoveryValues } from "./alarmEpisodes.js";
import { START_LOCK_KEY } from "./recipeGuard.js";
import { RECIPE_SNAPSHOT_VERSION } from "./recipeSnapshot.js";

const TICK_MS = 1_000;
const HEARTBEAT_EVERY_MS = 10_000;
const GAP_THRESHOLD_MS = 30_000;          // henti pemantauan >= ini dicatat sebagai monitor_gap
const PLC_OFFLINE_DEBOUNCE_MS = 5_000;    // PLC putus >= ini baru dicatat communication_abnormal

const bitStates = new Map(FAULT_KEYS.map((k) => [k, createBitState()]));
let started = false;
let busy = false;
let reconciled = false;
let lastBeatMs = 0;
let plcDownSince = null;
let plcDownLogged = false;
let lastErrLogMs = 0;

// Adopsi otomatis (item 9): hitung pembacaan berturut-turut di fase proses tanpa batch DB.
const ADOPT_PHASES = new Set([2, 3, 4, 5, 7]);   // filling, heating, steril, cooling, drain
const ADOPT_STREAK_NEEDED = 3;                     // ±3 detik stabil sebelum adopsi
let adoptStreak = 0;                               // pembacaan berturut-turut
let adoptBusy = false;                             // guard anti-overlap INSERT

const fmtWib = (d) => new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

async function getActiveOperator(batchNo = null) {
    if (batchNo) {
        const batchRes = await pool.query(
            "SELECT operator FROM batch_records WHERE batch_no = $1 LIMIT 1",
            [batchNo]
        );
        if (batchRes.rows[0]?.operator) return batchRes.rows[0].operator;
    } else {
        const runningBatch = await pool.query(
            "SELECT operator FROM batch_records WHERE status = 'running' LIMIT 1"
        );
        if (runningBatch.rows[0]?.operator) return runningBatch.rows[0].operator;
    }
    const userRes = await pool.query(
        "SELECT full_name, username FROM users WHERE is_active = true ORDER BY last_login_at DESC NULLS LAST LIMIT 1"
    );
    return userRes.rows[0]?.full_name ?? userRes.rows[0]?.username ?? null;
}

async function insertEvent(e) {
    await pool.query(
        `INSERT INTO alarm_log
            (alarm_date, event_date, variable_name, alarm_type, alarm_value, recovery_value,
             limit_value, event_type, operator, episode_id, alarm_key, batch_no, phase_code, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
            e.alarmDate ?? null, e.eventDate ?? null, e.variableName ?? null, e.alarmType ?? null,
            e.alarmValue ?? null, e.recoveryValue ?? null, e.limitValue ?? null, e.eventType,
            e.operator ?? null,
            e.episodeId ?? null, e.alarmKey ?? null, e.batchNo ?? null, e.phaseCode ?? null,
            e.description ?? null,
        ]
    );
}

async function heartbeat(nowMs, force = false) {
    if (!force && nowMs - lastBeatMs < HEARTBEAT_EVERY_MS) return;
    await pool.query(
        `INSERT INTO monitor_heartbeat (id, beat_at) VALUES (1, now())
         ON CONFLICT (id) DO UPDATE SET beat_at = EXCLUDED.beat_at`
    );
    lastBeatMs = nowMs;
}

async function openEpisode(key, st, snap, nowMs) {
    const cat = ALARM_CATALOG[key];
    const { alarmValue, limitValue } = onsetValues(key, snap);
    const batchRes = await pool.query(
        "SELECT batch_no, operator FROM batch_records WHERE status = 'running' LIMIT 1"
    );
    const batchNo = batchRes.rows[0]?.batch_no ?? null;   // boleh NULL: alarm tanpa batch tetap dicatat
    let operator = batchRes.rows[0]?.operator ?? null;
    if (!operator) {
        operator = await getActiveOperator(null);
    }
    const phaseCode = snap.phase?.rawValue ?? null;
    const episodeId = randomUUID();
    const alarmDate = new Date(nowMs);

    await insertEvent({
        alarmDate, variableName: cat.tag, alarmType: cat.alarmType, alarmValue, limitValue,
        eventType: "alarm_active", episodeId, alarmKey: key, batchNo, phaseCode, operator,
    });
    // State baru diubah SETELAH INSERT berhasil; bila gagal, tick berikut mencoba lagi.
    st.active = true;
    st.episodeId = episodeId;
    st.offSince = null;
    st.onset = { alarmDate, alarmValue, limitValue, batchNo, phaseCode, operator };
    console.log(`[alarmMonitor] ALARM ${cat.tag} (${cat.alarmType}) batch=${batchNo ?? "-"} fase=${phaseCode ?? "-"} operator=${operator ?? "-"}`);
}

async function writeRecovery(key, ep, eventAtMs, description = null, snap = null) {
    const cat = ALARM_CATALOG[key];
    const o = ep.onset ?? {};
    const recVal = recoveryValues(key, snap);
    let operator = o.operator ?? null;
    if (!operator) {
        operator = await getActiveOperator(o.batchNo ?? null);
    }
    await insertEvent({
        alarmDate: o.alarmDate ?? null, eventDate: new Date(eventAtMs),
        variableName: cat.tag, alarmType: cat.alarmType,
        alarmValue: o.alarmValue ?? null,
        recoveryValue: recVal,
        limitValue: o.limitValue ?? null,
        eventType: "alarm_recovery", episodeId: ep.episodeId, alarmKey: key,
        batchNo: o.batchNo ?? null, phaseCode: o.phaseCode ?? null, description,
        operator,
    });
}

async function closeEpisode(key, st, eventAtMs, snap = null) {
    await writeRecovery(key, st, eventAtMs, null, snap);
    Object.assign(st, createBitState());
    console.log(`[alarmMonitor] PULIH ${ALARM_CATALOG[key].tag}`);
}

/**
 * Setelah server (re)start, state memori kosong. Cocokkan dengan episode yang masih
 * terbuka di DB: bila bitnya masih ON, lanjutkan episode itu; bila sudah OFF, tutup dengan
 * keterangan bahwa pemulihannya tidak teramati (server sedang mati).
 */
async function reconcile(snap, nowMs) {
    const res = await pool.query(
        `SELECT a.episode_id, a.alarm_key, a.alarm_date, a.alarm_value, a.limit_value, a.batch_no, a.phase_code, a.operator
         FROM alarm_log a
         WHERE a.event_type = 'alarm_active' AND a.episode_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM alarm_log r
                           WHERE r.episode_id = a.episode_id AND r.event_type = 'alarm_recovery')
         ORDER BY a.alarm_date`
    );
    for (const row of res.rows) {
        const st = bitStates.get(row.alarm_key);
        if (!st) continue; // kunci tidak dikenal katalog saat ini
        const ep = {
            episodeId: row.episode_id,
            onset: {
                alarmDate: row.alarm_date, alarmValue: row.alarm_value, limitValue: row.limit_value,
                batchNo: row.batch_no, phaseCode: row.phase_code, operator: row.operator,
            },
        };
        const bit = snap.alarms?.bits?.[row.alarm_key];
        if (bit === false || st.active) {
            await writeRecovery(row.alarm_key, ep, nowMs,
                "Pemulihan tidak teramati: pemantauan sempat terhenti (server mati) sebelum alarm ini pulih.",
                snap);
        } else {
            Object.assign(st, createBitState(), { active: true, episodeId: ep.episodeId, onset: ep.onset });
        }
    }
}

async function onPlcDown(nowMs) {
    if (plcDownSince === null) plcDownSince = nowMs;
    // Data tidak ada = tidak tahu. Jangan hitung "mati" untuk menutup episode.
    for (const st of bitStates.values()) st.offSince = null;
    if (!plcDownLogged && nowMs - plcDownSince >= PLC_OFFLINE_DEBOUNCE_MS) {
        await insertEvent({
            eventDate: new Date(plcDownSince), eventType: "communication_abnormal",
            description: "Komunikasi dengan PLC terputus. Alarm tidak dapat dipantau selama ini.",
        });
        plcDownLogged = true;
    }
}

async function onPlcUp(nowMs) {
    if (plcDownLogged) {
        const mins = plcDownSince ? Math.max(1, Math.round((nowMs - plcDownSince) / 60_000)) : null;
        await insertEvent({
            eventDate: new Date(nowMs), eventType: "communication_normal",
            description: mins ? `Komunikasi PLC pulih (terputus sekitar ${mins} menit).` : "Komunikasi PLC pulih.",
        });
    }
    plcDownLogged = false;
    plcDownSince = null;
}

/**
 * Buat batch EXT otomatis saat mesin berjalan tanpa batch di web (item 9).
 * Dipanggil dari checkAdoption setelah streak stabil terpenuhi.
 */
async function adoptRunningProcess(snap) {
    // Cek sekali lagi (race condition): mungkin ada batch yang baru saja dibuat
    const check = await pool.query(
        "SELECT id FROM batch_records WHERE status = 'running' LIMIT 1"
    );
    if (check.rows.length > 0) return; // sudah ada batch, skip

    // Coba dapatkan advisory lock yang sama dengan START.
    // Kalau START sedang berjalan, lewati — tick berikut akan coba lagi.
    const lockRes = await pool.query(
        "SELECT pg_try_advisory_lock($1) AS ok", [START_LOCK_KEY]
    );
    if (!lockRes.rows[0]?.ok) {
        console.log("[alarmMonitor] Adopsi ditunda: START sedang berjalan (lock dipegang).");
        adoptStreak = 0; // reset, coba lagi dari awal
        return;
    }
    try {
        // Nama batch otomatis: EXT DD.MM.YY HH.mm (WIB)
        const now = new Date();
        const wib = new Date(now.getTime() + 7 * 3600_000);
        const dd = String(wib.getUTCDate()).padStart(2, "0");
        const mm = String(wib.getUTCMonth() + 1).padStart(2, "0");
        const yy = String(wib.getUTCFullYear()).slice(-2);
        const hh = String(wib.getUTCHours()).padStart(2, "0");
        const mn = String(wib.getUTCMinutes()).padStart(2, "0");
        const baseName = `EXT ${dd}.${mm}.${yy} ${hh}.${mn}`;

        // Hindari bentrok unique index (jarang, tapi bisa terjadi kalau ada 2 adopsi 1 menit)
        let batchNo = baseName;
        const existing = await pool.query(
            "SELECT batch_no FROM batch_records WHERE lower(btrim(batch_no)) LIKE lower(btrim($1)) || '%'",
            [baseName]
        );
        if (existing.rows.length > 0) {
            batchNo = `${baseName}-${existing.rows.length + 1}`;
        }

        // Snapshot dari readback setpoint PLC (bukan dari tabel recipes)
        const sp = snap.setpoints ?? {};
        const plcPhase = snap.phase?.rawValue ?? null;
        const recipeSnapshot = {
            version: RECIPE_SNAPSHOT_VERSION,
            capturedAt: now.toISOString(),
            recipeId: null,
            formulaNo: null,
            source: "plc_readback",
            adoptedAtPhase: plcPhase,
            controlTemp: sp.ctrlTemp ?? null,
            spaceTemp: sp.tempSpace ?? null,
            sterilTemp: sp.sterSet ?? null,
            sterilTimeMin: sp.sterSetTime ?? null,
            alarmPres: sp.alrmPres ?? null,
            coolingTemp1: sp.cool1Temp ?? null,
            coolingTemp2: sp.cool2Temp ?? null,
            foValSetting: null,
            controlType: "Time",
            sterilMaterial: null,
        };

        const insertResult = await pool.query(
            `INSERT INTO batch_records
                 (batch_no, loading_no, operator, machine_id, recipe_id,
                  product_name, product_spec, ctrl_type, ster_temp, cool_temp,
                  recipe_snapshot, status, run_begin)
             VALUES ($1, 'N/A', 'system', 'SG-40', NULL,
                     '-', '-', 'Time', $2, $3,
                     $4::jsonb, 'running', now())
             RETURNING batch_no`,
            [
                batchNo,
                recipeSnapshot.sterilTemp,
                recipeSnapshot.coolingTemp2,
                JSON.stringify(recipeSnapshot),
            ]
        );
        const created = insertResult.rows[0]?.batch_no;

        // Audit
        await pool.query(
            `INSERT INTO audit_log
                 (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
            [
                "system", "system", "batch_adopted", "batch", batchNo,
                JSON.stringify({ batchNo, plcPhase, source: "plc_readback", recipeSnapshot }),
                "system",
                `Batch ${batchNo} dibuat otomatis: proses ditemukan sudah berjalan di fase ${plcPhase} tanpa batch di web.`,
            ]
        );
        console.log(`[alarmMonitor] ADOPSI: batch ${created} dibuat otomatis (fase PLC ${plcPhase}).`);
    } finally {
        // Lepas lock sesegera mungkin
        await pool.query("SELECT pg_advisory_unlock($1)", [START_LOCK_KEY]).catch((e) => {
            console.error("[alarmMonitor] Gagal melepas advisory lock adopsi:", e.message);
        });
    }
}

/**
 * Cek apakah perlu mengadopsi proses yang berjalan dari luar web.
 * Dipanggil setiap tick (1 detik) setelah evaluasi alarm.
 * snap bisa null jika tick alarm gagal sebelum membaca snapshot.
 */
async function checkAdoption(snap) {
    if (adoptBusy) return;
    // Hanya lanjut kalau snap valid dan PLC online
    if (!snap || !snap.plcOk || snap.isDummy) { adoptStreak = 0; return; }

    const phaseRaw = snap.phase?.rawValue ?? null;
    const inProcessPhase = phaseRaw !== null && ADOPT_PHASES.has(phaseRaw);

    if (!inProcessPhase) { adoptStreak = 0; return; }

    // Cek apakah sudah ada batch running (query ringan)
    const batchRes = await pool.query(
        "SELECT id FROM batch_records WHERE status = 'running' LIMIT 1"
    );
    if (batchRes.rows.length > 0) { adoptStreak = 0; return; } // batch sudah ada, tidak perlu adopsi

    // Fase proses, tidak ada batch — hitung streak
    adoptStreak += 1;
    if (adoptStreak < ADOPT_STREAK_NEEDED) return; // belum cukup stabil

    // Streak terpenuhi: adopsi
    adoptStreak = 0;
    adoptBusy = true;
    try {
        await adoptRunningProcess(snap);
    } catch (err) {
        console.error("[alarmMonitor] Adopsi gagal:", err.message ?? err);
    } finally {
        adoptBusy = false;
    }
}

async function tick() {
    if (busy) return;
    busy = true;
    let snap = null;
    try {
        const nowMs = Date.now();
        await heartbeat(nowMs);                       // bukti hidup, tidak bergantung pada PLC
        snap = await readPlcSnapshot();
        if (snap.isDummy) return;                     // data simulasi (dev) tidak boleh masuk log
        if (!snap.plcOk) { await onPlcDown(nowMs); return; }
        await onPlcUp(nowMs);

        if (!reconciled) {
            await reconcile(snap, nowMs);
            reconciled = true;
        }
        for (const key of FAULT_KEYS) {
            const st = bitStates.get(key);
            const r = evaluateBit(st, snap.alarms?.bits?.[key], nowMs);
            if (r.action === "open") await openEpisode(key, st, snap, nowMs);
            else if (r.action === "close") await closeEpisode(key, st, r.eventAt, snap);
        }
    } catch (err) {
        // Jangan crash server; log dibatasi sekali per menit.
        if (Date.now() - lastErrLogMs >= 60_000) {
            console.error("[alarmMonitor] Tick gagal:", err.message ?? err);
            lastErrLogMs = Date.now();
        }
    } finally {
        busy = false;
    }

    // Cek adopsi (di luar blok alarm, tidak diblokir oleh busy alarm)
    await checkAdoption(snap);
}

export async function startAlarmMonitor() {
    if (started) return;
    started = true;
    try {
        const nowMs = Date.now();
        const hb = await pool.query("SELECT beat_at FROM monitor_heartbeat WHERE id = 1");
        if (hb.rows[0]) {
            const beatMs = new Date(hb.rows[0].beat_at).getTime();
            if (nowMs - beatMs >= GAP_THRESHOLD_MS) {
                await insertEvent({
                    eventDate: new Date(nowMs), eventType: "monitor_gap",
                    description:
                        `Pemantauan alarm terhenti dari ${fmtWib(beatMs)} sampai ${fmtWib(nowMs)} ` +
                        `(sekitar ${Math.max(1, Math.round((nowMs - beatMs) / 60_000))} menit). ` +
                        `Alarm yang terjadi pada rentang ini TIDAK terekam.`,
                });
            }
        }
        await insertEvent({ eventDate: new Date(nowMs), eventType: "server_start", description: "Server SCADA dimulai." });

        // Hindari catatan communication_abnormal ganda saat server restart ketika PLC memang masih putus.
        const last = await pool.query(
            `SELECT event_type FROM alarm_log
             WHERE event_type IN ('communication_abnormal','communication_normal')
             ORDER BY id DESC LIMIT 1`
        );
        plcDownLogged = last.rows[0]?.event_type === "communication_abnormal";
        await heartbeat(Date.now(), true);
    } catch (err) {
        console.error("[alarmMonitor] Inisialisasi gagal (migrasi item8_migration.sql sudah dijalankan?):", err.message ?? err);
    }
    setInterval(tick, TICK_MS);
    console.log(`> Alarm monitor berjalan, interval ${TICK_MS / 1000} detik`);
}
