// ==============================================================================
// Helper jam PLC (RTC S7-200). Tanpa import: aman di server dan klien.
//
// Baca : VB2000..VB2005 = tahun(2 digit), bulan, hari, jam, menit, detik, format BCD
//        (PLC menyalin dari TODR tiap 0,5 dtk; lihat export_atv.awl Network 5 dan 7).
// Tulis: VB3000..VB3005 (BCD), lalu TEPI NAIK M31.0 (ENTER_RTC) → PLC menjalankan TODW.
//
// BCD: 26 desimal dikirim sebagai byte 0x26 = 38 desimal. Itu yang ditulis ke tag Byte.
// ==============================================================================

export const CLOCK_READ_TAGS = ["R_YEAR", "R_MONTH", "R_DAY", "R_HOURS", "R_MINUTE", "R_SECOND"];
export const CLOCK_WRITE_TAGS = ["S_YEAR", "S_MONTH", "S_DAY", "S_HOURS", "S_MINUTE", "S_SECOND"];
export const CLOCK_TRIGGER_TAG = "ENTER_RTC";
export const CLOCK_PARTS = ["year", "month", "day", "hour", "minute", "second"];

export function toBcd(n) {
    return ((Math.floor(n / 10) & 0x0f) << 4) | (n % 10);
}

/** Byte BCD → angka desimal, atau null bila bukan BCD valid. */
export function fromBcd(byte) {
    const b = Number(byte);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    const hi = b >> 4;
    const lo = b & 0x0f;
    if (hi > 9 || lo > 9) return null;
    return hi * 10 + lo;
}

export function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function inRange(n, min, max) {
    return Number.isInteger(n) && n >= min && n <= max;
}

/** Validasi bagian-bagian waktu. @returns {{ok:true,value:object}|{ok:false,error:string}} */
export function validateClockInput(input) {
    const v = {};
    for (const p of CLOCK_PARTS) {
        const n = Number(input?.[p]);
        if (input?.[p] === null || input?.[p] === undefined || String(input[p]).trim() === "" || !Number.isInteger(n)) {
            return { ok: false, error: `Isian ${p} harus bilangan bulat` };
        }
        v[p] = n;
    }
    if (!inRange(v.year, 2000, 2099)) return { ok: false, error: "Tahun harus 2000 s.d. 2099" };
    if (!inRange(v.month, 1, 12)) return { ok: false, error: "Bulan harus 1 s.d. 12" };
    if (!inRange(v.day, 1, daysInMonth(v.year, v.month))) return { ok: false, error: "Tanggal tidak valid untuk bulan tsb" };
    if (!inRange(v.hour, 0, 23)) return { ok: false, error: "Jam harus 0 s.d. 23" };
    if (!inRange(v.minute, 0, 59)) return { ok: false, error: "Menit harus 0 s.d. 59" };
    if (!inRange(v.second, 0, 59)) return { ok: false, error: "Detik harus 0 s.d. 59" };
    return { ok: true, value: v };
}

/** Bagian waktu → array pasangan tag-nilai (BCD) siap ditulis. */
export function encodeClockWrites(parts) {
    const bytes = [
        toBcd(parts.year - 2000), toBcd(parts.month), toBcd(parts.day),
        toBcd(parts.hour), toBcd(parts.minute), toBcd(parts.second),
    ];
    return CLOCK_WRITE_TAGS.map((tag, i) => ({ tag, value: bytes[i] }));
}

/** Nilai raw tag R_* ({R_YEAR: 38, ...}) → bagian waktu, atau null bila tidak valid. */
export function decodeClock(raw) {
    const nums = CLOCK_READ_TAGS.map((t) => fromBcd(raw?.[t]));
    if (nums.some((n) => n === null)) return null;
    const [yy, month, day, hour, minute, second] = nums;
    const parts = { year: 2000 + yy, month, day, hour, minute, second };
    return validateClockInput(parts).ok ? parts : null;
}

/** Bagian waktu (anggap waktu dinding lokal) → milidetik "naif" untuk menghitung selisih. */
export function clockToNaiveMs(parts) {
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** Waktu lokal sebuah Date → bagian waktu. */
export function partsFromDate(d) {
    return {
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
    };
}

export function formatClock(parts) {
    if (!parts) return "—";
    const p2 = (n) => String(n).padStart(2, "0");
    return `${parts.year}-${p2(parts.month)}-${p2(parts.day)} ${p2(parts.hour)}:${p2(parts.minute)}:${p2(parts.second)}`;
}
