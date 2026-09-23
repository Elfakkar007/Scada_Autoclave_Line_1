import pool from "@/lib/db";

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

// ── PUT /api/formulas/[formulaNo] ─────────────────────────────────────────────
export async function PUT(request, { params }) {
    try {
        const { formulaNo: rawNo } = await params;
        const formulaNo = decodeURIComponent(rawNo);
        const body = await request.json();
        const {
            controlTemp, spaceTemp, sterilTemp, sterilTime,
            alarmPres, coolingTemp1, coolingTemp2, foValSetting,
            controlType, sterilMaterial, actor = "unknown",
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

        // Validasi semua angka >= 0
        const numericFields = { controlTemp, spaceTemp, sterilTemp, sterilTime, alarmPres, coolingTemp1, coolingTemp2, foValSetting };
        for (const [key, val] of Object.entries(numericFields)) {
            if (val === undefined || val === null || parseFloat(val) < 0 || isNaN(parseFloat(val))) {
                return Response.json({ ok: false, error: `Field ${key} tidak valid (harus >= 0)` }, { status: 400 });
            }
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
            ? `Formula ${formulaNo} diubah: ${changes.join("; ")}`
            : `Formula ${formulaNo} diperbarui`;

        // Tulis audit log
        await pool.query(
            `INSERT INTO audit_log
                (actor, action, entity_type, entity_id, old_value, new_value, source, description)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
            [
                actor, "update", "formula", formulaNo,
                JSON.stringify(oldFormula),
                JSON.stringify(updatedFormula),
                "web",
                description,
            ]
        );

        return Response.json(updatedFormula);
    } catch (error) {
        console.error("[PUT /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// ── DELETE /api/formulas/[formulaNo] ──────────────────────────────────────────
export async function DELETE(request, { params }) {
    try {
        const { formulaNo: rawNo } = await params;
        const formulaNo = decodeURIComponent(rawNo);
        const body = await request.json().catch(() => ({}));
        const actor = body.actor ?? "unknown";

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

        // Tulis audit log
        await pool.query(
            `INSERT INTO audit_log
                (actor, action, entity_type, entity_id, old_value, source, description)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [
                actor, "delete", "formula", formulaNo,
                JSON.stringify(oldFormula),
                "web",
                `Formula ${formulaNo} dihapus`,
            ]
        );

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[DELETE /api/formulas/[formulaNo]]", error);
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
}
