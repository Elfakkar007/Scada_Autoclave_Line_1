"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hasLevel } from "@/lib/permissionCatalog";

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ children, colorClass = "bg-scada-idle text-scada-ink" }) {
    return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${colorClass}`}>
            {children}
        </span>
    );
}

function fmt(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID");
}

// Warna badge per key role. Role buatan sendiri memakai warna netral.
function roleBadgeClass(key) {
    switch (key) {
        case "admin": return "bg-scada-water text-white";
        case "qa": return "bg-scada-steam text-white";
        case "maintainer": return "bg-scada-ink text-white";
        default: return "bg-scada-idle text-scada-ink";
    }
}

// GET /api/roles/options → daftar {id, key, name}. Dibuat tahan terhadap bentuk
// pembungkus respons (array langsung atau di dalam objek).
function unwrapRoles(json) {
    const list = Array.isArray(json) ? json : (json?.roles ?? json?.options ?? json?.data ?? []);
    return list
        .filter((r) => r && r.id != null)
        .map((r) => ({ id: r.id, key: r.key, name: r.name ?? r.key }));
}

// ── Form Tambah User ──────────────────────────────────────────────────────────
function AddUserForm({ roles, onSave, onCancel }) {
    const [form, setForm] = useState({ username: "", fullName: "", roleId: "", password: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Default role: "operator" bila ada (hak terkecil), kalau tidak role pertama.
    const defaultRoleId = (roles.find((r) => r.key === "operator") ?? roles[0])?.id;
    const roleId = form.roleId !== "" ? form.roleId : String(defaultRoleId ?? "");

    async function handleSubmit(e) {
        e.preventDefault();
        if (roleId === "") {
            setError("Pilih role terlebih dahulu");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: form.username,
                    fullName: form.fullName,
                    roleId: Number(roleId),
                    password: form.password,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                setError(json.error ?? "Gagal membuat user");
                return;
            }
            onSave({ username: json.username ?? json.user?.username ?? form.username });
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setSaving(false);
        }
    }

    const inputClass = "w-full bg-white border border-scada-idle rounded px-3 py-2 text-sm text-scada-ink focus:outline-none focus:border-scada-water transition-colors";
    const labelClass = "block text-xs text-scada-muted uppercase mb-1";

    return (
        <div className="bg-scada-card border border-scada-rule rounded shadow-sm p-5 mb-5">
            <h2 className="font-semibold text-sm mb-4">Tambah User Baru</h2>
            {error && (
                <div className="mb-3 px-3 py-2 bg-red-900 border border-red-700 text-red-200 rounded text-sm">
                    {error}
                </div>
            )}
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className={labelClass}>Username</label>
                        <input type="text" className={inputClass} placeholder="username_baru"
                            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelClass}>Full Name</label>
                        <input type="text" className={inputClass} placeholder="Nama Lengkap"
                            value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelClass}>Role</label>
                        <select className={inputClass + " cursor-pointer"}
                            value={roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                            {roles.length === 0 && <option value="">(daftar role belum termuat)</option>}
                            {roles.map((r) => (
                                <option key={r.id} value={String(r.id)}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Password</label>
                        <input type="password" className={inputClass} placeholder="Min. 6 karakter"
                            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                </div>
                <div className="flex gap-3">
                    <button type="submit" disabled={saving}
                        className="px-5 py-2 bg-scada-water hover:bg-scada-water-hover disabled:opacity-40 disabled:cursor-not-allowed rounded text-white text-sm font-semibold transition-colors">
                        {saving ? "Menyimpan…" : "Simpan"}
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

// ── Baris tabel satu user ─────────────────────────────────────────────────────
function UserRow({ user, roles, canEdit, currentUsername, onUpdated, onToast }) {
    const isSelf = user.username === currentUsername;

    // State untuk form edit inline
    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({ fullName: user.fullName, roleId: user.roleId });
    const [saving, setSaving] = useState(false);

    // State untuk reset password
    const [resetOpen, setResetOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [resetting, setResetting] = useState(false);

    // State untuk konfirmasi hapus
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── Save edit ──────────────────────────────────────────────────────────
    async function handleSaveEdit() {
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(user.username)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: editForm.fullName,
                    ...(isSelf ? {} : { roleId: Number(editForm.roleId) }),
                    isActive: user.isActive,
                }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                onToast(json.error ?? "Gagal memperbarui user", "error");
                return;
            }
            onToast(`User ${user.username} berhasil diperbarui`);
            setEditOpen(false);
            onUpdated();
        } catch {
            onToast("Gagal terhubung ke server", "error");
        } finally {
            setSaving(false);
        }
    }

    // ── Toggle aktif/nonaktif ──────────────────────────────────────────────
    async function handleToggleActive() {
        if (user.isActive) {
            // Nonaktifkan
            if (!window.confirm(`Yakin nonaktifkan user ${user.username}?`)) return;
            setSaving(true);
            try {
                const res = await fetch(`/api/users/${encodeURIComponent(user.username)}`, {
                    method: "DELETE",
                });
                const json = await res.json();
                if (!res.ok || json.ok === false) {
                    onToast(json.error ?? "Gagal menonaktifkan", "error");
                    return;
                }
                onToast(`User ${user.username} dinonaktifkan`);
                onUpdated();
            } catch {
                onToast("Gagal terhubung ke server", "error");
            } finally {
                setSaving(false);
            }
        } else {
            // Aktifkan kembali via PUT isActive:true
            setSaving(true);
            try {
                const res = await fetch(`/api/users/${encodeURIComponent(user.username)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fullName: user.fullName, roleId: user.roleId, isActive: true }),
                });
                const json = await res.json();
                if (!res.ok || json.ok === false) {
                    onToast(json.error ?? "Gagal mengaktifkan", "error");
                    return;
                }
                onToast(`User ${user.username} diaktifkan kembali`);
                onUpdated();
            } catch {
                onToast("Gagal terhubung ke server", "error");
            } finally {
                setSaving(false);
            }
        }
    }

    // ── Reset password ─────────────────────────────────────────────────────
    async function handleResetPassword() {
        if (newPassword.length < 6) {
            onToast("Password minimal 6 karakter", "error");
            return;
        }
        setResetting(true);
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword }),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                onToast(json.error ?? "Gagal reset password", "error");
                return;
            }
            onToast("Password berhasil direset");
            setResetOpen(false);
            setNewPassword("");
        } catch {
            onToast("Gagal terhubung ke server", "error");
        } finally {
            setResetting(false);
        }
    }

    // ── Hapus lunak (permanent soft-delete) ───────────────────────────────────
    async function handleDelete() {
        setDeleting(true);
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(user.username)}/delete`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                onToast(json.error ?? "Gagal menghapus user", "error");
                return;
            }
            onToast(`User ${user.username} berhasil dihapus`);
            setDeleteOpen(false);
            onUpdated();
        } catch {
            onToast("Gagal terhubung ke server", "error");
        } finally {
            setDeleting(false);
        }
    }

    const btnSm = "px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

    return (
        <>
            <tr className="border-b border-scada-rule hover:bg-scada-bg transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-semibold">
                    {user.username}
                    {isSelf && <span className="ml-2 text-xs text-scada-water font-normal">(Anda)</span>}
                </td>
                <td className="px-4 py-3 text-sm">{user.fullName}</td>
                <td className="px-4 py-3">
                    <Badge colorClass={roleBadgeClass(user.role)}>
                        {user.roleName ?? user.role}
                    </Badge>
                </td>
                <td className="px-4 py-3">
                    <Badge colorClass={user.isActive ? "bg-scada-run text-white" : "bg-scada-idle text-scada-ink"}>
                        {user.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-scada-muted">{fmt(user.lastLoginAt)}</td>
                <td className="px-4 py-3">
                    {!canEdit && <span className="text-xs text-scada-muted">Hanya lihat</span>}
                    {canEdit && (
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                className={`${btnSm} bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink`}
                                onClick={() => { setEditOpen((v) => !v); setResetOpen(false); setDeleteOpen(false); }}
                                disabled={saving}
                            >
                                Edit
                            </button>
                            <button
                                className={`${btnSm} ${user.isActive ? "bg-scada-stop hover:bg-scada-stop-hover text-white" : "bg-scada-run hover:bg-scada-run-hover text-white"}`}
                                onClick={handleToggleActive}
                                disabled={isSelf || saving}
                                title={isSelf ? "Ini akun Anda sendiri" : ""}
                            >
                                {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button
                                className={`${btnSm} bg-scada-steam hover:bg-scada-steam-hover text-white`}
                                onClick={() => { setResetOpen((v) => !v); setEditOpen(false); setDeleteOpen(false); }}
                                disabled={saving}
                            >
                                Reset PW
                            </button>
                            {!isSelf && (
                                <button
                                    className={`${btnSm} bg-red-700 hover:bg-red-800 text-white`}
                                    onClick={() => { setDeleteOpen((v) => !v); setEditOpen(false); setResetOpen(false); }}
                                    disabled={saving || deleting}
                                    title="Hapus akun (akun akan dihapus dan tidak bisa login lagi. Riwayat tetap tersimpan dan username tidak dapat dipakai ulang)"
                                >
                                    Hapus
                                </button>
                            )}
                        </div>
                    )}
                    {canEdit && isSelf && (
                        <p className="text-xs text-scada-muted mt-1 italic">Ini akun Anda sendiri</p>
                    )}
                </td>
            </tr>

            {/* ── Form edit inline ── */}
            {editOpen && (
                <tr className="bg-scada-bg border-b border-scada-rule">
                    <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div>
                                <label className="block text-xs text-scada-muted uppercase mb-1">Full Name</label>
                                <input
                                    type="text"
                                    className="bg-white border border-scada-idle rounded px-3 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water"
                                    value={editForm.fullName}
                                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-scada-muted uppercase mb-1">Role</label>
                                <select
                                    className="bg-white border border-scada-idle rounded px-3 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={String(editForm.roleId ?? "")}
                                    disabled={isSelf}
                                    onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                                >
                                    {roles.length === 0 && (
                                        <option value={String(user.roleId ?? "")}>{user.roleName ?? user.role}</option>
                                    )}
                                    {roles.map((r) => (
                                        <option key={r.id} value={String(r.id)}>{r.name}</option>
                                    ))}
                                </select>
                                {isSelf && <p className="text-xs text-scada-muted mt-0.5">Tidak bisa ubah role sendiri</p>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="px-4 py-1.5 bg-scada-water hover:bg-scada-water-hover text-white disabled:opacity-40 rounded text-sm font-semibold transition-colors"
                                >
                                    {saving ? "Menyimpan…" : "Simpan"}
                                </button>
                                <button
                                    onClick={() => setEditOpen(false)}
                                    className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink rounded text-sm font-semibold transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}

            {/* ── Form reset password inline ── */}
            {resetOpen && (
                <tr className="bg-scada-bg border-b border-scada-rule">
                    <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className="block text-xs text-scada-muted uppercase mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    className="bg-white border border-scada-idle rounded px-3 py-1.5 text-sm text-scada-ink focus:outline-none focus:border-scada-water"
                                    placeholder="Min. 6 karakter"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleResetPassword}
                                    disabled={resetting || newPassword.length < 6}
                                    className="px-4 py-1.5 bg-scada-steam hover:bg-scada-steam-hover text-white disabled:opacity-40 rounded text-sm font-semibold transition-colors"
                                >
                                    {resetting ? "Menyimpan…" : "Set Password"}
                                </button>
                                <button
                                    onClick={() => { setResetOpen(false); setNewPassword(""); }}
                                    className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink rounded text-sm font-semibold transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
            {/* ── Dialog konfirmasi hapus ── */}
            {deleteOpen && !isSelf && canEdit && (
                <tr className="bg-red-50 border-b border-red-200">
                    <td colSpan={6} className="px-4 py-4">
                        <div className="text-sm">
                            <p className="font-semibold text-red-800 mb-1">Hapus akun ini? Akun akan dihapus dan tidak bisa login lagi. Riwayat tetap tersimpan dan username tidak dapat dipakai ulang.</p>
                            <p className="text-scada-ink mb-1">
                                Username: <span className="font-mono font-semibold">{user.username}</span>
                                &ensp;|&ensp;
                                Nama: <span className="font-semibold">{user.fullName}</span>
                            </p>
                            <p className="text-red-700 text-xs mb-3">
                                ⚠ Username <span className="font-mono font-semibold">{user.username}</span> tidak bisa dipakai lagi setelah dihapus.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white disabled:opacity-40 rounded text-sm font-semibold transition-colors"
                                >
                                    {deleting ? "Menghapus…" : "Ya, Hapus"}
                                </button>
                                <button
                                    onClick={() => setDeleteOpen(false)}
                                    className="px-4 py-1.5 bg-white border border-scada-idle hover:bg-scada-bg text-scada-ink rounded text-sm font-semibold transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ── Halaman utama ─────────────────────────────────────────────────────────────
export default function UsersPage() {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [currentUsername, setCurrentUsername] = useState("");
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [rolesError, setRolesError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [toast, setToast] = useState(null);

    // Proteksi level halaman: izin "users" minimal view (ubah = boleh tambah/edit/reset)
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                const perms = json.user?.permissions;
                if (json.ok && hasLevel(perms, "users", "view")) {
                    setAuthorized(true);
                    setCanEdit(hasLevel(perms, "users", "edit"));
                    setCurrentUsername(json.user.username);
                } else {
                    router.replace("/");
                }
            })
            .catch(() => router.replace("/"));
    }, [router]);

    function showToast(msg, type = "success") {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    // Error API (401/403/500) ditampilkan, bukan disamarkan sebagai "Belum ada user".
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            const json = await res.json().catch(() => null);
            if (!res.ok || !json || json.ok === false) {
                setUsers([]);
                setLoadError(json?.error ?? `Gagal memuat daftar user (HTTP ${res.status})`);
                return;
            }
            setLoadError(null);
            setUsers(Array.isArray(json) ? json : (json.users ?? []));
        } catch {
            setUsers([]);
            setLoadError("Gagal terhubung ke server");
        } finally {
            setLoading(false);
        }
    }, []);

    // Daftar role untuk dropdown (izin: users view ATAU roles view)
    const fetchRoles = useCallback(async () => {
        try {
            const res = await fetch("/api/roles/options");
            const json = await res.json().catch(() => null);
            if (!res.ok || !json || json.ok === false) {
                setRolesError(json?.error ?? `Gagal memuat daftar role (HTTP ${res.status})`);
                return;
            }
            setRolesError(null);
            setRoles(unwrapRoles(json));
        } catch {
            setRolesError("Gagal terhubung ke server");
        }
    }, []);

    useEffect(() => {
        if (!authorized) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchUsers();
        fetchRoles();
    }, [authorized, fetchUsers, fetchRoles]);

    if (!authorized) return <div className="min-h-screen bg-scada-bg" />;

    return (
        <main className="min-h-screen bg-scada-bg text-scada-ink p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kelola User</h1>
                    <p className="text-sm text-scada-muted mt-1">
                        Manajemen akun pengguna dan role-nya
                    </p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => setShowAddForm((v) => !v)}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-scada-water hover:bg-scada-water-hover rounded text-white text-sm font-semibold transition-colors"
                    >
                        <span className="text-lg leading-none">+</span>
                        Tambah User
                    </button>
                )}
            </div>

            {/* ── Toast ── */}
            <Toast toast={toast} />

            {rolesError && (
                <div className="mb-4 px-4 py-2 rounded text-sm bg-red-900 border border-red-700 text-red-200">
                    {rolesError}
                </div>
            )}

            {/* ── Form tambah user ── */}
            {canEdit && showAddForm && (
                <AddUserForm
                    roles={roles}
                    onSave={(newUser) => {
                        setShowAddForm(false);
                        showToast(`User ${newUser.username} berhasil dibuat`);
                        fetchUsers();
                    }}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            {/* ── Tabel ── */}
            <div className="bg-scada-card border border-scada-rule rounded shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-scada-muted text-sm">Memuat data…</div>
                ) : loadError ? (
                    <div className="py-16 px-4 text-center text-red-700 text-sm">{loadError}</div>
                ) : users.length === 0 ? (
                    <div className="py-16 text-center text-scada-muted text-sm">Belum ada user.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-scada-bg border-b border-scada-rule">
                                <tr>
                                    {["Username", "Full Name", "Role", "Status", "Last Login", "Aksi"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs text-scada-muted uppercase tracking-wider font-semibold">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <UserRow
                                        key={u.username}
                                        user={u}
                                        roles={roles}
                                        canEdit={canEdit}
                                        currentUsername={currentUsername}
                                        onUpdated={fetchUsers}
                                        onToast={showToast}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}