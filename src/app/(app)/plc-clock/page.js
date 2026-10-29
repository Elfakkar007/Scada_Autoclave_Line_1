"use client";

import { useState, useEffect } from "react";
import { hasLevel } from "@/lib/permissionCatalog";
import { CLOCK_PARTS, validateClockInput, formatClock, clockToNaiveMs, partsFromDate } from "@/lib/plcClock";
import PermissionGate from "@/components/PermissionGate";
import PlcDialog from "@/components/PlcDialog";

const LABELS = { year: "Tahun", month: "Bulan", day: "Tanggal", hour: "Jam", minute: "Menit", second: "Detik" };
const EMPTY = { year: "", month: "", day: "", hour: "", minute: "", second: "" };
const INPUT =
    "w-full bg-white border border-scada-idle rounded px-3 py-1.5 text-sm font-mono text-scada-ink focus:outline-none focus:border-scada-water disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-scada-bg";

function formatDiff(sec) {
    if (sec === null || sec === undefined) return "—";
    const abs = Math.abs(sec);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    const txt = m > 0 ? `${m} mnt ${s} dtk` : `${s} dtk`;
    return sec === 0 ? "sama" : `${txt} ${sec > 0 ? "lebih cepat" : "lebih lambat"} dari PC`;
}

function ClockContent() {
    const [perms, setPerms] = useState(null);
    const [state, setState] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [dialog, setDialog] = useState(false);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [dlgError, setDlgError] = useState(null);
    const [doneMsg, setDoneMsg] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (!cancelled && json.ok) setPerms(json.user.permissions ?? null); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    // Jam PLC di-poll tiap 2 detik supaya tampilan ikut berjalan
    useEffect(() => {
        let cancelled = false;
        const load = () =>
            fetch("/api/plc-clock", { cache: "no-store" })
                .then((r) => r.json())
                .then((json) => { if (!cancelled) setState(json); })
                .catch(() => { });
        load();
        const id = setInterval(load, 2000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    const canEdit = hasLevel(perms, "plc_clock", "edit");
    const plcOk = state?.plcOk === true && !!state?.plc;
    const idle = state?.idle ?? null;
    const writable = canEdit && plcOk && idle?.ok === true;

    const validation = validateClockInput(form);
    const filled = CLOCK_PARTS.every((p) => String(form[p]).trim() !== "");
    const target = validation.ok ? validation.value : null;
    const farFromPc =
        target && state?.server
            ? Math.abs(clockToNaiveMs(target) - clockToNaiveMs(state.server)) > 5 * 60 * 1000
            : false;

    function fillWithPcTime() {
        const p = partsFromDate(new Date());
        setForm(Object.fromEntries(CLOCK_PARTS.map((k) => [k, String(p[k])])));
    }

    function openDialog() {
        setReason("");
        setDlgError(null);
        setDoneMsg(null);
        setDialog(true);
    }

    async function handleConfirm() {
        setSaving(true);
        setDlgError(null);
        try {
            const res = await fetch("/api/plc-clock", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, reason }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                setDlgError(json.error ?? "Gagal mengatur jam PLC.");
                return;
            }
            setDoneMsg(`Jam PLC sekarang terbaca ${formatClock(json.plc)}.${json.warning ? " " + json.warning : ""}`);
            setForm(EMPTY);
        } catch {
            setDlgError("Gagal terhubung ke server.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            <div className="mb-5">
                <h1 className="text-2xl font-bold tracking-tight">Jam PLC</h1>
                <p className="text-sm text-scada-muted mt-1">
                    Super Water Sterilizer — baca dan atur jam real-time PLC (Time setting di HMI)
                </p>
            </div>

            {state && !plcOk && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-stop text-white text-sm font-semibold">
                    {state.plcError ?? "Jam PLC tidak terbaca."}
                </div>
            )}
            {plcOk && idle && !idle.ok && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-steam text-white text-sm">
                    Pengaturan jam dikunci: {idle.reason}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4">
                    <div className="text-xs uppercase text-scada-muted">Jam PLC</div>
                    <div className="mt-1 font-mono text-xl font-bold">{formatClock(state?.plc)}</div>
                </div>
                <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4">
                    <div className="text-xs uppercase text-scada-muted">Jam PC (server web)</div>
                    <div className="mt-1 font-mono text-xl font-bold">{formatClock(state?.server)}</div>
                </div>
                <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4">
                    <div className="text-xs uppercase text-scada-muted">Selisih</div>
                    <div className="mt-1 text-lg font-semibold">{formatDiff(state?.diffSec)}</div>
                </div>
            </div>

            <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-scada-muted mb-3">Atur jam baru</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {CLOCK_PARTS.map((p) => (
                        <div key={p}>
                            <label className="block text-xs uppercase text-scada-muted mb-1" htmlFor={`clk-${p}`}>{LABELS[p]}</label>
                            <input
                                id={`clk-${p}`}
                                type="number"
                                inputMode="numeric"
                                className={INPUT}
                                disabled={!writable}
                                value={form[p]}
                                onChange={(e) => setForm((prev) => ({ ...prev, [p]: e.target.value }))}
                            />
                        </div>
                    ))}
                </div>
                {filled && !validation.ok && <p className="mt-2 text-xs text-scada-stop">{validation.error}</p>}
                {farFromPc && (
                    <p className="mt-2 text-xs text-scada-steam font-semibold">
                        Waktu yang dimasukkan berbeda lebih dari 5 menit dari jam PC. Pastikan ini disengaja.
                    </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3 items-center">
                    <button
                        onClick={fillWithPcTime}
                        disabled={!writable}
                        className="px-5 py-2 border border-scada-idle rounded text-sm font-semibold hover:bg-scada-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Isi dengan jam PC
                    </button>
                    <button
                        onClick={openDialog}
                        disabled={!writable || !validation.ok}
                        className="px-5 py-2 bg-scada-run hover:bg-scada-run-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Simpan
                    </button>
                    {!canEdit && perms && (
                        <span className="text-xs text-scada-muted italic">Anda hanya punya akses lihat untuk jam PLC.</span>
                    )}
                </div>
                <p className="mt-3 text-xs text-scada-muted">
                    Jam yang diisi dianggap waktu lokal. Tombol &quot;Isi dengan jam PC&quot; hanya mengisi kolom; jam PC terus berjalan,
                    jadi selisih beberapa detik setelah Simpan itu wajar.
                </p>
            </div>

            {dialog && (
                <PlcDialog title="Konfirmasi atur jam PLC">
                    {doneMsg ? (
                        <>
                            <p className="mb-4">{doneMsg}</p>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setDialog(false)}
                                    className="px-5 py-2 bg-scada-water hover:bg-scada-water-hover text-white rounded text-sm font-semibold transition-colors"
                                >
                                    Selesai
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <table className="w-full text-sm mb-4">
                                <tbody>
                                    <tr className="border-b border-scada-rule">
                                        <td className="py-1.5 text-scada-muted">Jam PLC sekarang</td>
                                        <td className="py-1.5 font-mono">{formatClock(state?.plc)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1.5 text-scada-muted">Jam baru</td>
                                        <td className="py-1.5 font-mono font-semibold">{formatClock(target)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <label className="block text-xs uppercase text-scada-muted mb-1" htmlFor="clk-reason">
                                Alasan (wajib, tercatat di Audit Log)
                            </label>
                            <textarea
                                id="clk-reason"
                                rows={2}
                                maxLength={200}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={saving}
                                className={INPUT.replace("font-mono ", "") + " mb-3"}
                                placeholder="Contoh: sinkron jam setelah pergantian baterai"
                            />
                            {dlgError && <div className="mb-3 px-3 py-2 rounded bg-scada-stop text-white text-sm">{dlgError}</div>}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDialog(false)}
                                    disabled={saving}
                                    className="px-5 py-2 border border-scada-idle rounded text-sm font-semibold hover:bg-scada-bg transition-colors disabled:opacity-40"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={saving || reason.trim().length < 3}
                                    className="px-5 py-2 bg-scada-run hover:bg-scada-run-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {saving ? "Menulis ke PLC…" : "Tulis ke PLC"}
                                </button>
                            </div>
                        </>
                    )}
                </PlcDialog>
            )}
        </main>
    );
}

export default function PlcClockPage() {
    return (
        <PermissionGate resource="plc_clock" minLevel="view">
            <ClockContent />
        </PermissionGate>
    );
}
