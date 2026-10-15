import { cookies } from "next/headers";
import pool from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth";

const GENERIC_SERVER_ERROR = "Terjadi kesalahan di server. Hubungi admin.";

function rowToSpec(row) {
    return {
        id: row.id,
        spec: row.spec,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ── GET /api/product-specs/[id] ───────────────────────────────────────────────
export async function GET(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { errorResponse } = await requireAuth(cookieStore);
        if (errorResponse) return errorResponse;

        const { id: rawId } = await params;
        const id = parseInt(rawId, 10);
        if (Number.isNaN(id)) {
            return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
        }

        const res = await pool.query("SELECT * FROM product_specs WHERE id = $1", [id]);
        if (res.rows.length === 0) {
            return Response.json({ ok: false, error: "Spesifikasi tidak ditemukan" }, { status: 404 });
        }
        return Response.json(rowToSpec(res.rows[0]));
    } catch (error) {
        console.error("[GET /api/product-specs/[id]]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── PUT /api/product-specs/[id] — Edit / Toggle Aktif (Admin) ──────────────────
export async function PUT(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { id: rawId } = await params;
        const id = parseInt(rawId, 10);
        if (Number.isNaN(id)) {
            return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
        }

        const body = await request.json();
        const rawSpec = String(body.spec ?? "").trim();
        const isActive = body.isActive !== false;

        if (!rawSpec) {
            return Response.json({ ok: false, error: "Spesifikasi tidak boleh kosong" }, { status: 400 });
        }
        if (rawSpec.length > 150) {
            return Response.json({ ok: false, error: "Spesifikasi terlalu panjang (maks. 150 karakter)" }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const oldRes = await client.query("SELECT * FROM product_specs WHERE id = $1 FOR UPDATE", [id]);
            if (oldRes.rows.length === 0) {
                await client.query("ROLLBACK");
                return Response.json({ ok: false, error: "Spesifikasi tidak ditemukan" }, { status: 404 });
            }
            const oldRow = oldRes.rows[0];

            // Cek duplikasi
            const dupCheck = await client.query(
                "SELECT id FROM product_specs WHERE lower(btrim(spec)) = lower($1) AND id != $2 LIMIT 1",
                [rawSpec, id]
            );
            if (dupCheck.rows.length > 0) {
                await client.query("ROLLBACK");
                return Response.json(
                    { ok: false, error: `Spesifikasi kemasan "${rawSpec}" sudah digunakan` },
                    { status: 409 }
                );
            }

            const updateRes = await client.query(
                `UPDATE product_specs 
                 SET spec = $1, is_active = $2, updated_at = NOW()
                 WHERE id = $3
                 RETURNING *`,
                [rawSpec, isActive, id]
            );
            const updated = updateRes.rows[0];

            // Audit log
            await client.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, old_value, new_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
                [
                    session.username,
                    session.role,
                    "update_product_spec",
                    "product_spec",
                    String(id),
                    JSON.stringify({ spec: oldRow.spec, isActive: oldRow.is_active }),
                    JSON.stringify({ spec: updated.spec, isActive: updated.is_active }),
                    "web",
                    `Spesifikasi kemasan "${updated.spec}" diubah oleh ${session.username}${
                        oldRow.is_active !== updated.is_active ? ` [status aktif: ${updated.is_active}]` : ""
                    }`,
                ]
            );

            await client.query("COMMIT");
            return Response.json({ ok: true, spec: rowToSpec(updated) });
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("[PUT /api/product-specs/[id]]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}

// ── DELETE /api/product-specs/[id] — Hapus Spesifikasi (Admin) ─────────────────
export async function DELETE(request, { params }) {
    try {
        const cookieStore = await cookies();
        const { session, errorResponse } = await requireAdmin(cookieStore);
        if (errorResponse) return errorResponse;

        const { id: rawId } = await params;
        const id = parseInt(rawId, 10);
        if (Number.isNaN(id)) {
            return Response.json({ ok: false, error: "ID tidak valid" }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const check = await client.query("SELECT * FROM product_specs WHERE id = $1 FOR UPDATE", [id]);
            if (check.rows.length === 0) {
                await client.query("ROLLBACK");
                return Response.json({ ok: false, error: "Spesifikasi tidak ditemukan" }, { status: 404 });
            }
            const target = check.rows[0];

            await client.query("DELETE FROM product_specs WHERE id = $1", [id]);

            // Audit log
            await client.query(
                `INSERT INTO audit_log
                    (actor, actor_role, action, entity_type, entity_id, old_value, source, description)
                 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
                [
                    session.username,
                    session.role,
                    "delete_product_spec",
                    "product_spec",
                    String(id),
                    JSON.stringify({ spec: target.spec, isActive: target.is_active }),
                    "web",
                    `Spesifikasi kemasan "${target.spec}" dihapus oleh ${session.username}`,
                ]
            );

            await client.query("COMMIT");
            return Response.json({ ok: true });
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("[DELETE /api/product-specs/[id]]", error);
        return Response.json({ ok: false, error: GENERIC_SERVER_ERROR }, { status: 500 });
    }
}
