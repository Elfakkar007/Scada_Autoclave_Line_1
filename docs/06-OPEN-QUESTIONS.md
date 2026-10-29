# Temuan Teknis, Hal Belum Terverifikasi, & Kode Yatim (Open Questions)

Dokumen ini memuat rangkuman faktual seluruh item yang berstatus `[TIDAK TERVERIFIKASI]`, kode mati (dead code), berkas yatim (tidak di-import), poin-poin yang memerlukan konfirmasi teknis oleh pengembang atau teknisi otomasi pabrik, serta daftar item yang telah teratasi (resolved) berdasarkan pemeriksaan langsung pada seluruh kode sumber.

---

## 1. Daftar Item `[TIDAK TERVERIFIKASI]`

Setiap poin di bawah ini tidak dapat dipastikan hanya dari membaca kode sumber di repositori:

1. **Format URL Kredensial Database PostgreSQL di Server Produksi**
   - **Lokasi Kode**: `src/lib/db.js:14`
   - **Status**: `[TIDAK TERVERIFIKASI: format URL kredensial PostgreSQL aktual di server produksi]`
   - **Fakta Kode**: Kode memanggil `process.env.DATABASE_URL` tanpa nilai default fallback. Nilai string koneksi aktual berada pada berkas `.env.local` lokal mesin host dan tidak tercatat di repositori Git.

2. **Kata Sandi Autentikasi IoT Gateway KEPServerEX**
   - **Lokasi Kode**: `src/lib/plc.js:35`
   - **Status**: `[TIDAK TERVERIFIKASI: password gateway pada instalasi fisik]`
   - **Fakta Kode**: Variabel `IOT_GATEWAY_PASS` memiliki nilai default string kosong `""`. Kredensial autentikasi Basic yang aktif pada KEPServerEX di PC mesin pabrik tidak dapat diverifikasi dari kode repositori.

3. **Formula Kalibrasi Tag Konduktivitas (L) dan Level Air (WATER)**
   - **Lokasi Kode**: `src/lib/plc.js:200-205`
   - **Status**: `[TIDAK TERVERIFIKASI: formula konversi kalibrasi tag konduktivitas L / VW122 dan level air WATER / VW124]`
   - **Fakta Kode**: Pada fungsi `readPlcSnapshot`, terdapat catatan komentar pengembang bahwa tag konduktivitas (`rawL` / register VW122) dan level air (`rawWater` / register VW124) belum memiliki rumus kalibrasi pasti dari SCADA lama, sehingga saat ini nilainya dibaca secara mentah atau dibagi 10 tanpa konversi unit fisik terkalibrasi.

4. **Perilaku Tag Bypass Interlock M6.0 pada Ladder PLC Fisik**
   - **Lokasi Kode**: `src/app/api/batch/start/route.js:342-347`
   - **Status**: `[TIDAK TERVERIFIKASI: perilaku fisik mesin saat tag M6.0 aktif di lapangan]`
   - **Fakta Kode**: Guard pemeriksaan `door?.bypass` dinonaktifkan dalam blok komentar karena catatan pengujian lapangan tanggal 10 Oktober 2026 menyatakan mesin autoclave tetap dapat memulai siklus dari SCADA lama meskipun bit M6.0 aktif. Logika ladder internal di pengontrol PLC Siemens S7-200 terkait fungsi sebenarnya bit M6.0 belum dapat diverifikasi secara definitif tanpa pengetesan sinyal I/O fisik.

5. **Kebijakan Retensi Berkas Backup SQL (`migrations/backup_271026.sql`)**
   - **Lokasi Kode**: `migrations/backup_271026.sql`
   - **Status**: `[TIDAK TERVERIFIKASI: status retensi berkas dump SQL di repositori git]`
   - **Fakta Kode**: Berkas cadangan database SQL berukuran 136 KB tersimpan dalam git tracking repositori tanpa dokumentasi apakah berkas ini snapshot sekali pakai sebelum eksekusi migrasi Fase 1 atau perlu dipertahankan selamanya di version control.

6. **Konfigurasi Akun Pengujian Matriks Perizinan Otomatis**
   - **Lokasi Kode**: `fase1/tests/matrix.mjs:18-45`
   - **Status**: `[TIDAK TERVERIFIKASI: ketersediaan file environment akun pengujian di pipeline CI/CD]`
   - **Fakta Kode**: Skrip pengujian matriks mewajibkan `process.env.CONFIRM_DEV === "yes"` dan membaca akun uji dari environment (`ACC_OPERATOR`, `ACC_MAINTAINER`, `ACC_QA`, `ACC_ADMIN`, `ACC_DASH`) dengan format `username:password`. Berkas `.env.test` atau konfigurasi akun otomatis belum didefinisikan secara resmi di root repositori.

7. **Status Eksekusi Migrasi 006 (`migrations/006_add_bottle_count.sql`) di Database Produksi**
   - **Lokasi Kode**: `src/app/api/batch/start/route.js:630`, `src/app/api/batch-records/export/route.js:103`
   - **Status**: `[TIDAK TERVERIFIKASI: status penerapan migrasi 006 pada database PostgreSQL produksi]`
   - **Fakta Kode**: Kode backend secara eksplisit menyertakan blok penanganan fallback bila kolom `bottle_count` belum ada di tabel `batch_records` (PostgreSQL error code `42703`). Status eksekusi skrip migrasi ini di server hosting fisik pabrik belum dapat diverifikasi hanya dari kode sumber.

8. **Pemetaan Tombol HMI Fisik untuk Buzzer M10.6 dan Kanal Tekanan P1 (SEL_PRESU)**
   - **Lokasi Kode**: `src/lib/plcManualCatalog.js:34`, `src/lib/plcParamCatalog.js:87`
   - **Status**: `[TIDAK TERVERIFIKASI: pemetaan tombol fisik HMI terhadap tag MAN_BUZZER (M10.6) dan interpretasi nilai 0/1 tag SEL_PRESU]`
   - **Fakta Kode**: Pada katalog kontrol manual terdapat catatan bahwa bit M10.6 belum diverifikasi pemetaannya terhadap tombol fisik mesin, dan pada katalog parameter terdapat catatan bahwa pemetaan nilai 0/1 tag `SEL_PRESU` (AIW12 vs AIW14) ke tampilan layar HMI fisik mesin belum diverifikasi di lapangan.

---

## 2. Kode Mati / Bagian Terisolasi (Dead Code)

1. **Guard Bypass Interlock M6.0 yang Dinonaktifkan**
   - **Lokasi Kode**: `src/app/api/batch/start/route.js:342-347`
   - **Kondisi**: Blok kode pemeriksaan status interlock pintu `door?.bypass` dimatikan dengan komentar `// if (door?.bypass) { ... }`.
   - **Dampak**: Permintaan START tidak lagi mengecek status bit M6.0 dari PLC.

2. **Fixture Data Uji Sterilisasi Riil**
   - **Lokasi Kode**: `src/lib/__fixtures__/printout_2026-10-03.js`
   - **Kondisi**: Berkas data statis array 282 baris hanya di-import oleh unit test `src/lib/f0.test.mjs:7` dan tidak pernah di-import oleh komponen runtime web produksi mana pun.

3. **Bypass Pengujian Evaluasi Kesiapan Mesin pada Dashboard (`startAllowed = true`)**
   - **Lokasi Kode**: `src/app/(app)/page.js:460`
   - **Kondisi**: Logika evaluasi kesiapan mesin `!noData && data.plcOk === true && phaseRaw === 1 && !data.running` dinonaktifkan dalam komentar, dan variabel `startAllowed` di-hardcode menjadi `const startAllowed = true;`.
   - **Dampak**: Tombol "START BATCH" pada antarmuka dashboard selalu aktif (dapat diklik) meskipun mesin offline atau sedang memproses batch lain. Meskipun guard server `/api/batch/start` tetap memvalidasi interlock mesin secara aman, antarmuka klien mengizinkan operator membuka modal form persiapan batch kapan pun.

---

## 3. Berkas Yatim (Orphan Files — Tidak Di-import Berkas Lain)

Berdasarkan analisis graf dependensi impor, berkas-berkas berikut tidak di-import oleh berkas kode antarmuka web dalam aplikasi:

1. **Aset Gambar Vektor Bawaan Template Next.js (Sudah Dihapus)**:
   - `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`.
   - **Keterangan**: Berkas SVG default template `create-next-app` telah dihapus dari repositori bersama dengan berkas dead code lainnya (`StatCard.js`, `dummyData.js`) untuk meringankan proyek.

2. **Script Utilitas Baris Perintah (CLI)**:
   - `scripts/hash-password.js`
   - **Keterangan**: Berkas script independen yang dieksekusi secara manual via terminal (`node scripts/hash-password.js <password>`) untuk membuat hash kata sandi pengguna baru ke konsol.

3. **Script Pengujian Matriks Otorisasi RBAC**:
   - `fase1/tests/matrix.mjs`
   - **Keterangan**: Skrip otomasi pengujian matriks hak akses pengguna terhadap seluruh API endpoint aplikasi berdasarkan katalog izin `permissionCatalog.js`. Dijalankan secara terpisah dari CLI (`node fase1/tests/matrix.mjs`).

4. **Berkas Migrasi Skema SQL (Eksekusi Manual Database)**:
   - `migrations/005_drop_legacy_role.sql` & `005_drop_legacy_role_rollback.sql`
   - `migrations/006_add_bottle_count.sql` & `006_add_bottle_count_rollback.sql`
   - `migrations/backup_271026.sql`
   - **Keterangan**: Berkas DDL SQL yang dieksekusi langsung oleh database administrator menggunakan klien PostgreSQL (`psql` atau pgAdmin), bukan melalui modul import aplikasi JavaScript.

5. **Berkas Pengujian Mandiri Unit Test Node.js**:
   - `src/lib/f0.test.mjs`
   - `src/lib/alarmEpisodes.test.mjs`
   - `src/lib/alarmView.test.mjs`
   - `src/lib/plcCommandAlert.test.mjs`
   - **Keterangan**: Berkas script pengujian Node.js yang dijalankan secara mandiri untuk memverifikasi logika modul tanpa di-bundle ke dalam antarmuka web.

---

## 4. Hal yang Perlu Dikonfirmasi oleh Developer / Tim Otomasi

1. **Konfirmasi Skala Pengukuran Konduktivitas & Sensor Level Air**:
   - Perlu konfirmasi dari tim instrumen/otomasi mengenai rentang output sinyal analog transmitter 4-20mA (atau 0-10V) yang masuk ke register VW122 (konduktivitas) dan VW124 (level bejana) agar visualisasi bar level dan angka konduktivitas pada laporan memiliki satuan resmi (misal: µS/cm atau % volume).
2. **Ketiadaan Fallback String pada `JWT_SECRET`**:
   - Pada `src/lib/auth.js:19` dan `src/proxy.js:5`, fallback secret string dev bawaan telah dihapus total (`new TextEncoder().encode(process.env.JWT_SECRET)`). Pastikan variabel `JWT_SECRET` selalu terdefinisi pada environment server hosting produksi (`.env.local` / system env) agar verifikasi JWT tidak memicu galat otentikasi.
3. **Retensi Berkas Dump SQL `migrations/backup_271026.sql`**:
   - Perlu konfirmasi apakah berkas dump SQL berukuran 136 KB ini dipertahankan di git tracking atau sebaiknya dipindahkan ke repositori cadangan/storage terpisah dan diabaikan melalui `.gitignore`.
4. **Pengembalian Evaluasi Kesiapan Mesin (`startAllowed`) di Dashboard**:
   - Sebelum rilis produksi pabrik, pastikan baris `const startAllowed = true;` pada `src/app/(app)/page.js:460` dikembalikan ke logika evaluasi aslinya (`const startAllowed = !noData && data.plcOk === true && phaseRaw === 1 && !data.running;`) agar operator tidak dapat membuka dialog START saat mesin sedang berjalan atau koneksi PLC terputus.
5. **Eksekusi Migrasi 006 pada Server Produksi**:
   - Pastikan skrip `migrations/006_add_bottle_count.sql` dijalankan di database PostgreSQL server pabrik sehingga kolom `batch_records.bottle_count` terpasang resmi dan tidak lagi memicu fallback error 42703.

---

## 5. Item yang Sudah Teratasi (Resolved Items)

Poin-poin di bawah ini sebelumnya merupakan temuan kode mati, inkonsistensi, atau open questions yang telah berhasil dituntaskan pada codebase:

1. **Pembersihan Kolom Legacy `users.role` dan Trigger Sinkronisasi**
   - **Status**: `RESOLVED` (Migrasi `migrations/005_drop_legacy_role.sql`)
   - **Keterangan**: Kolom `users.role` tipe VARCHAR beserta fungsi/trigger sinkronisasi `users_sync_role_id()` telah di-drop secara resmi. Otorisasi kini sepenuhnya bergantung pada relasi `users.role_id -> roles.id` dan tabel `role_permissions`.
2. **Pembersihan Payload `actor` Mati pada Permintaan STOP Batch**
   - **Status**: `RESOLVED` (`src/app/(app)/page.js:283`)
   - **Keterangan**: Pengiriman payload `{ actor }` pada pemanggilan fetch `POST /api/batch/stop` yang diabaikan server telah dihapus. Identitas aktor pencatat audit STOP diambil secara aman dan langsung dari sesi JWT token pengguna yang sedang login (`session.username`).
3. **Akurasi Teks Konfirmasi Hapus Pengguna (Mekanisme Hapus-Lunak)**
   - **Status**: `RESOLVED` (`src/app/(app)/users/page.js:343` dan `page.js:446`)
   - **Keterangan**: Teks konfirmasi dialog yang sebelumnya menyatakan "secara permanen" telah diperbarui agar mencerminkan kondisi riil: akun dihapus-lunak (`deleted_at = now()`, `is_active = false`, `role_id = NULL`), riwayat batch dan audit tetap tersimpan, serta username terkunci permanen.
4. **Akurasi Teks Audit Log Hapus Pengguna**
   - **Status**: `RESOLVED` (`src/app/api/users/[username]/delete/route.js:81`)
   - **Keterangan**: Deskripsi audit trail pencatatan hapus user diperbarui mencantumkan keterangan eksplisit bahwa tindakan merupakan hapus-lunak (`(hapus-lunak; data tetap tersimpan, username terkunci)`).
5. **Pembersihan Berkas Pengujian Integrasi Usang**
   - **Status**: `RESOLVED`
   - **Keterangan**: Berkas pengujian `fase1/tests/fase1_integration.mjs` telah dihapus dari repositori dan digantikan secara definitif oleh harness pengujian matriks RBAC `fase1/tests/matrix.mjs`.

---

## Change Log

- [2026-10-29] ADDED: Menambahkan temuan bypass dashboard `startAllowed = true` di `src/app/(app)/page.js:460` pada seksi Dead Code, item unverified penerapan `migrations/006_add_bottle_count.sql` dan pemetaan tag HMI `MAN_BUZZER`/`SEL_PRESU`, berkas yatim migrasi 006, serta butir konfirmasi pra-produksi di seksi 4.
- [2026-10-28] RESOLVED: Memindahkan isu kolom legacy `users.role`, dead payload `actor` pada STOP batch, ketidakakuratan teks dialog hapus user, audit log delete_user, dan berkas uji usang `fase1_integration.mjs` ke seksi teratasi (Resolved Items).
- [2026-10-28] ADDED: Menambahkan item unverified kebijakan retensi `migrations/backup_271026.sql` dan konfigurasi environment akun uji `fase1/tests/matrix.mjs`.
- [2026-10-28] ADDED: Menambahkan berkas yatim baru `fase1/tests/matrix.mjs` pada seksi skrip CLI / pengujian.
- [2026-10-28] MODIFIED: Memperbarui peringatan `JWT_SECRET` pada seksi 4 karena fallback dev secret string pada `src/lib/auth.js:19` dan `src/proxy.js:5` telah dihapus sepenuhnya dari kode sumber.
