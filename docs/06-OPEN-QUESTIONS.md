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
   - **Lokasi Kode**: `src/app/api/batch/start/route.js:342-347` (guard web dinonaktifkan); `context/export_atv.awl:125-170` (logika AWL ladder SBR0)
   - **Status**: `[SEBAGIAN TERVERIFIKASI dari kode; perilaku fisik mesin saat M6.0 aktif di lapangan TIDAK TERVERIFIKASI]`
   - **Fakta Kode**: Guard pemeriksaan `door?.bypass` dinonaktifkan dalam blok komentar di `batch/start/route.js:342-347` — dikonfirmasi dari pembacaan kode langsung. Dari berkas AWL `context/export_atv.awl`, bit `M6.0` di-OR-kan ke kondisi jaringan pelepasan seal di SBR0 (fungsi bypass dari sisi PLC dapat dibaca dari AWL). Namun perilaku fisik mesin saat bit ini aktif (apakah siklus benar-benar dapat dimulai atau ada interlock mekanik lain) tetap `[TIDAK TERVERIFIKASI: perlu pengujian sinyal I/O fisik di lapangan]`.

5. **Durasi Pulsa Pelepasan Seal (`RELEASE_PULSE_MS = 3000`) di Mesin Fisik**
   - **Lokasi Kode**: `src/lib/plcDoorCatalog.js:29, 32`
   - **Status**: `[TIDAK TERVERIFIKASI: nilai tebakan; komentar di baris 29 menyatakan "BELUM"]`
   - **Fakta Kode**: Nilai 3000 ms dipakai sebagai estimasi durasi penahanan tombol Door Release di HMI. Komentar pengembang di baris 29 secara eksplisit menyatakan nilai ini belum dikonfirmasi ke mesin fisik. Bila durasi terlalu pendek aktuator mekanik mungkin belum sempat melepas seal; bila terlalu panjang dapat membebani siklus scan PLC.

6. **Tipe Tombol HMI Rantai Fisik (Forward/Backward) — Momentary atau Toggle?**
   - **Lokasi Kode**: Logika deadman di `src/lib/plcDeadman.js:48-125` (`DEADMAN_TIMEOUT_MS = 1000` ms)
   - **Status**: `[TIDAK TERVERIFIKASI: tipe tombol HMI fisik belum diverifikasi di lapangan]`
   - **Fakta Kode**: Sistem web mengimplementasikan mekanisme deadman (klien mengirim loop refresh tiap 250 ms, auto-OFF setelah 1000 ms tanpa sinyal). Jika tombol pada layar sentuh atau panel fisik HMI bersifat momentary, maka perilaku keduanya sinkron. Namun jika tombol fisik HMI bersifat toggle/latching, perilaku bit `M11.0`/`M11.1` saat dikendalikan bersamaan belum pernah diverifikasi di lapangan.

7. **Polaritas Lampu Indikator Pintu pada HMI Fisik vs Web**
   - **Lokasi Kode**: `src/app/(app)/door-operate/page.js:26-34`, `src/lib/plcDoorCatalog.js:73-76`
   - **Status**: `[TIDAK TERVERIFIKASI: polaritas logika aktif sinyal sensor pintu fisik]`
   - **Fakta Kode**: Komponen Lamp di web mengasumsikan nilai boolean `true` dari tag `CLS_FRNT`, `OPN_FRNT`, `CLS_REAR`, `OPN_REAR` memetakan lampu aktif. Polaritas sensor fisik mesin (apakah normally-open atau normally-closed) dan apakah status terbuka/tertutup menyala saat sinyal HIGH atau LOW belum diuji pada mesin fisik.

8. **Arti dan Pemetaan Output Q0.4 (`DOOR_REL_OUT`) serta Sensor Rantai `I1.7`/`I2.0`**
   - **Lokasi Kode**: `context/tag_terbaru_kepsrvr.csv:104`, `src/lib/plcDoorCatalog.js:20-21, 55`
   - **Status**: `[TIDAK TERVERIFIKASI: CSV menyebut "dugaan katup", wiring fisik belum diverifikasi]`
   - **Fakta Kode**: Tag `DOOR_REL_OUT` dialamatkan ke `Q0.4`, namun deskripsi CSV menyatakan perkiraan sebagai katup solenoid pembuangan seal. Sinyal input limit sensor `I1.7` (sensor maju) dan `I2.0` (sensor mundur) memotong output rantai `Q3.4`/`Q3.5` pada ladder AWL, namun belum diverifikasi ke wiring terminal mesin fisik.

9. **Status Nilai `data.door.seal` di `/api/status` saat Output Q0.5 Aktif di Mesin Fisik**
   - **Lokasi Kode**: `src/app/(app)/page.js:524-527`, `src/lib/plcDoorCatalog.js:75`
   - **Status**: `[TIDAK TERVERIFIKASI: verifikasi baca-balik bit sensor seal fisik di lapangan]`
   - **Fakta Kode**: Evaluasi tombol Door Sealing di dashboard bergantung pada `sealOn = !!data.door?.seal` (dari tag `DOOR_SEAL`). Belum diverifikasi apakah bit feedback ini langsung mencerminkan output Q0.5 atau membaca saklar tekanan fisik pneumatik dari seal karet bejana.

10. **Perilaku Nyata Pergerakan Rantai, Seal, dan Pembuangan Air (Chamber Drain) di Mesin Fisik**
    - **Lokasi Kode**: `src/lib/plcDeadman.js`, `src/app/api/plc-door/route.js`
    - **Status**: `[TIDAK TERVERIFIKASI: fitur Door Operate belum pernah diuji langsung ke mesin fisik pabrik]`
    - **Fakta Kode**: Logika pengaman web (deadman, auto-OFF, interlocking phase) telah lulus 21 uji mock (`fase1/tests/plc_door_mock.mjs`), namun interaksi fisik pergerakan mekanis kereta dorong, katup pembuangan air chamber `M2.5` (`MAN_WTR_DRAIN`), dan keandalan segel pintu belum pernah diuji pada autoclave fisik.

11. **[TERATASI] Status Impor Tag Kontrol Manual ke Master CSV KEPServerEX**
    - **Lokasi Kode**: `src/lib/plcManualCatalog.js:16-34`, `context/tag_paling_baru.csv:58-68`
    - **Status**: `[TERATASI: seluruh 11 tag kontrol manual resmi terdaftar di context/tag_paling_baru.csv]`
    - **Fakta Kode**: Seluruh 11 tag kontrol manual (`MANUAL_OPER`, `MAN_STEAM_1`, `MAN_STEAM_2`, `MAN_WTR_DRAIN`, `MAN_COOLING_1`, `MAN_COOLING_2`, `MAN_STEAM_EXHS`, `MAN_WTR_FILL`, `MAN_AIR_CMBR`, `MAN_WTR_PUMP`, `MAN_BUZZER`) serta tag `CAL_WATER` (VW324) kini telah resmi didaftarkan di berkas CSV master `context/tag_paling_baru.csv` (116 tag). Tidak ada lagi tag kontrol manual yang tertinggal di luar CSV.

12. **Kebijakan Retensi Berkas Backup SQL (`migrations/backup_271026.sql`)**
    - **Lokasi Kode**: `migrations/backup_271026.sql`
    - **Status**: `[TIDAK TERVERIFIKASI: status retensi berkas dump SQL di repositori git]`
    - **Fakta Kode**: Berkas cadangan database SQL berukuran 136 KB tersimpan dalam git tracking repositori tanpa dokumentasi apakah berkas ini snapshot sekali pakai sebelum eksekusi migrasi Fase 1 atau perlu dipertahankan selamanya di version control.

13. **Konfigurasi Akun Pengujian Matriks Perizinan Otomatis**
    - **Lokasi Kode**: `fase1/tests/matrix.mjs:18-45`
    - **Status**: `[TIDAK TERVERIFIKASI: ketersediaan file environment akun pengujian di pipeline CI/CD]`
    - **Fakta Kode**: Skrip pengujian matriks mewajibkan `process.env.CONFIRM_DEV === "yes"` dan membaca akun uji dari environment (`ACC_OPERATOR`, `ACC_MAINTAINER`, `ACC_QA`, `ACC_ADMIN`, `ACC_DASH`) dengan format `username:password`. Berkas `.env.test` atau konfigurasi akun otomatis belum didefinisikan secara resmi di root repositori.

14. **Status Eksekusi Migrasi 006 (`migrations/006_add_bottle_count.sql`) di Database Produksi**
    - **Lokasi Kode**: `src/app/api/batch/start/route.js:630`, `src/app/api/batch-records/export/route.js:103`
    - **Status**: `[TIDAK TERVERIFIKASI: status penerapan migrasi 006 pada database PostgreSQL produksi]`
    - **Fakta Kode**: Kode backend secara eksplisit menyertakan blok penanganan fallback bila kolom `bottle_count` belum ada di tabel `batch_records` (PostgreSQL error code `42703`). Status eksekusi skrip migrasi ini di server hosting fisik pabrik belum dapat diverifikasi hanya dari kode sumber.

15. **Pemetaan Tombol HMI Fisik untuk Buzzer M10.6 dan Kanal Tekanan P1 (SEL_PRESU)**
    - **Lokasi Kode**: `src/lib/plcManualCatalog.js:34`, `src/lib/plcParamCatalog.js:87`
    - **Status**: `[TIDAK TERVERIFIKASI: pemetaan tombol fisik HMI terhadap tag MAN_BUZZER (M10.6) dan interpretasi nilai 0/1 tag SEL_PRESU]`
    - **Fakta Kode**: Pada katalog kontrol manual terdapat catatan bahwa bit M10.6 belum diverifikasi pemetaannya terhadap tombol fisik mesin, dan pada katalog parameter terdapat catatan bahwa pemetaan nilai 0/1 tag `SEL_PRESU` (AIW12 vs AIW14) ke tampilan layar HMI fisik mesin belum diverifikasi di lapangan.

16. **[TERATASI] Penyesuaian Penamaan Tag F0 Resmi (`F0_VAL`)**
    - **Lokasi Kode**: `src/lib/plcParamCatalog.js:50`, `src/lib/plc.js:78`, `src/app/api/batch/start/route.js:390`
    - **Status**: `[TERATASI: tag register VW220 resmi dinamai F0_VAL sesuai context/tag_paling_baru.csv]`
    - **Fakta Kode**: Tag beralamat register VW220 telah diselaraskan ke penamaan resmi `"F0_VAL"`. Telah dimasukkan ke `plcParamCatalog.js` (`foValue`), `plc.js` (`f0Val`, scaling x10 ke menit, `setpoints.f0Val`), serta `batch/start` untuk penulisan dan verifikasi setpoint resep.

17. **[TERATASI] Pemetaan Tag Offset Kalibrasi Konduktivitas (`CAL_L`) dan Level Air (`CAL_WATER`)**
    - **Lokasi Kode**: `src/lib/plcParamCatalog.js:120-122`, `src/app/api/plc-params/route.js:51`
    - **Status**: `[TERATASI: register VW322 untuk CAL_L dan VW324 untuk CAL_WATER terkonfirmasi sesuai context/tag_paling_baru.csv]`
    - **Fakta Kode**: Register `CAL_L` (VW322) dan `CAL_WATER` (VW324) telah masuk ke katalog kalibrasi `plcParamCatalog.js` serta pembacaan nilai sensor aktual `LIVE_TAGS` pada API `plc-params`.

---

## 2. Kode Mati / Bagian Terisolasi (Dead Code)

1. **Guard Bypass Interlock M6.0 yang Dinonaktifkan**
   - **Lokasi Kode**: `src/app/api/batch/start/route.js:342-347`
   - **Kondisi**: Blok kode pemeriksaan status interlock pintu `door?.bypass` dimatikan dengan komentar `// if (door?.bypass) { ... }`.
   - **Dampak**: Permintaan START tidak lagi mengecek status bit M6.0 dari PLC.

2. **Fixture Data Uji Sterilisasi Riil**
   - **Lokasi Kode**: `src/lib/__fixtures__/printout_2026-10-03.js`
   - **Kondisi**: Berkas data statis array 282 baris hanya di-import oleh unit test `src/lib/f0.test.mjs:7` dan tidak pernah di-import oleh komponen runtime web produksi mana pun.

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
   - `src/lib/auditActionLabels.test.mjs`
   - `src/lib/backup.test.mjs`
   - **Keterangan**: Berkas script pengujian Node.js yang dijalankan secara mandiri untuk memverifikasi logika modul tanpa di-bundle ke dalam antarmuka web.

6. **Test Mock Door Operate**:
   - `fase1/tests/plc_door_mock.mjs`
   - **Keterangan**: Berkas pengujian mock terpisah yang dijalankan via `node fase1/tests/plc_door_mock.mjs`. Berisi 21 tes mock pagar (`checkDoorCommand`) dan mekanisme deadman (`createDoorSafety`). Seluruh 21 pengujian berhasil lolos (pass).

7. **Test Pemeriksaan Database Backup**:
   - `fase1/tests/backup_check.mjs`
   - **Keterangan**: Berkas script pengujian baca-saja yang dijalankan via `node fase1/tests/backup_check.mjs` untuk memverifikasi pembuatan arsip backup terhadap PostgreSQL riil, membandingkan jumlah baris, dan memvalidasi checksum SHA-256. Bersifat non-destruktif (membersihkan arsip sementara setelah pengujian).

---

## 4. Hal yang Perlu Dikonfirmasi oleh Developer / Tim Otomasi

1. **Konfirmasi Skala Pengukuran Konduktivitas & Sensor Level Air**:
   - Perlu konfirmasi dari tim instrumen/otomasi mengenai rentang output sinyal analog transmitter 4-20mA (atau 0-10V) yang masuk ke register VW122 (konduktivitas) dan VW124 (level bejana) agar visualisasi bar level dan angka konduktivitas pada laporan memiliki satuan resmi (misal: µS/cm atau % volume).
2. **Ketiadaan Fallback String pada `JWT_SECRET`**:
   - Pada `src/lib/auth.js:19` dan `src/proxy.js:5`, fallback secret string dev bawaan telah dihapus total (`new TextEncoder().encode(process.env.JWT_SECRET)`). Pastikan variabel `JWT_SECRET` selalu terdefinisi pada environment server hosting produksi (`.env.local` / system env) agar verifikasi JWT tidak memicu galat otentikasi.
3. **Retensi Berkas Dump SQL `migrations/backup_271026.sql`**:
   - Perlu konfirmasi apakah berkas dump SQL berukuran 136 KB ini dipertahankan di git tracking atau sebaiknya dipindahkan ke repositori cadangan/storage terpisah dan diabaikan melalui `.gitignore`.
4. **Komentar Toggle Uji `startAllowed` di Dashboard**:
   - **Lokasi Kode**: `src/app/(app)/page.js:493-494`
   - **Keterangan**: Logika evaluasi kesiapan mesin di baris 492 (`const startAllowed = !noData && data.plcOk === true && phaseRaw === 1 && !data.running;`) berjalan normal dan aktif. Komentar pengembang di baris 493–494 (`// Biarkan baris ini tetap ada untuk testing pop up start ya` dan `// const startAllowed = true;`) sengaja dibiarkan pemilik untuk pengujian pop-up START saat tidak terhubung ke mesin fisik (bukan bypass aktif). Disarankan untuk tetap dibersihkan atau dikomentari permanen sebelum rilis produksi pabrik.
5. **Eksekusi Migrasi 006 pada Server Produksi**:
   - Pastikan skrip `migrations/006_add_bottle_count.sql` dijalankan di database PostgreSQL server pabrik sehingga kolom `batch_records.bottle_count` terpasang resmi dan tidak lagi memicu fallback error 42703.
6. **[TERATASI] Kepastian Penamaan Tag F0 (`F0_VAL`) dan Register `CAL_L` (VW322) & `CAL_WATER` (VW324)**:
   - Dikonfirmasi dari berkas `context/tag_paling_baru.csv` bahwa tag F0 beralamat VW220 adalah `F0_VAL`, `CAL_L` adalah VW322, dan `CAL_WATER` adalah VW324. Seluruh 116 tag pada CSV telah terpetakan penuh ke kode aplikasi.

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
6. **Klarifikasi Evaluasi Kesiapan Mesin Dashboard (`startAllowed`)**
   - **Status**: `RESOLVED` (`src/app/(app)/page.js:492-494`)
   - **Keterangan**: Laporan sebelumnya menandai baris `startAllowed = true` sebagai bypass aktif / dead code (salah baca). Verifikasi kode membuktikan baris aktif di baris 492 mengevaluasi kesiapan mesin secara penuh (`!noData && data.plcOk === true && phaseRaw === 1 && !data.running`), sedangkan baris `// const startAllowed = true;` di baris 494 hanyalah komentar toggle uji yang sengaja dibiarkan pemilik untuk pengetesan modal START tanpa mesin.
7. **Kamus Translasi & Standarisasi Warna Badge Aksi Audit Trail**
   - **Status**: `RESOLVED` (`src/lib/auditActionLabels.js` & `src/lib/auditActionLabels.test.mjs`)
   - **Keterangan**: Seluruh 37 aksi teknis database kini memiliki modul translasi resmi ke Bahasa Indonesia dan skema warna badge konsisten (`run`, `water`, `steam`, `stop`, `idle`, `plain`) yang terintegrasi pada antarmuka audit log web dan lembar cetak dokumen audit, diverifikasi dengan 117 unit test lolos.
8. **Konsolidasi Master Tag CSV KEPServerEX**
   - **Status**: `RESOLVED` (`context/tag_terbaru_kepsrvr.csv`)
   - **Keterangan**: Dua berkas CSV lama (`context/SiemensS7-200.csv` dan `context/SiemensS7-200_pintu_NANTI.csv`) telah digantikan oleh satu berkas master CSV `tag_terbaru_kepsrvr.csv` (105 tag), mengintegrasikan seluruh 6 tag pintu autoclave dan parameter mesin.
9. **Pelacakan Berkas Fitur Door Operate di Git**
   - **Status**: `RESOLVED` (Commit `0993d97`)
   - **Keterangan**: Sebanyak 5 berkas door operate (`door-operate/page.js`, `api/plc-door/route.js`, `plcDoorCatalog.js`, `plcDeadman.js`, `plc_door_mock.mjs`) yang sebelumnya berstatus untracked kini telah di-commit secara resmi ke branch `main`.
10. **Perluasan Skrip Matriks RBAC untuk Endpoint PLC**
    - **Status**: `RESOLVED` (`fase1/tests/matrix.mjs:16-35`)
    - **Keterangan**: Skrip `matrix.mjs` kini menguji endpoint PLC (`/api/plc-door`, `/api/plc-manual`, `/api/plc-clock`, `/api/plc-params`, `/api/batch/start`, serta opsi `PROBE_MACHINE_DENY=yes` untuk `/api/batch/stop` dan `/api/plc/reset`) menggunakan mekanisme safe probe yang berhenti di layer validasi tanpa menggerakkan mesin fisik.
11. **Peringatan Linting `react-hooks/set-state-in-effect` pada Halaman Cetak Trend Mandiri**
    - **Status**: `RESOLVED` (`src/app/print/trend/[batchNo]/page.js:176`)
    - **Keterangan**: Pemanggilan `setLoading(false)` langsung dalam body `useEffect` telah dibungkus menggunakan `Promise.resolve().then(() => setLoading(false))`. Pemeriksaan ESLint pada direktori `src/` kini menghasilkan 0 error dan 0 warning (lulus 100%).
12. **Kamus Translasi Seluruh Aksi Audit Log Sistem (Perluasan ke 55 Aksi)**
    - **Status**: `RESOLVED` (`src/lib/auditActionLabels.js` & `src/lib/auditActionLabels.test.mjs`)
    - **Keterangan**: Sebanyak 18 aksi audit tambahan (mencakup formula, produk, spesifikasi, batch, ekspor data, dan layanan backup) telah resmi dipetakan ke dalam `AUDIT_ACTIONS` dengan label bahasa Indonesia dan warna badge terstandarisasi, diverifikasi dengan 171 unit test lolos 100%.
13. **Integrasi 116 Tag Master PLC ke CSV Resmi (`context/tag_paling_baru.csv`)**
    - **Status**: `RESOLVED` (`context/tag_paling_baru.csv`)
    - **Keterangan**: Berkas CSV master terbaru telah menggantikan `context/tag_terbaru_kepsrvr.csv` (105 tag) menjadi `context/tag_paling_baru.csv` (116 tag). Seluruh 11 tag kontrol manual (`MANUAL_OPER`, `MAN_STEAM_1`, `MAN_STEAM_2`, `MAN_WTR_DRAIN`, `MAN_COOLING_1`, `MAN_COOLING_2`, `MAN_STEAM_EXHS`, `MAN_WTR_FILL`, `MAN_AIR_CMBR`, `MAN_WTR_PUMP`, `MAN_BUZZER`), offset kalibrasi level air bejana (`CAL_WATER` di VW324), serta standarisasi penamaan `F0_VAL` (VW220) dan register kalibrasi konduktivitas `CAL_L` (VW322) kini 100% terdaftar resmi dan sinkron dengan kode sumber.

---

## 6. Daftar Analisis Risiko Teknis & Keterbatasan Kode (Audit 2026-11-05)

Berikut adalah rangkuman inventarisasi risiko teknis, kode komentar pengaman, penanganan galat kosong, dan gap pengujian otomatis yang ditemukan pada audit kode:

1. **Guard Bypass Interlock `door?.bypass` (M6.0) Dinonaktifkan**:
   - **Lokasi**: `src/app/api/batch/start/route.js:353-358`
   - **Risiko**: Komentar kode mencatat bahwa guard web dicabut karena mesin autoclave tetap dapat memulai proses pada SCADA lama saat M6.0 aktif (uji lapangan 10 Okt 2026). Dari analisis file ladder AWL (`context/export_atv.awl:125-170`), M6.0 berfungsi sebagai bypass interlock tekanan pelepasan seal dan pembukaan pintu. Memulai siklus saat M6.0 aktif sepenuhnya bergantung pada proteksi internal ladder PLC.

2. **Komentar Toggle Uji `startAllowed` di Dashboard**:
   - **Lokasi**: `src/app/(app)/page.js:493-494`
   - **Risiko**: Bukan bypass aktif saat ini (logika asli di baris 492 aktif penuh). Namun keberadaan baris komentar `// const startAllowed = true;` berisiko tidak sengaja diaktifkan kembali oleh pengembang saat maintenance tanpa verifikasi koneksi mesin fisik.

3. **Keterbatasan Pengaman Rantai Door Operate saat Server Mati**:
   - **Lokasi**: `src/lib/plcDeadman.js:14-17`, `server.js:92-105`
   - **Risiko**: Mekanisme deadman rantai berjalan di memori Node.js (`setTimeout` 1000 ms). Bila proses server atau PC SCADA mati mendadak saat bit `M11.0` (Forward) atau `M11.1` (Backward) sedang bernilai `true`, server tidak dapat menulis `false`. Rantai fisik akan terus bergerak sampai sensor batas mesin (`I1.7`/`I2.0`) atau interlock PLC memotongnya. Penanganan saat ini: `server.js` menulis `false` secara best-effort saat startup (baris 101–111). Perlindungan mutlak membutuhkan timer internal pada ladder PLC.

4. **[TERATASI] Ketiadaan Berkas CSV Resmi untuk 11 Tag Kontrol Manual**:
   - **Lokasi**: `src/lib/plcManualCatalog.js:16-34`, `context/tag_paling_baru.csv`
   - **Status**: Telah diselesaikan melalui kehadiran `context/tag_paling_baru.csv` (116 tag). Seluruh 11 tag kontrol manual (`MANUAL_OPER`, `MAN_STEAM_1` s.d. `MAN_BUZZER`) dan tag kalibrasi `CAL_WATER` kini telah resmi terdaftar di baris 31 dan 58–68 master CSV.

5. **Catatan TODO Kritis Terbengkalai di Pustaka Inti**:
   - `src/lib/batchFinalize.js:22`: `// TODO: konfirmasikan ke QA apakah kode 5 (cooling) sudah cukup sebagai bukti sterilisasi selesai.`
   - `src/lib/batchFinalize.js:115`: `// TODO (pertanyaan terbuka #2): definisi Total.Time di printout lama belum pasti`
   - `src/lib/plc.js:338, 339, 371, 372`: Formula scaling konduktivitas (`L` / VW122) dan level air bejana (`WATER` / VW124) belum dikonfirmasi.

6. **Penyembunyian Peringatan Kompiler (21 Baris `eslint-disable`)**:
   - Ditemukan 21 baris penonaktifan aturan ESLint (khususnya `react-hooks/set-state-in-effect` dan `react-hooks/exhaustive-deps`) pada halaman dashboard `page.js` (baris 251, 256, 278), `alarm/page.js`, `audit-log/page.js`, `data-report/page.js`, `StartDialog.js`, dll. Hal ini dilakukan untuk menghindari re-render loop saat sinkronisasi state polling, namun memerlukan perhatian saat refactoring.

7. **Penelanan Galat Kosong (18 Blok `catch { }`)**:
   - Ditemukan 18 blok `catch` kosong tanpa logging di komponen frontend dan deadman (misal: `door-operate/page.js:100, 111`, `manual/page.js:55, 66`, `page.js:264`, `plc-clock/page.js:38, 49`). Galat jaringan pada polling berkala diabaikan agar antarmuka tidak berkedip banner error sementara koneksi tidak stabil.

8. **Pengecualian Uji Otomatis pada Skrip Matriks RBAC**:
   - **Lokasi**: `fase1/tests/matrix.mjs:36-39`
   - **Risiko**: Skrip `matrix.mjs` sengaja mengecualikan pengujian untuk `POST /api/auth/unlock` (agar tidak memicu pembatasan login throttle akibat ketiadaan password) dan field bertingkat `restricted` pada `PUT /api/plc-params` (memerlukan rentang nilai valid katalog untuk menguji penolakan izin `action.write_safety_params`).

9. **[TERATASI] Peringatan Linting `react-hooks/set-state-in-effect` pada Halaman Cetak Trend**:
   - **Status**: Telah diselesaikan pada `src/app/print/trend/[batchNo]/page.js:176` via `Promise.resolve().then(...)`. Hasil uji linter kini bersih 100% (0 error, 0 warning).

---

## Change Log

- [2026-11-07] RESOLVED: Memindahkan isu 11 tag kontrol manual yang belum terdaftar di CSV ke Seksi 5 dan menandai butir 4 Seksi 6 sebagai teratasi setelah seluruh 116 tag PLC resmi dimasukkan ke master CSV context/tag_paling_baru.csv.
- [2026-11-07] RESOLVED: Memindahkan isu diskrepansi register kalibrasi konduktivitas CAL_L (VW322 vs VW144) dan F0 target (F0_VAL VW220) ke status terselesaikan seiring pembaruan master tag CSV.

- [2026-11-05] RESOLVED: Memindahkan isu peringatan linting `react-hooks/set-state-in-effect` pada halaman cetak trend dan kesenjangan translasi aksi audit ke Seksi 5 setelah diperbaiki penuh di kode.
- [2026-11-05] ADDED: Menambahkan berkas pengujian mandiri `src/lib/backup.test.mjs` dan skrip validasi database baca-saja `fase1/tests/backup_check.mjs` pada Seksi 3.
- [2026-11-03] ADDED: Menambahkan butir 16 (Diskrepansi Penamaan Tag F0: `FO_VALUE` vs `F0_VAL`) dan butir 17 (Diskrepansi Register `CAL_L`: VW144 vs VW322) pada Seksi 1. Menambahkan butir 6 (konfirmasi penamaan F0 dan register CAL_L) pada Seksi 4. Menambahkan butir 9 (peringatan linting pada print/trend/[batchNo]) pada Seksi 6.
- [2026-11-03] RESOLVED: Menambahkan 4 item teratasi pada Seksi 5: translasi audit log via `auditActionLabels.js`, konsolidasi CSV ke `tag_terbaru_kepsrvr.csv`, pelacakan git berkas door-operate, dan perluasan safe probe PLC pada skrip pengujian `matrix.mjs`.
- [2026-11-03] MODIFIED: Memperbarui butir 11 Seksi 1 dan butir 4 Seksi 6 (kini fokus pada sisa 11 tag kontrol manual yang belum ada di CSV master). Memperbarui butir 5 Seksi 3 (menambahkan `auditActionLabels.test.mjs`) dan butir 6 Seksi 3 (menghapus status untracked `plc_door_mock.mjs`). Memperbarui butir 8 Seksi 6 mengenai status probe `matrix.mjs`.
- [2026-11-02] ADDED: Menambahkan Seksi 6 (Analisis Risiko Teknis & Keterbatasan Kode) mencakup evaluasi bypass interlock M6.0, komentar toggle startAllowed, failsafe deadman saat server down, ketiadaan CSV 15 tag manual/parameter, TODO terbengkalai, dan gap uji 9 endpoint di matrix.mjs.
- [2026-11-02] RESOLVED: Mengoreksi klaim lama bahwa `startAllowed = true` adalah bypass aktif (salah baca). Logika evaluasi di `src/app/(app)/page.js:492` aktif penuh; baris 494 hanyalah komentar toggle uji yang sengaja dibiarkan pemilik. Memindahkan item dari Dead Code ke Resolved dan memperbarui Seksi 4 menjadi catatan netral.
- [2026-11-02] MODIFIED: Memperbarui nomor baris dead code `startAllowed` dari `page.js:460` → `page.js:501` sesuai verifikasi kode terbaru (file bertambah ±163 baris). Menambahkan 5 item baru belum terverifikasi ke mesin (butir 9–13) terkait fitur Door Operate. Menambahkan berkas yatim baru `fase1/tests/plc_door_mock.mjs` ke Seksi 3. Memperbarui Seksi 4 butir 4 (nomor baris baru). Memperbarui Seksi 1 butir 4 (status AWL dan guard web).
- [2026-10-29] ADDED: Menambahkan temuan bypass dashboard `startAllowed = true` di `src/app/(app)/page.js:460` pada seksi Dead Code, item unverified penerapan `migrations/006_add_bottle_count.sql` dan pemetaan tag HMI `MAN_BUZZER`/`SEL_PRESU`, berkas yatim migrasi 006, serta butir konfirmasi pra-produksi di seksi 4.
- [2026-10-28] RESOLVED: Memindahkan isu kolom legacy `users.role`, dead payload `actor` pada STOP batch, ketidakakuratan teks dialog hapus user, audit log delete_user, dan berkas uji usang `fase1_integration.mjs` ke seksi teratasi (Resolved Items).
- [2026-10-28] ADDED: Menambahkan item unverified kebijakan retensi `migrations/backup_271026.sql` dan konfigurasi environment akun uji `fase1/tests/matrix.mjs`.
- [2026-10-28] ADDED: Menambahkan berkas yatim baru `fase1/tests/matrix.mjs` pada seksi skrip CLI / pengujian.
- [2026-10-28] MODIFIED: Memperbarui peringatan `JWT_SECRET` pada seksi 4 karena fallback dev secret string pada `src/lib/auth.js:19` dan `src/proxy.js:5` telah dihapus sepenuhnya dari kode sumber.
