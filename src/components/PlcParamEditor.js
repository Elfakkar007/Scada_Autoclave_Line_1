"use client";

import { useState, useEffect } from "react";
import { hasLevel } from "@/lib/permissionCatalog";
import {
    PLC_GROUPS, PLC_FIELDS,
    formatValue, validateField, rawEquals,
} from "@/lib/plcParamCatalog";
import PlcDialog from "@/components/PlcDialog";

const INPUT =
    "w-full bg-white border border-scada-idle rounded px-3 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-scada-bg";

// ── Popup konfirmasi: nilai lama → nilai baru, alasan wajib, lalu hasil baca-balik ──
function ConfirmDialog({ title, pending, reason, onReason, saving, error, done, onCancel, onConfirm, onClose }) {
    const hasDanger = pending.some((p) => p.def.danger);
    const hasRecipe = pending.some((p) => p.def.recipeDriven);

    if (done) {
        return (
            <PlcDialog title="Tersimpan ke PLC" wide>
                <p className="mb-3 text-scada-muted">
                    Nilai berikut sudah ditulis dan terbaca balik dari PLC. Cocokkan dengan layar HMI.
                </p>
                <table className="w-full text-sm mb-4">
                    <thead>
                        <tr className="text-left text-xs uppercase text-scada-muted border-b border-scada-rule">
                            <th className="py-1 pr-2">Parameter</th>
                            <th className="py-1 pr-2">Lama</th>
                            <th className="py-1 pr-2">Baru</th>
                            <th className="py-1">Terbaca dari PLC</th>
                        </tr>
                    </thead>
                    <tbody>
                        {done.map((w) => (
                            <tr key={w.key} className="border-b border-scada-rule last:border-0">
                                <td className="py-1.5 pr-2">{w.label}</td>
                                <td className="py-1.5 pr-2 font-mono">{w.oldLabel}</td>
                                <td className="py-1.5 pr-2 font-mono">{w.newLabel}</td>
                                <td className="py-1.5 font-mono font-semibold text-scada-run">{w.readBackLabel}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-scada-water hover:bg-scada-water-hover text-white rounded text-sm font-semibold transition-colors"
                    >
                        Selesai
                    </button>
                </div>
            </PlcDialog>
        );
    }

    return (
        <PlcDialog title={`Konfirmasi tulis ke PLC — ${title}`} wide>
            {hasDanger && (
                <div className="mb-3 px-3 py-2 rounded bg-scada-stop text-white text-sm font-semibold">
                    PERHATIAN: perubahan ini memengaruhi pengaman mesin (interlock pintu / pembacaan tekanan).
                    Pastikan nilainya benar sebelum melanjutkan.
                </div>
            )}
            {hasRecipe && (
                <div className="mb-3 px-3 py-2 rounded bg-scada-bg border border-scada-steam text-sm">
                    Sebagian nilai ini ditimpa oleh resep setiap kali START dari web. Perubahan hanya bertahan untuk start dari HMI.
                </div>
            )}
            <table className="w-full text-sm mb-4">
                <thead>
                    <tr className="text-left text-xs uppercase text-scada-muted border-b border-scada-rule">
                        <th className="py-1 pr-2">Parameter</th>
                        <th className="py-1 pr-2">Nilai lama</th>
                        <th className="py-1">Nilai baru</th>
                    </tr>
                </thead>
                <tbody>
                    {pending.map((p) => (
                        <tr key={p.def.key} className="border-b border-scada-rule last:border-0">
                            <td className="py-1.5 pr-2">{p.def.label}</td>
                            <td className="py-1.5 pr-2 font-mono">{formatValue(p.def, p.oldValue)} {p.def.kind !== "bool" ? p.def.unit : ""}</td>
                            <td className="py-1.5 font-mono font-semibold">{formatValue(p.def, p.value)} {p.def.kind !== "bool" ? p.def.unit : ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <label className="block text-xs uppercase text-scada-muted mb-1" htmlFor="plc-reason">
                Alasan perubahan (wajib, tercatat di Audit Log)
            </label>
            <textarea
                id="plc-reason"
                rows={2}
                maxLength={200}
                value={reason}
                onChange={(e) => onReason(e.target.value)}
                disabled={saving}
                className={INPUT + " mb-3"}
                placeholder="Contoh: kalibrasi tahunan sensor T3 oleh teknisi"
            />

            {error && (
                <div className="mb-3 px-3 py-2 rounded bg-scada-stop text-white text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    disabled={saving}
                    className="px-5 py-2 border border-scada-idle rounded text-sm font-semibold hover:bg-scada-bg transition-colors disabled:opacity-40"
                >
                    Batal
                </button>
                <button
                    onClick={onConfirm}
                    disabled={saving || reason.trim().length < 3}
                    className="px-5 py-2 bg-scada-run hover:bg-scada-run-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {saving ? "Menulis ke PLC…" : "Tulis ke PLC"}
                </button>
            </div>
        </PlcDialog>
    );
}

// ── Satu baris field ──────────────────────────────────────────────────────────
// showSensorColumn: true untuk grup kalibrasi — kolom selalu tampil walau PLC offline.
function FieldRow({ def, current, liveValue, showSensorColumn, input, error, editable, onChange }) {
    const isBool = def.kind === "bool";
    const shown = input ?? "";

    const hasLiveVal = liveValue !== null && liveValue !== undefined;
    const liveUnit = def.unit === "°C" ? "°C" : (def.unit === "kPa" ? "kPa" : "");
    const liveFormatted = hasLiveVal
        ? (typeof liveValue === "number"
            ? (liveValue >= 0 ? "+" : "") + liveValue.toFixed(def.unit === "kPa" ? 0 : 1)
            : String(liveValue))
        : null;

    return (
        <div className={`grid gap-x-4 gap-y-1 px-4 py-3 border-b border-scada-rule last:border-0 items-start ${showSensorColumn ? "grid-cols-1 md:grid-cols-[10rem_9rem_9rem_1fr]" : "grid-cols-1 md:grid-cols-[11rem_10rem_1fr]"}`}>
            <div>
                <div className="text-xs uppercase text-scada-muted font-semibold">{def.label}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                    {def.readOnly && <span className="px-1.5 py-0.5 text-[10px] rounded bg-scada-idle text-scada-ink">hanya dibaca</span>}
                    {def.restricted && <span className="px-1.5 py-0.5 text-[10px] rounded bg-scada-steam text-white">keselamatan</span>}
                    {def.recipeDriven && <span className="px-1.5 py-0.5 text-[10px] rounded bg-scada-water text-white">ditimpa resep</span>}
                </div>
            </div>
            {/* Kolom "Nilai Sensor" — selalu ada untuk grup kalibrasi, "—" bila PLC offline */}
            {showSensorColumn && (
                <div>
                    <div className="text-[10px] uppercase text-scada-muted">Nilai Sensor</div>
                    <div className="font-mono text-sm font-semibold text-scada-water">
                        {liveFormatted !== null
                            ? <>{liveFormatted} <span className="text-scada-muted font-normal">{liveUnit}</span></>
                            : <span className="text-scada-muted font-normal">—</span>
                        }
                    </div>
                </div>
            )}
            <div>
                <div className="text-[10px] uppercase text-scada-muted">{showSensorColumn ? "Offset Kalibrasi" : "Nilai PLC"}</div>
                <div className="font-mono text-sm font-semibold">
                    {formatValue(def, current)} {current !== null && current !== undefined && !isBool ? <span className="text-scada-muted font-normal">{def.unit}</span> : null}
                </div>
            </div>
            <div>
                {def.readOnly ? (
                    <p className="text-xs text-scada-muted">{def.hint}</p>
                ) : isBool ? (
                    <select
                        className={INPUT + " cursor-pointer"}
                        disabled={!editable}
                        value={shown}
                        onChange={(e) => onChange(def.key, e.target.value)}
                    >
                        <option value="">(tidak diubah)</option>
                        {def.options.map((o) => (
                            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                        ))}
                    </select>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            inputMode="decimal"
                            step={def.kind === "int" ? 1 / def.scale : "any"}
                            min={def.min}
                            max={def.max}
                            className={INPUT + " max-w-[10rem]"}
                            disabled={!editable}
                            placeholder="nilai baru"
                            value={shown}
                            onChange={(e) => onChange(def.key, e.target.value)}
                        />
                        <span className="text-xs text-scada-muted whitespace-nowrap">
                            {def.unit} · {def.min} s.d. {def.max}
                        </span>
                    </div>
                )}
                {error && <p className="mt-1 text-xs text-scada-stop">{error}</p>}
                {!def.readOnly && def.hint && <p className="mt-1 text-xs text-scada-muted">{def.hint}</p>}
            </div>
        </div>
    );
}

// ── Panel satu grup (di-remount tiap ganti tab lewat prop key) ────────────────
function GroupPanel({ group, perms }) {
    const meta = PLC_GROUPS[group];
    const fields = PLC_FIELDS[group];

    const [tick, setTick] = useState(0);
    const [result, setResult] = useState(null); // { tick, status, data }
    const [inputs, setInputs] = useState({});
    const [dialog, setDialog] = useState(false);
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [dlgError, setDlgError] = useState(null);
    const [done, setDone] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/plc-params?group=${group}`, { cache: "no-store" })
            .then((r) => r.json().then((data) => ({ status: r.status, data })))
            .then(({ status, data }) => { if (!cancelled) setResult({ tick, status, data }); })
            .catch(() => { if (!cancelled) setResult({ tick, status: 0, data: null }); });
        return () => { cancelled = true; };
    }, [group, tick]);

    const loading = !result || result.tick !== tick;
    const data = result?.data ?? null;
    const plcOk = data?.plcOk === true;
    const idle = data?.idle ?? null;
    // liveValues: nilai sensor aktual (hanya ada untuk grup kalibrasi, dari API)
    const liveValues = data?.liveValues ?? null;
    // showSensorColumn: true untuk kalibrasi — kolom tampil selalu (walau PLC offline)
    const showSensorColumn = group === "calibration";

    const baseEdit =
        hasLevel(perms, meta.resource, "edit") &&
        (!meta.writeAction || hasLevel(perms, meta.writeAction, "edit"));
    const canEditField = (def) =>
        baseEdit && !def.readOnly && (!def.restricted || hasLevel(perms, def.restricted, "edit"));
    const writableNow = plcOk && idle?.ok === true;

    // Hitung perubahan yang tertunda + galat per field
    const pending = [];
    const errors = {};
    for (const def of fields) {
        const typed = inputs[def.key];
        if (typed === undefined || String(typed).trim() === "") continue;
        const v = validateField(def, typed);
        if (!v.ok) { errors[def.key] = v.error; continue; }
        const cur = data?.values?.[def.key];
        if (!cur || cur.raw === null || cur.raw === undefined) continue;
        if (rawEquals(def, v.raw, cur.raw)) continue;
        pending.push({ def, input: typed, value: v.value, oldValue: cur.value });
    }
    const hasErrors = Object.keys(errors).length > 0;

    function handleChange(key, value) {
        setInputs((prev) => ({ ...prev, [key]: value }));
    }

    function openDialog() {
        setReason("");
        setDlgError(null);
        setDone(null);
        setDialog(true);
    }

    async function handleConfirm() {
        setSaving(true);
        setDlgError(null);
        try {
            const res = await fetch("/api/plc-params", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    group,
                    changes: Object.fromEntries(pending.map((p) => [p.def.key, p.input])),
                    reason,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                setDlgError(json.error ?? "Gagal menulis ke PLC.");
                if (res.status === 502) setTick((t) => t + 1); // nilai PLC mungkin berubah: muat ulang
                return;
            }
            const defByKey = Object.fromEntries(fields.map((f) => [f.key, f]));
            setDone(json.written.map((w) => {
                const def = defByKey[w.key];
                const u = def.kind !== "bool" ? ` ${def.unit}` : "";
                return {
                    ...w,
                    oldLabel: formatValue(def, w.oldValue) + u,
                    newLabel: formatValue(def, w.newValue) + u,
                    readBackLabel: formatValue(def, w.readBackValue) + u,
                };
            }));
            setInputs({});
            setTick((t) => t + 1);
        } catch {
            setDlgError("Gagal terhubung ke server.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            {loading && <p className="mb-3 text-sm text-scada-muted">Membaca nilai dari PLC…</p>}
            {!loading && result.status === 403 && (
                <p className="mb-3 text-sm text-scada-stop">Anda tidak memiliki izin untuk melihat bagian ini.</p>
            )}
            {!loading && data && !plcOk && (
                <div className="mb-3 px-4 py-2 rounded bg-scada-stop text-white text-sm font-semibold">
                    {data.plcError ?? "PLC tidak terbaca."} Nilai tidak ditampilkan.
                </div>
            )}
            {!loading && plcOk && idle && !idle.ok && (
                <div className="mb-3 px-4 py-2 rounded bg-scada-steam text-white text-sm">
                    Penulisan dikunci: {idle.reason} Nilai tetap bisa dilihat.
                </div>
            )}
            {!loading && plcOk && !baseEdit && (
                <p className="mb-3 text-xs text-scada-muted italic">Anda hanya punya akses lihat untuk bagian ini.</p>
            )}

            <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm overflow-hidden">
                {fields.map((def) => (
                    <FieldRow
                        key={def.key}
                        def={def}
                        current={data?.values?.[def.key]?.value ?? null}
                        liveValue={liveValues ? (liveValues[def.key] ?? null) : null}
                        showSensorColumn={showSensorColumn}
                        input={inputs[def.key]}
                        error={errors[def.key]}
                        editable={canEditField(def) && writableNow}
                        onChange={handleChange}
                    />
                ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    onClick={openDialog}
                    disabled={pending.length === 0 || hasErrors || !writableNow || !baseEdit}
                    className="px-5 py-2 bg-scada-run hover:bg-scada-run-hover text-white rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Simpan{pending.length > 0 ? ` (${pending.length} perubahan)` : ""}
                </button>
                <button
                    onClick={() => { setInputs({}); setTick((t) => t + 1); }}
                    className="px-5 py-2 border border-scada-idle rounded text-sm font-semibold hover:bg-scada-bg transition-colors"
                >
                    Muat ulang dari PLC
                </button>
                {baseEdit && (
                    <span className="text-xs text-scada-muted">
                        Setelah Simpan, ada popup konfirmasi. Cocokkan nilai dengan layar HMI di mesin.
                    </span>
                )}
            </div>

            {dialog && (
                <ConfirmDialog
                    title={meta.title}
                    pending={pending}
                    reason={reason}
                    onReason={setReason}
                    saving={saving}
                    error={dlgError}
                    done={done}
                    onCancel={() => setDialog(false)}
                    onConfirm={handleConfirm}
                    onClose={() => setDialog(false)}
                />
            )}
        </div>
    );
}

// ── Komponen utama: tab antar grup + izin dari /api/auth/me ───────────────────
export default function PlcParamEditor({ title, subtitle, groups }) {
    const [active, setActive] = useState(groups[0]);
    const [perms, setPerms] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (!cancelled && json.ok) setPerms(json.user.permissions ?? null); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            <div className="mb-5">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-sm text-scada-muted mt-1">{subtitle}</p>
            </div>

            {groups.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {groups.map((g) => (
                        <button
                            key={g}
                            onClick={() => setActive(g)}
                            className={`px-4 py-2 rounded text-sm font-semibold border transition-colors ${active === g
                                ? "bg-scada-water text-white border-scada-water"
                                : "bg-scada-card text-scada-ink border-scada-rule hover:bg-scada-bg"}`}
                        >
                            {PLC_GROUPS[g].title}
                        </button>
                    ))}
                </div>
            )}

            <GroupPanel key={active} group={active} perms={perms} />
        </main>
    );
}
