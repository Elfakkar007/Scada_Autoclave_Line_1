/**
 * src/lib/recipeGuard.js — Penjaga integritas resep (item 6).
 *
 * SERVER-ONLY helper untuk route /api/formulas. Tidak meng-import db.js: semua
 * fungsi menerima `client` pg yang SUDAH berada di dalam transaksi (BEGIN).
 */

// Kunci advisory lock untuk alur START. WAJIB sama dengan yang dipakai
// src/app/api/batch/start/route.js (route itu meng-import konstanta ini).
export const START_LOCK_KEY = 7401001;

/**
 * true bila alur START sedang berjalan (lock eksklusif dipegang request START).
 *
 * Memakai advisory lock BERSAMA tingkat-transaksi: gagal bila START memegang lock;
 * bila berhasil, lock dipegang sampai COMMIT/ROLLBACK sehingga START tidak bisa
 * menyela di tengah edit/hapus resep (START yang kebetulan masuk saat itu mendapat
 * 409 "START lain sedang diproses" selama beberapa milidetik).
 *
 * Kenapa perlu: START membaca resep di awal tetapi baru INSERT batch_records
 * belasan detik kemudian. Tanpa ini, resep yang dihapus di jendela itu membuat
 * INSERT batch gagal (FK) padahal PLC sudah jalan.
 */
export async function isStartInProgress(client) {
    const r = await client.query("SELECT pg_try_advisory_xact_lock_shared($1) AS ok", [START_LOCK_KEY]);
    return r.rows[0]?.ok !== true;
}

/**
 * Pemakaian sebuah resep oleh batch_records.
 * @returns {Promise<{ total: number, running: number, finished: number, aborted: number, runningBatchNo: string|null }>}
 */
export async function getRecipeUsage(client, recipeId) {
    const r = await client.query(
        `SELECT status, COUNT(*)::int AS n,
                (array_agg(batch_no ORDER BY id DESC))[1] AS sample_batch_no
         FROM batch_records
         WHERE recipe_id = $1
         GROUP BY status`,
        [recipeId]
    );
    const usage = { total: 0, running: 0, finished: 0, aborted: 0, runningBatchNo: null };
    for (const row of r.rows) {
        usage.total += row.n;
        if (row.status === "running") {
            usage.running = row.n;
            usage.runningBatchNo = row.sample_batch_no;
        } else if (row.status === "finished") {
            usage.finished = row.n;
        } else if (row.status === "aborted") {
            usage.aborted = row.n;
        }
    }
    return usage;
}
