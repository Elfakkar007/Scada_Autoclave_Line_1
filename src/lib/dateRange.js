/**
 * src/lib/dateRange.js — Helper filter rentang tanggal untuk query PostgreSQL.
 *
 * Zona waktu bisnis: Asia/Jakarta (WIB, UTC+7).
 * "from" dan "to" bersifat INKLUSIF per hari penuh.
 *
 * Pola SQL yang dihasilkan (sudah diverifikasi benar untuk WIB):
 *   kolom >= ($N::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
 *   kolom <  (($M::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
 */

// Validasi format YYYY-MM-DD
function isValidDate(str) {
    if (!str || typeof str !== "string") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(str + "T00:00:00Z");
    return !isNaN(d.getTime());
}

/**
 * Bangun potongan SQL WHERE dan array nilai untuk filter rentang tanggal.
 *
 * @param {string|null} from     - Tanggal awal "YYYY-MM-DD" (opsional)
 * @param {string|null} to       - Tanggal akhir "YYYY-MM-DD" (opsional, inklusif)
 * @param {string}      kolom    - Ekspresi kolom SQL, contoh "event_time" atau "COALESCE(run_begin, created_at)"
 * @param {number}      startIdx - Indeks parameter $N berikutnya (default 1)
 *
 * @returns {{
 *   conditions: string[],   // potongan SQL siap dimasukkan ke WHERE
 *   values:     any[],      // nilai parameter yang dikembalikan
 *   error:      string|null // pesan error bila validasi gagal (pemanggil kembalikan 400)
 * }}
 */
export function buildDateRangeFilter(from, to, kolom, startIdx = 1) {
    const conditions = [];
    const values     = [];

    const hasFrom = from && from.trim() !== "";
    const hasTo   = to   && to.trim()   !== "";

    // Validasi format
    if (hasFrom && !isValidDate(from.trim())) {
        return { conditions, values, error: `Parameter "from" tidak valid: "${from}". Gunakan format YYYY-MM-DD.` };
    }
    if (hasTo && !isValidDate(to.trim())) {
        return { conditions, values, error: `Parameter "to" tidak valid: "${to}". Gunakan format YYYY-MM-DD.` };
    }

    // Validasi from <= to
    if (hasFrom && hasTo && from.trim() > to.trim()) {
        return { conditions, values, error: `"from" (${from}) tidak boleh lebih besar dari "to" (${to}).` };
    }

    let idx = startIdx;

    if (hasFrom) {
        values.push(from.trim());
        conditions.push(
            `${kolom} >= ($${idx}::date)::timestamp AT TIME ZONE 'Asia/Jakarta'`
        );
        idx++;
    }

    if (hasTo) {
        values.push(to.trim());
        conditions.push(
            `${kolom} < (($${idx}::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')`
        );
        idx++;
    }

    return { conditions, values, error: null };
}
