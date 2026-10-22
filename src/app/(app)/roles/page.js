"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    RESOURCES,
    LEVEL_LABELS,
    hasLevel,
    normalizePermissions,
} from "@/lib/permissionCatalog";

// ── Helper bentuk respons API ─────────────────────────────────────────────────
// Dibuat tahan terhadap variasi nama field (camelCase / snake_case) dan pembungkus
// respons. Yang TIDAK boleh ditebak: izin. Bila respons detail tidak memuat
// `permissions`, halaman menolak mengedit (bukan menampilkan "semua none").
function countOf(r) {
    const v = r.userCount ?? r.user_count ?? r.usersCount ?? r.users_count ?? r.memberCount;
    if (v != null && Number.isFinite(Number(v))) return Number(v);
    if (Array.isArray(r.users)) return r.users.length;
    return null; // tidak diketahui
}

function normRole(r) {
    return {
        id: r.id,
        key: r.key,
        name: r.name ?? r.key ?? "",
        description: r.description ?? "",
        isSystem: Boolean(r.isSystem ?? r.is_system),
        userCount: countOf(r),
    };
}

function toPermMap(p) {
    if (Array.isArray(p)) {
        const m = {};
        for (const x of p) if (x?.resource) m[x.resource] = x.level;
        return normalizePermissions(m);
    }
    return normalizePermissions(p);
}

// Label level. Kunci aksi ("action.*") hanya punya none/edit → bahasa yang lebih pas.
const ACTION_LABELS = { none: "Ditolak", edit: "Diizinkan" };
function levelLabel(resource, level) {
    return resource.group === "action" ? ACTION_LABELS[level] : LEVEL_LABELS[level];
}

const ACTIVE_CLASS = {
    none: "bg-scada-idle text-scada-ink",
    view: "bg-scada-steam text-white",
    edit: "bg-scada-water text-white",
};

// ── Toast & Badge (pola sama dengan halaman Kelola User) ─────────────────────
function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium transition-all ${toast.type === "error"
                ? "bg-red-900 border border-red-700 text-red-200"
                : "bg-green-900 border border-green-700 text-green-200"
            }`}>
            {toast.msg}
        </div>
    );
}

function Badge({ children, colorClass = "bg-scada-idle text-scada-ink" }) {
    return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${colorClass}`}>
            {children}
        </span>
    );
}

const inputClass = "w-full bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const labelClass = "block text-xs text-scada-muted uppercase mb-1";

// ── Matriks izin: resource × level ───────────────────────────────────────────
function PermissionMatrix({ perms, original, disabled, onChange }) {
    const groups = [
        { id: "page", title: "Halaman" },
        { id: "action", title: "Kunci aksi kritis" },
    ];

    return (
        <div className="overflow-x-auto border border-scada-rule rounded">
            <table className="w-full">
                <thead className="bg-scada-bg border-b border-scada-rule">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs text-scada-muted uppercase tracking-wider font-semibold">
                            Resource
                        </th>
                        <th className="px-4 py-2 text-left text-xs text-scada-muted uppercase tracking-wider font-semibold">
                            Level akses
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((g) => (
                        <Fragment key={g.id}>
                            <tr className="bg-scada-bg border-b border-scada-rule">
                                <td colSpan={2} className="px-4 py-1.5 text-xs font-semibold text-scada-muted uppercase tracking-wider">
                                    {g.title}
                                </td>
                            </tr>
                            {RESOURCES.filter((r) => r.group === g.id).map((r) => {
                                const current = perms[r.key];
                                const changed = original && original[r.key] !== current;
                                return (
                                    <tr key={r.key} className="border-b border-scada-rule last:border-b-0">
                                        <td className="px-4 py-2 text-sm">
                                            {r.label}
                                            {changed && (
                                                <span className="ml-2 text-xs text-scada-water font-semibold">● diubah</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="inline-flex rounded border border-scada-idle overflow-hidden">
                                                {r.levels.map((lv) => {
                                                    const active = current === lv;
                                                    return (
                                                        <button
                                                            key={lv}
                                                            type="button"
                                                            disabled={disabled}
                                                            onClick={() => onChange(r.key, lv)}
                                                            className={`px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${active
                                                                    ? ACTIVE_CLASS[lv]
                                                                    : "bg-white text-scada-muted hover:bg-scada-bg disabled:hover:bg-white"
                                                                }`}
                                                        >
                                                            {levelLabel(r, lv)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Form buat role ────────────────────────────────────────────────────────────
function CreateRoleForm({ roles, onCreated, onCancel }) {
    const [form, setForm] = useState({ name: "", key: "", description: "", copyFromRoleId: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) {
            setError("Nama role wajib diisi");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const body = { name: form.name.trim() };
            if (form.key.trim()) body.key = form.key.trim();
            if (form.description.trim()) body.description = form.description.trim();
            if (form.copyFromRoleId !== "") body.copyFromRoleId = Number(form.copyFromRoleId);

            const res = await fetch("/api/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
                setError(json?.error ?? "Gagal membuat role");
                return;
            }
            onCreated(json?.role?.id ?? json?.id ?? null, body.name);
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="bg-scada-card border border-scada-rule rounded shadow-sm p-5 mb-5">
            <h2 className="font-semibold text-sm mb-4">Buat Role Baru</h2>
            {error && (
                <div className="mb-3 px-3 py-2 bg-red-900 border border-red-700 text-red-200 rounded text-sm">
                    {error}
                </div>
            )}
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className={labelClass}>Nama role</label>
                        <input type="text" className={inputClass} placeholder="mis. Supervisor"
                            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelClass}>Key (opsional)</label>
                        <input type="text" className={inputClass + " font-mono"} placeholder="otomatis dari nama"
                            value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
                        <p className="text-xs text-scada-muted mt-0.5">
                            Huruf kecil, angka, garis bawah; awali huruf; 2–32 karakter. Tidak bisa diubah setelah dibuat.
                        </p>
                    </div>
                    <div>
                        <label className={labelClass}>Deskripsi (opsional)</label>
                        <input type="text" className={inputClass}
                            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelClass}>Salin izin dari</label>
                        <select className={inputClass + " cursor-pointer"}
                            value={form.copyFromRoleId}
                            onChange={(e) => setForm({ ...form, copyFromRoleId: e.target.value })}>
                            <option value="">(kosong: semua tersembunyi)</option>
                            {roles.map((r) => (
                                <option key={r.id} value={String(r.id)}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button type="submit" disabled={saving}
                        className="px-5 py-2 bg-scada-water hover:bg-scada-water-hover disabled:opacity-40 disabled:cursor-not-allowed rounded text-white text-sm font-semibold transition-colors">
                        {saving ? "Membuat…" : "Buat Role"}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-5 py-2 bg-white border border-scada-idle hover:bg-scada-bg rounded text-scada-ink text-sm font-semibold transition-colors">
                        Batal
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function RolesPage() {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [canEdit, setCanEdit] = useState(false);

    const [roles, setRoles] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [listError, setListError] = useState(null);

    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);   // data tersimpan di server
    const [draft, setDraft] = useState(null);   // yang sedang diedit
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState(null);
    const [reloadTick, setReloadTick] = useState(0);

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [toast, setToast] = useState(null);

    function showToast(msg, type = "success") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), type === "error" ? 6000 : 3000);
    }

    // Proteksi level halaman: izin "roles" minimal view (ubah = boleh buat/edit/hapus)
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                const perms = json.user?.permissions;
                if (json.ok && hasLevel(perms, "roles", "view")) {
                    setAuthorized(true);
                    setCanEdit(hasLevel(perms, "roles", "edit"));
                } else {
                    router.replace("/");
                }
            })
            .catch(() => router.replace("/"));
    }, [router]);

    const fetchRoles = useCallback(async () => {
        setLoadingList(true);
        try {
            const res = await fetch("/api/roles");
            const json = await res.json().catch(() => null);
            if (!res.ok || !json || json.ok === false) {
                setRoles([]);
                setListError(json?.error ?? `Gagal memuat daftar role (HTTP ${res.status})`);
                return;
            }
            const raw = Array.isArray(json) ? json : (json.roles ?? json.data ?? []);
            const list = raw.filter((r) => r && r.id != null).map(normRole);
            setListError(null);
            setRoles(list);
            // Pertahankan pilihan bila masih ada; kalau tidak, pilih role pertama
            setSelectedId((prev) =>
                prev != null && list.some((r) => r.id === prev) ? prev : (list[0]?.id ?? null)
            );
        } catch {
            setRoles([]);
            setListError("Gagal terhubung ke server");
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (authorized) fetchRoles();
    }, [authorized, fetchRoles]);

    // Muat detail (dengan izin) tiap role dipilih / setelah simpan
    useEffect(() => {
        if (!authorized || selectedId == null) return;
        let cancelled = false;
        (async () => {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoadingDetail(true);
            setDetailError(null);
            try {
                const res = await fetch(`/api/roles/${encodeURIComponent(selectedId)}`);
                const json = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok || !json || json.ok === false) {
                    setDetail(null);
                    setDraft(null);
                    setDetailError(json?.error ?? `Gagal memuat role (HTTP ${res.status})`);
                    return;
                }
                const obj = json.role ?? json;
                if (obj.permissions == null) {
                    // Jangan menebak: menampilkan "semua tersembunyi" lalu menyimpannya
                    // akan menghapus izin role ini.
                    setDetail(null);
                    setDraft(null);
                    setDetailError("Respons server tidak memuat daftar izin role ini, editor dinonaktifkan.");
                    return;
                }
                const base = normRole(obj);
                const perms = toPermMap(obj.permissions);
                setDetail({ ...base, permissions: perms });
                setDraft({ name: base.name, description: base.description, permissions: { ...perms } });
            } catch {
                if (cancelled) return;
                setDetail(null);
                setDraft(null);
                setDetailError("Gagal terhubung ke server");
            } finally {
                if (!cancelled) setLoadingDetail(false);
            }
        })();
        return () => { cancelled = true; };
    }, [authorized, selectedId, reloadTick]);

    const dirty = useMemo(() => {
        if (!detail || !draft) return false;
        if (draft.name !== detail.name) return true;
        if ((draft.description ?? "") !== (detail.description ?? "")) return true;
        return RESOURCES.some((r) => draft.permissions[r.key] !== detail.permissions[r.key]);
    }, [detail, draft]);

    function selectRole(id) {
        if (id === selectedId) return;
        if (dirty && !window.confirm("Perubahan belum disimpan. Pindah role dan buang perubahan?")) return;
        setDetail(null);
        setDraft(null);
        setSelectedId(id);
    }

    function setLevel(resourceKey, level) {
        setDraft((d) => ({ ...d, permissions: { ...d.permissions, [resourceKey]: level } }));
    }

    function resetDraft() {
        if (!detail) return;
        setDraft({ name: detail.name, description: detail.description, permissions: { ...detail.permissions } });
    }

    async function handleSave() {
        if (!detail || !dirty) return;
        if (!draft.name.trim()) {
            showToast("Nama role wajib diisi", "error");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/roles/${encodeURIComponent(detail.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: draft.name.trim(),
                    description: draft.description,
                    permissions: draft.permissions,
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
                showToast(json?.error ?? "Gagal menyimpan role", "error");
                return;
            }
            showToast(`Role ${draft.name.trim()} disimpan`);
            setReloadTick((t) => t + 1);
            fetchRoles();
        } catch {
            showToast("Gagal terhubung ke server", "error");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!detail) return;
        if (!window.confirm(`Hapus role "${detail.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/roles/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
            const json = await res.json().catch(() => null);
            if (!res.ok || json?.ok === false) {
                showToast(json?.error ?? "Gagal menghapus role", "error");
                return;
            }
            showToast(`Role ${detail.name} dihapus`);
            setDetail(null);
            setDraft(null);
            setSelectedId(null); // fetchRoles memilih role pertama
            fetchRoles();
        } catch {
            showToast("Gagal terhubung ke server", "error");
        } finally {
            setDeleting(false);
        }
    }

    if (!authorized) return <div className="min-h-screen bg-scada-bg" />;

    const listItem = roles.find((r) => r.id === selectedId);
    const userCount = detail?.userCount ?? listItem?.userCount ?? null;
    const deleteBlockedReason = detail?.isSystem
        ? "Role sistem tidak bisa dihapus"
        : userCount > 0
            ? "Role masih dipakai user"
            : "";

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Role Management</h1>
                    <p className="text-sm text-scada-muted mt-1">
                        Atur hak akses per halaman dan per aksi kritis untuk setiap role
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setShowCreate((v) => !v)}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-scada-water hover:bg-scada-water-hover rounded text-white text-sm font-semibold transition-colors"
                    >
                        <span className="text-lg leading-none">+</span>
                        Buat Role
                    </button>
                )}
            </div>

            <Toast toast={toast} />

            {canEdit && showCreate && (
                <CreateRoleForm
                    roles={roles}
                    onCancel={() => setShowCreate(false)}
                    onCreated={(newId, name) => {
                        setShowCreate(false);
                        showToast(`Role ${name} dibuat`);
                        if (newId != null) {
                            setDetail(null);
                            setDraft(null);
                            setSelectedId(newId);
                        }
                        fetchRoles();
                    }}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-5 items-start">
                {/* ── Daftar role ── */}
                <aside className="bg-scada-card border border-scada-rule rounded shadow-sm overflow-hidden">
                    {loadingList ? (
                        <div className="py-10 text-center text-scada-muted text-sm">Memuat data…</div>
                    ) : listError ? (
                        <div className="py-10 px-4 text-center text-red-700 text-sm">{listError}</div>
                    ) : roles.length === 0 ? (
                        <div className="py-10 text-center text-scada-muted text-sm">Belum ada role.</div>
                    ) : (
                        <ul>
                            {roles.map((r) => {
                                const active = r.id === selectedId;
                                return (
                                    <li key={r.id} className="border-b border-scada-rule last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => selectRole(r.id)}
                                            className={`w-full text-left px-4 py-3 transition-colors ${active
                                                    ? "bg-scada-bg border-l-2 border-scada-water"
                                                    : "hover:bg-scada-bg border-l-2 border-transparent"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold truncate">{r.name}</span>
                                                {r.isSystem && <Badge>Sistem</Badge>}
                                            </div>
                                            <div className="text-xs text-scada-muted mt-0.5 flex justify-between">
                                                <span className="font-mono">{r.key}</span>
                                                <span>{r.userCount == null ? "-" : `${r.userCount} user`}</span>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </aside>

                {/* ── Editor role ── */}
                <section>
                    {selectedId == null ? (
                        <div className="bg-scada-card border border-scada-rule rounded shadow-sm py-16 text-center text-scada-muted text-sm">
                            Pilih role di sebelah kiri.
                        </div>
                    ) : detailError ? (
                        <div className="bg-scada-card border border-scada-rule rounded shadow-sm py-16 px-4 text-center text-red-700 text-sm">
                            {detailError}
                        </div>
                    ) : loadingDetail || !draft || !detail ? (
                        <div className="bg-scada-card border border-scada-rule rounded shadow-sm py-16 text-center text-scada-muted text-sm">
                            Memuat data…
                        </div>
                    ) : (
                        <div className="bg-scada-card border border-scada-rule rounded shadow-sm p-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className={labelClass}>Nama role</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={draft.name}
                                        disabled={!canEdit}
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Deskripsi</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={draft.description ?? ""}
                                        disabled={!canEdit}
                                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-scada-muted">
                                <span>Key: <span className="font-mono text-scada-ink">{detail.key}</span></span>
                                <span>·</span>
                                <span>{userCount == null ? "Jumlah user tidak diketahui" : `${userCount} user memakai role ini`}</span>
                                {detail.isSystem && <Badge>Role sistem</Badge>}
                            </div>

                            <PermissionMatrix
                                perms={draft.permissions}
                                original={detail.permissions}
                                disabled={!canEdit}
                                onChange={setLevel}
                            />

                            <p className="text-xs text-scada-muted mt-3">
                                Resource tanpa level tersimpan dianggap tersembunyi (default tolak). Selalu harus tersisa
                                minimal satu user aktif dengan izin Role Management level &quot;Lihat &amp; ubah&quot;;
                                server menolak perubahan yang melanggarnya. Beberapa kunci aksi belum terpasang di fitur
                                apa pun, jadi pengaturannya baru berlaku saat fitur terkait dipasang.
                            </p>

                            {canEdit ? (
                                <div className="flex flex-wrap items-center gap-3 mt-5">
                                    <button
                                        onClick={handleSave}
                                        disabled={!dirty || saving || !draft.name.trim()}
                                        className="px-5 py-2 bg-scada-water hover:bg-scada-water-hover disabled:opacity-40 disabled:cursor-not-allowed rounded text-white text-sm font-semibold transition-colors"
                                    >
                                        {saving ? "Menyimpan…" : "Simpan perubahan"}
                                    </button>
                                    <button
                                        onClick={resetDraft}
                                        disabled={!dirty || saving}
                                        className="px-5 py-2 bg-white border border-scada-idle hover:bg-scada-bg disabled:opacity-40 disabled:cursor-not-allowed rounded text-scada-ink text-sm font-semibold transition-colors"
                                    >
                                        Batalkan perubahan
                                    </button>
                                    <div className="flex-1" />
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting || saving || Boolean(deleteBlockedReason)}
                                        title={deleteBlockedReason}
                                        className="px-5 py-2 bg-scada-stop hover:bg-scada-stop-hover text-white disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                                    >
                                        {deleting ? "Menghapus…" : "Hapus role"}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-scada-muted mt-4 italic">
                                    Anda hanya punya akses lihat untuk halaman ini.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}