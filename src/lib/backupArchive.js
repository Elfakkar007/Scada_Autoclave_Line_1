// ==============================================================================
// PERHATIAN: SERVER-ONLY (memakai pg, fs, crypto). Jangan di-import dari "use client".
//
// Membuat satu arsip .zip berisi CSV per tabel data record + manifest.json.
//   - batch_records.csv, batch_trend.csv, alarm_log.csv, audit_log.csv
//   - manifest.json: jumlah baris, rentang id, SHA-256 tiap CSV, daftar kolom, rentang tanggal.
//
// Keputusan desain:
//   * Kolom DIBACA DARI information_schema, bukan ditulis tangan. Kolom baru dari migrasi
//     berikutnya otomatis ikut terarsip, dan manifest mencatat kolom yang dipakai.
//   * Semua tabel dibaca dalam SATU transaksi REPEATABLE READ READ ONLY (potret konsisten,
//     walau batch sedang merekam trend).
//   * Baca bertahap dengan keyset (id > terakhir), tanpa batas baris dan tanpa memuat semua ke memori.
//   * Nilai ditulis sebagai teks apa adanya dari PostgreSQL (angka tidak dibulatkan). Waktu = UTC ISO-8601
//     dengan mikrodetik. NULL = kolom kosong; string kosong = "" (bertanda kutip), jadi keduanya bisa dibedakan.
//   * batch_trend diberi kolom tambahan batch_no supaya arsip tetap bermakna tanpa id internal.
// ==============================================================================

import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { Zip, ZipDeflate, Unzip, UnzipInflate } from "fflate";
import { buildDateRangeFilter } from "./dateRange.js";

export const BACKUP_FORMAT_VERSION = 1;
const PAGE_SIZE = 5000;

// alias tabel utama selalu "t"; batch_trend bergabung ke batch_records "b" untuk batch_no + filter tanggal.
export const BACKUP_TABLES = [
    {
        name: "batch_records",
        file: "batch_records.csv",
        from: "batch_records t",
        rangeExpr: "COALESCE(t.run_begin, t.created_at)",
        rangeLabel: "COALESCE(run_begin, created_at)",
        extra: [],
    },
    {
        name: "batch_trend",
        file: "batch_trend.csv",
        from: "batch_trend t JOIN batch_records b ON b.id = t.batch_id",
        rangeExpr: "COALESCE(b.run_begin, b.created_at)",
        rangeLabel: "tanggal batch induknya: COALESCE(run_begin, created_at)",
        extra: [{ sql: "b.batch_no::text", as: "batch_no", type: "text" }],
    },
    {
        name: "alarm_log",
        file: "alarm_log.csv",
        from: "alarm_log t",
        rangeExpr: "COALESCE(t.event_date, t.created_at)",
        rangeLabel: "COALESCE(event_date, created_at)",
        extra: [],
    },
    {
        name: "audit_log",
        file: "audit_log.csv",
        from: "audit_log t",
        rangeExpr: "t.event_time",
        rangeLabel: "event_time",
        extra: [],
    },
];

// ── CSV ───────────────────────────────────────────────────────────────────────

/** Satu sel CSV (RFC 4180). null -> kosong; string kosong -> "" (supaya beda dari null). */
export function csvField(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s === "") return '""';
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(values) {
    return values.map(csvField).join(",") + "\r\n";
}

// ── SQL ───────────────────────────────────────────────────────────────────────

function quoteIdent(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

/** Ekspresi SELECT satu kolom, hasilnya selalu teks yang deterministik. */
export function selectExpr(column, dataType) {
    const q = quoteIdent(column);
    if (dataType === "timestamp with time zone") {
        return `to_char(t.${q} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${q}`;
    }
    if (dataType === "timestamp without time zone") {
        return `to_char(t.${q}, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS ${q}`;
    }
    return `t.${q}::text AS ${q}`;
}

async function loadColumns(q, table) {
    const res = await q.query(
        `SELECT column_name, data_type
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position`,
        [table]
    );
    if (res.rows.length === 0) throw new Error(`Tabel "${table}" tidak ditemukan di database`);
    if (!res.rows.some((c) => c.column_name === "id")) throw new Error(`Tabel "${table}" tidak punya kolom id`);
    return res.rows.map((c) => ({ name: c.column_name, type: c.data_type }));
}

// ── Penulisan zip dengan backpressure ─────────────────────────────────────────

function openZipWriter(outPath) {
    const out = createWriteStream(outPath, { flags: "wx" });
    let failure = null;
    out.on("error", (e) => { failure = e; });
    const pending = [];
    const zip = new Zip((err, chunk) => {
        if (err) { failure = err; return; }
        pending.push(chunk);
    });

    async function flush() {
        if (failure) throw failure;
        while (pending.length > 0) {
            const c = pending.shift();
            if (!out.write(c)) await once(out, "drain");
        }
        if (failure) throw failure;
    }
    async function finish() {
        zip.end();
        await flush();
        out.end();
        await once(out, "finish");
        if (failure) throw failure;
    }
    function abort() {
        out.destroy();
    }
    return { zip, flush, finish, abort };
}

// ── Pembuatan arsip ───────────────────────────────────────────────────────────

/**
 * @param {object}  o
 * @param {{query:Function, connect?:Function}} o.db   pool pg (atau tiruan untuk tes)
 * @param {string}  o.outPath                          lokasi file .zip yang ditulis (harus belum ada)
 * @param {"manual"|"scheduled"} o.kind
 * @param {{from:string|null,to:string|null}|null} o.range  null = semua data
 * @param {string}  o.createdBy                        username atau "system"
 * @param {Date}    [o.now]
 * @returns {Promise<{manifest:object, sizeBytes:number}>}
 */
export async function createBackupArchive({ db, outPath, kind, range = null, createdBy, now = new Date() }) {
    // Validasi rentang sekali di depan (error format = Error biasa dengan code RANGE)
    if (range) {
        const chk = buildDateRangeFilter(range.from ?? "", range.to ?? "", "x", 1);
        if (chk.error) throw Object.assign(new Error(chk.error), { code: "RANGE" });
    }

    const client = typeof db.connect === "function" ? await db.connect() : null;
    const q = client ?? db;
    const writer = openZipWriter(outPath);
    let inTx = false;

    try {
        await q.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        inTx = true;

        const tables = {};
        for (const t of BACKUP_TABLES) {
            const columns = await loadColumns(q, t.name);
            const selectList = [
                ...columns.map((c) => selectExpr(c.name, c.type)),
                ...t.extra.map((e) => `${e.sql} AS ${quoteIdent(e.as)}`),
            ].join(", ");
            const header = [...columns.map((c) => c.name), ...t.extra.map((e) => e.as)];

            const rf = range
                ? buildDateRangeFilter(range.from ?? "", range.to ?? "", t.rangeExpr, 2)
                : { conditions: [], values: [], error: null };
            const extraWhere = rf.conditions.map((c) => ` AND (${c})`).join("");
            const sql = `SELECT ${selectList} FROM ${t.from} WHERE t.id > $1::bigint${extraWhere} ORDER BY t.id ASC LIMIT ${PAGE_SIZE}`;

            const hash = createHash("sha256");
            const file = new ZipDeflate(t.file, { level: 6, mtime: now });
            writer.zip.add(file);

            const push = async (text, final = false) => {
                const buf = Buffer.from(text, "utf8");
                hash.update(buf);
                file.push(buf, final);
                await writer.flush();
            };

            await push("\uFEFF" + csvLine(header)); // BOM supaya Excel membaca UTF-8 dengan benar

            let lastId = "-1";
            let rows = 0;
            let minId = null;
            let maxId = null;
            for (;;) {
                const res = await q.query(sql, [lastId, ...rf.values]);
                if (res.rows.length === 0) break;
                let text = "";
                for (const r of res.rows) {
                    text += csvLine(header.map((h) => r[h]));
                    const id = BigInt(r.id);
                    if (minId === null || id < minId) minId = id;
                    if (maxId === null || id > maxId) maxId = id;
                }
                rows += res.rows.length;
                lastId = res.rows[res.rows.length - 1].id;
                await push(text);
                if (res.rows.length < PAGE_SIZE) break;
            }
            file.push(new Uint8Array(0), true);
            await writer.flush();

            tables[t.name] = {
                file: t.file,
                rows,
                minId: minId === null ? null : minId.toString(),
                maxId: maxId === null ? null : maxId.toString(),
                sha256: hash.digest("hex"),
                columns: [...columns, ...t.extra.map((e) => ({ name: e.as, type: e.type }))],
                filter: range ? t.rangeLabel : null,
                complete: !range,
            };
        }

        await q.query("COMMIT");
        inTx = false;

        const manifest = {
            formatVersion: BACKUP_FORMAT_VERSION,
            app: "scada-sterilizer",
            kind,
            createdAt: now.toISOString(),
            createdBy,
            range: range ? { from: range.from ?? null, to: range.to ?? null, zone: "Asia/Jakarta" } : null,
            complete: !range,
            note: range
                ? "Arsip PARSIAL: dibatasi rentang tanggal. Audit log di sini TIDAK lengkap."
                : "Arsip penuh: seluruh baris keempat tabel pada saat potret diambil.",
            csv: {
                encoding: "UTF-8 dengan BOM",
                newline: "CRLF",
                timestamps: "UTC, ISO-8601 dengan mikrodetik, akhiran Z",
                null: "sel kosong tanpa tanda kutip",
                emptyString: "dua tanda kutip (\"\")",
                numbers: "teks apa adanya dari PostgreSQL (tidak dibulatkan)",
            },
            tables,
        };
        const mf = new ZipDeflate("manifest.json", { level: 6, mtime: now });
        writer.zip.add(mf);
        mf.push(Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), true);
        await writer.finish();

        const { size } = await stat(outPath);
        return { manifest, sizeBytes: size };
    } catch (err) {
        if (inTx) await q.query("ROLLBACK").catch(() => {});
        writer.abort();
        throw err;
    } finally {
        if (client) client.release();
    }
}

// ── Verifikasi ────────────────────────────────────────────────────────────────

/** SHA-256 sebuah file (untuk dicatat di audit log). */
export async function hashFile(filePath) {
    const h = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) h.update(chunk);
    return h.digest("hex");
}

/**
 * Baca ulang zip dari disk secara streaming: hitung SHA-256 tiap CSV dan cocokkan dengan manifest.
 * @returns {Promise<{ok:boolean, problems:string[], manifest:object|null}>}
 */
export async function verifyArchive(filePath) {
    const problems = [];
    const hashes = new Map();
    let manifestText = null;

    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
        const h = createHash("sha256");
        const parts = [];
        const isManifest = file.name === "manifest.json";
        file.ondata = (err, chunk, final) => {
            if (err) { problems.push(`${file.name}: ${err.message ?? err}`); return; }
            if (isManifest) parts.push(Buffer.from(chunk)); else h.update(chunk);
            if (final) {
                if (isManifest) manifestText = Buffer.concat(parts).toString("utf8");
                else hashes.set(file.name, h.digest("hex"));
            }
        };
        file.start();
    };

    try {
        for await (const chunk of createReadStream(filePath)) unzip.push(new Uint8Array(chunk), false);
        unzip.push(new Uint8Array(0), true);
    } catch (err) {
        problems.push(`Zip tidak bisa dibaca: ${err.message}`);
        return { ok: false, problems, manifest: null };
    }

    let manifest = null;
    if (manifestText === null) {
        problems.push("manifest.json tidak ditemukan di dalam zip");
    } else {
        try { manifest = JSON.parse(manifestText); } catch { problems.push("manifest.json rusak (bukan JSON)"); }
    }
    if (manifest) {
        for (const [name, info] of Object.entries(manifest.tables ?? {})) {
            const got = hashes.get(info.file);
            if (!got) problems.push(`${info.file} tidak ada di dalam zip`);
            else if (got !== info.sha256) problems.push(`${info.file}: SHA-256 tidak cocok dengan manifest (${name})`);
        }
    }
    return { ok: problems.length === 0, problems, manifest };
}
