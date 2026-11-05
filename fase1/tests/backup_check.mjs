// Pemeriksaan BACA-SAJA terhadap DB sungguhan: membuat arsip backup penuh di folder sementara,
// memverifikasinya, membandingkan jumlah baris dengan DB, lalu menghapusnya. Tidak menulis apa pun ke DB.
//
// Jalankan dari root proyek:
//   node fase1/tests/backup_check.mjs
// DATABASE_URL otomatis dibaca dari .env.local bila belum diset di terminal (nilainya tidak ditampilkan).
// Atau isi manual (pilih sesuai terminal):
//   Git Bash   : DATABASE_URL="postgresql://user:pass@localhost:5432/namadb" node fase1/tests/backup_check.mjs
//   PowerShell : $env:DATABASE_URL="postgresql://user:pass@localhost:5432/namadb"; node fase1/tests/backup_check.mjs
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { createBackupArchive, verifyArchive, BACKUP_TABLES } from "../../src/lib/backupArchive.js";

// Fallback: baca DATABASE_URL dari .env.local (tanpa mencetak nilainya).
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
    const m = /^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m.exec(readFileSync(".env.local", "utf8"));
    if (m) {
        process.env.DATABASE_URL = m[1].replace(/^(["'])(.*)\1$/, "$2");
        console.log("DATABASE_URL dibaca dari .env.local");
    }
}
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL belum diisi dan tidak ada di .env.local. Lihat petunjuk di bagian atas file ini.");
    process.exit(2);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dir = mkdtempSync(path.join(tmpdir(), "backup-check-"));
let failed = false;
const count = async () => {
    const out = {};
    for (const t of BACKUP_TABLES) out[t.name] = Number((await pool.query(`SELECT count(*) FROM ${t.name}`)).rows[0].count);
    return out;
};

try {
    const before = await count();
    const out = path.join(dir, "check.zip");
    const t0 = Date.now();
    const { manifest, sizeBytes } = await createBackupArchive({ db: pool, outPath: out, kind: "manual", range: null, createdBy: "backup_check" });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const after = await count();

    console.log(`Arsip dibuat dalam ${secs} dtk, ${(sizeBytes / 1024).toFixed(1)} KB\n`);
    console.log("Tabel          di arsip   DB sebelum   DB sesudah   kolom");
    for (const t of BACKUP_TABLES) {
        const m = manifest.tables[t.name];
        // Server dev yang sedang jalan bisa menambah baris selama pemeriksaan: jumlah arsip harus di antara keduanya.
        const okRows = m.rows >= before[t.name] && m.rows <= after[t.name];
        if (!okRows) failed = true;
        console.log(`${t.name.padEnd(14)} ${String(m.rows).padStart(8)}   ${String(before[t.name]).padStart(10)}   ${String(after[t.name]).padStart(10)}   ${m.columns.length}  ${okRows ? "OK" : "TIDAK COCOK"}`);
    }
    const v = await verifyArchive(out);
    console.log(`\nVerifikasi ulang isi zip (SHA-256 tiap CSV): ${v.ok ? "OK" : "GAGAL " + v.problems.join("; ")}`);
    if (!v.ok) failed = true;
    console.log("Kolom batch_records:", manifest.tables.batch_records.columns.map((c) => c.name).join(", "));
} catch (err) {
    failed = true;
    console.error("Pemeriksaan gagal:", err.message);
} finally {
    rmSync(dir, { recursive: true, force: true });
    await pool.end();
}
console.log(failed ? "\nADA MASALAH" : "\nSemua OK");
process.exit(failed ? 1 : 0);
