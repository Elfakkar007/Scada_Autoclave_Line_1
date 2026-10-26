// Helper bersama untuk menampilkan nama operator di halaman cetak / ekspor.
// Halaman cetak dan ekspor TIDAK memakai badge komponen; sebagai gantinya
// nama diberi akhiran teks ' (deleted user)' bila akunnya dihapus-lunak.
// Dipakai oleh:
//   - src/app/print/data-report/[batchNo]/page.js
//   - src/app/print/data-report/[batchNo]/curve/page.js

/**
 * Mengembalikan teks operator yang aman untuk ditampilkan di halaman cetak.
 * Jika `deleted` true dan nama bukan "-", akhiran " (deleted user)" ditambahkan.
 *
 * @param {string|null|undefined} name    - nama operator (dari batch.operator)
 * @param {boolean}               deleted - apakah akun sudah dihapus-lunak
 * @returns {string}
 */
export function operatorText(name, deleted) {
    const base = (name === null || name === undefined || name === "") ? "-" : String(name);
    return deleted && base !== "-" ? `${base} (deleted user)` : base;
}
