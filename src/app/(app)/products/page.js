"use client";

import { useState, useEffect, useCallback } from "react";

function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div
            className={`mb-4 px-4 py-3 rounded border text-sm font-semibold transition-all shadow-sm ${
                toast.type === "error"
                    ? "bg-red-50 border-red-300 text-red-800"
                    : "bg-emerald-50 border-emerald-300 text-emerald-900"
            }`}
        >
            {toast.msg}
        </div>
    );
}

function StatusBadge({ active }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                active
                    ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : "bg-gray-100 border-gray-300 text-gray-700"
            }`}
        >
            <span
                className={`w-2 h-2 rounded-full ${
                    active ? "bg-emerald-600" : "bg-gray-400"
                }`}
            />
            {active ? "Aktif" : "Nonaktif"}
        </span>
    );
}

function fmtDate(dateStr) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const inputClass =
    "w-full bg-white border border-[#B8C0BE] rounded px-3 py-2 text-sm text-[#1E2A2E] placeholder-[#8C9E9B] focus:outline-none focus:border-[#1C6E74] focus:ring-1 focus:ring-[#1C6E74] transition-colors";
const labelClass = "block text-xs text-[#1E2A2E] font-bold uppercase mb-1";

export default function MasterProductsPage() {
    // Tab: "products" (Nama Produk) | "specs" (Spesifikasi Kemasan)
    const [activeTab, setActiveTab] = useState("products");

    const [userRole, setUserRole] = useState(null);
    const [toast, setToast] = useState(null);

    // Data lists
    const [products, setProducts] = useState([]);
    const [specs, setSpecs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter
    const [searchProd, setSearchProd] = useState("");
    const [filterStatusProd, setFilterStatusProd] = useState("all");
    const [searchSpec, setSearchSpec] = useState("");
    const [filterStatusSpec, setFilterStatusSpec] = useState("all");

    // Modal Add/Edit
    // null | { tab: "products"|"specs", mode: "add"|"edit", item: object }
    const [modalConfig, setModalConfig] = useState(null);
    const [formInput, setFormInput] = useState("");
    const [formActive, setFormActive] = useState(true);
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    // Modal Delete
    // null | { tab: "products"|"specs", item: object }
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const showToast = useCallback((msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchAllData = useCallback(async () => {
        try {
            setLoading(true);
            const [pRes, sRes] = await Promise.all([
                fetch("/api/products"),
                fetch("/api/product-specs"),
            ]);
            const [pData, sData] = await Promise.all([pRes.json(), sRes.json()]);

            setProducts(Array.isArray(pData) ? pData : []);
            setSpecs(Array.isArray(sData) ? sData : []);
        } catch {
            showToast("Gagal memuat data master", "error");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((j) => {
                if (j.ok) setUserRole(j.user?.role ?? "operator");
            })
            .catch(() => {});
        fetchAllData();
    }, [fetchAllData]);

    const isAdmin = userRole === "admin";

    // ── Handler Modal Add / Edit ──────────────────────────────────────────────
    function handleOpenAdd(tab) {
        setFormInput("");
        setFormActive(true);
        setFormError(null);
        setModalConfig({ tab, mode: "add", item: null });
    }

    function handleOpenEdit(tab, item) {
        setFormInput(tab === "products" ? item.name : item.spec);
        setFormActive(item.isActive);
        setFormError(null);
        setModalConfig({ tab, mode: "edit", item });
    }

    async function handleSaveForm(e) {
        e.preventDefault();
        if (!modalConfig) return;
        setFormSaving(true);
        setFormError(null);

        const isProd = modalConfig.tab === "products";
        const isEdit = modalConfig.mode === "edit";

        const endpoint = isProd
            ? (isEdit ? `/api/products/${modalConfig.item.id}` : "/api/products")
            : (isEdit ? `/api/product-specs/${modalConfig.item.id}` : "/api/product-specs");
        const method = isEdit ? "PUT" : "POST";

        const payload = isProd
            ? { name: formInput.trim(), isActive: formActive }
            : { spec: formInput.trim(), isActive: formActive };

        try {
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || json.ok === false) {
                setFormError(json.error ?? "Gagal menyimpan data");
                return;
            }

            const labelType = isProd ? "Nama Produk" : "Spesifikasi Kemasan";
            showToast(`${labelType} "${formInput.trim()}" berhasil ${isEdit ? "diperbarui" : "ditambahkan"}`);
            setModalConfig(null);
            fetchAllData();
        } catch {
            setFormError("Gagal terhubung ke server");
        } finally {
            setFormSaving(false);
        }
    }

    // ── Toggle Status Aktif ───────────────────────────────────────────────────
    async function handleToggleStatus(tab, item) {
        if (!isAdmin) return;
        const isProd = tab === "products";
        const endpoint = isProd ? `/api/products/${item.id}` : `/api/product-specs/${item.id}`;
        const nextActive = !item.isActive;
        const payload = isProd
            ? { name: item.name, isActive: nextActive }
            : { spec: item.spec, isActive: nextActive };

        try {
            const res = await fetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                showToast(json.error ?? "Gagal mengubah status", "error");
                return;
            }
            const label = isProd ? item.name : item.spec;
            showToast(`"${label}" berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}`);
            fetchAllData();
        } catch {
            showToast("Gagal terhubung ke server", "error");
        }
    }

    // ── Delete Handler ────────────────────────────────────────────────────────
    async function handleConfirmDelete() {
        if (!deleteTarget || !isAdmin) return;
        setDeleting(true);
        const isProd = deleteTarget.tab === "products";
        const endpoint = isProd
            ? `/api/products/${deleteTarget.item.id}`
            : `/api/product-specs/${deleteTarget.item.id}`;

        try {
            const res = await fetch(endpoint, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || json.ok === false) {
                showToast(json.error ?? "Gagal menghapus", "error");
                return;
            }
            const label = isProd ? deleteTarget.item.name : deleteTarget.item.spec;
            showToast(`"${label}" berhasil dihapus dari master`);
            setDeleteTarget(null);
            fetchAllData();
        } catch {
            showToast("Gagal menghapus data", "error");
        } finally {
            setDeleting(false);
        }
    }

    // ── Filter list ───────────────────────────────────────────────────────────
    const filteredProducts = products.filter((p) => {
        if (filterStatusProd === "active" && !p.isActive) return false;
        if (filterStatusProd === "inactive" && p.isActive) return false;
        if (!searchProd.trim()) return true;
        return p.name.toLowerCase().includes(searchProd.toLowerCase());
    });

    const filteredSpecs = specs.filter((s) => {
        if (filterStatusSpec === "active" && !s.isActive) return false;
        if (filterStatusSpec === "inactive" && s.isActive) return false;
        if (!searchSpec.trim()) return true;
        return s.spec.toLowerCase().includes(searchSpec.toLowerCase());
    });

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header Utama */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1E2A2E] flex items-center gap-2.5">
                        <span className="text-[#1C6E74]">📦</span> MASTER PRODUK & SPESIFIKASI
                    </h1>
                    <p className="text-sm text-[#5C6B6A] mt-1 font-medium">
                        Pengelolaan katalog nama produk dan spesifikasi kemasan secara terpisah untuk persiapan batch sterilisasi
                    </p>
                </div>
                {!isAdmin && (
                    <div className="text-xs text-[#5C6B6A] font-medium bg-white border border-[#D8DEDC] px-3.5 py-2 rounded shadow-sm">
                        Mode Lihat (Hanya Admin yang dapat mengelola data)
                    </div>
                )}
            </div>

            <Toast toast={toast} />

            {/* Tab Navigasi (2 CRUD dalam 1 Halaman) */}
            <div className="flex gap-2 border-b border-[#D8DEDC] mb-6">
                <button
                    type="button"
                    onClick={() => setActiveTab("products")}
                    className={`px-5 py-3 text-sm font-bold rounded-t-md transition-all flex items-center gap-2 border-t border-l border-r ${
                        activeTab === "products"
                            ? "bg-white text-[#1C6E74] border-[#D8DEDC] border-b-2 border-b-white -mb-[1px] shadow-sm"
                            : "bg-[#EEF1F0] text-[#5C6B6A] border-transparent hover:text-[#1E2A2E]"
                    }`}
                >
                    <span>🏷️</span>
                    <span>1. Master Nama Produk</span>
                    <span
                        className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            activeTab === "products"
                                ? "bg-[#1C6E74] text-white"
                                : "bg-[#D8DEDC] text-[#5C6B6A]"
                        }`}
                    >
                        {products.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("specs")}
                    className={`px-5 py-3 text-sm font-bold rounded-t-md transition-all flex items-center gap-2 border-t border-l border-r ${
                        activeTab === "specs"
                            ? "bg-white text-[#1C6E74] border-[#D8DEDC] border-b-2 border-b-white -mb-[1px] shadow-sm"
                            : "bg-[#EEF1F0] text-[#5C6B6A] border-transparent hover:text-[#1E2A2E]"
                    }`}
                >
                    <span>🧴</span>
                    <span>2. Master Spesifikasi Kemasan</span>
                    <span
                        className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            activeTab === "specs"
                                ? "bg-[#1C6E74] text-white"
                                : "bg-[#D8DEDC] text-[#5C6B6A]"
                        }`}
                    >
                        {specs.length}
                    </span>
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: MASTER NAMA PRODUK */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === "products" && (
                <div>
                    {/* Toolbar */}
                    <div className="bg-white border border-[#D8DEDC] rounded-lg p-4 mb-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="flex-1 w-full sm:w-auto relative">
                            <input
                                type="text"
                                placeholder="Cari nama produk…"
                                value={searchProd}
                                onChange={(e) => setSearchProd(e.target.value)}
                                className={inputClass}
                            />
                            {searchProd && (
                                <button
                                    onClick={() => setSearchProd("")}
                                    className="absolute right-3 top-2.5 text-[#5C6B6A] hover:text-[#1E2A2E] text-sm"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#5C6B6A] font-bold uppercase">Status:</span>
                                <select
                                    value={filterStatusProd}
                                    onChange={(e) => setFilterStatusProd(e.target.value)}
                                    className="bg-white border border-[#B8C0BE] rounded px-3 py-2 text-xs text-[#1E2A2E] font-medium cursor-pointer focus:outline-none focus:border-[#1C6E74]"
                                >
                                    <option value="all">Semua ({products.length})</option>
                                    <option value="active">Hanya Aktif ({products.filter((p) => p.isActive).length})</option>
                                    <option value="inactive">Hanya Nonaktif ({products.filter((p) => !p.isActive).length})</option>
                                </select>
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={() => handleOpenAdd("products")}
                                    className="px-4 py-2 bg-[#4F7A52] hover:bg-[#446C47] text-white rounded text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                                >
                                    <span>+</span> Tambah Nama Produk
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabel Nama Produk */}
                    <div className="bg-white border border-[#D8DEDC] rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#E5EAE8] border-b border-[#D8DEDC] text-xs uppercase text-[#1E2A2E] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3.5 w-14 text-center">No</th>
                                        <th className="px-4 py-3.5">Nama Produk</th>
                                        <th className="px-4 py-3.5 w-32 text-center">Status</th>
                                        <th className="px-4 py-3.5 w-48 text-center">Terakhir Diubah</th>
                                        {isAdmin && <th className="px-4 py-3.5 w-60 text-center">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#D8DEDC]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 5 : 4} className="p-10 text-center text-[#5C6B6A] italic">
                                                Memuat daftar produk…
                                            </td>
                                        </tr>
                                    ) : filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 5 : 4} className="p-10 text-center text-[#5C6B6A]">
                                                {searchProd || filterStatusProd !== "all"
                                                    ? "Tidak ada nama produk yang cocok dengan pencarian / filter."
                                                    : "Belum ada nama produk terdaftar. Klik \"+ Tambah Nama Produk\" untuk menambahkan."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((prod, idx) => (
                                            <tr key={prod.id} className="hover:bg-[#F2F6F5] transition-colors">
                                                <td className="px-4 py-3 text-center text-xs text-[#5C6B6A] font-bold">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-[#1E2A2E] text-sm">
                                                    {prod.name}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <StatusBadge active={prod.isActive} />
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-[#5C6B6A] whitespace-nowrap">
                                                    {fmtDate(prod.updatedAt)}
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {/* Tombol Toggle Status */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleStatus("products", prod)}
                                                                title={prod.isActive ? "Nonaktifkan produk ini" : "Aktifkan produk ini"}
                                                                className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                                                                    prod.isActive
                                                                        ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                                                                        : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                                                                }`}
                                                            >
                                                                {prod.isActive ? "Nonaktifkan" : "Aktifkan"}
                                                            </button>

                                                            {/* Tombol Edit */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEdit("products", prod)}
                                                                className="px-2.5 py-1 bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                            >
                                                                ✏️ Edit
                                                            </button>

                                                            {/* Tombol Hapus */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteTarget({ tab: "products", item: prod })}
                                                                className="px-2.5 py-1 bg-rose-50 text-rose-900 border border-rose-300 hover:bg-rose-100 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                            >
                                                                🗑️ Hapus
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: MASTER SPESIFIKASI KEMASAN */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {activeTab === "specs" && (
                <div>
                    {/* Toolbar */}
                    <div className="bg-white border border-[#D8DEDC] rounded-lg p-4 mb-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="flex-1 w-full sm:w-auto relative">
                            <input
                                type="text"
                                placeholder="Cari spesifikasi kemasan…"
                                value={searchSpec}
                                onChange={(e) => setSearchSpec(e.target.value)}
                                className={inputClass}
                            />
                            {searchSpec && (
                                <button
                                    onClick={() => setSearchSpec("")}
                                    className="absolute right-3 top-2.5 text-[#5C6B6A] hover:text-[#1E2A2E] text-sm"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#5C6B6A] font-bold uppercase">Status:</span>
                                <select
                                    value={filterStatusSpec}
                                    onChange={(e) => setFilterStatusSpec(e.target.value)}
                                    className="bg-white border border-[#B8C0BE] rounded px-3 py-2 text-xs text-[#1E2A2E] font-medium cursor-pointer focus:outline-none focus:border-[#1C6E74]"
                                >
                                    <option value="all">Semua ({specs.length})</option>
                                    <option value="active">Hanya Aktif ({specs.filter((s) => s.isActive).length})</option>
                                    <option value="inactive">Hanya Nonaktif ({specs.filter((s) => !s.isActive).length})</option>
                                </select>
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={() => handleOpenAdd("specs")}
                                    className="px-4 py-2 bg-[#4F7A52] hover:bg-[#446C47] text-white rounded text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                                >
                                    <span>+</span> Tambah Spesifikasi
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabel Spesifikasi Kemasan */}
                    <div className="bg-white border border-[#D8DEDC] rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#E5EAE8] border-b border-[#D8DEDC] text-xs uppercase text-[#1E2A2E] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3.5 w-14 text-center">No</th>
                                        <th className="px-4 py-3.5">Spesifikasi Kemasan / Larutan</th>
                                        <th className="px-4 py-3.5 w-32 text-center">Status</th>
                                        <th className="px-4 py-3.5 w-48 text-center">Terakhir Diubah</th>
                                        {isAdmin && <th className="px-4 py-3.5 w-60 text-center">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#D8DEDC]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 5 : 4} className="p-10 text-center text-[#5C6B6A] italic">
                                                Memuat daftar spesifikasi…
                                            </td>
                                        </tr>
                                    ) : filteredSpecs.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 5 : 4} className="p-10 text-center text-[#5C6B6A]">
                                                {searchSpec || filterStatusSpec !== "all"
                                                    ? "Tidak ada spesifikasi yang cocok dengan pencarian / filter."
                                                    : "Belum ada spesifikasi terdaftar. Klik \"+ Tambah Spesifikasi\" untuk menambahkan."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSpecs.map((sp, idx) => (
                                            <tr key={sp.id} className="hover:bg-[#F2F6F5] transition-colors">
                                                <td className="px-4 py-3 text-center text-xs text-[#5C6B6A] font-bold">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-[#1E2A2E] text-sm">
                                                    {sp.spec}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <StatusBadge active={sp.isActive} />
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs text-[#5C6B6A] whitespace-nowrap">
                                                    {fmtDate(sp.updatedAt)}
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-2">
                                                            {/* Tombol Toggle Status */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleStatus("specs", sp)}
                                                                title={sp.isActive ? "Nonaktifkan spesifikasi ini" : "Aktifkan spesifikasi ini"}
                                                                className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                                                                    sp.isActive
                                                                        ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                                                                        : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                                                                }`}
                                                            >
                                                                {sp.isActive ? "Nonaktifkan" : "Aktifkan"}
                                                            </button>

                                                            {/* Tombol Edit */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEdit("specs", sp)}
                                                                className="px-2.5 py-1 bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                            >
                                                                ✏️ Edit
                                                            </button>

                                                            {/* Tombol Hapus */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteTarget({ tab: "specs", item: sp })}
                                                                className="px-2.5 py-1 bg-rose-50 text-rose-900 border border-rose-300 hover:bg-rose-100 rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                                            >
                                                                🗑️ Hapus
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MODAL TAMBAH / EDIT */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {modalConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg border border-[#D8DEDC] shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#D8DEDC]">
                            <h2 className="text-base font-bold text-[#1E2A2E]">
                                {modalConfig.mode === "add" ? "Tambah " : "Edit "}
                                {modalConfig.tab === "products" ? "Nama Produk" : "Spesifikasi Kemasan"}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setModalConfig(null)}
                                className="text-[#5C6B6A] hover:text-[#1E2A2E] text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {formError && (
                            <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-300 text-red-800 rounded text-xs font-semibold">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSaveForm} className="space-y-4">
                            <div>
                                <label className={labelClass}>
                                    {modalConfig.tab === "products" ? "Nama Produk *" : "Spesifikasi Kemasan / Larutan *"}
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={150}
                                    placeholder={
                                        modalConfig.tab === "products"
                                            ? "contoh: Ringer Lactate"
                                            : "contoh: 500 ml Soft Bag"
                                    }
                                    value={formInput}
                                    onChange={(e) => setFormInput(e.target.value)}
                                    className={inputClass}
                                    autoFocus
                                />
                            </div>

                            <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                                <input
                                    type="checkbox"
                                    checked={formActive}
                                    onChange={(e) => setFormActive(e.target.checked)}
                                    className="w-4 h-4 rounded cursor-pointer accent-[#1C6E74]"
                                />
                                <span className="text-sm font-semibold text-[#1E2A2E]">
                                    Status Aktif (dapat dipilih pada Pop-up START)
                                </span>
                            </label>

                            <div className="flex gap-2.5 pt-4 border-t border-[#D8DEDC]">
                                <button
                                    type="submit"
                                    disabled={formSaving}
                                    className="flex-1 py-2.5 bg-[#4F7A52] hover:bg-[#446C47] text-white rounded font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
                                >
                                    {formSaving ? "Menyimpan…" : "Simpan Data"}
                                </button>
                                <button
                                    type="button"
                                    disabled={formSaving}
                                    onClick={() => setModalConfig(null)}
                                    className="px-5 py-2.5 border border-[#D8DEDC] text-[#5C6B6A] hover:text-[#1E2A2E] hover:bg-gray-100 rounded font-semibold text-sm transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MODAL KONFIRMASI HAPUS */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg border border-red-300 shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-red-100 border border-red-300 flex items-center justify-center mx-auto mb-3 text-red-600 text-xl font-bold">
                            ⚠️
                        </div>
                        <h3 className="text-base font-bold text-[#1E2A2E] mb-2">
                            Hapus {deleteTarget.tab === "products" ? "Nama Produk" : "Spesifikasi"}?
                        </h3>
                        <p className="text-xs text-[#5C6B6A] mb-5 leading-relaxed font-medium">
                            Anda yakin ingin menghapus{" "}
                            <strong className="text-[#1E2A2E]">
                                "{deleteTarget.tab === "products" ? deleteTarget.item.name : deleteTarget.item.spec}"
                            </strong>{" "}
                            dari master? Tindakan ini akan dicatat ke dalam Audit Log.
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {deleting ? "Menghapus…" : "Ya, Hapus"}
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setDeleteTarget(null)}
                                className="px-5 py-2 border border-[#D8DEDC] text-[#5C6B6A] hover:text-[#1E2A2E] hover:bg-gray-100 rounded font-semibold text-sm transition-colors"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
