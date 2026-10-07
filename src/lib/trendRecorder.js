/**
 * src/lib/trendRecorder.js — Perekam data trend suhu & peristiwa fase.
 *
 * Dipanggil oleh server.js (custom server) via setInterval tiap 5 detik.
 * Tidak setiap tick menghasilkan INSERT — keputusan INSERT ada di dalam fungsi ini.
 *
 * Kolom batch_trend yang di-INSERT:
 *   batch_id, ts, t1..t6, p (snap.p1), th, tm, tl, avg (rata-rata TH/TM/TL),
 *   cond (snap.conductivity), phase_code
 *
 * DESAIN ANTI-CRASH:
 * - Semua error di-catch di level recordTrendTick() dan hanya di-log ke console.
 * - Tidak ada throw ke atas, supaya server tidak crash gara-gara 1 tick gagal.
 *
 * ATURAN IMPORT: wajib pakai import relatif + ekstensi .js (dimuat dari custom server CommonJS).
 */

import pool from "./db.js";
import { readPlcSnapshot } from "./plc.js";
import { finalizeBatch } from "./batchFinalize.js";

// ── Konstanta perilaku recorder — sesuaikan di sini bila perlu ───────────────
const ROW_INTERVAL_MS = 60_000; // jarak minimum antar baris trend periodik (ms)
const POST_FINISH_MAX_ROWS = 2;     // maksimal baris tambahan setelah fase 6 (Selesai)
const IDLE_FINALIZE_MS = 120_000; // durasi idle minimum sebelum auto-finalize (ms)

// ── State modul — bertahan di memori selama server hidup ─────────────────────
let busy = false;     // guard: cegah panggilan rekursif / overlap
let idleSince = null;      // Date pertama kali fase idle terdeteksi, atau null
let streakBatchId = null;      // batchId yang sedang dipantau idle-nya

// Throttle log PLC offline: hanya log sekali per menit
let lastPlcWarnMs = 0;

/**
 * Rekam satu data point ke batch_trend (bila kondisi terpenuhi).
 * Dipanggil tiap 5 detik dari server.js (setInterval).
 *
 * Alur:
 *   1. Guard busy — skip bila tick sebelumnya belum selesai.
 *   2. Cek batch running.
 *   3. Baca PLC — skip (tanpa ubah state idle) bila !plcOk.
 *   4. Update waktu & timer batch_records sesuai fase.
 *   5. Putuskan apakah INSERT baris trend.
 *   6. Rekonsiliasi idle berbasis waktu → auto-finalize bila perlu.
 */
export async function recordTrendTick() {
    // ── Guard: cegah overlap eksekusi ────────────────────────────────────────
    if (busy) return;
    busy = true;

    try {
        // ── 1. Cek batch running ──────────────────────────────────────────────
        const batchResult = await pool.query(
            "SELECT id, batch_no, run_begin FROM batch_records WHERE status = 'running' LIMIT 1"
        );
        if (batchResult.rows.length === 0) {
            // Tidak ada batch running — reset state idle dan selesai
            idleSince = null;
            streakBatchId = null;
            return;
        }
        const { id: batchId, batch_no: batchNo, run_begin: runBegin } = batchResult.rows[0];

        // ── 2. Baca PLC ───────────────────────────────────────────────────────
        const snap = await readPlcSnapshot();

        // ── 3. PLC offline — skip tick, JANGAN ubah state idle ───────────────
        //    Putus komunikasi bukan bukti mesin idle; jangan trigger auto-finalize.
        if (!snap.plcOk) {
            const nowMs = Date.now();
            if (nowMs - lastPlcWarnMs >= 60_000) {
                console.warn(
                    `[trendRecorder] Tick dilewati (PLC tidak terhubung): ${snap.plcError}`
                );
                lastPlcWarnMs = nowMs;
            }
            return;
        }

        // ── 4. Update waktu & timer batch_records ─────────────────────────────
        const phase = snap.phase?.rawValue ?? null;
        const timers = snap.timers ?? {};
        const heatSec = Number.isFinite(timers.heatSec) ? timers.heatSec : null;
        const sterSec = Number.isFinite(timers.sterSec) ? timers.sterSec : null;
        const coolSec = Number.isFinite(timers.coolSec) ? timers.coolSec : null;

        try {
            // Fase 3 (Heating) — catat heat_begin sekali, update heat_time_min
            if (phase === 3) {
                await pool.query(
                    `UPDATE batch_records
                     SET heat_begin    = COALESCE(heat_begin, now()),
                         heat_time_min = COALESCE($1, heat_time_min)
                     WHERE id = $2`,
                    [heatSec !== null ? heatSec / 60.0 : null, batchId]
                );
            }

            // Fase 4 (Steril) — catat ster_begin sekali, update ster_time_min & heat_time_min
            // heat_time_min di fase 4 tetap diperbarui karena counter PLC bertahan setelah Heating.
            if (phase === 4) {
                await pool.query(
                    `UPDATE batch_records
                        SET heat_begin    = COALESCE(heat_begin, now()),
                            heat_time_min = COALESCE($1, heat_time_min),
                            ster_begin    = COALESCE(ster_begin, now()),
                            ster_time_min = COALESCE($2, ster_time_min)
                        WHERE id = $3`,
                    [
                        heatSec !== null ? heatSec / 60.0 : null,
                        sterSec !== null ? sterSec / 60.0 : null,
                        batchId,
                    ]
                );
            }

            // Fase 5,7,6 (Cooling/Drain/Selesai) — catat cool_begin sekali, update cool_time_min.
            // Saat masuk fase 5: PLC me-reset counter ster_time, jadi ambil dari snapshot resep
            // batch (item 6), BUKAN dari tabel recipes yang bisa sudah diedit.
            if (phase === 5 || phase === 7 || phase === 6) {
                // Update cool_begin & cool_time_min
                await pool.query(
                    `UPDATE batch_records
                     SET cool_begin    = COALESCE(cool_begin, CASE WHEN $1 THEN now() END),
                         cool_time_min = COALESCE($2, cool_time_min)
                     WHERE id = $3`,
                    [phase === 5, coolSec !== null ? coolSec / 60.0 : null, batchId]
                );

                // Salin ster_time_min dari recipe_snapshot HANYA bila nilainya masih berbeda
                // (PLC reset counter sterTime begitu masuk fase 5, jadi nilai DB sudah kehilangan data).
                // Fallback ke tabel recipes hanya untuk batch tanpa snapshot (batch yang sudah
                // berjalan saat item 6 dipasang); batch baru selalu punya snapshot.
                await pool.query(
                    `UPDATE batch_records b
                     SET ster_time_min = src.v
                     FROM (
                         SELECT b2.id,
                                COALESCE((b2.recipe_snapshot->>'sterilTimeMin')::numeric, r.steril_time_min) AS v
                         FROM batch_records b2
                         LEFT JOIN recipes r ON r.id = b2.recipe_id
                         WHERE b2.id = $1
                     ) src
                     WHERE b.id = src.id
                       AND src.v IS NOT NULL
                       AND b.ster_time_min IS DISTINCT FROM src.v`,
                    [batchId]
                );
            }
        } catch (timerErr) {
            // Kegagalan update timer tidak menghentikan INSERT trend
            console.error("[trendRecorder] Gagal update timer batch_records:", timerErr.message);
        }

        // ── 5. Putuskan apakah INSERT baris trend ─────────────────────────────
        try {
            // Ambil baris trend terakhir (untuk cek fase dan waktu)
            const lastRowRes = await pool.query(
                `SELECT ts, phase_code
                 FROM batch_trend
                 WHERE batch_id = $1
                 ORDER BY ts DESC LIMIT 1`,
                [batchId]
            );
            const lastRow = lastRowRes.rows[0] ?? null;

            // Cek apakah fase 6 sudah terlalu banyak baris (batas POST_FINISH_MAX_ROWS)
            let tooManyFinish = false;
            if (phase === 6) {
                const finishCountRes = await pool.query(
                    `SELECT COUNT(*) FROM batch_trend WHERE batch_id = $1 AND phase_code = 6`,
                    [batchId]
                );
                const finishCount = parseInt(finishCountRes.rows[0].count, 10);
                if (finishCount >= 1 + POST_FINISH_MAX_ROWS) {
                    tooManyFinish = true;
                }
            }

            // Kondisi INSERT:
            //   (a) belum ada baris sama sekali, ATAU
            //   (b) fase berbeda dari baris terakhir (baris peristiwa), ATAU
            //   (c) selisih waktu >= ROW_INTERVAL_MS
            // Pengecualian: jangan INSERT kalau fase 6 sudah terlalu banyak baris
            const noRows = lastRow === null;
            const phaseChanged = lastRow !== null && lastRow.phase_code !== phase;
            const timeElapsed = lastRow !== null &&
                (Date.now() - new Date(lastRow.ts).getTime()) >= ROW_INTERVAL_MS;

            const shouldInsert = !tooManyFinish && (noRows || phaseChanged || timeElapsed);

            if (shouldInsert) {
                // Hitung avg = rata-rata TH, TM, TL yang tidak null
                const thvVals = [snap.th, snap.tm, snap.tl]
                    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)));
                const avgTemp = thvVals.length > 0
                    ? thvVals.reduce((a, b) => a + b, 0) / thvVals.length
                    : null;

                await pool.query(
                    `INSERT INTO batch_trend
                        (batch_id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg, cond, phase_code)
                     VALUES
                        ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                    [
                        batchId,
                        snap.t1 ?? null,
                        snap.t2 ?? null,
                        snap.t3 ?? null,
                        snap.t4 ?? null,
                        snap.t5 ?? null,
                        snap.t6 ?? null,
                        snap.p1 ?? null,         // tekanan utama chamber
                        snap.th ?? null,
                        snap.tm ?? null,
                        snap.tl ?? null,
                        avgTemp,                 // rata-rata TH/TM/TL
                        snap.conductivity ?? null, // konduktivitas (tag L/VW122)
                        phase,                   // VW98 mentah; null bila tidak terbaca
                    ]
                );

                const reason = noRows ? "baris pertama" : phaseChanged ? `fase→${phase}` : "interval";
                console.log(
                    `[trendRecorder] INSERT OK — batch ${batchNo}, fase=${phase ?? "-"}, ` +
                    `TL=${snap.tl ?? "-"}°C, avg=${avgTemp !== null ? avgTemp.toFixed(1) : "-"}°C` +
                    `, alasan=${reason}`
                );
            }
        } catch (insertErr) {
            console.error("[trendRecorder] Gagal INSERT batch_trend:", insertErr.message);
        }

        // ── 6. Rekonsiliasi idle berbasis WAKTU ───────────────────────────────
        try {
            // Reset state kalau batchId berubah (batch baru dimulai)
            if (batchId !== streakBatchId) {
                idleSince = null;
                streakBatchId = batchId;
            }

            // Fase 0 (idle pintu belum siap) atau 1 (idle siap): mulai/pertahankan timer idle
            // Fase lain (termasuk null): reset timer idle
            if (phase === 0 || phase === 1) {
                if (idleSince === null) {
                    idleSince = new Date();
                }
            } else {
                idleSince = null;
            }

            // Trigger auto-finalize bila:
            //   - Mesin sudah idle >= IDLE_FINALIZE_MS
            //   - Batch sudah berjalan lebih dari 90 detik (hindari false trigger saat startup)
            if (idleSince !== null && runBegin) {
                const idleElapsedMs = Date.now() - idleSince.getTime();
                const batchElapsedMs = Date.now() - new Date(runBegin).getTime();

                if (idleElapsedMs >= IDLE_FINALIZE_MS && batchElapsedMs > 90_000) {
                    console.log(
                        `[trendRecorder] Auto-finalize dipicu: batch ${batchNo} idle ` +
                        `${Math.round(idleElapsedMs / 1000)}s, elapsed ${Math.round(batchElapsedMs / 1000)}s`
                    );

                    const result = await finalizeBatch(batchId, { plcPhase: phase });

                    // Reset state idle setelah finalisasi
                    idleSince = null;
                    streakBatchId = null;

                    if (!result.alreadyFinalized) {
                        // Tulis audit log — dibungkus try/catch sendiri (gagal audit tidak fatal)
                        try {
                            await pool.query(
                                `INSERT INTO audit_log
                                    (actor, actor_role, action, entity_type, entity_id,
                                     new_value, source, description)
                                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                                [
                                    "system",
                                    "system",
                                    "batch_auto_finalize",
                                    "batch",
                                    batchNo,
                                    JSON.stringify({
                                        status: result.status,
                                        foMin: result.foMin,
                                        f0Complete: result.f0Complete,
                                        plcPhaseAtFinalize: phase,
                                    }),
                                    "system",
                                    `Ditutup otomatis: PLC kembali Idle tanpa Stop dari web. Status: ${result.status}`,
                                ]
                            );
                        } catch (auditErr) {
                            console.error("[trendRecorder] Gagal catat audit auto-finalize:", auditErr.message);
                        }
                    }
                }
            }
        } catch (reconErr) {
            // Rekonsiliasi gagal tidak boleh mematikan recorder
            console.error("[trendRecorder] Error rekonsiliasi idle:", reconErr.message ?? reconErr);
        }

    } catch (err) {
        // JANGAN re-throw: proses background tidak boleh crash server
        console.error("[trendRecorder] Gagal merekam tick:", err.message ?? err);
    } finally {
        // Pastikan busy selalu direset meski terjadi error
        busy = false;
    }
}