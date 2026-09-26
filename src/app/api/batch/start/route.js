import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readPlcSnapshot } from "@/lib/plc";
import { writePlcTags } from "@/lib/plcWrite";

export async function POST(request) {
    try {
        // ▼ PROTEKSI SERVER-SIDE: wajib login (admin atau operator boleh)
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const {
            batchNo, loadingNo, machineId,
            productName, productSpec, formulaNo,
            // "operator" dan "actor" dari body DIABAIKAN — diambil dari session
        } = body;

        // Operator diambil dari session (tidak bisa dipalsukan)
        const operator = session.fullName ?? session.username;

        // Validasi: semua field wajib tidak boleh kosong
        const required = { batchNo, loadingNo, machineId, productName, productSpec, formulaNo };
        for (const [key, val] of Object.entries(required)) {
            if (!val || String(val).trim() === "") {
                return Response.json({ ok: false, error: `Field ${key} tidak boleh kosong` }, { status: 400 });
            }
        }

        // Validasi: formulaNo harus ada di tabel recipes
        // Query lengkap semua kolom yang dibutuhkan untuk validasi DAN penulisan setpoint ke PLC
        const recipeResult = await pool.query(
            `SELECT id, control_temp, cooling_temp1, cooling_temp2, control_type,
                    space_temp, steril_temp, steril_time_min, alarm_pres
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

        // ── Cek koneksi PLC & status pintu ───────────────────────────────────────
        // PERINGATAN: Fitur ini akan menulis ke PLC sungguhan. Pastikan kondisi mesin
        // sudah siap sebelum melanjutkan.
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

        // Cek status pintu dari snapshot.door.
        // opnFrnt = true artinya pintu DEPAN TERBUKA, opnRear = true artinya pintu BELAKANG TERBUKA.
        // Proses hanya bisa dimulai kalau kedua pintu TERTUTUP.
        const frontOpen = snapshot.door?.opnFrnt ?? false;
        const rearOpen  = snapshot.door?.opnRear ?? false;

        if (frontOpen || rearOpen) {
            const pintus = [
                frontOpen ? "pintu depan" : null,
                rearOpen  ? "pintu belakang" : null,
            ].filter(Boolean).join(" dan ");
            return Response.json(
                {
                    ok: false,
                    error: `${pintus.charAt(0).toUpperCase() + pintus.slice(1)} belum tertutup, proses tidak bisa dimulai`,
                },
                { status: 400 }
            );
        }

        // ── Tulis setpoint resep ke PLC ───────────────────────────────────────────
        // PERINGATAN: Scaling x10 untuk tag suhu BELUM 100% terverifikasi ke ladder
        // logic PLC asli. Awasi mesin secara langsung saat menggunakan fitur ini.
        // ALRM_PRES: scaling tekanan belum jelas — ditulis apa adanya sampai ada konfirmasi.
        const setpointPairs = [
            { tag: "CTRL_TEMP",     value: Math.round((recipe.control_temp  ?? 0) * 10) },
            { tag: "TEMP_SPACE",    value: Math.round((recipe.space_temp    ?? 0) * 10) },
            { tag: "STER_SET",      value: Math.round((recipe.steril_temp   ?? 0) * 10) },
            { tag: "STER_SET_TIME", value: recipe.steril_time_min ?? 0 },  // TIDAK dikali 10, satuan menit (terkonfirmasi)
            { tag: "ALRM_PRES",     value: recipe.alarm_pres ?? 0 },       // TIDAK dikali 10, scaling belum jelas
            { tag: "COOL1_TEMP",    value: Math.round((recipe.cooling_temp1 ?? 0) * 10) },
            { tag: "COOL2_TEMP",    value: Math.round((recipe.cooling_temp2 ?? 0) * 10) },
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

        // ── Kirim perintah START ke PLC ───────────────────────────────────────────
        const writeStartResult = await writePlcTags([{ tag: "START", value: true }]);
        if (!writeStartResult.ok) {
            console.error("[batch/start] Gagal kirim START ke PLC:", writeStartResult.results);
            return Response.json(
                {
                    ok: false,
                    error: "Parameter berhasil ditulis, tapi gagal mengirim perintah START ke PLC",
                    details: writeStartResult.results.filter((r) => !r.success),
                },
                { status: 502 }
            );
        }

        // ── INSERT batch_records baru (logic existing, tidak diubah) ─────────────
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
                operator,                           // dari session
                String(machineId).trim(),
                recipe.id,
                String(productName).trim(),
                String(productSpec).trim(),
                recipe.control_type,
                parseFloat(recipe.control_temp),
                parseFloat(recipe.cooling_temp1),
            ]
        );

        const newBatch = insertResult.rows[0];

        // Tulis audit log — actor dari session
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
                JSON.stringify({ batchNo: newBatch.batch_no, formulaNo, operator, machineId, productName }),
                "web",
                `Batch ${newBatch.batch_no} dimulai oleh ${session.username} (Formula: ${formulaNo}) | Setpoint & START berhasil ditulis ke PLC`,
            ]
        );

        return Response.json(
            {
                ok: true,
                batchNo: newBatch.batch_no,
                operator: newBatch.operator,
                machineId: newBatch.machine_id,
                productName: newBatch.product_name,
                runBegin: newBatch.run_begin,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[POST /api/batch/start]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
