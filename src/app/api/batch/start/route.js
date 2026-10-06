import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readPlcSnapshot } from "@/lib/plc";
import { writePlcTags, pulsePlcTag } from "@/lib/plcWrite";
import { validateRecipe } from "@/lib/recipeValidation";
import { validateBatchNo } from "@/lib/batchNo";

// Rentang nilai resep dikelola di src/lib/recipeValidation.js.
// Aturan format nomor batch ada di src/lib/batchNo.js (dipakai juga oleh klien).

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";

// ── Lock anti-klik ganda (sisi server) ────────────────────────────────────────
// Seluruh alur START memakan waktu detik (verifikasi setpoint s.d. 4 dtk, polling
// fase s.d. 10 dtk), dan baris batch_records baru dibuat di AKHIR alur. Tanpa lock,
// dua request yang datang berdekatan sama-sama lolos semua cek dan sama-sama
// menulis setpoint + mengirim pulsa START ke PLC.
//
// Memakai PostgreSQL advisory lock (bukan variabel di memori) supaya tetap benar
// walau modul di-load ulang (hot reload dev) atau ada lebih dari satu proses.
// Lock dipegang di koneksi khusus sampai alur selesai; kalau koneksi putus, lock
// otomatis lepas.
const START_LOCK_KEY = 7401001; // angka bebas, harus unik untuk operasi START

/** @returns {Promise<{ release: () => Promise<void> } | null>} null = lock sedang dipegang request lain */
async function acquireStartLock() {
    const client = await pool.connect();
    let acquired = false;
    try {
        const r = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [START_LOCK_KEY]);
        acquired = r.rows[0]?.ok === true;
    } catch (err) {
        client.release(true); // buang koneksi
        throw err;
    }
    if (!acquired) {
        client.release();
        return null;
    }
    return {
        async release() {
            let destroy = false;
            try {
                await client.query("SELECT pg_advisory_unlock($1)", [START_LOCK_KEY]);
            } catch (err) {
                // Kalau unlock gagal, koneksi HARUS dibuang (bukan dikembalikan ke pool),
                // karena lock menempel di sesi koneksi ini.
                console.error("[batch/start] Gagal melepas advisory lock, koneksi dibuang:", err.message);
                destroy = true;
            }
            client.release(destroy);
        },
    };
}

// ── Nama otomatis untuk "Run kosongan" ────────────────────────────────────────
// Format: "KOSONGAN dd.mm.yy" (WIB). Kalau sudah ada hari itu: "-2", "-3", dst.
function wibDateStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "2-digit",
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")}.${get("month")}.${get("year")}`;
}

async function nextEmptyRunName() {
    const base = `KOSONGAN ${wibDateStamp()}`;
    const res = await pool.query(
        `SELECT lower(btrim(batch_no)) AS k
         FROM batch_records
         WHERE lower(btrim(batch_no)) = lower($1)
            OR lower(btrim(batch_no)) LIKE lower($2)`,
        [base, `${base}-%`]
    );
    const taken = new Set(res.rows.map((r) => r.k));
    let candidate = base;
    let n = 2;
    while (taken.has(candidate.toLowerCase())) {
        candidate = `${base}-${n}`;
        n += 1;
    }
    return candidate;
}

const STATUS_LABEL = { running: "sedang berjalan", finished: "selesai", aborted: "dibatalkan" };

/**
 * Polling readPlcSnapshot sampai phase.rawValue masuk ke salah satu target,
 * atau batas waktu tercapai.
 *
 * @param {number[]} targetPhases - Kode fase yang diterima sebagai "berhasil mulai"
 * @param {number}   timeoutMs    - Batas waktu total polling
 * @param {number}   intervalMs   - Jarak antar polling
 * @returns {Promise<{ reached: boolean, lastSnapshot: object }>}
 */
async function pollUntilPhase(targetPhases, timeoutMs = 10_000, intervalMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let lastSnapshot = null;

    while (Date.now() < deadline) {
        const snap = await readPlcSnapshot();
        // Hanya hitung pembacaan yang valid (plcOk true).
        // Pembacaan saat PLC offline diabaikan — data dummy bukan patokan fase.
        if (snap.plcOk) {
            lastSnapshot = snap;
            const raw = snap.phase?.rawValue;
            if (raw !== null && raw !== undefined && targetPhases.includes(raw)) {
                return { reached: true, lastSnapshot };
            }
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
    }

    return { reached: false, lastSnapshot };
}

export async function POST(request) {
    let lock = null;
    try {
        // ▼ PROTEKSI SERVER-SIDE: wajib login (admin atau operator boleh)
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        // ▼ Lock anti-klik ganda: hanya satu proses START pada satu waktu
        lock = await acquireStartLock();
        if (!lock) {
            return Response.json(
                {
                    ok: false,
                    error: "Permintaan START lain sedang diproses. Tunggu sampai selesai dan jangan menekan tombol berulang.",
                },
                { status: 409 }
            );
        }

        return await runStart(request, session);
    } catch (error) {
        console.error("[POST /api/batch/start]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    } finally {
        if (lock) await lock.release();
    }
}

async function runStart(request, session) {
    try {
        const body = await request.json();
        // "operator" dan "actor" dari body DIABAIKAN — diambil dari session
        const { machineId, formulaNo } = body;
        let { batchNo, loadingNo, productName, productSpec } = body;

        // Run kosongan (tes tanpa produk): nomor batch dibuat server, sisanya baku.
        const emptyRun = body.emptyRun === true;
        if (emptyRun) {
            batchNo = null;   // diisi nextEmptyRunName() setelah cek running
            loadingNo = "N/A";
            productName = "-";
            productSpec = "-";
        }

        // Operator diambil dari session (tidak bisa dipalsukan)
        const operator = session.fullName ?? session.username;

        // Validasi: semua field identitas wajib tidak boleh kosong
        const required = emptyRun
            ? { machineId, formulaNo }
            : { batchNo, loadingNo, machineId, productName, productSpec, formulaNo };
        for (const [key, val] of Object.entries(required)) {
            if (!val || String(val).trim() === "") {
                return Response.json({ ok: false, error: `Field ${key} tidak boleh kosong` }, { status: 400 });
            }
        }

        // Validasi format Batch No (karakter aman untuk URL dan nama file)
        if (!emptyRun) {
            const bn = validateBatchNo(batchNo);
            if (!bn.ok) {
                return Response.json({ ok: false, error: bn.error }, { status: 400 });
            }
            batchNo = bn.value; // sudah di-trim
        }

        // Validasi: formulaNo harus ada di tabel recipes
        // SELECT mengambil semua field termasuk fo_val_setting untuk validateRecipe
        const recipeResult = await pool.query(
            `SELECT id, control_temp, cooling_temp1, cooling_temp2, control_type,
                    space_temp, steril_temp, steril_time_min, alarm_pres, fo_val_setting
             FROM recipes WHERE formula_no = $1`,
            [String(formulaNo).trim()]
        );
        if (recipeResult.rows.length === 0) {
            return Response.json(
                { ok: false, error: `Formula "${formulaNo}" tidak ditemukan di database` },
                { status: 400 }
            );
        }
        const recipe = recipeResult.rows[0];

        // ── Validasi nilai resep dengan validateRecipe SEBELUM menyentuh PLC ────
        // validateRecipe mendeteksi null SEBELUM Number() sehingga Number(null)=0
        // tidak lolos sebagai nilai valid.
        const recipeValidation = validateRecipe(recipe);
        if (!recipeValidation.ok) {
            return Response.json(
                {
                    ok: false,
                    error: "Resep tidak valid: " + recipeValidation.problems.map((p) => p.message).join("; "),
                    invalidFields: recipeValidation.problems,
                },
                { status: 400 }
            );
        }
        // Warnings (mis. fo_val_setting kosong) hanya dicatat ke console, tidak memblokir
        if (recipeValidation.warnings.length > 0) {
            console.warn(
                "[batch/start] Warning resep:",
                recipeValidation.warnings.map((w) => w.message).join("; ")
            );
        }

        // Ambil nilai yang sudah divalidasi (langsung dari DB; Number() aman karena
        // validateRecipe sudah memastikan semua bukan null dan dalam rentang)
        const ctrlTemp = Number(recipe.control_temp);
        const spaceTemp = Number(recipe.space_temp);
        const sterilTemp = Number(recipe.steril_temp);
        const sterilTime = Number(recipe.steril_time_min);
        const alrmPres = Number(recipe.alarm_pres);
        const cool1Temp = Number(recipe.cooling_temp1);
        const cool2Temp = Number(recipe.cooling_temp2);

        // Validasi: cek apakah ada batch yang sedang running
        const runningCheck = await pool.query(
            "SELECT COUNT(*) FROM batch_records WHERE status = 'running'"
        );
        if (parseInt(runningCheck.rows[0].count, 10) > 0) {
            return Response.json(
                { ok: false, error: "Masih ada batch yang sedang berjalan" },
                { status: 409 }
            );
        }

        // ── Nomor batch harus unik — DICEK SEBELUM menyentuh PLC ────────────────
        // Baris batch_records baru dibuat SETELAH PLC terbukti mulai. Kalau duplikat
        // baru ketahuan saat INSERT, mesin sudah jalan tanpa catatan. Karena itu cek
        // di sini. Unique index (lower(btrim(batch_no))) di DB hanya jaring pengaman.
        // Lock START sedang dipegang, jadi tidak ada request START lain yang menyela.
        if (emptyRun) {
            batchNo = await nextEmptyRunName();
        } else {
            const dup = await pool.query(
                `SELECT status, run_begin
                 FROM batch_records
                 WHERE lower(btrim(batch_no)) = lower($1)
                 LIMIT 1`,
                [batchNo]
            );
            if (dup.rows.length > 0) {
                const d = dup.rows[0];
                const statusLabel = STATUS_LABEL[d.status] ?? d.status;
                const when = d.run_begin
                    ? ` pada ${new Date(d.run_begin).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`
                    : "";
                let hint = d.status === "aborted"
                    ? ` Batch yang dibatalkan tetap memakai nomornya; tambahkan akhiran, mis. "${batchNo}-R1".`
                    : " Gunakan nomor batch lain.";
                if (/^kosongan/i.test(batchNo)) {
                    hint += ' Untuk tes tanpa produk, centang "Run kosongan".';
                }
                return Response.json(
                    {
                        ok: false,
                        code: "batch_no_duplicate",
                        error: `Batch No "${batchNo}" sudah pernah dipakai (status: ${statusLabel}${when}).${hint}`,
                    },
                    { status: 409 }
                );
            }
        }

        // ── Baca snapshot PLC ──────────────────────────────────────────────────
        const snapshot = await readPlcSnapshot();

        if (!snapshot.plcOk) {
            return Response.json(
                {
                    ok: false,
                    error: "PLC tidak terhubung, tidak bisa memulai proses dari web. Pastikan koneksi PLC aktif.",
                },
                { status: 503 }
            );
        }

        // ── Guard fase PLC (urutan penting, jangan diubah) ──────────────────────
        const rawPhase = snapshot.phase?.rawValue;

        if (rawPhase === null || rawPhase === undefined) {
            return Response.json(
                { ok: false, error: "Fase PLC tidak terbaca (PROCCES_TEXT null). Periksa koneksi ke PLC." },
                { status: 503 }
            );
        }

        if (rawPhase === 6) {
            return Response.json(
                {
                    ok: false,
                    error: "Mesin masih berstatus Selesai. Tekan STOP dulu sebelum memulai batch baru.",
                },
                { status: 409 }
            );
        }

        // Fase aktif (sedang dalam siklus): 2=filling, 3=heating, 4=steril, 5=cooling, 7=drain
        if ([2, 3, 4, 5, 7].includes(rawPhase)) {
            const phaseLabel = snapshot.phase?.label ?? `kode ${rawPhase}`;
            return Response.json(
                {
                    ok: false,
                    error: `Mesin sedang menjalankan proses: ${phaseLabel}. Tunggu sampai selesai atau tekan STOP.`,
                },
                { status: 409 }
            );
        }

        // Hanya kode 1 (siap) yang boleh lanjut; kode 0 = pintu belum tertutup/tersegel
        if (rawPhase !== 1) {
            return Response.json(
                {
                    ok: false,
                    error: `Mesin tidak dalam keadaan siap (fase saat ini: ${snapshot.phase?.label ?? rawPhase}). Pastikan pintu tertutup dan mesin di posisi Idle.`,
                },
                { status: 409 }
            );
        }

        // ── Guard status pintu ────────────────────────────────────────────────
        const door = snapshot.door;
        const opnFrnt = door?.opnFrnt ?? false;
        const opnRear = door?.opnRear ?? false;
        const clsFrnt = door?.clsFrnt ?? false;
        const clsRear = door?.clsRear ?? false;
        // seal = tag DOOR_SEAL (Q0.5, status segel AKTUAL / syarat Start), bukan M1.2 (permintaan seal)
        const sealOk = door?.seal ?? false;

        if (opnFrnt || opnRear) {
            const pintus = [
                opnFrnt ? "pintu depan" : null,
                opnRear ? "pintu belakang" : null,
            ].filter(Boolean).join(" dan ");
            return Response.json(
                { ok: false, error: `${pintus.charAt(0).toUpperCase() + pintus.slice(1)} masih terbuka.` },
                { status: 409 }
            );
        }

        if (!clsFrnt || !clsRear) {
            const belum = [
                !clsFrnt ? "pintu depan" : null,
                !clsRear ? "pintu belakang" : null,
            ].filter(Boolean).join(" dan ");
            return Response.json(
                { ok: false, error: `Sensor tutup belum aktif untuk ${belum}. Pastikan pintu tertutup rapat.` },
                { status: 409 }
            );
        }

        if (!sealOk) {
            return Response.json(
                { ok: false, error: "Seal pintu belum aktif. Pastikan door seal sudah mengembang sebelum memulai." },
                { status: 409 }
            );
        }

        // ── Guard bypass interlock ────────────────────────────────────────────
        // DOOR_LOCK (M6.0) sebenarnya bypass interlock, bukan kunci pintu.
        // Kalau aktif, start dari web dilarang (kondisi mesin tidak dapat dipercaya).
        if (door?.bypass) {
            return Response.json(
                { ok: false, error: "Mode bypass interlock (DOOR_LOCK/M6.0) aktif. Nonaktifkan dulu sebelum memulai." },
                { status: 409 }
            );
        }

        // ── Guard CTRL SEL (M15.0) ────────────────────────────────────────────
        // Hanya berlaku kalau plcOk true (sudah dipastikan di atas).
        if (snapshot.ctrlSel === null) {
            return Response.json(
                { ok: false, error: "Tidak bisa membaca tag CTRL SEL dari PLC. Periksa konfigurasi KEPServerEX." },
                { status: 503 }
            );
        }
        if (snapshot.ctrlSel === true) {
            return Response.json(
                { ok: false, error: "CTRL SEL aktif (mode F0). Mesin harus dalam mode waktu (CTRL SEL=false) sebelum start." },
                { status: 409 }
            );
        }

        // ── Tulis setpoint resep ke PLC ───────────────────────────────────────
        // Gunakan nilai Number() hasil validasi di atas.
        // ALRM_PRES dalam kPa, TIDAK di-scale (ditulis apa adanya).
        const setpointPairs = [
            { tag: "CTRL_TEMP", value: Math.round(ctrlTemp * 10) },
            { tag: "TEMP_SPACE", value: Math.round(spaceTemp * 10) },
            { tag: "STER_SET", value: Math.round(sterilTemp * 10) },
            { tag: "STER_SET_TIME", value: sterilTime },     // TIDAK dikali 10, satuan menit (terkonfirmasi)
            { tag: "ALRM_PRES", value: alrmPres },       // dalam kPa, ditulis apa adanya (terkonfirmasi)
            { tag: "COOL1_TEMP", value: Math.round(cool1Temp * 10) },
            { tag: "COOL2_TEMP", value: Math.round(cool2Temp * 10) },
        ];

        const writeSetpointResult = await writePlcTags(setpointPairs);
        if (!writeSetpointResult.ok) {
            console.error("[batch/start] Gagal menulis setpoint ke PLC:", writeSetpointResult.results);
            return Response.json(
                {
                    ok: false,
                    error: "Gagal menulis parameter resep ke PLC",
                    details: writeSetpointResult.results.filter((r) => !r.success),
                },
                { status: 502 }
            );
        }

        // ── Verifikasi setpoint pasca-tulis: loop retry sampai 4000 ms ──────────────
        // Baca ulang tiap 500 ms. Pembacaan dengan plcOk=false diabaikan (lanjut).
        // Berhenti begitu semua pasangan cocok. Kalau sampai batas waktu masih ada
        // yang tidak cocok, gagal dengan audit_log + response 502.
        {
            const VERIFY_TIMEOUT_MS = 4000;
            const VERIFY_INTERVAL_MS = 500;
            const verifyDeadline = Date.now() + VERIFY_TIMEOUT_MS;

            // Pasangan yang perlu diverifikasi (alrmPres dibandingkan persis === seperti sterSetTime)
            const buildVerifyPairs = (sp) => [
                { tag: "CTRL_TEMP", expected: ctrlTemp, got: sp?.ctrlTemp, exact: false },
                { tag: "TEMP_SPACE", expected: spaceTemp, got: sp?.tempSpace, exact: false },
                { tag: "STER_SET", expected: sterilTemp, got: sp?.sterSet, exact: false },
                { tag: "STER_SET_TIME", expected: sterilTime, got: sp?.sterSetTime, exact: true },
                { tag: "COOL1_TEMP", expected: cool1Temp, got: sp?.cool1Temp, exact: false },
                { tag: "COOL2_TEMP", expected: cool2Temp, got: sp?.cool2Temp, exact: false },
                { tag: "ALRM_PRES", expected: alrmPres, got: sp?.alrmPres, exact: true }, // kPa, perbandingan ===
            ];

            const hasMismatch = (pairs) => pairs.filter(({ expected, got, exact }) => {
                if (got === null || got === undefined) return true;
                return exact ? expected !== got : Math.abs(expected - got) >= 0.05;
            });

            let lastValidSp = null;
            let mismatch = null;

            while (Date.now() < verifyDeadline) {
                let snapVerify;
                try {
                    snapVerify = await readPlcSnapshot();
                } catch (_e) {
                    // Gagal baca — tunggu interval dan coba lagi
                    const rem = verifyDeadline - Date.now();
                    if (rem > 0) await new Promise((r) => setTimeout(r, Math.min(VERIFY_INTERVAL_MS, rem)));
                    continue;
                }

                if (!snapVerify.plcOk) {
                    // PLC offline saat ini — abaikan, lanjut polling
                    const rem = verifyDeadline - Date.now();
                    if (rem > 0) await new Promise((r) => setTimeout(r, Math.min(VERIFY_INTERVAL_MS, rem)));
                    continue;
                }

                lastValidSp = snapVerify.setpoints;
                const pairs = buildVerifyPairs(lastValidSp);
                mismatch = hasMismatch(pairs);

                if (mismatch.length === 0) {
                    // Semua cocok — lanjut ke START
                    break;
                }

                // Masih ada yang tidak cocok — tunggu dan coba lagi
                const rem = verifyDeadline - Date.now();
                if (rem <= 0) break;
                await new Promise((r) => setTimeout(r, Math.min(VERIFY_INTERVAL_MS, rem)));
            }

            // Evaluasi hasil akhir
            if (lastValidSp === null) {
                // Tidak pernah ada satupun pembacaan valid
                return Response.json(
                    { ok: false, error: "PLC tidak terhubung saat verifikasi setpoint pasca-tulis. START dibatalkan." },
                    { status: 502 }
                );
            }

            const finalPairs = buildVerifyPairs(lastValidSp);
            const finalMismatch = hasMismatch(finalPairs);

            if (finalMismatch.length > 0) {
                console.error("[batch/start] Setpoint tidak cocok setelah verifikasi:", finalMismatch);
                try {
                    await pool.query(
                        `INSERT INTO audit_log
                            (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                        [
                            session.username,
                            session.role,
                            "start_batch_rejected",
                            "batch",
                            String(batchNo).trim(),
                            JSON.stringify({ reason: "setpoint_mismatch", mismatch: finalMismatch }),
                            "web",
                            `START dibatalkan: setpoint tidak cocok setelah ditulis. ` +
                            finalMismatch.map((m) => `${m.tag} ekspektasi=${m.expected} terbaca=${m.got}`).join("; "),
                        ]
                    );
                } catch (auditErr) {
                    console.error("[batch/start] Gagal catat audit setpoint mismatch:", auditErr.message);
                }
                return Response.json(
                    {
                        ok: false,
                        error: "Setpoint tidak cocok setelah ditulis ke PLC. START dibatalkan.",
                        mismatch: finalMismatch,
                    },
                    { status: 502 }
                );
            }
        }

        // ── Kirim START sebagai pulsa (bukan tulis true saja) ─────────────────
        // START (M1.4) dibaca PLC sebagai LEVEL — kalau dibiarkan true, bisa memicu
        // siklus baru sendiri. Wajib menggunakan pulsePlcTag.
        const pulse = await pulsePlcTag("START");
        // Apapun hasil pulsa (ok true/false, stuckRisk true/false), SELALU lanjut polling.
        // Kondisi fase PLC yang terbaca adalah patokan, bukan hasil pulsa.
        if (!pulse.ok) {
            console.error("[batch/start] Pulsa START tidak sepenuhnya berhasil (tetap lanjut polling):", pulse);
        }

        // ── Polling konfirmasi PLC benar-benar mulai ─────────────────────────
        // Tunggu sampai fase masuk 2 (filling), 3 (heating), atau 4 (steril).
        // Kalau dalam 10 detik tidak tercapai, JANGAN insert batch.
        const { reached, lastSnapshot } = await pollUntilPhase([2, 3, 4], 10_000, 500);

        if (!reached) {
            const lastPhaseLabel = lastSnapshot?.phase?.label ?? "tidak diketahui";
            const lastRaw = lastSnapshot?.phase?.rawValue ?? "N/A";

            // Pesan error: sertakan peringatan stuckRisk kalau tag START mungkin tertahan
            const stuckWarning = pulse.stuckRisk
                ? " PERINGATAN: tag START mungkin tertahan aktif di PLC — perlu dicek manual di lapangan!"
                : "";

            // Catat ke audit log meski batch tidak dibuat
            try {
                await pool.query(
                    `INSERT INTO audit_log
                        (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                    [
                        session.username,
                        session.role,
                        "start_batch_rejected",
                        "batch",
                        String(batchNo).trim(),
                        JSON.stringify({ formulaNo, lastPhase: lastPhaseLabel, lastRawPhase: lastRaw, stuckRisk: pulse.stuckRisk }),
                        "web",
                        `START dikirim tapi PLC tidak masuk fase proses dalam 10 detik. Fase terakhir: ${lastPhaseLabel} (kode ${lastRaw})${stuckWarning}`,
                    ]
                );
            } catch (auditErr) {
                console.error("[batch/start] Gagal catat audit start_batch_rejected:", auditErr.message);
            }

            return Response.json(
                {
                    ok: false,
                    error: `PLC tidak memulai proses. Periksa pintu, seal, dan input pengaman di mesin.${stuckWarning}`,
                    lastPhase: lastPhaseLabel,
                    stuckRisk: pulse.stuckRisk,
                },
                { status: 409 }
            );
        }

        // ── INSERT batch_records setelah konfirmasi PLC mulai ────────────────
        let newBatch;
        try {
            const insertResult = await pool.query(
                `INSERT INTO batch_records
                    (batch_no, loading_no, operator, machine_id, recipe_id,
                     product_name, product_spec, ctrl_type, ster_temp, cool_temp,
                     status, run_begin)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'running', now())
                 RETURNING *`,
                [
                    String(batchNo).trim(),
                    String(loadingNo).trim(),
                    operator,
                    String(machineId).trim(),
                    recipe.id,
                    String(productName).trim(),
                    String(productSpec).trim(),
                    recipe.control_type,
                    sterilTemp,   // ster_temp = setpoint sterilisasi (bukan ctrlTemp)
                    cool2Temp,    // cool_temp = cooling_temp2 sesuai printout SCADA lama
                ]
            );
            newBatch = insertResult.rows[0];
        } catch (dbErr) {
            // PLC sudah mulai jalan, tapi pencatatan database gagal — ini kritis.
            // 23505 = pelanggaran unique (nomor batch bentrok, atau one_running_batch).
            // Seharusnya tidak terjadi karena sudah dicek di awal + lock; ini jaring pengaman.
            console.error(
                "[batch/start] KRITIS: PLC sudah mulai berjalan tapi INSERT batch_records gagal!",
                dbErr.code, dbErr.constraint ?? "", dbErr.message
            );
            const isUniqueViolation = dbErr?.code === "23505";
            return Response.json(
                {
                    ok: false,
                    critical: true,
                    error: isUniqueViolation
                        ? "PLC sudah mulai berjalan, tapi nomor batch bentrok dengan catatan lain sehingga batch tidak tersimpan. Segera catat secara manual dan hubungi admin."
                        : "PLC sudah mulai berjalan, tapi batch gagal dicatat di database. Segera catat secara manual dan hubungi admin.",
                },
                { status: 500 }
            );
        }

        // Tulis audit log — actor dari session
        try {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username,
                    session.role,
                    "start_batch",
                    "batch",
                    newBatch.batch_no,
                    JSON.stringify({ batchNo: newBatch.batch_no, formulaNo, operator, machineId, productName, emptyRun }),
                    "web",
                    `Batch ${newBatch.batch_no}${emptyRun ? " (run kosongan)" : ""} dimulai oleh ${session.username} (Formula: ${formulaNo}) | Setpoint & START berhasil ditulis ke PLC, fase terkonfirmasi`,
                ]
            );
        } catch (auditErr) {
            // Audit log gagal tidak fatal — batch sudah tercatat, log saja ke console
            console.error("[batch/start] Gagal catat audit start_batch:", auditErr.message);
        }

        return Response.json(
            {
                ok: true,
                batchNo: newBatch.batch_no,
                operator: newBatch.operator,
                machineId: newBatch.machine_id,
                productName: newBatch.product_name,
                runBegin: newBatch.run_begin,
                emptyRun,
                // Peringatan kalau pulsa START tidak sempurna meski fase sudah tercapai
                ...(pulse.ok ? {} : {
                    warning: "START mungkin tertahan aktif di PLC (pulsa tidak sempurna). " +
                        "Pantau mesin dan verifikasi status tag START di KEPServerEX.",
                    stuckRisk: pulse.stuckRisk,
                }),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[POST /api/batch/start] runStart", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}