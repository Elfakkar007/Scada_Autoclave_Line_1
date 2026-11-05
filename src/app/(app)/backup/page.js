"use client";

import { useEffect, useState } from "react";
import { hasLevel } from "@/lib/permissionCatalog";

const INTERVALS = [
    ["daily", "Harian"],
    ["weekly", "Mingguan"],
    ["monthly", "30 hari"],
];

function fmtDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

function fmtSize(n) {
    if (!Number.isFinite(n)) return "-";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const KIND_LABEL = { manual: "Manual", scheduled: "Terjadwal" };

export default function BackupPage() {
    const [data, setData] = useState(null); // respons GET /api/backup
    const [canEdit, setCanEdit] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [form, setForm] = useState(null); // pengaturan jadwal yang sedang diedit
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }

    // Muat status + izin. Semua setState ada di dalam callback promise (bukan sinkron di efek).
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch("/api/backup").then((r) => r.json()),
            fetch("/api/auth/me").then((r) => r.json()),
        ])
            .then(([status, me]) => {
                if (cancelled) return;
                if (!status.ok) {
                    setLoadError(status.error ?? "Gagal memuat data backup");
                    return;
                }
                setLoadError("");
                setData(status);
                setForm((prev) => prev ?? { ...status.settings });
                setCanEdit(Boolean(me?.ok) && hasLevel(me.user?.permissions, "backup", "edit"));
            })
            .catch(() => {
                if (!cancelled) setLoadError("Tidak bisa menghubungi server");
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    async function runManual() {
        setBusy(true);
        setMsg(null);
        try {
            const res = await fetch("/api/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from, to }),
            });
            const json = await res.json();
            if (!json.ok) {
                setMsg({ type: "err", text: json.error ?? "Backup gagal" });
            } else {
                const total = Object.values(json.rows).reduce((a, b) => a + b, 0);
                setMsg({
                    type: "ok",
                    text: `Backup dibuat: ${json.file.name} (${total} baris, ${fmtSize(json.file.sizeBytes)})${json.complete ? "" : ". Arsip PARSIAL karena dibatasi rentang tanggal."}`,
                });
                setReloadKey((k) => k + 1);
            }
        } catch {
            setMsg({ type: "err", text: "Tidak bisa menghubungi server" });
        } finally {
            setBusy(false);
        }
    }

    async function saveSettings() {
        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch("/api/backup", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: form.enabled,
                    interval: form.interval,
                    timeOfDay: form.timeOfDay,
                    generations: Number(form.generations),
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                setMsg({ type: "err", text: json.error ?? "Gagal menyimpan pengaturan" });
            } else {
                setForm({ ...json.settings });
                setMsg({ type: "ok", text: "Pengaturan backup terjadwal disimpan." });
                setReloadKey((k) => k + 1);
            }
        } catch {
            setMsg({ type: "err", text: "Tidak bisa menghubungi server" });
        } finally {
            setSaving(false);
        }
    }

    if (loadError) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold text-scada-ink mb-3">Backup Data</h1>
                <p className="text-sm text-red-600">{loadError}</p>
            </div>
        );
    }
    if (!data || !form) {
        return (
            <div className="p-6">
                <h1 className="text-xl font-bold text-scada-ink mb-3">Backup Data</h1>
                <p className="text-sm text-scada-muted">Memuat...</p>
            </div>
        );
    }

    const last = data.settings.lastResult;
    const card = "bg-scada-card border border-scada-rule rounded p-4";
    const input = "border border-scada-rule rounded px-2 py-1 text-sm bg-white";
    const btn = "px-4 py-1.5 rounded text-sm font-medium text-white bg-scada-water hover:opacity-90 disabled:opacity-50";

    return (
        <div className="p-6 flex flex-col gap-5 max-w-5xl overflow-y-auto h-full">
            <div>
                <h1 className="text-xl font-bold text-scada-ink">Backup Data</h1>
                <p className="text-xs text-scada-muted mt-1">
                    Arsip data batch, trend (kurva), alarm, dan audit log dalam satu file ZIP berisi CSV dan manifest.
                    Folder: <span className="font-mono">{data.root}</span>
                </p>
            </div>

            {msg && (
                <div className={`text-sm rounded px-3 py-2 border ${msg.type === "ok" ? "border-green-300 text-green-800 bg-green-50" : "border-red-300 text-red-700 bg-red-50"}`}>
                    {msg.text}
                </div>
            )}

            {/* ── Backup manual ── */}
            <section className={card}>
                <h2 className="text-sm font-bold text-scada-ink mb-2">Backup sekarang</h2>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-scada-muted flex flex-col gap-1">
                        Dari tanggal
                        <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} disabled={!canEdit || busy} />
                    </label>
                    <label className="text-xs text-scada-muted flex flex-col gap-1">
                        Sampai tanggal
                        <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} disabled={!canEdit || busy} />
                    </label>
                    <button
                        type="button"
                        className="px-3 py-1.5 rounded text-sm border border-scada-rule text-scada-ink hover:bg-white disabled:opacity-50"
                        onClick={() => { setFrom(""); setTo(""); }}
                        disabled={!canEdit || busy || (!from && !to)}
                    >
                        Semua data
                    </button>
                    <button type="button" className={btn} onClick={runManual} disabled={!canEdit || busy || data.running}>
                        {busy ? "Membuat backup..." : "Buat backup"}
                    </button>
                </div>
                <p className="text-xs text-scada-muted mt-2">
                    Kosongkan kedua tanggal untuk membackup semua data (arsip lengkap). Bila tanggal diisi, arsip ditandai PARSIAL
                    dan audit log di dalamnya hanya untuk rentang itu. Arsip manual tidak dihapus otomatis.
                </p>
                {!canEdit && <p className="text-xs text-scada-muted mt-1">Anda hanya punya izin melihat.</p>}
                {data.running && !busy && <p className="text-xs text-scada-steam mt-1">Sebuah backup sedang berjalan.</p>}
            </section>

            {/* ── Terjadwal ── */}
            <section className={card}>
                <h2 className="text-sm font-bold text-scada-ink mb-2">Backup terjadwal</h2>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm text-scada-ink flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.enabled}
                            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                            disabled={!canEdit || saving}
                        />
                        Aktif
                    </label>
                    <label className="text-xs text-scada-muted flex flex-col gap-1">
                        Interval
                        <select className={input} value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} disabled={!canEdit || saving}>
                            {INTERVALS.map(([k, label]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs text-scada-muted flex flex-col gap-1">
                        Jam
                        <input type="time" className={input} value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} disabled={!canEdit || saving} />
                    </label>
                    <label className="text-xs text-scada-muted flex flex-col gap-1">
                        Simpan file terakhir
                        <input type="number" min={1} max={10} className={`${input} w-20`} value={form.generations} onChange={(e) => setForm({ ...form, generations: e.target.value })} disabled={!canEdit || saving} />
                    </label>
                    <button type="button" className={btn} onClick={saveSettings} disabled={!canEdit || saving}>
                        {saving ? "Menyimpan..." : "Simpan pengaturan"}
                    </button>
                </div>
                <p className="text-xs text-scada-muted mt-2">
                    Tiap kali jalan dibuat arsip penuh baru. Sebelum dipakai, arsip dibaca ulang dan checksum-nya dicocokkan;
                    hanya setelah itu file lama yang melebihi jumlah di atas dihapus.
                </p>
                <div className="text-xs text-scada-ink mt-2 flex flex-col gap-0.5">
                    <span>Jalan berikutnya: <b>{data.settings.enabled ? fmtDate(data.nextDue) : "tidak dijadwalkan"}</b></span>
                    <span>
                        Hasil terakhir:{" "}
                        {last
                            ? last.ok
                                ? `berhasil ${fmtDate(last.at)} (${last.file}, ${last.rows} baris)`
                                : `GAGAL ${fmtDate(last.at)}: ${last.error}`
                            : "belum pernah jalan"}
                    </span>
                </div>
            </section>

            {/* ── Daftar arsip ── */}
            <section className={card}>
                <h2 className="text-sm font-bold text-scada-ink mb-2">Arsip tersimpan ({data.files.length})</h2>
                {data.files.length === 0 ? (
                    <p className="text-sm text-scada-muted">Belum ada arsip.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-scada-muted border-b border-scada-rule">
                                    <th className="py-1 pr-3">Jenis</th>
                                    <th className="py-1 pr-3">Nama file</th>
                                    <th className="py-1 pr-3">Ukuran</th>
                                    <th className="py-1 pr-3">Dibuat</th>
                                    <th className="py-1" />
                                </tr>
                            </thead>
                            <tbody>
                                {data.files.map((f) => (
                                    <tr key={`${f.kind}/${f.name}`} className="border-b border-scada-rule/50">
                                        <td className="py-1 pr-3">{KIND_LABEL[f.kind] ?? f.kind}</td>
                                        <td className="py-1 pr-3 font-mono text-xs break-all">{f.name}</td>
                                        <td className="py-1 pr-3 whitespace-nowrap">{fmtSize(f.sizeBytes)}</td>
                                        <td className="py-1 pr-3 whitespace-nowrap">{fmtDate(f.modifiedAt)}</td>
                                        <td className="py-1 text-right">
                                            {canEdit && (
                                                <a
                                                    className="text-scada-water underline"
                                                    href={`/api/backup/download?kind=${encodeURIComponent(f.kind)}&name=${encodeURIComponent(f.name)}`}
                                                >
                                                    Unduh
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
