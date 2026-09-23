import pool from "@/lib/db";

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            batchNo, loadingNo, operator, machineId,
            productName, productSpec, formulaNo,
            actor = "unknown",
        } = body;

        // Validasi: semua field wajib tidak boleh kosong
        const required = { batchNo, loadingNo, operator, machineId, productName, productSpec, formulaNo };
        for (const [key, val] of Object.entries(required)) {
            if (!val || String(val).trim() === "") {
                return Response.json({ ok: false, error: `Field ${key} tidak boleh kosong` }, { status: 400 });
            }
        }

        // Validasi: formulaNo harus ada di tabel recipes
        const recipeResult = await pool.query(
            `SELECT id, control_temp, cooling_temp1, control_type
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

        // INSERT batch_records baru
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
                String(operator).trim(),
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

        // Tulis audit log
        await pool.query(
            `INSERT INTO audit_log
                (actor, action, entity_type, entity_id, new_value, source, description)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
            [
                actor, "start_batch", "batch", newBatch.batch_no,
                JSON.stringify({ batchNo: newBatch.batch_no, formulaNo, operator, machineId, productName }),
                "web",
                `Batch ${newBatch.batch_no} dimulai oleh ${operator} (Formula: ${formulaNo})`,
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
