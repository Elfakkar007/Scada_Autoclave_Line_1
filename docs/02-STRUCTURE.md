# Struktur Folder Proyek

Dokumen ini menyajikan pohon direktori proyek `scada-sterilizer` beserta deskripsi fungsi faktual satu baris untuk setiap folder, berdasarkan verifikasi langsung terhadap berkas-berkas yang ada di dalamnya.

```text
scada-sterilizer/
├── context/                             # Berkas referensi PLC Siemens S7-200, tabel CSV pemetaan tag, program AWL, dan catatan desain.
├── docs/                                # Dokumentasi teknis sistem, inventarisasi file, peta relasi kode, dan spesifikasi fitur.
├── public/                              # Aset statis web publik, logo perusahaan format SVG/PNG, dan berkas audio notifikasi.
│   └── sounds/                          # Berkas audio WAV pemutar peringatan suara saat alarm aktif.
├── scripts/                             # Script utilitas baris perintah (CLI) untuk pembuatan hash password bcrypt di luar web.
└── src/                                 # Direktori kode sumber utama aplikasi Next.js SCADA.
    ├── app/                             # Lapisan App Router Next.js berisi halaman antarmuka, layout, style global, dan route handler API.
    │   ├── (app)/                       # Route group aplikasi berotentikasi yang dilengkapi navigasi utama, banner alarm, dan pengunci layar.
    │   │   ├── alarm/                   # Halaman pemantauan tabel riwayat alarm mesin dengan filter pencarian dan rentang tanggal.
    │   │   ├── audit-log/               # Halaman inspeksi jejak audit aktivitas pengguna dan perubahan konfigurasi sistem.
    │   │   ├── data-report/             # Halaman daftar riwayat batch proses sterilisasi autoclave dengan fitur pencarian dan filter status.
    │   │   │   └── [batchNo]/           # Halaman laporan rinci satu nomor batch yang menampilkan metadata, kalkulasi F0, dan tabel trend.
    │   │   ├── formula/                 # Halaman pengelolaan parameter resep sterilisasi dengan validasi rentang fisik dan proteksi saat batch berjalan.
    │   │   ├── products/                # Halaman pengelolaan master nama produk dan spesifikasi kemasan dengan tab ganda.
    │   │   ├── trend/                   # Halaman visualisasi kurva grafik suhu 9 sensor dan tekanan per nomor batch.
    │   │   └── users/                   # Halaman administrasi akun pengguna (operator/admin), pengubahan role, reset password, dan aktivasi.
    │   ├── api/                         # Kumpulan endpoint backend Next.js Route Handler untuk operasi database dan integrasi ke PLC.
    │   │   ├── alarms/                  # Endpoint pengambilan data log alarm mesin dengan pagination dan filter parameter.
    │   │   │   ├── active/              # Endpoint pemantauan alarm aktif yang belum pulih beserta status heartbeat monitor.
    │   │   │   ├── by-batch/            # Endpoint filter riwayat alarm yang tercatat dalam rentang waktu proses batch.
    │   │   │   │   └── [batchNo]/       # Handler spesifik pengembalian alarm berdasarkan parameter nomor batch di URL.
    │   │   │   ├── event-types/         # Endpoint daftar unik jenis event alarm yang tersimpan di database.
    │   │   │   └── print-data/          # Endpoint penyedia seluruh baris data alarm yang lolos filter untuk dokumen cetak.
    │   │   ├── audit-log/               # Endpoint query jejak audit log aktivitas dengan pagination dan penyaringan kata kunci.
    │   │   │   ├── export/              # Endpoint ekspor rekam audit ke file spreadsheet Excel XLSX atau format data JSON.
    │   │   │   └── filters/             # Endpoint daftar unik kategori aksi dan tipe entitas pada tabel audit_log.
    │   │   ├── auth/                    # Endpoint penanganan autentikasi sesi pengguna, login, logout, dan status verifikasi akun.
    │   │   │   ├── login/               # Endpoint verifikasi kredensial login dengan batas percobaan gagal 5 kali per 15 menit.
    │   │   │   ├── logout/              # Endpoint pencatatan audit log penutupan sesi dan penghapusan cookie session_token.
    │   │   │   ├── me/                  # Endpoint verifikasi payload JWT sesi dan sinkronisasi data aktif pengguna dari database.
    │   │   │   ├── unlock/              # Endpoint autentikasi ulang kata sandi pengguna untuk membuka pengunci layar screen lock.
    │   │   │   └── users/               # Endpoint publik penyedia daftar username dan nama lengkap operator untuk form login.
    │   │   ├── batch/                   # Endpoint orkestrasi kontrol eksekusi proses batch sterilisasi ke pengontrol mesin.
    │   │   │   ├── start/               # Endpoint validasi resep, penulisan setpoint PLC, pengiriman pulsa START, dan pembuatan batch_records.
    │   │   │   └── stop/                # Endpoint pengiriman pulsa STOP PLC, perhitungan F0 akhir, dan finalisasi status batch.
    │   │   ├── batch-records/           # Endpoint penelusuran riwayat catatan batch sterilisasi dengan filter tanggal dan status.
    │   │   │   ├── [batchNo]/           # Endpoint detail batch record tunggal beserta seluruh deret titik data sensor tabel batch_trend.
    │   │   │   └── export/              # Endpoint ekspor komprehensif seluruh parameter batch ke berkas spreadsheet Excel XLSX dan JSON.
    │   │   ├── formulas/                # Endpoint daftar seluruh formula resep sterilisasi dan penambahan resep baru oleh admin.
    │   │   │   └── [formulaNo]/         # Endpoint pengambilan, pembaruan, dan penghapusan resep sterilisasi berdasarkan nomor formula.
    │   │   ├── plc/                     # Endpoint interaksi dan manipulasi langsung tag komunikasi pengontrol PLC.
    │   │   │   └── reset/               # Endpoint pengiriman pulsa STOP untuk mereset mesin dari fase Selesai (VW98=6) kembali ke Siap.
    │   │   ├── product-specs/           # Endpoint daftar dan penambahan entitas master spesifikasi kemasan atau larutan produk.
    │   │   │   └── [id]/                # Endpoint pembaruan teks, perubahan status aktif, dan penghapusan data spesifikasi kemasan.
    │   │   ├── products/                # Endpoint daftar dan penambahan entitas master nama produk sterilisasi.
    │   │   │   └── [id]/                # Endpoint pembaruan nama produk, perubahan status aktif, dan penghapusan data produk.
    │   │   ├── status/                  # Endpoint pembacaan gabungan data sensor PLC secara real-time dan status batch yang sedang berjalan.
    │   │   └── users/                   # Endpoint manajemen akun pengguna untuk menampilkan daftar user dan pendaftaran akun baru.
    │   │       └── [username]/          # Endpoint pengubahan nama, pembaruan role, dan penonaktifan (soft delete) akun pengguna.
    │   │           └── reset-password/  # Endpoint reset kata sandi akun pengguna oleh administrator.
    │   ├── login/                       # Halaman antarmuka otentikasi login pengguna dengan dropdown pilihan akun.
    │   └── print/                       # Kumpulan halaman dokumen laporan yang ditata khusus untuk pencetakan kertas standar pabrik.
    │       ├── alarm/                   # Format cetak tabel riwayat alarm dan kejadian abnormal mesin (A4 landscape).
    │       ├── audit-log/               # Format cetak log jejak audit aktivitas operasional dan administratif (A4 landscape).
    │       ├── batch-records/           # Format cetak tabel ringkasan batch proses sterilisasi (A4 landscape).
    │       └── data-report/             # Modul cetak dokumen laporan data batch sterilisasi.
    │           └── [batchNo]/           # Format cetak gabungan data record proses, grafik kurva suhu/tekanan, dan riwayat alarm batch.
    │               └── curve/           # Format cetak khusus grafik kurva suhu 9 sensor dan tekanan satu halaman penuh (A4 landscape).
    ├── components/                      # Komponen antarmuka pengguna modular yang menyusun visualisasi dashboard SCADA.
    └── lib/                             # Modul logika bisnis, driver database, komunikasi IoT gateway, pemantau alarm, dan formula F0.
        └── __fixtures__/                # Berkas data referensi uji cetak dan catatan proses nyata batch tanggal 03-10-2026.
```
