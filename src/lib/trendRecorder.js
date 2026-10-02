/**
 * src/lib/trendRecorder.js — Perekam data trend suhu tiap interval waktu.
 *
 * Dipanggil oleh server.js (custom server) via setInterval, bukan oleh Next.js.
 * Tugasnya: kalau ada batch yang sedang running, baca PLC dan simpan 1 baris
 * ke tabel batch_trend.
 *
 * Kolom batch_trend yang di-INSERT:
 *   batch_id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg, phase_code
 *   - p      : diisi dari snap.p1 (sensor tekanan utama chamber); p2 tidak punya kolom
 *   - phase_code: diisi dari snap.phase?.rawValue (nilai VW98 mentah), null bila tidak terbaca
 *
 * DESAIN ANTI-CRASH:
 * - Semua error di-catch di level recordTrendTick() dan hanya di-log ke console.
 * - Tidak ada throw ke atas, supaya server tidak crash gara-gara 1 tick gagal
 *   (misal: PLC momentarily disconnect, DB timeout, dll).
 *
 * ATURAN IMPORT: wajib pakai import relatif + ekstensi .js (dimuat dari custom server CommonJS).
 */

import pool from "./db.js";
import { readPlcSnapshot } from "./plc.js";
import { finalizeBatch } from "./batchFinalize.js";

// ── State modul untuk rekonsiliasi idle ──────────────────────────────────────
// Dipakai untuk mendeteksi mesin kembali idle setelah batch dimulai.
// State ini bertahan di memori selama server hidup.
let idleStreak   = 0;  // jumlah tick berturut-turut dengan fase 0 atau 1
let streakBatchId = null; // batch yang sedang dipantau streak-nya

/**
 * Rekam satu data point suhu ke batch_trend.
 * Dipanggil tiap interval dari server.js (setInterval).
 *
 * Alur:
 *   1. Cek apakah ada batch_records dengan status = 'running'. Ambil juga batch_no
 *      dan run_begin untuk keperluan rekonsiliasi.
 *      Kalau tidak ada, return diam-diam.
 *   2. Panggil readPlcSnapshot() untuk baca data sensor.
 *   3. Kalau plcOk === false, SKIP insert (jangan rekam data tidak valid).
 *      idleStreak TIDAK diubah saat PLC tidak terhubung (putus komm bukan bukti idle).
 *   4. Kalau plcOk true, INSERT 1 baris ke batch_trend.
 *   5. Setelah INSERT berhasil: rekonsiliasi idle streak (deteksi mesin kembali idle).
 */
export async function recordTrendTick() {
    try {
        // 1. Cek apakah ada batch yang sedang running
        const batchResult = await pool.query(
            "SELECT id, batch_no, run_begin FROM batch_records WHERE status = 'running' LIMIT 1"
        );
        if (batchResult.rows.length === 0) {
            // Tidak ada batch running, tidak perlu rekam apa-apa
            return;
        }
        const { id: batchId, batch_no: batchNo, run_begin: runBegin } = batchResult.rows[0];

        // 2. Baca PLC
        const snap = await readPlcSnapshot();

        // 3. Kalau PLC tidak terhubung, skip tick ini — jangan insert data invalid
        //    PENTING: idleStreak tidak direset saat PLC offline (putus komm bukan bukti idle)
        if (!snap.plcOk) {
            console.warn(
                `[trendRecorder] Tick dilewati (PLC tidak terhubung): ${snap.plcError}`
            );
            return;
        }

        // 4. Hitung rata-rata suhu T1-T6 (simple average, null diabaikan)
        const tempVals = [snap.t1, snap.t2, snap.t3, snap.t4, snap.t5, snap.t6]
            .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
        const avgTemp = tempVals.length > 0
            ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length
            : null;

        const rawPhase = snap.phase?.rawValue ?? null;

        // INSERT 1 baris ke batch_trend.
        // Kolom tekanan: tabel hanya punya satu kolom "p" → diisi snap.p1 (sensor utama chamber).
        // Kolom phase_code: nilai VW98 mentah dari PLC, null bila tidak terbaca.
        await pool.query(
            `INSERT INTO batch_trend
                (batch_id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg, phase_code)
             VALUES
                ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                batchId,
                snap.t1 ?? null,
                snap.t2 ?? null,
                snap.t3 ?? null,
                snap.t4 ?? null,
                snap.t5 ?? null,
                snap.t6 ?? null,
                snap.p1 ?? null,  // tekanan utama chamber; p2 tidak punya kolom di batch_trend
                snap.th ?? null,
                snap.tm ?? null,
                snap.tl ?? null,
                avgTemp,
                rawPhase,         // VW98 mentah; null bila PROCCES_TEXT gagal dibaca
            ]
        );

        console.log(
            `[trendRecorder] Tick OK — batch ${batchId}, ` +
            `fase=${rawPhase ?? "-"}, TL=${snap.tl ?? "-"}°C, avg=${avgTemp !== null ? avgTemp.toFixed(1) : "-"}°C`
        );

        // 5. ── Rekonsiliasi idle streak ────────────────────────────────────────
        // Setelah INSERT berhasil, cek apakah mesin sudah kembali Idle.
        // Ini mendeteksi kasus mesin selesai/berhenti tanpa Stop dari web.
        try {
            // Reset streak kalau batchId berubah (batch baru dimulai)
            if (batchId !== streakBatchId) {
                idleStreak    = 0;
                streakBatchId = batchId;
            }

            // Fase 0 (idle pintu belum siap) atau 1 (idle siap): naik streak
            // Fase lain (termasuk null): reset streak
            if (rawPhase === 0 || rawPhase === 1) {
                idleStreak++;
            } else {
                idleStreak = 0;
            }

            // Trigger auto-finalize kalau:
            //   - Streak >= 2 tick berturut-turut mesin di fase idle
            //   - Batch sudah berjalan lebih dari 90 detik (hindari false trigger saat startup)
            if (idleStreak >= 2 && runBegin) {
                const elapsedMs = Date.now() - new Date(runBegin).getTime();
                if (elapsedMs > 90_000) {
                    console.log(
                        `[trendRecorder] Auto-finalize dipicu: batch ${batchNo} idle ${idleStreak} tick, ` +
                        `elapsed ${Math.round(elapsedMs / 1000)}s`
                    );

                    // Finalisasi batch — status ditentukan oleh finalizeBatch (plcPhase + trend)
                    const result = await finalizeBatch(batchId, { plcPhase: rawPhase });

                    // Reset streak setelah finalisasi (berhasil atau alreadyFinalized)
                    idleStreak    = 0;
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
                                        status:               result.status,
                                        sterilizationResult:  result.sterilizationResult,
                                        foMin:                result.foMin,
                                        plcPhaseAtFinalize:   rawPhase,
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
            console.error("[trendRecorder] Error rekonsiliasi idle streak:", reconErr.message ?? reconErr);
        }

    } catch (err) {
        // JANGAN re-throw: proses background tidak boleh crash server
        // gara-gara 1 tick gagal (mis. DB timeout sesaat, PLC disconnect, dll)
        console.error("[trendRecorder] Gagal merekam tick:", err.message ?? err);
    }
}
