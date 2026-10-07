import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { validateRecipe } from "@/lib/recipeValidation";
import { isStartInProgress, getRecipeUsage } from "@/lib/recipeGuard";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";
const START_BUSY_MESSAGE = "Proses START batch sedang berjalan. Coba lagi beberapa detik lagi.";

// ── Helper: konversi row snake_case → camelCase ──────────────────────────────
function rowToFormula(row) {
    return {
        id: row.id,
        formulaNo: row.formula_no,
        controlTemp: row.control_temp !== null ? parseFloat(row.control_temp) : null,
        spaceTemp: row.space_temp !== null ? parseFloat(row.space_temp) : null,
        sterilTemp: row.steril_temp !== null ? parseFloat(row.steril_temp) : null,
        sterilTime: row.steril_time_min !== null ? parseInt(row.steril_time_min, 10) : null,
        alarmPres: row.alarm_pres !== null ? parseFloat(row.alarm_pres) : null,
        coolingTemp1: row.cooling_temp1 !== null ? parseFloat(row.cooling_temp1) : null,
        coolingTemp2: row.cooling_temp2 !== null ? parseFloat(row.cooling_temp2) : null,
        foValSetting: row.fo_val_setting !== null ? parseFloat(row.fo_val_setting) : null,
        controlType: row.control_type,
        sterilMaterial: row.steril_material,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ── GET /api/formulas/[formulaNo] — semua role yang login boleh akses ─────────
export async function GET(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        const { formulaNo: rawNo } = await params;
        const formulaNo = decodeURIComponent(rawNo);

        const result = await pool.query(
            "SELECT * FROM recipes WHERE formula_no = $1",
            [formulaNo]
        );
        if (result.rows.length === 0) {
            return Response.json(
                { ok: false, error: `Formula "${formulaNo}" tidak ditemukan` },
                { status: 404 }
            );
        }
        const row = result.rows[0];
        const formula = rowToFormula(row);
        const validation = validateRecipe(row);
        return Response.json({ ...formula, validation });
    } catch (error) {
        console.error("[GET /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── PUT /api/formulas/[formulaNo] — KHUSUS ADMIN ──────────────────────────────
export async function PUT(request, { params }) {
    try {
        // ▼ PROTEKSI SERVER-SIDE: hanya admin yang boleh
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { formulaNo: rawNo } = await params;
        const formulaNo = decodeURIComponent(rawNo);
        const body = await request.json();
        const {
            controlTemp, spaceTemp, sterilTemp, sterilTime,
            alarmPres, coolingTemp1, coolingTemp2, foValSetting,
            controlType, sterilMaterial,
            // "actor" dari body diabaikan
        } = body;

        // ── Seluruh alur PUT dalam SATU transaksi (item 6) ────────────────────────
        // Baca (kunci baris) → cek pemakaian → validasi → UPDATE → audit → COMMIT.
        // Audit gagal → UPDATE ikut batal.
        const client = await pool.connect();
        const reject = async (response) => {
            await client.query("ROLLBACK");
            return response;
        };
        try {
            await client.query("BEGIN");

            // START sedang berjalan → tolak (lihat recipeGuard.js)
            if (await isStartInProgress(client)) {
                return await reject(Response.json({ ok: false, error: START_BUSY_MESSAGE }, { status: 409 }));
            }

            // Ambil data lama + kunci baris (untuk old_value di audit log)
            const oldResult = await client.query(
                "SELECT * FROM recipes WHERE formula_no = $1 FOR UPDATE",
                [formulaNo]
            );
            if (oldResult.rows.length === 0) {
                return await reject(Response.json({ ok: false, error: `Formula "${formulaNo}" tidak ditemukan` }, { status: 404 }));
            }
            const oldRow = oldResult.rows[0];
            const oldFormula = rowToFormula(oldRow);

            // Blokir edit bila resep dipakai batch yang sedang berjalan.
            // Batch selesai/dibatalkan tidak terpengaruh: nilainya sudah ada di recipe_snapshot.
            const usage = await getRecipeUsage(client, oldRow.id);
            if (usage.running > 0) {
                return await reject(Response.json(
                    {
                        ok: false,
                        code: "recipe_in_use_running",
                        error: `Formula "${formulaNo}" tidak bisa diubah: sedang dipakai batch "${usage.runningBatchNo}" yang masih berjalan. ` +
                            `Tunggu batch selesai atau tekan STOP dulu.`,
                    },
                    { status: 409 }
                ));
            }

            // ── Validasi: gabungan data lama + perubahan dari body (strict) ───────────
            // Kalau body tidak mengirim suatu field, gunakan nilai lama dari DB.
            // Sertakan formula_no, control_type, steril_material agar strict mode
            // bisa memeriksa field teks wajib.
            const recipeCandidate = {
                formula_no: formulaNo, // tidak boleh berubah, gunakan dari URL
                control_temp: controlTemp !== undefined ? controlTemp : oldRow.control_temp,
                space_temp: spaceTemp !== undefined ? spaceTemp : oldRow.space_temp,
                steril_temp: sterilTemp !== undefined ? sterilTemp : oldRow.steril_temp,
                steril_time_min: sterilTime !== undefined ? sterilTime : oldRow.steril_time_min,
                alarm_pres: alarmPres !== undefined ? alarmPres : oldRow.alarm_pres,
                cooling_temp1: coolingTemp1 !== undefined ? coolingTemp1 : oldRow.cooling_temp1,
                cooling_temp2: coolingTemp2 !== undefined ? coolingTemp2 : oldRow.cooling_temp2,
                fo_val_setting: foValSetting !== undefined ? foValSetting : oldRow.fo_val_setting,
                control_type: controlType !== undefined ? controlType : oldRow.control_type,
                steril_material: sterilMaterial !== undefined ? sterilMaterial : oldRow.steril_material,
            };

            const validation = validateRecipe(recipeCandidate, { strict: true });
            if (!validation.ok) {
                return await reject(Response.json(
                    {
                        ok: false,
                        error: "Resep tidak valid: " + validation.problems.map((p) => p.message).join("; "),
                        invalidFields: validation.problems,
                    },
                    { status: 400 }
                ));
            }

            // UPDATE recipes
            const updateResult = await client.query(
                `UPDATE recipes
                 SET control_temp = $1, space_temp = $2, steril_temp = $3,
                     steril_time_min = $4, alarm_pres = $5, cooling_temp1 = $6,
                     cooling_temp2 = $7, fo_val_setting = $8, control_type = $9,
                     steril_material = $10, updated_at = now()
                 WHERE formula_no = $11
                 RETURNING *`,
                [
                    parseFloat(recipeCandidate.control_temp),
                    parseFloat(recipeCandidate.space_temp),
                    parseFloat(recipeCandidate.steril_temp),
                    parseInt(recipeCandidate.steril_time_min, 10),
                    parseFloat(recipeCandidate.alarm_pres),
                    parseFloat(recipeCandidate.cooling_temp1),
                    parseFloat(recipeCandidate.cooling_temp2),
                    recipeCandidate.fo_val_setting !== null && recipeCandidate.fo_val_setting !== undefined
                        ? parseFloat(recipeCandidate.fo_val_setting)
                        : null,
                    recipeCandidate.control_type,
                    recipeCandidate.steril_material,
                    formulaNo,
                ]
            );

            const updatedFormula = rowToFormula(updateResult.rows[0]);

            // Buat deskripsi perubahan yang meaningful
            const changes = [];
            if (oldFormula.sterilTime !== updatedFormula.sterilTime)
                changes.push(`steril_time_min dari ${oldFormula.sterilTime} menjadi ${updatedFormula.sterilTime}`);
            if (oldFormula.sterilTemp !== updatedFormula.sterilTemp)
                changes.push(`steril_temp dari ${oldFormula.sterilTemp} menjadi ${updatedFormula.sterilTemp}`);
            if (oldFormula.controlTemp !== updatedFormula.controlTemp)
                changes.push(`control_temp dari ${oldFormula.controlTemp} menjadi ${updatedFormula.controlTemp}`);
            const description = changes.length > 0
                ? `Formula ${formulaNo} diubah oleh ${session.username}: ${changes.join("; ")}`
                : `Formula ${formulaNo} diperbarui oleh ${session.username}`;

            // Audit log — actor dari session, SATU transaksi dengan UPDATE
            await client.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, old_value, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
                [
                    session.username,
                    session.role,
                    "update",
                    "formula",
                    formulaNo,
                    JSON.stringify(oldFormula),
                    JSON.stringify(updatedFormula),
                    "web",
                    description,
                ]
            );

            await client.query("COMMIT");

            // Kembalikan formula yang diperbarui + validasi + warnings
            const updatedValidation = validateRecipe(updateResult.rows[0]);
            return Response.json({ ...updatedFormula, validation: updatedValidation, warnings: updatedValidation.warnings });
        } catch (txErr) {
            try { await client.query("ROLLBACK"); } catch (_) { /* abaikan error rollback */ }
            throw txErr; // ditangkap catch luar → 500 generik
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("[PUT /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── DELETE /api/formulas/[formulaNo] — KHUSUS ADMIN ──────────────────────────
export async function DELETE(request, { params }) {
    try {
        // ▼ PROTEKSI SERVER-SIDE: hanya admin yang boleh
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { formulaNo: rawNo } = await params;
        const formulaNo = decodeURIComponent(rawNo);

        // ── Seluruh alur DELETE dalam SATU transaksi (item 6) ─────────────────────
        const client = await pool.connect();
        const reject = async (response) => {
            await client.query("ROLLBACK");
            return response;
        };
        try {
            await client.query("BEGIN");

            // START sedang berjalan → tolak. Tanpa ini, resep yang dihapus selagi START
            // menunggu PLC membuat INSERT batch_records gagal (FK) padahal mesin sudah jalan.
            if (await isStartInProgress(client)) {
                return await reject(Response.json({ ok: false, error: START_BUSY_MESSAGE }, { status: 409 }));
            }

            // Ambil data lama + kunci baris (untuk old_value di audit log)
            const oldResult = await client.query(
                "SELECT * FROM recipes WHERE formula_no = $1 FOR UPDATE",
                [formulaNo]
            );
            if (oldResult.rows.length === 0) {
                return await reject(Response.json({ ok: false, error: `Formula "${formulaNo}" tidak ditemukan` }, { status: 404 }));
            }
            const oldRow = oldResult.rows[0];
            const oldFormula = rowToFormula(oldRow);

            // Resep yang pernah dipakai batch (status apa pun) tidak boleh dihapus:
            // batch_records.recipe_id punya FK ke recipes(id). Dicek di sini supaya
            // pesannya ramah (409), bukan error FK mentah (500).
            const usage = await getRecipeUsage(client, oldRow.id);
            if (usage.total > 0) {
                const parts = [];
                if (usage.running > 0) parts.push(`${usage.running} berjalan`);
                if (usage.finished > 0) parts.push(`${usage.finished} selesai`);
                if (usage.aborted > 0) parts.push(`${usage.aborted} dibatalkan`);
                return await reject(Response.json(
                    {
                        ok: false,
                        code: usage.running > 0 ? "recipe_in_use_running" : "recipe_in_use",
                        error: `Formula "${formulaNo}" tidak bisa dihapus: sudah dipakai ${usage.total} batch (${parts.join(", ")}). ` +
                            `Resep yang pernah dipakai dipertahankan agar riwayat batch tetap bisa ditelusuri.`,
                    },
                    { status: 409 }
                ));
            }

            // Hapus dari recipes
            await client.query("DELETE FROM recipes WHERE formula_no = $1", [formulaNo]);

            // Audit log — actor dari session, SATU transaksi dengan DELETE
            await client.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, old_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username,
                    session.role,
                    "delete",
                    "formula",
                    formulaNo,
                    JSON.stringify(oldFormula),
                    "web",
                    `Formula ${formulaNo} dihapus oleh ${session.username}`,
                ]
            );

            await client.query("COMMIT");
            return Response.json({ ok: true });
        } catch (txErr) {
            try { await client.query("ROLLBACK"); } catch (_) { /* abaikan error rollback */ }
            // Jaring pengaman: 23503 = pelanggaran FK (ada batch yang menunjuk resep ini
            // yang lolos dari pengecekan di atas). Tetap balas 409 yang ramah.
            if (txErr?.code === "23503") {
                return Response.json(
                    {
                        ok: false,
                        code: "recipe_in_use",
                        error: `Formula "${formulaNo}" tidak bisa dihapus karena masih dipakai data batch.`,
                    },
                    { status: 409 }
                );
            }
            throw txErr; // ditangkap catch luar → 500 generik
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("[DELETE /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}