// Komponen badge kecil 'deleted user' untuk ditampilkan di samping nama akun yang sudah dihapus.
// Digunakan di halaman Audit Log, daftar batch, dan tempat lain yang menampilkan nama user/operator.
// Ekspor (Excel/CSV/PDF/print) TIDAK memakai badge ini — sebagai gantinya tambahkan akhiran
// ' (deleted user)' pada teks nama di server (lihat route export).

export default function DeletedUserBadge() {
    return (
        <span
            className="inline-block text-xs px-1.5 py-0.5 rounded border border-scada-rule text-scada-muted ml-1.5"
            title="Akun ini sudah dihapus"
        >
            deleted user
        </span>
    );
}
