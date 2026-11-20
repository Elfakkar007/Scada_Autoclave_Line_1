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
    const [form, setForm] = useState(null); // pengaturan jadwal & salin otomatis yang sedang diedit
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }
    const [testingDir, setTestingDir] = useState(false);
    const [dirCheckMsg, setDirCheckMsg] = useState(null); // { ok: boolean, text: string }

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
                const copyNotice = json.autoCopy
                    ? json.autoCopy.ok
                        ? ` | ✓ Salinan otomatis tersimpan di: ${json.autoCopy.path}`
                        : ` | ⚠️ Gagal salin otomatis (${json.autoCopy.error})`
                    : "";
                setMsg({
                    type: "ok",
                    text: `Backup dibuat: ${json.file.name} (${total} baris, ${fmtSize(json.file.sizeBytes)})${json.complete ? "" : ". Arsip PARSIAL karena dibatasi rentang tanggal."}${copyNotice}`,
                });
                setReloadKey((k) => k + 1);
            }
        } catch {
            setMsg({ type: "err", text: "Tidak bisa menghubungi server" });
        } finally {
            setBusy(false);
        }
    }

    async function checkDir() {
        if (!form.autoCopyDir?.trim()) {
            setDirCheckMsg({ ok: false, text: "Ketik path direktori tujuan terlebih dahulu" });
            return;
        }
        setTestingDir(true);
        setDirCheckMsg(null);
        try {
            const res = await fetch("/api/backup/check-dir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dir: form.autoCopyDir.trim() }),
            });
            const json = await res.json();
            if (json.ok) {
                setDirCheckMsg({ ok: true, text: `✓ Direktori siap & dapat ditulisi: ${json.path}` });
            } else {
                setDirCheckMsg({ ok: false, text: `✕ ${json.error ?? "Direktori tidak dapat diakses"}` });
            }
        } catch {
            setDirCheckMsg({ ok: false, text: "Gagal menghubungi server untuk cek direktori" });
        } finally {
            setTestingDir(false);
        }
    }

    async function saveSettings(sourceLabel = "Pengaturan") {
        setSaving(true);
        setMsg(null);
        setDirCheckMsg(null);
        try {
            const res = await fetch("/api/backup", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: form.enabled,
                    interval: form.interval,
                    timeOfDay: form.timeOfDay,
                    generations: Number(form.generations),
                    autoCopyEnabled: Boolean(form.autoCopyEnabled),
                    autoCopyDir: String(form.autoCopyDir ?? "").trim(),
                }),
            });
            const json = await res.json();
            if (!json.ok) {
                setMsg({ type: "err", text: json.error ?? "Gagal menyimpan pengaturan" });
            } else {
                setForm({ ...json.settings });
                setMsg({ type: "ok", text: `${sourceLabel} berhasil disimpan.` });
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
    const input = "border border-scada-rule rounded px-2.5 py-1.5 text-sm bg-white";
    const btn = "px-4 py-1.5 rounded text-sm font-medium text-white bg-scada-water hover:opacity-90 disabled:opacity-50";

    return (
        <div className="p-6 flex flex-col gap-5 w-full min-h-screen overflow-y-auto">
            <div>
                <h1 className="text-xl font-bold text-scada-ink">Backup Data</h1>
                <p className="text-xs text-scada-muted mt-1">
                    Arsip data batch, trend (kurva), alarm, dan audit log dalam satu file ZIP berisi CSV dan manifest.
                    Folder server: <span className="font-mono bg-white px-2 py-0.5 rounded border border-scada-rule/60">{data.root}</span>
                </p>
            </div>

            {msg && (
                <div className={`text-sm rounded px-3 py-2 border ${msg.type === "ok" ? "border-green-300 text-green-800 bg-green-50" : "border-red-300 text-red-700 bg-red-50"}`}>
                    {msg.text}
                </div>
            )}

            {/* ── 1. Backup manual ── */}
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
                    {form.autoCopyEnabled && form.autoCopyDir && (
                        <span className="block mt-1 text-emerald-800 font-medium">
                            ✓ Salin otomatis aktif: File hasil backup manual ini juga akan langsung disalin ke <code className="bg-emerald-50 px-1 border border-emerald-200 rounded">{form.autoCopyDir}</code>
                        </span>
                    )}
                </p>
                {!canEdit && <p className="text-xs text-scada-muted mt-1">Anda hanya punya izin melihat.</p>}
                {data.running && !busy && <p className="text-xs text-scada-steam mt-1">Sebuah backup sedang berjalan.</p>}
            </section>

            {/* ── 2. Terjadwal ── */}
            <section className={card}>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-scada-ink">Backup terjadwal</h2>
                    <button type="button" className={btn} onClick={() => saveSettings("Pengaturan backup terjadwal")} disabled={!canEdit || saving}>
                        {saving ? "Menyimpan..." : "Simpan pengaturan jadwal"}
                    </button>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm text-scada-ink flex items-center gap-2 cursor-pointer">
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
                </div>
                <p className="text-xs text-scada-muted mt-2">
                    Tiap kali jalan dibuat arsip penuh baru. Sebelum dipakai, arsip dibaca ulang dan checksum-nya dicocokkan;
                    hanya setelah itu file lama yang melebihi jumlah di atas dihapus.
                </p>
                <div className="text-xs text-scada-ink mt-3 pt-2 border-t border-scada-rule/50 flex flex-col gap-1">
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

            {/* ── 3. Salin otomatis (Ekspor Lokal / Flashdisk / LAN) ── */}
            <section className={card}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-scada-ink">Salin Otomatis ke Direktori Eksternal</h2>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            100% Offline
                        </span>
                    </div>
                    <button type="button" className={btn} onClick={() => saveSettings("Pengaturan salin otomatis")} disabled={!canEdit || saving}>
                        {saving ? "Menyimpan..." : "Simpan pengaturan salin"}
                    </button>
                </div>

                <p className="text-xs text-scada-muted mb-3">
                    Saat opsi ini aktif, setiap kali backup dibuat (baik <b>backup terjadwal</b> maupun <b>backup manual sekarang</b>), file ZIP hasil backup akan otomatis disalin ke folder lokal/eksternal yang Anda tentukan di bawah.
                </p>

                <div className="flex flex-col gap-3">
                    <label className="text-sm font-semibold text-scada-ink flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.autoCopyEnabled ?? false}
                            onChange={(e) => {
                                setForm({ ...form, autoCopyEnabled: e.target.checked });
                                setDirCheckMsg(null);
                            }}
                            disabled={!canEdit || saving}
                        />
                        Aktifkan salin otomatis untuk semua backup (terjadwal &amp; manual)
                    </label>

                    {form.autoCopyEnabled && (
                        <div className="flex flex-col gap-3 pt-1">
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="text-xs text-scada-muted flex-1 min-w-[320px] flex flex-col gap-1">
                                    Path Direktori Tujuan (Flashdisk USB, Harddisk Eksternal, Folder Lokal, atau LAN):
                                    <input
                                        type="text"
                                        className={`${input} font-mono text-xs w-full`}
                                        placeholder="contoh: E:\Backup atau D:\Backup_Sterilizer atau C:\Users\LENOVO\Downloads"
                                        value={form.autoCopyDir ?? ""}
                                        onChange={(e) => {
                                            setForm({ ...form, autoCopyDir: e.target.value });
                                            setDirCheckMsg(null);
                                        }}
                                        disabled={!canEdit || saving}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={checkDir}
                                    disabled={!canEdit || testingDir || !form.autoCopyDir?.trim()}
                                    className="px-3.5 py-1.5 rounded text-xs border border-scada-rule text-scada-ink hover:bg-white disabled:opacity-50"
                                >
                                    {testingDir ? "Memeriksa..." : "🔍 Uji Akses Folder"}
                                </button>
                            </div>

                            {dirCheckMsg && (
                                <div className={`text-xs px-3 py-2 rounded border max-w-2xl ${dirCheckMsg.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                                    {dirCheckMsg.text}
                                </div>
                            )}

                            <div className="text-[11px] text-scada-muted bg-scada-bg p-3 rounded border border-scada-rule/60 flex flex-col gap-1.5">
                                <span className="font-semibold text-scada-ink">💡 Panduan Direktori Tujuan:</span>
                                <span>• <b>Flashdisk / Harddisk Eksternal:</b> Masukkan huruf drive, contoh <code>E:\Backup</code> atau <code>F:\</code>.</span>
                                <span>• <b>Folder Lokal:</b> Contoh <code>C:\Users\LENOVO\Downloads</code> atau <code>D:\Backup_Autoclave</code>.</span>
                                <span>• <b>Folder Jaringan LAN:</b> Contoh <code>Z:\Backup</code> atau <code>\\192.168.5.5\Satoria Aneka\Backup</code>.</span>
                                <span>• <b>Keamanan Server:</b> Jika flashdisk dicabut atau folder tidak dapat diakses saat backup berjalan, <b>backup utama di server tetap 100% aman dan berhasil</b>.</span>
                            </div>

                            {last?.autoCopy && (
                                <div className="text-xs pt-2 border-t border-scada-rule/50">
                                    <span className="text-scada-muted">Status salinan terakhir (backup terjadwal): </span>
                                    {last.autoCopy.ok ? (
                                        <b className="text-emerald-700">✓ Berhasil disalin ke {last.autoCopy.path}</b>
                                    ) : (
                                        <b className="text-amber-700">⚠️ Gagal disalin ({last.autoCopy.error}). Backup server tetap aman.</b>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ── 4. Daftar arsip ── */}
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
