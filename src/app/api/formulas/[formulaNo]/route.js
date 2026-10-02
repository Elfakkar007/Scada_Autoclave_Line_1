import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { validateRecipe } from "@/lib/recipeValidation";

// ── Helper: konversi row snake_case → camelCase ──────────────────────────────
function rowToFormula(row) {
    return {
        id:             row.id,
        formulaNo:      row.formula_no,
        controlTemp:    row.control_temp    !== null ? parseFloat(row.control_temp)    : null,
        spaceTemp:      row.space_temp      !== null ? parseFloat(row.space_temp)      : null,
        sterilTemp:     row.steril_temp     !== null ? parseFloat(row.steril_temp)     : null,
        sterilTime:     row.steril_time_min !== null ? parseInt(row.steril_time_min, 10) : null,
        alarmPres:      row.alarm_pres      !== null ? parseFloat(row.alarm_pres)      : null,
        coolingTemp1:   row.cooling_temp1   !== null ? parseFloat(row.cooling_temp1)   : null,
        coolingTemp2:   row.cooling_temp2   !== null ? parseFloat(row.cooling_temp2)   : null,
        foValSetting:   row.fo_val_setting  !== null ? parseFloat(row.fo_val_setting)  : null,
        controlType:    row.control_type,
        sterilMaterial: row.steril_material,
        createdAt:      row.created_at,
        updatedAt:      row.updated_at,
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
        return Response.json({ ok: false, error: error.message }, { status: 500 });
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

        // Ambil data lama (untuk old_value di audit log)
        const oldResult = await pool.query(
            "SELECT * FROM recipes WHERE formula_no = $1",
            [formulaNo]
        );
        if (oldResult.rows.length === 0) {
            return Response.json({ ok: false, error: `Formula "${formulaNo}" tidak ditemukan` }, { status: 404 });
        }
        const oldFormula = rowToFormula(oldResult.rows[0]);

        // ── Validasi: gabungan data lama + perubahan dari body ─────────────────
        // Kalau body tidak mengirim suatu field, gunakan nilai lama dari DB.
        const recipeCandidate = {
            control_temp:    controlTemp    !== undefined ? controlTemp    : oldResult.rows[0].control_temp,
            space_temp:      spaceTemp      !== undefined ? spaceTemp      : oldResult.rows[0].space_temp,
            steril_temp:     sterilTemp     !== undefined ? sterilTemp     : oldResult.rows[0].steril_temp,
            steril_time_min: sterilTime     !== undefined ? sterilTime     : oldResult.rows[0].steril_time_min,
            alarm_pres:      alarmPres      !== undefined ? alarmPres      : oldResult.rows[0].alarm_pres,
            cooling_temp1:   coolingTemp1   !== undefined ? coolingTemp1   : oldResult.rows[0].cooling_temp1,
            cooling_temp2:   coolingTemp2   !== undefined ? coolingTemp2   : oldResult.rows[0].cooling_temp2,
            fo_val_setting:  foValSetting   !== undefined ? foValSetting   : oldResult.rows[0].fo_val_setting,
        };

        const validation = validateRecipe(recipeCandidate);
        if (!validation.ok) {
            return Response.json(
                {
                    ok: false,
                    error: "Resep tidak valid: " + validation.problems.map((p) => p.message).join("; "),
                    invalidFields: validation.problems,
                },
                { status: 400 }
            );
        }

        // UPDATE recipes
        const updateResult = await pool.query(
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
                controlType   ?? oldResult.rows[0].control_type,
                sterilMaterial ?? oldResult.rows[0].steril_material,
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

        // Tulis audit log — actor dari session
        await pool.query(
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

        // Kembalikan formula yang diperbarui + validasi + warnings
        const updatedValidation = validateRecipe(updateResult.rows[0]);
        return Response.json({ ...updatedFormula, validation: updatedValidation, warnings: updatedValidation.warnings });
    } catch (error) {
        console.error("[PUT /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
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

        // Ambil data lama (untuk old_value di audit log)
        const oldResult = await pool.query(
            "SELECT * FROM recipes WHERE formula_no = $1",
            [formulaNo]
        );
        if (oldResult.rows.length === 0) {
            return Response.json({ ok: false, error: `Formula "${formulaNo}" tidak ditemukan` }, { status: 404 });
        }
        const oldFormula = rowToFormula(oldResult.rows[0]);

        // Hapus dari recipes
        await pool.query(
            "DELETE FROM recipes WHERE formula_no = $1",
            [formulaNo]
        );

        // Tulis audit log — actor dari session
        await pool.query(
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

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[DELETE /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
