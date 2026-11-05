// ==============================================================================
// PERHATIAN: SERVER-ONLY (fs + pg). Jangan di-import dari komponen "use client".
// Impor memakai path RELATIF (.js) karena modul ini juga dimuat langsung oleh server.js
// (scheduler), di luar bundler Next.js.
//
// Folder backup  : env BACKUP_DIR (default: folder "backups" di root proyek). Dipilih saat
//                  instalasi, SENGAJA tidak bisa diubah dari web (mencegah path liar).
//                    <BACKUP_DIR>/manual/      backup rentang tanggal, TIDAK dihapus otomatis
//                    <BACKUP_DIR>/terjadwal/   snapshot penuh, hanya N generasi terakhir
//                    <BACKUP_DIR>/backup_settings.json
// Anti-tabrakan  : file kunci .backup.lock (dibuat eksklusif). Perlu file, bukan variabel modul,
//                  karena scheduler (server.js) dan route Next.js adalah instance modul berbeda.
// ==============================================================================

import * as fsp from "node:fs/promises";
import path from "node:path";
import pool from "./db.js";
import { insertAudit, tryAudit } from "./auditLog.js";
import { createBackupArchive, verifyArchive, hashFile } from "./backupArchive.js";
import {
    SCHEDULED_RE, MANUAL_RE,
    normalizeSettings, computeNextDue, isDue, pickOldest,
    scheduledFileName, manualFileName,
} from "./backupSchedule.js";

// Folder backup dihitung saat runtime (env BACKUP_DIR) dan berada DI LUAR hasil build, jadi Turbopack
// tidak perlu menelusurinya. Tanpa komentar turbopackIgnore, `next build` memberi peringatan
// "Dynamic filesystem access causes tracing of the whole project". Semua akses fs/path dinamis
// modul ini lewat pembungkus di bawah supaya komentarnya cukup ditulis di satu tempat.
const joinP = (...parts) => path.join(/*turbopackIgnore: true*/ ...parts);
const resolveP = (p) => path.resolve(/*turbopackIgnore: true*/ p);
const mkdir = (p, o) => fsp.mkdir(/*turbopackIgnore: true*/ p, o);
const readdir = (p) => fsp.readdir(/*turbopackIgnore: true*/ p);
const readFile = (p, enc) => fsp.readFile(/*turbopackIgnore: true*/ p, enc);
const writeFile = (p, data, enc) => fsp.writeFile(/*turbopackIgnore: true*/ p, data, enc);
const rename = (from, to) => fsp.rename(/*turbopackIgnore: true*/ from, to);
const rm = (p, o) => fsp.rm(/*turbopackIgnore: true*/ p, o);
const stat = (p) => fsp.stat(/*turbopackIgnore: true*/ p);
const open = (p, flags) => fsp.open(/*turbopackIgnore: true*/ p, flags);

const LOCK_STALE_MS = 60 * 60 * 1000; // kunci lebih tua dari 1 jam dianggap sisa proses yang mati

export function backupRoot() {
    return resolveP(process.env.BACKUP_DIR || "backups");
}
const dirFor = (kind) => joinP(backupRoot(), kind === "scheduled" ? "terjadwal" : "manual");
const settingsPath = () => joinP(backupRoot(), "backup_settings.json");
const lockPath = () => joinP(backupRoot(), ".backup.lock");

async function ensureDirs() {
    await mkdir(dirFor("manual"), { recursive: true });
    await mkdir(dirFor("scheduled"), { recursive: true });
}

// ── Pengaturan ────────────────────────────────────────────────────────────────

export async function readSettings() {
    try {
        return normalizeSettings(JSON.parse(await readFile(settingsPath(), "utf8")));
    } catch {
        return normalizeSettings(null); // belum ada / rusak -> default (nonaktif)
    }
}

async function writeSettings(settings) {
    await ensureDirs();
    const tmp = `${settingsPath()}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(settings, null, 2), "utf8");
    await rename(tmp, settingsPath());
}

/** Baca-gabung-tulis tepat sebelum menulis, supaya tidak menimpa perubahan lain. */
async function patchSettings(patch) {
    const cur = await readSettings();
    const next = normalizeSettings({ ...cur, ...patch });
    await writeSettings(next);
    return next;
}

/**
 * Ubah pengaturan jadwal dari UI. Audit ditulis SEBELUM berkas diubah (gagal audit = tidak berubah).
 * @param {{enabled:boolean, interval:string, timeOfDay:string, generations:number}} value  (sudah divalidasi)
 */
export async function updateSettings(value, actor, actorRole) {
    const cur = await readSettings();
    const now = new Date();
    const turnedOn = value.enabled && !cur.enabled;
    await insertAudit(pool, {
        actor, actorRole,
        action: "backup_settings_update",
        entityType: "backup",
        entityId: "terjadwal",
        oldValue: { enabled: cur.enabled, interval: cur.interval, timeOfDay: cur.timeOfDay, generations: cur.generations },
        newValue: value,
        description: `Pengaturan backup terjadwal diubah oleh ${actor}: ${value.enabled ? "aktif" : "nonaktif"}, interval ${value.interval}, jam ${value.timeOfDay}, simpan ${value.generations} file terakhir.`,
    });
    return patchSettings({
        ...value,
        enabledAt: turnedOn ? now.toISOString() : cur.enabledAt,
        lastFailedAt: turnedOn ? null : cur.lastFailedAt,
        updatedBy: actor,
        updatedAt: now.toISOString(),
    });
}

// ── Kunci ─────────────────────────────────────────────────────────────────────

async function acquireLock() {
    await ensureDirs();
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const fh = await open(lockPath(), "wx");
            await fh.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
            await fh.close();
            return true;
        } catch (err) {
            if (err.code !== "EEXIST") throw err;
            const st = await stat(lockPath()).catch(() => null);
            if (st && Date.now() - st.mtimeMs > LOCK_STALE_MS) {
                await rm(lockPath(), { force: true }); // sisa proses mati: bersihkan lalu coba sekali lagi
                continue;
            }
            return false;
        }
    }
    return false;
}
const releaseLock = () => rm(lockPath(), { force: true }).catch(() => {});

export async function isRunning() {
    const st = await stat(lockPath()).catch(() => null);
    return !!st && Date.now() - st.mtimeMs <= LOCK_STALE_MS;
}

// ── Daftar dan akses file ─────────────────────────────────────────────────────

export async function listBackups() {
    const out = [];
    for (const kind of ["manual", "scheduled"]) {
        const re = kind === "scheduled" ? SCHEDULED_RE : MANUAL_RE;
        let names = [];
        try { names = await readdir(dirFor(kind)); } catch { /* folder belum ada */ }
        for (const name of names.filter((n) => re.test(n))) {
            const st = await stat(joinP(dirFor(kind), name)).catch(() => null);
            if (st?.isFile()) out.push({ kind, name, sizeBytes: st.size, modifiedAt: st.mtime.toISOString() });
        }
    }
    return out.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

/** Path absolut file backup, atau null bila nama/jenis tidak sah atau file tidak ada. */
export async function resolveBackupFile(kind, name) {
    if (kind !== "manual" && kind !== "scheduled") return null;
    const re = kind === "scheduled" ? SCHEDULED_RE : MANUAL_RE;
    if (typeof name !== "string" || !re.test(name)) return null; // pola ketat: tanpa pemisah path
    const full = joinP(dirFor(kind), name);
    const st = await stat(full).catch(() => null);
    return st?.isFile() ? { full, sizeBytes: st.size } : null;
}

export async function getStatus() {
    const settings = await readSettings();
    const due = computeNextDue(settings);
    return {
        root: backupRoot(),
        settings,
        nextDue: due ? due.toISOString() : null,
        running: await isRunning(),
        files: await listBackups(),
    };
}

// ── Menjalankan backup ────────────────────────────────────────────────────────

async function uniquePath(dir, name) {
    let candidate = name;
    for (let i = 2; i < 100; i++) {
        if (!(await stat(joinP(dir, candidate)).catch(() => null))) return joinP(dir, candidate);
        candidate = name.replace(/\.zip$/, `_${i}.zip`);
    }
    throw new Error("Nama file backup bentrok terlalu sering");
}

async function rotateScheduled(keep) {
    const names = (await readdir(dirFor("scheduled"))).filter((n) => SCHEDULED_RE.test(n));
    for (const old of pickOldest(names, keep)) {
        await rm(joinP(dirFor("scheduled"), old), { force: true }).catch((e) =>
            console.error("[backup] Gagal menghapus generasi lama:", old, e.message)
        );
    }
}

const totalRows = (manifest) => Object.values(manifest.tables).reduce((n, t) => n + t.rows, 0);

/**
 * @param {{kind:"manual"|"scheduled", range:{from:string|null,to:string|null}|null, actor:string, actorRole:string|null}} o
 * Melempar Error dengan code "BUSY" bila backup lain sedang berjalan.
 */
export async function runBackup({ kind, range = null, actor, actorRole = null }) {
    if (!(await acquireLock())) {
        throw Object.assign(new Error("Backup lain sedang berjalan. Coba lagi sebentar."), { code: "BUSY" });
    }
    const now = new Date();
    let tmpPath = null;
    try {
        const dir = dirFor(kind);
        const name = kind === "scheduled" ? scheduledFileName(now) : manualFileName(range?.from, range?.to, now);
        const finalPath = await uniquePath(dir, name);
        tmpPath = `${finalPath}.tmp`;
        await rm(tmpPath, { force: true });

        const { manifest, sizeBytes } = await createBackupArchive({
            db: pool, outPath: tmpPath, kind, range, createdBy: actor, now,
        });

        // Baca ulang dari disk dan cocokkan SHA-256 tiap CSV sebelum arsip dianggap sah.
        const check = await verifyArchive(tmpPath);
        if (!check.ok) throw new Error(`Verifikasi arsip gagal: ${check.problems.join("; ")}`);

        await rename(tmpPath, finalPath);
        tmpPath = null;
        const sha256 = await hashFile(finalPath);
        const fileName = path.basename(finalPath);
        const rows = totalRows(manifest);

        if (kind === "scheduled") {
            const s = await readSettings();
            await rotateScheduled(s.generations);
            await patchSettings({
                lastScheduledAt: now.toISOString(),
                lastFailedAt: null,
                lastResult: { ok: true, at: now.toISOString(), file: fileName, sizeBytes, rows },
            });
        }

        await tryAudit({
            actor, actorRole,
            action: "backup_created",
            entityType: "backup",
            entityId: fileName,
            newValue: {
                kind, range: manifest.range, complete: manifest.complete, sizeBytes, sha256,
                rows: Object.fromEntries(Object.entries(manifest.tables).map(([k, v]) => [k, v.rows])),
                via: kind === "scheduled" ? "scheduler" : "web",
            },
            description: `Backup ${kind === "scheduled" ? "terjadwal" : "manual"} dibuat oleh ${actor}: ${fileName}, ${rows} baris, ${sizeBytes} byte, SHA-256 ${sha256}${manifest.complete ? "" : " (PARSIAL: rentang tanggal)"}.`,
        }, "backup");

        return { kind, name: fileName, sizeBytes, sha256, rows, manifest };
    } catch (err) {
        if (tmpPath) await rm(tmpPath, { force: true }).catch(() => {});
        if (kind === "scheduled") {
            await patchSettings({
                lastFailedAt: new Date().toISOString(),
                lastResult: { ok: false, at: new Date().toISOString(), error: String(err.message).slice(0, 500) },
            }).catch(() => {});
        }
        await tryAudit({
            actor, actorRole,
            action: "backup_failed",
            entityType: "backup",
            entityId: null,
            newValue: { kind, range, error: String(err.message).slice(0, 500) },
            description: `Backup ${kind === "scheduled" ? "terjadwal" : "manual"} gagal (${actor}): ${String(err.message).slice(0, 300)}`,
        }, "backup");
        throw err;
    } finally {
        await releaseLock();
    }
}

/** Catat unduhan. MELEMPAR bila audit gagal: unduhan tidak boleh lolos tanpa jejak. */
export async function auditDownload(session, kind, name, sizeBytes) {
    await insertAudit(pool, {
        actor: session.username,
        actorRole: session.role,
        action: "backup_downloaded",
        entityType: "backup",
        entityId: name,
        newValue: { kind, sizeBytes },
        description: `Backup ${name} diunduh oleh ${session.username}.`,
    });
}

// ── Scheduler (dipanggil dari server.js) ──────────────────────────────────────

export function startBackupScheduler({ intervalMs = 60_000 } = {}) {
    let busy = false;
    const tick = async () => {
        if (busy) return;
        busy = true;
        try {
            const s = await readSettings();
            if (!isDue(s)) return;
            console.log("[backup] Memulai backup terjadwal...");
            const r = await runBackup({ kind: "scheduled", range: null, actor: "system", actorRole: "system" });
            console.log(`[backup] Selesai: ${r.name} (${r.rows} baris, ${r.sizeBytes} byte)`);
        } catch (err) {
            if (err.code === "BUSY") return; // backup manual sedang jalan, cek lagi menit depan
            console.error("[backup] Backup terjadwal gagal:", err.message);
        } finally {
            busy = false;
        }
    };
    const timer = setInterval(tick, intervalMs);
    timer.unref?.();
    console.log(`> Backup scheduler aktif (cek tiap ${intervalMs / 1000} detik; folder ${backupRoot()})`);
    return timer;
}
