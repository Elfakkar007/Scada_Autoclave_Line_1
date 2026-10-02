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

// ── GET /api/formulas — semua role yang login boleh akses ─────────────────────
export async function GET() {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        const result = await pool.query(
            "SELECT * FROM recipes ORDER BY formula_no ASC"
        );
        // Tambahkan field validation ke setiap resep
        const formulas = result.rows.map((row) => {
            const formula = rowToFormula(row);
            const validation = validateRecipe(row); // pakai row (snake_case) langsung
            return { ...formula, validation };
        });
        return Response.json(formulas);
    } catch (error) {
        console.error("[GET /api/formulas]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// ── POST /api/formulas — KHUSUS ADMIN ─────────────────────────────────────────
export async function POST(request) {
    try {
        // ▼ PROTEKSI SERVER-SIDE: hanya admin yang boleh
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const {
            formulaNo, controlTemp, spaceTemp, sterilTemp, sterilTime,
            alarmPres, coolingTemp1, coolingTemp2, foValSetting,
            controlType, sterilMaterial,
            // "actor" dari body diabaikan — diambil dari session
        } = body;

        // Validasi: formulaNo tidak boleh kosong
        if (!formulaNo || String(formulaNo).trim() === "") {
            return Response.json({ ok: false, error: "Formula No tidak boleh kosong" }, { status: 400 });
        }

        // ── Validasi nilai resep dengan validateRecipe (strict) ─────────────────
        // Bangun object snake_case sesuai format yang diterima validateRecipe.
        // Sertakan formula_no, control_type, steril_material agar strict mode
        // bisa memeriksa field teks wajib.
        const recipeCandidate = {
            formula_no:      String(formulaNo).trim(),
            control_temp:    controlTemp,
            space_temp:      spaceTemp,
            steril_temp:     sterilTemp,
            steril_time_min: sterilTime,
            alarm_pres:      alarmPres,
            cooling_temp1:   coolingTemp1,
            cooling_temp2:   coolingTemp2,
            fo_val_setting:  foValSetting,
            control_type:    controlType,
            steril_material: sterilMaterial,
        };
        const validation = validateRecipe(recipeCandidate, { strict: true });
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

        // Validasi: cek duplikat formulaNo
        const existing = await pool.query(
            "SELECT id FROM recipes WHERE formula_no = $1",
            [String(formulaNo).trim()]
        );
        if (existing.rows.length > 0) {
            return Response.json({ ok: false, error: `Formula No "${formulaNo}" sudah digunakan` }, { status: 400 });
        }

        // INSERT formula baru
        const insertResult = await pool.query(
            `INSERT INTO recipes
                (formula_no, control_temp, space_temp, steril_temp, steril_time_min,
                 alarm_pres, cooling_temp1, cooling_temp2, fo_val_setting,
                 control_type, steril_material)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                String(formulaNo).trim(),
                parseFloat(controlTemp),
                parseFloat(spaceTemp),
                parseFloat(sterilTemp),
                parseInt(sterilTime, 10),
                parseFloat(alarmPres),
                parseFloat(coolingTemp1),
                parseFloat(coolingTemp2),
                foValSetting !== null && foValSetting !== undefined ? parseFloat(foValSetting) : null,
                controlType,
                sterilMaterial,
            ]
        );

        const newFormula = rowToFormula(insertResult.rows[0]);

        // Tulis audit log — actor dari session (tidak bisa dipalsukan)
        await pool.query(
            `INSERT INTO audit_log
                (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
            [
                session.username,
                session.role,
                "create",
                "formula",
                newFormula.formulaNo,
                JSON.stringify(newFormula),
                "web",
                `Formula ${newFormula.formulaNo} dibuat oleh ${session.username}`,
            ]
        );

        // Kembalikan formula baru + warnings kalau ada
        return Response.json(
            { ...newFormula, validation, warnings: validation.warnings },
            { status: 201 }
        );
    } catch (error) {
        console.error("[POST /api/formulas]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
