"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium transition-all ${
            toast.type === "error"
                ? "bg-red-900 border border-red-700 text-red-200"
                : "bg-green-900 border border-green-700 text-green-200"
        }`}>
            {toast.msg}
        </div>
    );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ children, colorClass = "bg-slate-700 text-slate-300" }) {
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

// ── Form Tambah User ──────────────────────────────────────────────────────────
function AddUserForm({ onSave, onCancel }) {
    const [form, setForm] = useState({ username: "", fullName: "", role: "operator", password: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                setError(json.error ?? "Gagal membuat user");
                return;
            }
            onSave(json);
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setSaving(false);
        }
    }

    const inputClass = "w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors";
    const labelClass = "block text-xs text-slate-400 uppercase mb-1";

    return (
        <div className="bg-slate-800 border border-blue-600/40 rounded-lg p-5 mb-5">
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
                            value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                            <option value="operator">operator</option>
                            <option value="admin">admin</option>
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
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors">
                        {saving ? "Menyimpan…" : "Simpan"}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold transition-colors">
                        Batal
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Baris tabel satu user ─────────────────────────────────────────────────────
function UserRow({ user, currentUsername, onUpdated, onToast }) {
    const isSelf = user.username === currentUsername;

    // State untuk form edit inline
    const [editOpen, setEditOpen]           = useState(false);
    const [editForm, setEditForm]           = useState({ fullName: user.fullName, role: user.role });
    const [saving, setSaving]               = useState(false);

    // State untuk reset password
    const [resetOpen, setResetOpen]         = useState(false);
    const [newPassword, setNewPassword]     = useState("");
    const [resetting, setResetting]         = useState(false);

    // ── Save edit ──────────────────────────────────────────────────────────
    async function handleSaveEdit() {
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(user.username)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullName: editForm.fullName, role: editForm.role, isActive: user.isActive }),
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
                    body: JSON.stringify({ fullName: user.fullName, role: user.role, isActive: true }),
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

    const btnSm = "px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

    return (
        <>
            <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-semibold">
                    {user.username}
                    {isSelf && <span className="ml-2 text-xs text-blue-400 font-normal">(Anda)</span>}
                </td>
                <td className="px-4 py-3 text-sm">{user.fullName}</td>
                <td className="px-4 py-3">
                    <Badge colorClass={user.role === "admin" ? "bg-blue-700 text-blue-200" : "bg-slate-600 text-slate-300"}>
                        {user.role}
                    </Badge>
                </td>
                <td className="px-4 py-3">
                    <Badge colorClass={user.isActive ? "bg-green-700 text-green-200" : "bg-slate-600 text-slate-400"}>
                        {user.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{fmt(user.lastLoginAt)}</td>
                <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            className={`${btnSm} bg-slate-700 hover:bg-slate-600 text-slate-200`}
                            onClick={() => { setEditOpen((v) => !v); setResetOpen(false); }}
                            disabled={saving}
                        >
                            Edit
                        </button>
                        <button
                            className={`${btnSm} ${user.isActive ? "bg-red-700 hover:bg-red-600 text-red-100" : "bg-green-700 hover:bg-green-600 text-green-100"}`}
                            onClick={handleToggleActive}
                            disabled={isSelf || saving}
                            title={isSelf ? "Ini akun Anda sendiri" : ""}
                        >
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                            className={`${btnSm} bg-amber-700 hover:bg-amber-600 text-amber-100`}
                            onClick={() => { setResetOpen((v) => !v); setEditOpen(false); }}
                            disabled={saving}
                        >
                            Reset PW
                        </button>
                    </div>
                    {isSelf && (
                        <p className="text-xs text-slate-500 mt-1 italic">Ini akun Anda sendiri</p>
                    )}
                </td>
            </tr>

            {/* ── Form edit inline ── */}
            {editOpen && (
                <tr className="bg-slate-800/60 border-b border-slate-700">
                    <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div>
                                <label className="block text-xs text-slate-400 uppercase mb-1">Full Name</label>
                                <input
                                    type="text"
                                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                                    value={editForm.fullName}
                                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 uppercase mb-1">Role</label>
                                <select
                                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={editForm.role}
                                    disabled={isSelf}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                >
                                    <option value="operator">operator</option>
                                    <option value="admin">admin</option>
                                </select>
                                {isSelf && <p className="text-xs text-slate-500 mt-0.5">Tidak bisa ubah role sendiri</p>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-sm font-semibold transition-colors"
                                >
                                    {saving ? "Menyimpan…" : "Simpan"}
                                </button>
                                <button
                                    onClick={() => setEditOpen(false)}
                                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold transition-colors"
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
                <tr className="bg-slate-800/60 border-b border-slate-700">
                    <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className="block text-xs text-slate-400 uppercase mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                                    placeholder="Min. 6 karakter"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleResetPassword}
                                    disabled={resetting || newPassword.length < 6}
                                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded text-sm font-semibold transition-colors"
                                >
                                    {resetting ? "Menyimpan…" : "Set Password"}
                                </button>
                                <button
                                    onClick={() => { setResetOpen(false); setNewPassword(""); }}
                                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold transition-colors"
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
    const [authorized, setAuthorized]   = useState(false);
    const [currentUsername, setCurrentUsername] = useState("");
    const [users, setUsers]             = useState([]);
    const [loading, setLoading]         = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [toast, setToast]             = useState(null);

    // Proteksi level halaman
    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((json) => {
                if (json.ok && json.user?.role === "admin") {
                    setAuthorized(true);
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

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await fetch("/api/users");
            const json = await res.json();
            setUsers(Array.isArray(json) ? json : []);
        } catch {
            showToast("Gagal memuat daftar user", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authorized) fetchUsers();
    }, [authorized, fetchUsers]);

    if (!authorized) return <div className="min-h-screen bg-slate-900" />;

    return (
        <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kelola User</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Manajemen akun operator &amp; admin (khusus admin)
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm((v) => !v)}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-sm font-semibold transition-colors"
                >
                    <span className="text-lg leading-none">+</span>
                    Tambah User
                </button>
            </div>

            {/* ── Toast ── */}
            <Toast toast={toast} />

            {/* ── Form tambah user ── */}
            {showAddForm && (
                <AddUserForm
                    onSave={(newUser) => {
                        setShowAddForm(false);
                        showToast(`User ${newUser.username} berhasil dibuat`);
                        fetchUsers();
                    }}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            {/* ── Tabel ── */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-slate-500 text-sm">Memuat data…</div>
                ) : users.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 text-sm">Belum ada user.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/60 border-b border-slate-700">
                                <tr>
                                    {["Username", "Full Name", "Role", "Status", "Last Login", "Aksi"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase tracking-wider font-semibold">
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
