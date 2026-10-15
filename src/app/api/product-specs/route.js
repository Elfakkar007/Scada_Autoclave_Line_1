import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";

let tableInitialized = false;
async function ensureProductSpecsTable() {
    if (tableInitialized) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS product_specs (
                id SERIAL PRIMARY KEY,
                spec VARCHAR(150) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS product_specs_spec_uniq 
                ON product_specs (lower(btrim(spec)));
            CREATE INDEX IF NOT EXISTS product_specs_active_idx 
                ON product_specs (is_active);
        `);
        tableInitialized = true;
    } catch (e) {
        console.error("[ensureProductSpecsTable] Inisialisasi gagal:", e.message);
    }
}

function rowToSpec(row) {
    return {
        id: row.id,
        spec: row.spec,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ── GET /api/product-specs — Daftar Spesifikasi Kemasan ────────────────────────
export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        await ensureProductSpecsTable();

        const { searchParams } = new URL(request.url);
        const onlyActive = searchParams.get("active") === "true";

        const sql = onlyActive
            ? "SELECT * FROM product_specs WHERE is_active = true ORDER BY spec ASC"
            : "SELECT * FROM product_specs ORDER BY spec ASC";

        const result = await pool.query(sql);
        return Response.json(result.rows.map(rowToSpec));
    } catch (error) {
        console.error("[GET /api/product-specs]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── POST /api/product-specs — Tambah Spesifikasi (Admin) ───────────────────────
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        await ensureProductSpecsTable();

        const body = await request.json();
        const rawSpec = String(body.spec ?? "").trim();
        const isActive = body.isActive !== false;

        if (!rawSpec) {
            return Response.json({ ok: false, error: "Spesifikasi tidak boleh kosong" }, { status: 400 });
        }
        if (rawSpec.length > 150) {
            return Response.json({ ok: false, error: "Spesifikasi terlalu panjang (maks. 150 karakter)" }, { status: 400 });
        }

        // Cek duplikasi
        const dupCheck = await pool.query(
            "SELECT id FROM product_specs WHERE lower(btrim(spec)) = lower($1) LIMIT 1",
            [rawSpec]
        );
        if (dupCheck.rows.length > 0) {
            return Response.json(
                { ok: false, error: `Spesifikasi kemasan "${rawSpec}" sudah terdaftar` },
                { status: 409 }
            );
        }

        const insertRes = await pool.query(
            `INSERT INTO product_specs (spec, is_active, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING *`,
            [rawSpec, isActive]
        );
        const newSpec = insertRes.rows[0];

        // Audit log
        try {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username,
                    session.role,
                    "create_product_spec",
                    "product_spec",
                    String(newSpec.id),
                    JSON.stringify({ spec: newSpec.spec, isActive: newSpec.is_active }),
                    "web",
                    `Spesifikasi kemasan "${newSpec.spec}" dibuat oleh ${session.username}`,
                ]
            );
        } catch (auditErr) {
            console.error("[POST /api/product-specs] Gagal catat audit:", auditErr.message);
        }

        return Response.json({ ok: true, spec: rowToSpec(newSpec) }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/product-specs]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
