import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";

let tableInitialized = false;
async function ensureProductNamesTable() {
    if (tableInitialized) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS product_names (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS product_names_name_uniq 
                ON product_names (lower(btrim(name)));
            CREATE INDEX IF NOT EXISTS product_names_active_idx 
                ON product_names (is_active);
        `);
        tableInitialized = true;
    } catch (e) {
        console.error("[ensureProductNamesTable] Inisialisasi gagal:", e.message);
    }
}

function rowToProduct(row) {
    return {
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ── GET /api/products — Daftar Nama Produk ─────────────────────────────────────
export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        await ensureProductNamesTable();

        const { searchParams } = new URL(request.url);
        const onlyActive = searchParams.get("active") === "true";

        const sql = onlyActive
            ? "SELECT * FROM product_names WHERE is_active = true ORDER BY name ASC"
            : "SELECT * FROM product_names ORDER BY name ASC";

        const result = await pool.query(sql);
        return Response.json(result.rows.map(rowToProduct));
    } catch (error) {
        console.error("[GET /api/products]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── POST /api/products — Tambah Nama Produk (Admin) ───────────────────────────
export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        await ensureProductNamesTable();

        const body = await request.json();
        const rawName = String(body.name ?? "").trim();
        const isActive = body.isActive !== false;

        if (!rawName) {
            return Response.json({ ok: false, error: "Nama produk tidak boleh kosong" }, { status: 400 });
        }
        if (rawName.length > 150) {
            return Response.json({ ok: false, error: "Nama produk terlalu panjang (maks. 150 karakter)" }, { status: 400 });
        }

        // Cek duplikasi
        const dupCheck = await pool.query(
            "SELECT id FROM product_names WHERE lower(btrim(name)) = lower($1) LIMIT 1",
            [rawName]
        );
        if (dupCheck.rows.length > 0) {
            return Response.json(
                { ok: false, error: `Nama produk "${rawName}" sudah terdaftar` },
                { status: 409 }
            );
        }

        const insertRes = await pool.query(
            `INSERT INTO product_names (name, is_active, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING *`,
            [rawName, isActive]
        );
        const newProd = insertRes.rows[0];

        // Audit log
        try {
            await pool.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username,
                    session.role,
                    "create_product_name",
                    "product_name",
                    String(newProd.id),
                    JSON.stringify({ name: newProd.name, isActive: newProd.is_active }),
                    "web",
                    `Nama produk "${newProd.name}" dibuat oleh ${session.username}`,
                ]
            );
        } catch (auditErr) {
            console.error("[POST /api/products] Gagal catat audit:", auditErr.message);
        }

        return Response.json({ ok: true, product: rowToProduct(newProd) }, { status: 201 });
    } catch (error) {
        console.error("[POST /api/products]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
