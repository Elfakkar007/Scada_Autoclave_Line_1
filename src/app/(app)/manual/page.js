"use client";

import { useState, useEffect } from "react";
import { hasLevel } from "@/lib/permissionCatalog";
import { MANUAL_ITEMS } from "@/lib/plcManualCatalog";
import PermissionGate from "@/components/PermissionGate";
import PlcDialog from "@/components/PlcDialog";

const PHASE_LABEL = {
    0: "Idle (pintu belum tertutup)", 1: "Siap (pintu tertutup)", 2: "FILLING", 3: "HEATING",
    4: "STERIL.", 5: "COOLING", 6: "END", 7: "DRAIN",
};

function Lamp({ on }) {
    const cls = on === null || on === undefined ? "bg-scada-idle" : on ? "bg-scada-run" : "bg-white border border-scada-idle";
    return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />;
}

function ItemCard({ item, command, output, canUse, busy, onSet }) {
    const on = command === true;
    return (
        <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4 flex flex-col gap-2">
            <div className="font-semibold text-sm">{item.label}</div>
            <div className="flex items-center gap-4 text-xs text-scada-muted">
                <span className="flex items-center gap-1.5"><Lamp on={command} /> Perintah</span>
                {item.outTag && <span className="flex items-center gap-1.5"><Lamp on={output} /> Output aktual</span>}
            </div>
            <button
                onClick={() => onSet(item.key, !on)}
                disabled={!canUse || busy}
                className={`mt-1 px-4 py-2 rounded text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${on
                    ? "bg-scada-stop hover:bg-scada-stop-hover"
                    : "bg-scada-water hover:bg-scada-water-hover"}`}
            >
                {on ? "Matikan" : "Nyalakan"}
            </button>
            {item.note && <p className="text-xs text-scada-muted">{item.note}</p>}
        </div>
    );
}

function ManualContent() {
    const [perms, setPerms] = useState(null);
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null); // { type: "error"|"ok", text }
    const [enterDialog, setEnterDialog] = useState(false);
    const [reason, setReason] = useState("");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (!cancelled && json.ok) setPerms(json.user.permissions ?? null); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    // Keadaan mesin di-poll tiap 500ms agar monitoring lebih real-time (lampu output aktual harus mengikuti PLC)
    useEffect(() => {
        let cancelled = false;
        const load = () =>
            fetch("/api/plc-manual", { cache: "no-store" })
                .then((r) => r.json())
                .then((json) => { if (!cancelled) setState(json); })
                .catch(() => { });
        load();
        const id = setInterval(load, 500);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    const canEdit = hasLevel(perms, "manual_control", "edit");
    const plcOk = state?.plcOk === true;
    const missing = plcOk ? state.missingTags ?? [] : [];
    const modeOn = plcOk && state.modeOn === true;
    const idle = state?.idle ?? null;

    async function send(body) {
        setBusy(true);
        setMessage(null);
        try {
            const res = await fetch("/api/plc-manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                setMessage({ type: "error", text: json.error ?? "Perintah gagal." });
                return false;
            }
            return true;
        } catch {
            setMessage({ type: "error", text: "Gagal terhubung ke server." });
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function handleEnter() {
        const ok = await send({ action: "enter", reason });
        if (ok) setEnterDialog(false);
    }

    function handleSet(key, value) {
        send({ action: "set", key, value });
    }

    function handleExit() {
        send({ action: "exit" });
    }

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            <div className="mb-5">
                <h1 className="text-2xl font-bold tracking-tight">Kontrol Manual</h1>
                <p className="text-sm text-scada-muted mt-1">
                    Super Water Sterilizer — menggerakkan katup dan pompa langsung (Manually Operate di HMI)
                </p>
            </div>

            {state && !plcOk && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-stop text-white text-sm font-semibold">
                    {state.plcError ?? "PLC tidak terbaca."}
                </div>
            )}
            {missing.length > 0 && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-steam text-white text-sm">
                    Tag manual belum ada di KEPServerEX ({missing.join(", ")}). Impor <b>SiemensS7-200_manual_NANTI.csv</b> dulu.
                </div>
            )}
            {message && (
                <div className={`mb-4 px-4 py-2 rounded text-sm font-medium text-white ${message.type === "error" ? "bg-scada-stop" : "bg-scada-run"}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4 mb-5 flex flex-wrap items-center gap-6">
                <div>
                    <div className="text-xs uppercase text-scada-muted">Mode manual</div>
                    <div className={`mt-1 inline-block px-3 py-1 rounded text-sm font-bold text-white ${modeOn ? "bg-scada-steam" : "bg-scada-idle"}`}>
                        {state ? (modeOn ? "AKTIF" : "TIDAK AKTIF") : "…"}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase text-scada-muted">Fase mesin</div>
                    <div className="mt-1 text-sm font-semibold">
                        {plcOk && state.phase !== null ? (PHASE_LABEL[state.phase] ?? `kode ${state.phase}`) : "—"}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase text-scada-muted">P1 / Safety Press</div>
                    <div className="mt-1 text-sm font-mono font-semibold">
                        {plcOk && state.p1 !== null ? `${state.p1}` : "—"} / {plcOk && state.safetyPress !== null ? `${state.safetyPress}` : "—"} kPa
                    </div>
                </div>
                <div className="flex gap-3 ml-auto">
                    {!modeOn && (
                        <button
                            onClick={() => { setReason(""); setMessage(null); setEnterDialog(true); }}
                            disabled={!canEdit || !plcOk || busy || missing.length > 0 || idle?.ok !== true}
                            className="px-5 py-2 bg-scada-steam hover:bg-scada-steam-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Masuk mode manual
                        </button>
                    )}
                    {(modeOn || missing.length === 0) && (
                        <button
                            onClick={handleExit}
                            disabled={!canEdit || !plcOk || busy || !modeOn}
                            className="px-5 py-2 bg-scada-stop hover:bg-scada-stop-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            KELUAR MODE MANUAL (matikan semua)
                        </button>
                    )}
                </div>
            </div>

            {plcOk && idle && !idle.ok && !modeOn && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-steam text-white text-sm">
                    Kontrol manual dikunci: {idle.reason}
                </div>
            )}
            {plcOk && modeOn && idle && !idle.ok && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-stop text-white text-sm font-semibold">
                    Mode manual aktif padahal mesin tidak idle ({idle.reason}) Segera tekan KELUAR MODE MANUAL.
                </div>
            )}
            {!canEdit && perms && (
                <p className="mb-4 text-xs text-scada-muted italic">Anda hanya punya akses lihat untuk kontrol manual.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {MANUAL_ITEMS.map((item) => (
                    <ItemCard
                        key={item.key}
                        item={item}
                        command={plcOk ? state.commands?.[item.key] ?? null : null}
                        output={plcOk ? state.outputs?.[item.key] ?? null : null}
                        canUse={canEdit && plcOk && modeOn && missing.length === 0}
                        busy={busy}
                        onSet={handleSet}
                    />
                ))}
            </div>

            <div className="mt-6 text-xs text-scada-muted max-w-3xl space-y-1">
                <p>Perintah menetap di PLC walau halaman ditutup. Selesai bekerja, selalu tekan KELUAR MODE MANUAL.</p>
                <p>Tombol STOP di mesin TIDAK mengeluarkan mode manual: output akan menyala lagi. Gunakan tombol keluar di atas.</p>
                <p>Katup steam hanya bisa dinyalakan saat kedua pintu tertutup dan seal aktif, dan tidak bersamaan dengan katup cooling.</p>
            </div>

            {enterDialog && (
                <PlcDialog title="Konfirmasi masuk mode manual">
                    <p className="mb-3">
                        Semua perintah dipastikan mati terlebih dulu, lalu mode manual diaktifkan. Pastikan tidak ada orang di dekat
                        katup, pintu, dan pompa.
                    </p>
                    <label className="block text-xs uppercase text-scada-muted mb-1" htmlFor="man-reason">
                        Alasan (wajib, tercatat di Audit Log)
                    </label>
                    <textarea
                        id="man-reason"
                        rows={2}
                        maxLength={200}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={busy}
                        className="w-full bg-white border border-scada-idle rounded px-3 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water mb-3"
                        placeholder="Contoh: uji fungsi katup drain setelah penggantian seal"
                    />
                    {message?.type === "error" && (
                        <div className="mb-3 px-3 py-2 rounded bg-scada-stop text-white text-sm">{message.text}</div>
                    )}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setEnterDialog(false)}
                            disabled={busy}
                            className="px-5 py-2 border border-scada-idle rounded text-sm font-semibold hover:bg-scada-bg transition-colors disabled:opacity-40"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleEnter}
                            disabled={busy || reason.trim().length < 3}
                            className="px-5 py-2 bg-scada-steam hover:bg-scada-steam-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy ? "Memproses…" : "Masuk mode manual"}
                        </button>
                    </div>
                </PlcDialog>
            )}
        </main>
    );
}

export default function ManualPage() {
    return (
        <PermissionGate resource="manual_control" minLevel="view">
            <ManualContent />
        </PermissionGate>
    );
}
