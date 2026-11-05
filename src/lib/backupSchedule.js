// ==============================================================================
// Aturan jadwal dan penamaan backup. MURNI: tanpa fs, tanpa pg, aman dites di Node.
// Dipakai backupService.js (server) dan backup.test.mjs.
//
// Jam jadwal mengikuti jam lokal PC server (di pabrik = WIB). Nama file memakai WIB.
// ==============================================================================

import { buildDateRangeFilter } from "./dateRange.js";

export const INTERVAL_OPTIONS = [
    { key: "daily", days: 1, label: "Harian" },
    { key: "weekly", days: 7, label: "Mingguan" },
    { key: "monthly", days: 30, label: "30 hari" },
];

export const MIN_GENERATIONS = 1;
export const MAX_GENERATIONS = 10;
export const RETRY_AFTER_FAIL_MS = 60 * 60 * 1000; // gagal -> coba lagi paling cepat 1 jam kemudian

export const DEFAULT_SETTINGS = {
    enabled: false,
    interval: "weekly",
    timeOfDay: "02:00",
    generations: 3,
    enabledAt: null, // ISO: kapan toggle terakhir dinyalakan (jangkar jadwal pertama)
    lastScheduledAt: null, // ISO: backup terjadwal terakhir yang BERHASIL
    lastFailedAt: null, // ISO: kegagalan terakhir (dikosongkan saat berhasil)
    lastResult: null, // { ok, at, file?, sizeBytes?, rows?, error? }
    updatedBy: null,
    updatedAt: null,
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function intervalDays(key) {
    return INTERVAL_OPTIONS.find((o) => o.key === key)?.days ?? 7;
}

function isIsoString(v) {
    return typeof v === "string" && !Number.isNaN(new Date(v).getTime());
}

/** Bersihkan objek pengaturan dari file (rusak/kurang kolom -> isi default, nilai aneh -> default). */
export function normalizeSettings(raw) {
    const r = raw && typeof raw === "object" ? raw : {};
    const d = DEFAULT_SETTINGS;
    const gens = Number.isInteger(r.generations) ? r.generations : d.generations;
    return {
        enabled: r.enabled === true,
        interval: INTERVAL_OPTIONS.some((o) => o.key === r.interval) ? r.interval : d.interval,
        timeOfDay: typeof r.timeOfDay === "string" && TIME_RE.test(r.timeOfDay) ? r.timeOfDay : d.timeOfDay,
        generations: Math.min(MAX_GENERATIONS, Math.max(MIN_GENERATIONS, gens)),
        enabledAt: isIsoString(r.enabledAt) ? r.enabledAt : null,
        lastScheduledAt: isIsoString(r.lastScheduledAt) ? r.lastScheduledAt : null,
        lastFailedAt: isIsoString(r.lastFailedAt) ? r.lastFailedAt : null,
        lastResult: r.lastResult && typeof r.lastResult === "object" ? r.lastResult : null,
        updatedBy: typeof r.updatedBy === "string" ? r.updatedBy : null,
        updatedAt: isIsoString(r.updatedAt) ? r.updatedAt : null,
    };
}

/** Validasi input dari UI. Return { value } atau { error }. */
export function validateSettingsInput(input) {
    if (!input || typeof input !== "object") return { error: "Isi pengaturan tidak valid" };
    if (typeof input.enabled !== "boolean") return { error: "Status aktif harus berupa true/false" };
    if (!INTERVAL_OPTIONS.some((o) => o.key === input.interval)) return { error: "Interval tidak dikenal" };
    if (typeof input.timeOfDay !== "string" || !TIME_RE.test(input.timeOfDay)) {
        return { error: "Jam harus berformat HH:MM (00:00 sampai 23:59)" };
    }
    if (!Number.isInteger(input.generations) || input.generations < MIN_GENERATIONS || input.generations > MAX_GENERATIONS) {
        return { error: `Jumlah file tersimpan harus bilangan bulat ${MIN_GENERATIONS} sampai ${MAX_GENERATIONS}` };
    }
    return {
        value: {
            enabled: input.enabled,
            interval: input.interval,
            timeOfDay: input.timeOfDay,
            generations: input.generations,
        },
    };
}

/**
 * Rentang tanggal untuk backup manual. Kosong dua-duanya = SEMUA data (range null).
 * Format dan urutan dicek oleh buildDateRangeFilter (sama dengan ekspor yang sudah ada).
 */
export function parseRange(from, to) {
    const f = typeof from === "string" ? from.trim() : "";
    const t = typeof to === "string" ? to.trim() : "";
    if (!f && !t) return { range: null, error: null };
    const check = buildDateRangeFilter(f, t, "x", 1);
    if (check.error) return { range: null, error: check.error };
    return { range: { from: f || null, to: t || null }, error: null };
}

/** Waktu jalan berikutnya (Date) atau null bila nonaktif. */
export function computeNextDue(settings, now = new Date()) {
    if (!settings.enabled) return null;
    const [hh, mm] = settings.timeOfDay.split(":").map(Number);
    if (settings.lastScheduledAt) {
        const d = new Date(settings.lastScheduledAt);
        d.setDate(d.getDate() + intervalDays(settings.interval));
        d.setHours(hh, mm, 0, 0);
        return d;
    }
    // Belum pernah jalan: kemunculan berikutnya dari jam yang dipilih, dihitung sejak toggle dinyalakan.
    const anchor = new Date(settings.enabledAt ?? now);
    const d = new Date(anchor);
    d.setHours(hh, mm, 0, 0);
    if (d <= anchor) d.setDate(d.getDate() + 1);
    return d;
}

export function isDue(settings, now = new Date()) {
    const due = computeNextDue(settings, now);
    if (!due || now < due) return false;
    if (settings.lastFailedAt && now - new Date(settings.lastFailedAt) < RETRY_AFTER_FAIL_MS) return false;
    return true;
}

// ── Penamaan file ─────────────────────────────────────────────────────────────

/** "YYYYMMDD-HHMMSS" menurut WIB. */
export function stampWIB(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const g = (t) => parts.find((p) => p.type === t).value;
    return `${g("year")}${g("month")}${g("day")}-${g("hour")}${g("minute")}${g("second")}`;
}

export const SCHEDULED_RE = /^backup_terjadwal_\d{8}-\d{6}(_\d+)?\.zip$/;
export const MANUAL_RE = /^backup_manual_[0-9A-Za-z-]+_[0-9A-Za-z-]+_dibuat\d{8}-\d{6}(_\d+)?\.zip$/;

export function scheduledFileName(now = new Date()) {
    return `backup_terjadwal_${stampWIB(now)}.zip`;
}

export function manualFileName(from, to, now = new Date()) {
    return `backup_manual_${from || "awal"}_${to || "akhir"}_dibuat${stampWIB(now)}.zip`;
}

/** Nama yang harus dihapus agar tersisa `keep` file terbaru. Nama berpola tanggal, jadi urut abjad = urut waktu. */
export function pickOldest(names, keep) {
    const sorted = [...names].sort();
    return sorted.slice(0, Math.max(0, sorted.length - keep));
}
