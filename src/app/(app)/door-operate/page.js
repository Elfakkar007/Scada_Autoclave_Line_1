"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { hasLevel } from "@/lib/permissionCatalog";
import { checkDoorCommand } from "@/lib/plcDoorCatalog";
import PermissionGate from "@/components/PermissionGate";

const PHASE_LABEL = {
    0: "Idle (pintu belum tertutup)", 1: "Siap (pintu tertutup)", 2: "FILLING", 3: "HEATING",
    4: "STERIL.", 5: "COOLING", 6: "END", 7: "DRAIN",
};

const HOLD_INTERVAL_MS = 100; // kirim "run" tiap ini selama tombol ditahan (server mematikan bila >1 dtk sepi)

function postDoor(body, keepalive = false) {
    return fetch("/api/plc-door", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
    });
}

function Lamp({ on, label }) {
    const cls = on === null || on === undefined ? "bg-scada-idle" : on ? "bg-scada-run" : "bg-white border border-scada-idle";
    return (
        <div className="flex items-center gap-2 text-xs uppercase text-scada-muted">
            <span className={`inline-block w-4 h-4 rounded-full ${cls}`} />
            {label}
        </div>
    );
}

function CmdButton({ label, color, disabled, onClick, hint }) {
    const palette = {
        water: "bg-scada-water hover:bg-scada-water-hover",
        stop: "bg-scada-stop hover:bg-scada-stop-hover",
        steam: "bg-scada-steam hover:bg-scada-steam-hover",
        run: "bg-scada-run",
    }[color] ?? "bg-scada-water hover:bg-scada-water-hover";
    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={onClick}
                disabled={disabled}
                className={`px-4 py-3 rounded text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${palette}`}
            >
                {label}
            </button>
            {hint && <p className="text-[11px] text-scada-muted leading-snug">{hint}</p>}
        </div>
    );
}

// Tombol "tahan": aktif hanya selama ditekan. Pelepasan dalam bentuk apa pun = berhenti.
function HoldButton({ label, active, disabled, onStart, onEnd, hint }) {
    return (
        <div className="flex flex-col gap-1">
            <button
                disabled={disabled}
                onPointerDown={(e) => {
                    if (e.button !== undefined && e.button !== 0) return;
                    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* tidak semua perangkat */ }
                    onStart();
                }}
                onPointerUp={onEnd}
                onPointerCancel={onEnd}
                onPointerLeave={onEnd}
                onLostPointerCapture={onEnd}
                onContextMenu={(e) => e.preventDefault()}
                style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
                className={`px-4 py-3 rounded text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active
                    ? "bg-scada-run"
                    : "bg-scada-water hover:bg-scada-water-hover"}`}
            >
                {active ? `${label} (ditahan)` : `${label} (tahan)`}
            </button>
            {hint && <p className="text-[11px] text-scada-muted leading-snug">{hint}</p>}
        </div>
    );
}

function DoorContent() {
    const [perms, setPerms] = useState(null);
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null); // { type: "error"|"ok", text }
    const [holding, setHolding] = useState(null); // "fwd" | "bwd" | null

    // Status tombol tahan hidup di ref: dibaca oleh loop async dan event, bukan saat render.
    const holdRef = useRef({ token: 0 });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => { if (!cancelled && json.ok) setPerms(json.user.permissions ?? null); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    // Keadaan mesin di-poll tiap 500ms agar monitoring lebih real-time
    useEffect(() => {
        let cancelled = false;
        const load = () =>
            fetch("/api/plc-door", { cache: "no-store" })
                .then((r) => r.json())
                .then((json) => { if (!cancelled) setState(json); })
                .catch(() => { });
        load();
        const id = setInterval(load, 500);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    // Lepas tombol / sembunyikan halaman / tutup tab / koneksi putus → rantai berhenti.
    const endHold = useCallback(() => {
        if (!holdRef.current.token) return;
        holdRef.current = { token: 0 };
        setHolding(null);
        postDoor({ action: "chain", mode: "stop" }, true).catch(() => {
            // keepalive gagal: coba sendBeacon sebagai jalan terakhir
            try {
                const blob = new Blob([JSON.stringify({ action: "chain", mode: "stop" })], { type: "application/json" });
                navigator.sendBeacon("/api/plc-door", blob);
            } catch { /* server tetap mematikan lewat timeout deadman */ }
        });
    }, []);

    useEffect(() => {
        const onHide = () => { if (document.visibilityState === "hidden") endHold(); };
        window.addEventListener("blur", endHold);
        window.addEventListener("pagehide", endHold);
        document.addEventListener("visibilitychange", onHide);
        return () => {
            window.removeEventListener("blur", endHold);
            window.removeEventListener("pagehide", endHold);
            document.removeEventListener("visibilitychange", onHide);
            endHold(); // pindah halaman
        };
    }, [endHold]);

    const startHold = useCallback((dir) => {
        if (holdRef.current.token) return;
        const token = Date.now();
        holdRef.current = { token };
        setHolding(dir);
        setMessage(null);

        // Fire-and-forget: tidak menunggu response sebelum mengirim tick berikutnya.
        // Error berturut-turut (MAX_ERRORS kali) tetap menghentikan loop dengan aman.
        // Deadman di server (DEADMAN_TIMEOUT_MS=1000ms) tetap aktif sebagai jaring pengaman.
        let errorCount = 0;
        const MAX_ERRORS = 3;

        const tick = async () => {
            if (holdRef.current.token !== token) return; // sudah dilepas
            try {
                const res = await postDoor({ action: "chain", mode: "run", dir });
                const json = await res.json();
                if (holdRef.current.token !== token) return; // dilepas saat await
                if (!json.ok) {
                    errorCount++;
                    if (errorCount >= MAX_ERRORS) {
                        setMessage({ type: "error", text: json.error ?? "Perintah rantai gagal." });
                        endHold();
                        return;
                    }
                } else {
                    errorCount = 0; // reset bila berhasil
                }
            } catch {
                errorCount++;
                if (errorCount >= MAX_ERRORS) {
                    setMessage({ type: "error", text: "Koneksi ke server terputus. Rantai dihentikan." });
                    endHold();
                    return;
                }
            }
            if (holdRef.current.token === token) {
                setTimeout(tick, HOLD_INTERVAL_MS);
            }
        };

        tick(); // mulai segera tanpa delay awal
    }, [endHold]);

    // Sama dengan server: manual_control edit ATAU hak START/STOP (dashboard edit + batch_control edit).
    const canEdit = hasLevel(perms, "manual_control", "edit")
        || (hasLevel(perms, "dashboard", "edit") && hasLevel(perms, "action.batch_control", "edit"));
    const plcOk = state?.plcOk === true;
    const missing = plcOk ? state.missingTags ?? [] : [];
    const usable = canEdit && plcOk && missing.length === 0 && !busy;
    const cmd = plcOk ? state.commands ?? {} : {};
    const doors = plcOk ? state.doors ?? {} : {};

    // Alasan penolakan per tombol (pagar yang sama dengan server; server tetap yang menentukan)
    const why = (a) => (plcOk ? checkDoorCommand(a, state) : null);
    const refuse = { seal: why("seal"), release: why("release"), drain: why("drain"), unlock: why("unlock"), fwd: why("fwd"), bwd: why("bwd") };
    const drainOn = cmd.drain === true;
    const unlockOn = cmd.unlock === true;
    // Door Release: toggle — cmd.release true = M1.3 aktif (menahan seal lepas)
    const releaseOn = cmd.release === true;
    const p1High = plcOk && state.p1 !== null && state.safetyPress !== null && state.p1 > state.safetyPress;
    const chainStuck = plcOk && state.chain?.stuck === true;
    const secLeft = (ms) => (ms === null || ms === undefined ? null : Math.ceil(ms / 1000));

    async function send(body) {
        setBusy(true);
        setMessage(null);
        try {
            const res = await postDoor(body);
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

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            <div className="mb-5">
                <h1 className="text-2xl font-bold tracking-tight">Door Operate</h1>
                <p className="text-sm text-scada-muted mt-1">
                    Super Water Sterilizer — Front Door Operate di HMI (seal, rantai, buang air). HMI tetap bisa dipakai sebagai cadangan.
                </p>
            </div>

            {state && !plcOk && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-stop text-white text-sm font-semibold">
                    {state.plcError ?? "PLC tidak terbaca."}
                </div>
            )}
            {missing.length > 0 && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-steam text-white text-sm">
                    Tag belum ada di KEPServerEX ({missing.join(", ")}). Impor <b>SiemensS7-200_pintu_NANTI.csv</b> dan
                    <b> SiemensS7-200_manual_NANTI.csv</b> dulu.
                </div>
            )}
            {chainStuck && (
                <div className="mb-4 px-4 py-2 rounded bg-scada-stop text-white text-sm font-semibold flex items-center justify-between gap-4">
                    <span>Rantai terakhir TIDAK terverifikasi mati di PLC. Periksa mesin; matikan CHAIN_FWD/CHAIN_BWD dari HMI atau KEPServerEX.</span>
                    <button
                        onClick={async () => {
                            // Kirim stop untuk memaksa ulang writeFalse; bila berhasil, chain.stuck akan jadi false
                            await postDoor({ action: "chain", mode: "stop" });
                        }}
                        className="shrink-0 px-3 py-1 rounded bg-white text-scada-stop font-bold text-xs hover:bg-gray-100"
                    >
                        Coba Matikan
                    </button>
                </div>
            )}
            {message && (
                <div className={`mb-4 px-4 py-2 rounded text-sm font-medium text-white ${message.type === "error" ? "bg-scada-stop" : "bg-scada-run"}`}>
                    {message.text}
                </div>
            )}
            {!canEdit && perms && (
                <p className="mb-4 text-xs text-scada-muted italic">Anda hanya punya akses lihat untuk Door Operate.</p>
            )}

            <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4 mb-5 flex flex-wrap items-center gap-8">
                <div>
                    <div className="text-xs uppercase text-scada-muted">Fase mesin</div>
                    <div className="mt-1 text-sm font-semibold">
                        {plcOk && state.phase !== null ? (PHASE_LABEL[state.phase] ?? `kode ${state.phase}`) : "—"}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase text-scada-muted">Pre. (P1) / Safety Press</div>
                    <div className={`mt-1 text-sm font-mono font-semibold ${p1High ? "text-scada-stop" : ""}`}>
                        {plcOk && state.p1 !== null ? state.p1 : "—"} / {plcOk && state.safetyPress !== null ? state.safetyPress : "—"} kPa
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase text-scada-muted">Seal pintu</div>
                    <div className={`mt-1 inline-block px-3 py-1 rounded text-sm font-bold text-white ${doors.seal === true ? "bg-scada-run" : "bg-scada-idle"}`}>
                        {plcOk && doors.seal !== null && doors.seal !== undefined ? (doors.seal ? "AKTIF" : "LEPAS") : "…"}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase text-scada-muted">Mode manual</div>
                    <div className="mt-1 text-sm font-semibold">
                        {plcOk && state.manualMode !== null ? (state.manualMode ? "AKTIF (perintah pintu dikunci)" : "Tidak aktif") : "—"}
                    </div>
                </div>
            </div>

            <div className="bg-scada-card border border-scada-rule rounded-lg shadow-sm p-4 mb-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Lamp on={plcOk ? doors.clsFrnt ?? null : null} label="Front door closed" />
                    <Lamp on={plcOk ? doors.opnFrnt ?? null : null} label="Front door opened" />
                    <Lamp on={plcOk ? doors.clsRear ?? null : null} label="Rear door closed" />
                    <Lamp on={plcOk ? doors.opnRear ?? null : null} label="Rear door opened" />
                    <Lamp on={plcOk ? state.waterLevel ?? null : null} label="Water level" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <CmdButton
                    label="Door Sealing" color="water"
                    disabled={!usable || !!refuse.seal}
                    onClick={() => send({ action: "seal" })}
                    hint={refuse.seal && canEdit ? refuse.seal : "Pulsa singkat; seal aktif bila kedua pintu tertutup."}
                />
                <CmdButton
                    label={releaseOn ? "Door Release: MATIKAN" : "Door Release"}
                    color={releaseOn ? "stop" : "steam"}
                    disabled={releaseOn ? !(canEdit && plcOk && !busy) : (!usable || !!refuse.release)}
                    onClick={() => send({ action: "release", value: !releaseOn })}
                    hint={!releaseOn && refuse.release && canEdit ? refuse.release : "Melepas seal. Bisa ditekan saat pintu terbuka atau saat P1 ≤ Safety Press."}
                />
                <CmdButton
                    label={drainOn ? `Water Drain: MATIKAN${secLeft(state?.autoOff?.drain) !== null ? ` (auto-OFF ${secLeft(state.autoOff.drain)} dtk)` : ""}` : "Water Drain"}
                    color={drainOn ? "stop" : "water"}
                    disabled={drainOn ? !(canEdit && plcOk && !busy) : (!usable || !!refuse.drain)}
                    onClick={() => send({ action: "drain", value: !drainOn })}
                    hint={!drainOn && refuse.drain && canEdit ? refuse.drain : "Buang air chamber. Mati sendiri setelah 60 detik."}
                />
                <HoldButton
                    label="Forward" active={holding === "fwd"}
                    disabled={!usable || !!refuse.fwd || (holding !== null && holding !== "fwd")}
                    onStart={() => startHold("fwd")} onEnd={endHold}
                    hint={refuse.fwd && canEdit ? refuse.fwd : "Rantai maju hanya selama ditahan."}
                />
                <HoldButton
                    label="Backward" active={holding === "bwd"}
                    disabled={!usable || !!refuse.bwd || (holding !== null && holding !== "bwd")}
                    onStart={() => startHold("bwd")} onEnd={endHold}
                    hint={refuse.bwd && canEdit ? refuse.bwd : "Rantai mundur hanya selama ditahan."}
                />
                <CmdButton
                    label={unlockOn ? `Door Unlock: MATIKAN${secLeft(state?.autoOff?.unlock) !== null ? ` (auto-OFF ${secLeft(state.autoOff.unlock)} dtk)` : ""}` : "Door Unlock"}
                    color="stop"
                    disabled={unlockOn ? !(canEdit && plcOk && !busy) : (!usable || !!refuse.unlock)}
                    onClick={() => send({ action: "unlock", value: !unlockOn })}
                    hint={!unlockOn && refuse.unlock && canEdit ? refuse.unlock : "Bypass interlock PLC. Hanya bila P1 ≤ Safety Press; mati sendiri setelah 60 detik."}
                />
            </div>

            <div className="mt-6 text-xs text-scada-muted max-w-3xl space-y-1">
                <p>Forward/Backward berjalan hanya selama tombol ditahan dan berhenti otomatis bila dilepas, halaman ditutup, atau koneksi putus.</p>
                <p>Pastikan tidak ada orang di area rantai dan kereta sebelum menggerakkan. Bila server/PC mati saat rantai bergerak, rantai berjalan sampai PLC memotongnya; gunakan HMI.</p>
                <p>Setelah siklus END, tekan Reset di Dashboard dulu sebelum Door Release.</p>
            </div>
        </main>
    );
}

export default function DoorOperatePage() {
    return (
        <PermissionGate resource="manual_control" minLevel="view">
            <DoorContent />
        </PermissionGate>
    );
}
