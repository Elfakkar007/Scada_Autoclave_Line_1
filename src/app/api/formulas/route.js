import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

// ── Helper: konversi row snake_case → camelCase ──────────────────────────────
function rowToFormula(row) {
    return {
        id:             row.id,
        formulaNo:      row.formula_no,
        controlTemp:    parseFloat(row.control_temp),
        spaceTemp:      parseFloat(row.space_temp),
        sterilTemp:     parseFloat(row.steril_temp),
        sterilTime:     parseInt(row.steril_time_min, 10),
        alarmPres:      parseFloat(row.alarm_pres),
        coolingTemp1:   parseFloat(row.cooling_temp1),
        coolingTemp2:   parseFloat(row.cooling_temp2),
        foValSetting:   parseFloat(row.fo_val_setting),
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
        return Response.json(result.rows.map(rowToFormula));
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

        // Validasi: semua angka harus >= 0
        const numericFields = { controlTemp, spaceTemp, sterilTemp, sterilTime, alarmPres, coolingTemp1, coolingTemp2, foValSetting };
        for (const [key, val] of Object.entries(numericFields)) {
            if (val === undefined || val === null || parseFloat(val) < 0 || isNaN(parseFloat(val))) {
                return Response.json({ ok: false, error: `Field ${key} tidak valid (harus >= 0)` }, { status: 400 });
            }
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
                parseFloat(foValSetting),
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

        return Response.json(newFormula, { status: 201 });
    } catch (error) {
        console.error("[POST /api/formulas]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
