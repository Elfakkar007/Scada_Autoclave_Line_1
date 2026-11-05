// Jalankan: node src/lib/backup.test.mjs   (tanpa DB; query SQL sungguhan dicek oleh fase1/tests/backup_check.mjs)
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync, unzipSync, strToU8 } from "fflate";
import {
    INTERVAL_OPTIONS, normalizeSettings, validateSettingsInput, parseRange, computeNextDue, isDue,
    pickOldest, stampWIB, scheduledFileName, manualFileName, SCHEDULED_RE, MANUAL_RE, RETRY_AFTER_FAIL_MS,
} from "./backupSchedule.js";
import { csvField, csvLine, selectExpr, createBackupArchive, verifyArchive } from "./backupArchive.js";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error("GAGAL:", msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: dapat ${JSON.stringify(a)}, harapan ${JSON.stringify(b)}`);

// ── CSV ──
eq(csvField(null), "", "null -> kosong");
eq(csvField(undefined), "", "undefined -> kosong");
eq(csvField(""), '""', "string kosong -> \"\" (beda dari null)");
eq(csvField("abc"), "abc", "teks biasa");
eq(csvField(12.5), "12.5", "angka");
eq(csvField("a,b"), '"a,b"', "koma");
eq(csvField('Infus "NaCl"'), '"Infus ""NaCl"""', "kutip digandakan");
eq(csvField("baris1\nbaris2"), '"baris1\nbaris2"', "baris baru dikutip");
eq(csvField("a\r\nb"), '"a\r\nb"', "CRLF dikutip");
eq(csvLine(["a", null, ""]), 'a,,""\r\n', "baris CSV berakhir CRLF");

// ── SQL pembentuk kolom ──
ok(selectExpr("ts", "timestamp with time zone").includes("AT TIME ZONE 'UTC'"), "timestamptz dikonversi ke UTC");
ok(selectExpr("x", "numeric").includes('::text'), "numeric dibaca sebagai teks");
ok(selectExpr('a"b', "text").includes('"a""b"'), "nama kolom di-quote aman");

// ── Pengaturan ──
const n0 = normalizeSettings(null);
eq([n0.enabled, n0.interval, n0.timeOfDay, n0.generations], [false, "weekly", "02:00", 3], "default saat file kosong/rusak");
const n1 = normalizeSettings({ enabled: "ya", interval: "x", timeOfDay: "99:99", generations: 99, lastScheduledAt: "bukan-tanggal" });
eq([n1.enabled, n1.interval, n1.timeOfDay, n1.generations, n1.lastScheduledAt], [false, "weekly", "02:00", 10, null], "nilai aneh dibersihkan");
eq(normalizeSettings({ generations: 0 }).generations, 1, "generasi minimal 1");

const good = { enabled: true, interval: "daily", timeOfDay: "23:59", generations: 3 };
ok(validateSettingsInput(good).value, "input sah diterima");
ok(validateSettingsInput({ ...good, enabled: "true" }).error, "enabled harus boolean");
ok(validateSettingsInput({ ...good, interval: "yearly" }).error, "interval asing ditolak");
ok(validateSettingsInput({ ...good, timeOfDay: "24:00" }).error, "jam 24:00 ditolak");
ok(validateSettingsInput({ ...good, timeOfDay: "2:00" }).error, "jam tanpa nol depan ditolak");
ok(validateSettingsInput({ ...good, generations: 0 }).error, "generasi 0 ditolak");
ok(validateSettingsInput({ ...good, generations: 11 }).error, "generasi 11 ditolak");
ok(validateSettingsInput({ ...good, generations: 2.5 }).error, "generasi pecahan ditolak");
ok(validateSettingsInput(null).error, "null ditolak");

// ── Rentang ──
eq(parseRange("", ""), { range: null, error: null }, "kosong = semua data");
eq(parseRange(undefined, undefined).range, null, "undefined = semua data");
eq(parseRange("2026-10-01", "").range, { from: "2026-10-01", to: null }, "hanya from");
eq(parseRange("", "2026-10-31").range, { from: null, to: "2026-10-31" }, "hanya to");
ok(parseRange("01-10-2026", "").error, "format salah ditolak");
ok(parseRange("2026-11-02", "2026-11-01").error, "from > to ditolak");
ok(parseRange("2026-02-31", "").error === null || parseRange("2026-02-31", "").error, "tanggal mustahil ditangani (tidak melempar)");

// ── Jadwal (jam lokal, sama seperti kode) ──
const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm, 0, 0);
const base = { ...normalizeSettings(null), enabled: true, interval: "daily", timeOfDay: "02:00" };
eq(computeNextDue({ ...base, enabled: false }), null, "nonaktif = tidak ada jadwal");
eq(computeNextDue({ ...base, enabledAt: at(2026, 11, 3, 1, 0).toISOString() }).getTime(), at(2026, 11, 3, 2, 0).getTime(), "dinyalakan 01:00 -> hari yang sama 02:00");
eq(computeNextDue({ ...base, enabledAt: at(2026, 11, 3, 3, 0).toISOString() }).getTime(), at(2026, 11, 4, 2, 0).getTime(), "dinyalakan 03:00 -> besok 02:00");
eq(computeNextDue({ ...base, lastScheduledAt: at(2026, 11, 3, 2, 0).toISOString() }).getTime(), at(2026, 11, 4, 2, 0).getTime(), "harian: +1 hari");
eq(computeNextDue({ ...base, interval: "weekly", lastScheduledAt: at(2026, 11, 3, 2, 0).toISOString() }).getTime(), at(2026, 11, 10, 2, 0).getTime(), "mingguan: +7 hari");
eq(computeNextDue({ ...base, interval: "monthly", lastScheduledAt: at(2026, 11, 3, 2, 0).toISOString() }).getTime(), at(2026, 12, 3, 2, 0).getTime(), "30 hari");
eq(computeNextDue({ ...base, timeOfDay: "14:30", lastScheduledAt: at(2026, 11, 3, 2, 0).toISOString() }).getTime(), at(2026, 11, 4, 14, 30).getTime(), "jam diubah ikut berlaku");

const s1 = { ...base, lastScheduledAt: at(2026, 11, 3, 2, 0).toISOString() };
ok(!isDue(s1, at(2026, 11, 4, 1, 59)), "belum jatuh tempo");
ok(isDue(s1, at(2026, 11, 4, 2, 0)), "tepat jatuh tempo");
ok(isDue(s1, at(2026, 11, 8, 9, 0)), "server mati beberapa hari: dikejar setelah hidup");
ok(!isDue({ ...s1, enabled: false }, at(2026, 11, 8)), "nonaktif tidak pernah due");
const failed = { ...s1, lastFailedAt: at(2026, 11, 4, 2, 0).toISOString() };
ok(!isDue(failed, new Date(at(2026, 11, 4, 2, 0).getTime() + RETRY_AFTER_FAIL_MS - 1000)), "baru gagal: tunggu sebelum coba lagi");
ok(isDue(failed, new Date(at(2026, 11, 4, 2, 0).getTime() + RETRY_AFTER_FAIL_MS + 1000)), "lewat jeda: coba lagi");

// ── Penamaan + rotasi ──
eq(stampWIB(new Date("2026-11-03T20:00:00Z")), "20261104-030000", "stempel WIB (UTC+7, lintas hari)");
const sn = scheduledFileName(new Date("2026-11-03T20:00:00Z"));
ok(SCHEDULED_RE.test(sn) && !MANUAL_RE.test(sn), "nama terjadwal cocok polanya");
const mn = manualFileName("2026-10-01", "2026-10-31", new Date("2026-11-03T20:00:00Z"));
ok(MANUAL_RE.test(mn) && !SCHEDULED_RE.test(mn), "nama manual cocok polanya");
ok(MANUAL_RE.test(manualFileName(null, null, new Date())), "manual semua data: awal_akhir");
for (const bad of ["../x.zip", "backup_terjadwal_20261104-030000.zip/../../x", "a/b.zip", "backup_terjadwal_1.zip", "backup_settings.json", "backup_terjadwal_20261104-030000.zip.tmp"]) {
    ok(!SCHEDULED_RE.test(bad) && !MANUAL_RE.test(bad), `nama ditolak: ${bad}`);
}
const names = ["backup_terjadwal_20261101-020000.zip", "backup_terjadwal_20261103-020000.zip", "backup_terjadwal_20261102-020000.zip", "backup_terjadwal_20261103-020000_2.zip"];
eq(pickOldest(names, 2), ["backup_terjadwal_20261101-020000.zip", "backup_terjadwal_20261102-020000.zip"], "rotasi: yang tertua dihapus, termasuk urutan sufiks _2");
eq(pickOldest(names, 10), [], "kurang dari batas: tak ada yang dihapus");
eq(pickOldest([], 3), [], "kosong aman");
ok(INTERVAL_OPTIONS.length === 3, "tiga pilihan interval");

// ── Arsip dengan DB tiruan (tanpa SQL nyata) ──
const COLS = {
    batch_records: [["id", "integer"], ["batch_no", "text"], ["note", "text"], ["run_begin", "timestamp with time zone"]],
    batch_trend: [["id", "bigint"], ["batch_id", "integer"], ["t1", "numeric"]],
    alarm_log: [["id", "bigint"], ["description", "text"]],
    audit_log: [["id", "bigint"], ["action", "text"], ["new_value", "jsonb"]],
};
function fakeDb(sizes) {
    const calls = { sql: [] };
    return {
        calls,
        async query(sql, params) {
            calls.sql.push(String(sql).slice(0, 30));
            if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
            if (sql.includes("information_schema.columns")) {
                return { rows: (COLS[params[0]] ?? []).map(([column_name, data_type]) => ({ column_name, data_type })) };
            }
            const table = /FROM (\w+) t/.exec(sql)[1];
            const limit = Number(/LIMIT (\d+)/.exec(sql)[1]);
            const after = Number(params[0]);
            const rows = [];
            for (let id = Math.max(after + 1, 1); id <= sizes[table] && rows.length < limit; id++) { // id tabel sungguhan mulai dari 1
                const r = { id: String(id) };
                for (const [c] of COLS[table].slice(1)) r[c] = c === "note" ? (id % 3 === 0 ? "" : id % 3 === 1 ? null : 'x,"y"\nz') : `${table}-${c}-${id}`;
                if (table === "batch_trend") r.batch_no = "B-1";
                rows.push(r);
            }
            return { rows };
        },
    };
}
const dir = mkdtempSync(path.join(tmpdir(), "bktest-"));
try {
    for (const n of [0, 1, 4999, 5000, 5001, 10000, 12345]) {
        const db = fakeDb({ batch_records: n, batch_trend: n, alarm_log: 2, audit_log: 3 });
        const out = path.join(dir, `a${n}.zip`);
        const { manifest, sizeBytes } = await createBackupArchive({ db, outPath: out, kind: "manual", range: null, createdBy: "tester" });
        eq(manifest.tables.batch_records.rows, n, `jumlah baris ${n} akurat di batas halaman`);
        eq(manifest.tables.batch_trend.rows, n, `trend ${n} baris`);
        eq(manifest.tables.batch_records.maxId, n === 0 ? null : String(n), `maxId ${n}`);
        ok(manifest.complete === true && manifest.range === null, "tanpa rentang = lengkap");
        ok(sizeBytes > 0, "ukuran file tercatat");
        const v = await verifyArchive(out);
        ok(v.ok, `verifikasi arsip ${n} baris: ${v.problems.join("; ")}`);
        const files = unzipSync(new Uint8Array(readFileSync(out)));
        const csv = Buffer.from(files["batch_records.csv"]).toString("utf8");
        ok(csv.startsWith("\uFEFFid,batch_no,note,run_begin\r\n"), "BOM + header kolom");
    }
    // CSV detail: null vs kosong vs kutip vs baris baru terbaca balik
    {
        const out = path.join(dir, "detail.zip");
        await createBackupArchive({ db: fakeDb({ batch_records: 3, batch_trend: 0, alarm_log: 0, audit_log: 0 }), outPath: out, kind: "scheduled", range: null, createdBy: "system" });
        const csv = Buffer.from(unzipSync(new Uint8Array(readFileSync(out)))["batch_records.csv"]).toString("utf8");
        ok(csv.includes('1,batch_records-batch_no-1,,'), "id 1: note null -> kosong");
        ok(csv.includes('3,batch_records-batch_no-3,"",'), "id 3: note string kosong -> \"\"");
        ok(csv.includes('2,batch_records-batch_no-2,"x,""y""\nz",'), "id 2: koma, kutip, baris baru aman");
    }
    // Rentang tidak sah ditolak sebelum menyentuh DB
    {
        const db = fakeDb({ batch_records: 1, batch_trend: 1, alarm_log: 1, audit_log: 1 });
        let err = null;
        try { await createBackupArchive({ db, outPath: path.join(dir, "r.zip"), kind: "manual", range: { from: "2026-11-02", to: "2026-11-01" }, createdBy: "t" }); } catch (e) { err = e; }
        ok(err?.code === "RANGE", "rentang terbalik ditolak dengan code RANGE");
        eq(db.calls.sql.length, 0, "tidak ada query yang jalan");
        const out = path.join(dir, "p.zip");
        const { manifest } = await createBackupArchive({ db, outPath: out, kind: "manual", range: { from: "2026-10-01", to: null }, createdBy: "t" });
        ok(manifest.complete === false && /PARSIAL/.test(manifest.note), "rentang -> ditandai PARSIAL");
        ok(manifest.tables.audit_log.complete === false && manifest.tables.audit_log.filter === "event_time", "audit_log parsial, filter tercatat");
    }
    // Gagal di tengah: ROLLBACK dijalankan dan error diteruskan
    {
        const db = fakeDb({ batch_records: 3, batch_trend: 3, alarm_log: 1, audit_log: 1 });
        const orig = db.query.bind(db);
        db.query = async (sql, p) => { if (/FROM alarm_log t/.test(sql)) throw new Error("putus"); return orig(sql, p); };
        let err = null;
        try { await createBackupArchive({ db, outPath: path.join(dir, "f.zip"), kind: "manual", range: null, createdBy: "t" }); } catch (e) { err = e; }
        ok(err?.message === "putus", "error DB diteruskan");
        ok(db.calls.sql.some((s) => s.startsWith("ROLLBACK")), "ROLLBACK dijalankan");
    }
    // Pemalsuan: CSV diubah tapi manifest tetap -> verifikasi harus gagal
    {
        const src = path.join(dir, "a1.zip");
        const files = unzipSync(new Uint8Array(readFileSync(src)));
        files["batch_records.csv"] = strToU8(Buffer.from(files["batch_records.csv"]).toString("utf8").replace("batch_records-batch_no-1", "DIUBAH"));
        const tampered = path.join(dir, "tampered.zip");
        writeFileSync(tampered, zipSync(files));
        const v = await verifyArchive(tampered);
        ok(!v.ok && v.problems.some((p) => /SHA-256 tidak cocok/.test(p)), "CSV yang diubah ketahuan lewat SHA-256");
        // manifest hilang
        const noManifest = { ...files }; delete noManifest["manifest.json"];
        writeFileSync(path.join(dir, "nm.zip"), zipSync(noManifest));
        ok(!(await verifyArchive(path.join(dir, "nm.zip"))).ok, "tanpa manifest ditolak");
        // file rusak (bukan zip)
        writeFileSync(path.join(dir, "junk.zip"), "ini bukan zip");
        ok(!(await verifyArchive(path.join(dir, "junk.zip"))).ok, "file bukan zip ditolak");
    }
} finally {
    rmSync(dir, { recursive: true, force: true });
}

console.log(fail === 0 ? `Semua lolos (${pass} lolos)` : `${fail} GAGAL, ${pass} lolos`);
process.exit(fail === 0 ? 0 : 1);
