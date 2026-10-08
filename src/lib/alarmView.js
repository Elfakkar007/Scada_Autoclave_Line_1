/**
 * src/lib/alarmView.js — Logika tampilan popup alarm (FUNGSI MURNI, tanpa React/DOM).
 *
 * Aturan:
 *  - Ada episode aktif yang BELUM di-minimize operator -> panel terbuka + bunyi menyala.
 *  - Semua episode aktif sudah di-minimize -> banner merah permanen, bunyi mati.
 *  - Episode BARU muncul saat banner -> panel terbuka lagi + bunyi menyala lagi.
 *  - Operator boleh membuka panel dari banner (expandedManual): tampil, tapi tidak membunyikan.
 *  - Popup tidak bisa ditutup selama masih ada alarm aktif; hilang sendiri saat semua pulih.
 */

export function deriveAlarmView(active, minimizedIds, expandedManual) {
    const count = active.length;
    if (count === 0) return { show: false, mode: "none", soundOn: false, count: 0 };
    const hasUnseen = active.some((a) => !minimizedIds.has(a.episodeId));
    if (hasUnseen) return { show: true, mode: "expanded", soundOn: true, count };
    return { show: true, mode: expandedManual ? "expanded" : "banner", soundOn: false, count };
}

/** Himpunan baru: semua episode aktif ditandai sudah di-minimize. */
export function minimizeAll(active, prev) {
    return new Set([...prev, ...active.map((a) => a.episodeId)]);
}

/** Buang id yang sudah tidak aktif. Mengembalikan objek yang SAMA bila tidak ada perubahan. */
export function pruneIds(prev, active) {
    const live = new Set(active.map((a) => a.episodeId));
    const next = new Set([...prev].filter((id) => live.has(id)));
    return next.size === prev.size ? prev : next;
}
