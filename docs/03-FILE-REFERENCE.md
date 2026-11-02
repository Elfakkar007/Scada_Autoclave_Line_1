# Referensi File Teknis (File Reference)

Dokumen ini memuat dokumentasi teknis lengkap dan faktual untuk setiap file dalam proyek `scada-sterilizer` (total 135 file, 128 file di luar folder `docs/`). Seluruh deskripsi, nama fungsi, export, import, dan nomor baris diverifikasi langsung dari kode sumber tanpa praduga atau spekulasi.

---

### `package.json`
- **Tipe**: Config / Manifest
- **Fungsi**: Mendefinisikan nama paket, versi, scripts build/dev, serta dependensi pustaka proyek Next.js dan driver PostgreSQL.
- **Export utama**: Tidak ada (berkas JSON manifest).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menentukan runtime engine dan pustaka eksternal yang diinstal pada `node_modules`.
- **Bukti**: `package.json:1-30`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

---

### `next.config.mjs`
- **Tipe**: Config
- **Fungsi**: Mengonfigurasi pengaturan framework Next.js.
- **Export utama**: `nextConfig` (objek konfigurasi default Next.js).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mempengaruhi proses kompilasi dan bundling aplikasi Next.js.
- **Bukti**: `next.config.mjs:1-6`
- **Catatan**: Objek konfigurasi berstatus kosong `{}` (`next.config.mjs:2`).

---

### `jsconfig.json`
- **Tipe**: Config
- **Fungsi**: Mengatur path mapping compiler JavaScript untuk memetakan alias `@/*` ke `./src/*`.
- **Export utama**: Tidak ada (berkas JSON konfigurasi).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menyediakan resolusi alias import pada runtime dan IDE.
- **Bukti**: `jsconfig.json:1-9`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

---

### `eslint.config.mjs`
- **Tipe**: Config
- **Fungsi**: Mengonfigurasi linter JavaScript menggunakan Flat Config ESLint dan plugin bawaan Next.js.
- **Export utama**: `eslintConfig` (array konfigurasi aturan ESLint).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Digunakan oleh perintah `npm run lint` untuk analisis statis kode.
- **Bukti**: `eslint.config.mjs:1-11`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

---

### `postcss.config.mjs`
- **Tipe**: Config
- **Fungsi**: Mendaftarkan plugin PostCSS `@tailwindcss/postcss` untuk pemrosesan file CSS Tailwind v4.
- **Export utama**: Objek konfigurasi default PostCSS.
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mempengaruhi pemrosesan stylesheet pada build Next.js.
- **Bukti**: `postcss.config.mjs:1-6`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

---

### `.gitignore`
- **Tipe**: Config
- **Fungsi**: Mengecualikan folder dependensi, build artifact Next.js, berkas log, dan environment variables lokal dari pelacakan Git.
- **Export utama**: Tidak ada (berkas teks Git ignore).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mencegah commit direktori seperti `node_modules` dan `.next` ke repositori.
- **Bukti**: `.gitignore:1-35`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

---

### `.env.local`
- **Tipe**: Config / Environment
- **Fungsi**: Menyimpan konfigurasi variabel lingkungan lokal untuk database PostgreSQL, secret JWT, dan IoT Gateway PLC.
- **Export utama**: Tidak ada (berkas konfigurasi env lokal).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menyediakan nilai variabel lingkungan runtime pada `process.env`.
- **Bukti**: `.env.local:1-12`
- **Catatan**: [TIDAK TERVERIFIKASI: nilai rahasia env di lingkungan hosting produksi].

---

### `README.md`
- **Tipe**: Dokumentasi
- **Fungsi**: Memuat instruksi dasar template pembuatan proyek Next.js dengan perintah run `npm run dev`.
- **Export utama**: Tidak ada (berkas teks Markdown).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `README.md:1-43`
- **Catatan**: Berisi teks bawaan `create-next-app`.

---

### `server.js`
- **Tipe**: Entry Point / Custom Server
- **Fungsi**: Membuat server HTTP kustom port 3001, mengintegrasikan Next.js request handler, menjalankan background interval 5 detik untuk trend recorder, pemantau alarm, dan saat startup best-effort mereset `CHAIN_FWD`/`CHAIN_BWD` = false agar rantai tidak tertinggal menyala dari sesi sebelum server mati.
- **Export utama**: Tidak ada (script eksekusi Node.js).
- **Meng-import (internal)**: `src/lib/trendRecorder.js` (dynamic import, baris 42), `src/lib/alarmMonitor.js` (dynamic import, baris 44), `src/lib/plcWrite.js` (dynamic import best-effort, baris 95)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membuka port jaringan HTTP (`server.js:67`), membaca env `PORT`, `HOSTNAME`, `TRUST_PROXY`, menjalankan `setInterval` latar belakang, menyuntikkan header `x-client-ip` tiap request (`server.js:59`).
- **Bukti**: `server.js:1-108`
- **Catatan**: Blok reset rantai (baris 92–105): pada 10 detik setelah server siap, mengimpor `plcWrite.js` via dynamic import dan menulis `CHAIN_FWD`/`CHAIN_BWD` = false secara best-effort. Kegagalan (tag belum diimpor, PLC belum siap) hanya menghasilkan `console.warn`, tidak menghentikan server. Pola CJS + dynamic import dipakai karena ESM interop (baris 10–19 komentar penjelasan).

---

### `scripts/hash-password.js`
- **Tipe**: Script CLI
- **Fungsi**: Menghasilkan string hash bcrypt dari argumen baris perintah atau input default serta mencetak contoh query INSERT pengguna dengan penugasan `role_id` ke tabel `roles`.
- **Export utama**: Tidak ada (script mandiri CLI).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menulis output string hash password dan contoh query INSERT ke konsol terminal.
- **Bukti**: `scripts/hash-password.js:1-26`
- **Catatan**: Menggunakan subquery `(SELECT id FROM roles WHERE key = 'admin')` untuk `role_id`. Kolom legacy `users.role` sudah dihapus.

---

### `src/proxy.js`
- **Tipe**: Middleware / Proxy (Next.js 16)
- **Fungsi**: Memeriksa keberadaan dan validitas cookie session_token JWT pada route yang dilindungi dan mengalihkan pengguna belum login ke halaman /login.
- **Export utama**: `proxy` (fungsi asynchronous middleware)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membaca cookie `session_token`, memverifikasi JWT via `jose`, dan memodifikasi respons redirect HTTP.
- **Bukti**: `src/proxy.js:10-38`
- **Catatan**: Menggantikan konvensi `middleware.js` sesuai standar Next.js 16.

---

### `context/SiemensS7-200.csv`
- **Tipe**: Data Referensi
- **Fungsi**: Mendokumentasikan daftar 62 baris pemetaan tag PLC Siemens S7-200, alamat register memori (VW, Q, I, M), tipe data, dan deskripsi fungsinya.
- **Export utama**: Tidak ada (berkas teks CSV referensi).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Tidak ada (berkas referensi).
- **Bukti**: `context/SiemensS7-200.csv:1-62`
- **Catatan**: Menjadi dasar konstanta `TAG_MAP` pada `src/lib/plc.js`.

---

### `context/export_atv.awl`
- **Tipe**: Data Referensi
- **Fungsi**: Memuat 1043 baris kode program logika ladder/AWL pengontrol PLC Siemens S7-200 pada unit Autoclave Line 1.
- **Export utama**: Tidak ada (berkas instruksi AWL PLC).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Tidak ada (berkas referensi).
- **Bukti**: `context/export_atv.awl:1-1043`
- **Catatan**: Berisi logika interlock pintu, subrutin sterilisasi, dan pembacaan sensor analog VW.

---

### `context/ROADMAP (12).md`
- **Tipe**: Dokumentasi
- **Fungsi**: Mencatat 586 baris riwayat keputusan teknis, arsitektur SCADA, pemetaan tag PLC, dan catatan commit perbaikan sistem.
- **Export utama**: Tidak ada (berkas teks Markdown referensi).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `context/ROADMAP (12).md:1-586`
- **Catatan**: Dokumen historis pengembangan.

---

### `package-lock.json`
- **Tipe**: Lockfile
- **Fungsi**: Mengunci versi spesifik dependensi paket npm dan integritas hash tarball.
- **Export utama**: Tidak ada (lockfile npm).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjamin determinisme instalasi dependensi.
- **Bukti**: `package-lock.json`
- **Catatan**: Berkas lockfile otomatis oleh npm.

---

### `public/sounds/alarm.wav`
- **Tipe**: Audio Asset
- **Fungsi**: Menyediakan berkas audio suara peringatan alarm yang diputar berulang oleh komponen antarmuka AlarmCenter saat ada alarm aktif.
- **Export utama**: Tidak ada (berkas audio binary WAV).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Di-fetch oleh browser klien pada path `/sounds/alarm.wav` (`src/components/AlarmCenter.js:77`).
- **Bukti**: `src/components/AlarmCenter.js:77`
- **Catatan**: Daftar aset non-kode.

---

### `public/satoria-logo.png`
- **Tipe**: Image Asset
- **Fungsi**: Menyediakan file gambar logo Satoria Pharma yang dirender pada navbar utama aplikasi dan halaman login.
- **Export utama**: Tidak ada (berkas binary gambar PNG).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Di-load oleh tag `<img>` pada Navbar (`src/components/Navbar.js:18`) dan Login (`src/app/login/page.js:132`).
- **Bukti**: `src/components/Navbar.js:18`, `src/app/login/page.js:132`
- **Catatan**: Daftar aset non-kode.

---

### `src/lib/db.js`
- **Tipe**: Util / Database Client Pool
- **Fungsi**: Menginisialisasi connection pool PostgreSQL (`pg.Pool`) berkapasitas maksimal 20 koneksi dan idle timeout 30 detik.
- **Export utama**: `pool` (default export instance `pg.Pool`)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/alarms/active/route.js`, `src/app/api/alarms/by-batch/[batchNo]/route.js`, `src/app/api/alarms/event-types/route.js`, `src/app/api/alarms/print-data/route.js`, `src/app/api/alarms/route.js`, `src/app/api/audit-log/export/route.js`, `src/app/api/audit-log/filters/route.js`, `src/app/api/audit-log/route.js`, `src/app/api/auth/login/route.js`, `src/app/api/auth/me/route.js`, `src/app/api/auth/unlock/route.js`, `src/app/api/auth/users/route.js`, `src/app/api/batch/start/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/batch-records/export/route.js`, `src/app/api/batch-records/route.js`, `src/app/api/batch-records/[batchNo]/route.js`, `src/app/api/formulas/route.js`, `src/app/api/formulas/[formulaNo]/route.js`, `src/app/api/plc/reset/route.js`, `src/app/api/product-specs/route.js`, `src/app/api/product-specs/[id]/route.js`, `src/app/api/products/route.js`, `src/app/api/products/[id]/route.js`, `src/app/api/status/route.js`, `src/app/api/users/route.js`, `src/app/api/users/[username]/reset-password/route.js`, `src/app/api/users/[username]/route.js`, `src/lib/alarmMonitor.js`, `src/lib/auditLog.js`, `src/lib/auth.js`, `src/lib/batchFinalize.js`, `src/lib/trendRecorder.js`
- **Efek samping / dependensi eksternal**: Membuka koneksi TCP pool ke server PostgreSQL menggunakan variabel lingkungan `DATABASE_URL` (`src/lib/db.js:14`).
- **Bukti**: `src/lib/db.js:1-20`
- **Catatan**: Memasang event listener error pada pool (`src/lib/db.js:18`).

---

### `src/lib/auth.js`
- **Tipe**: Util / Autentikasi & Otorisasi (Server-Only)
- **Fungsi**: Menyediakan pembuatan token sesi JWT berdurasi 8 jam, verifikasi sesi dari cookies, opsi keamanan cookie, query data izin pengguna real-time dari database (`loadUserAccess`), serta guard otorisasi `requireAuth`, `requirePermission`, dan `requireAnyPermission`. Guard legacy `requireAdmin` telah dihapus.
- **Export utama**: `createSessionToken`, `sessionCookieOptions`, `verifySessionToken`, `getSessionFromCookies`, `requireAuth`, `requirePermission`, `requireAnyPermission` (fungsi)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/permissionCatalog.js`
- **Dipakai oleh**: Seluruh route handler API berotentikasi di `src/app/api/*`
- **Efek samping / dependensi eksternal**: Membaca variabel lingkungan `JWT_SECRET` (`src/lib/auth.js:19`), `COOKIE_SECURE` (`src/lib/auth.js:41`), membaca/memodifikasi cookies HTTP, dan menjalankan query ke tabel `users`, `roles`, serta `role_permissions`.
- **Bukti**: `src/lib/auth.js:1-195`
- **Catatan**: Perubahan role/izin pengguna di database langsung berlaku pada request berikutnya tanpa menunggu masa berlaku JWT berakhir.

---

### `src/lib/auditLog.js`
- **Tipe**: Util / Logging Audit Trail
- **Fungsi**: Menyediakan fungsi fail-closed `insertAudit` yang melempar exception bila audit gagal, dan fail-open `tryAudit` yang hanya mencatat warning ke console tanpa melempar error.
- **Export utama**: `insertAudit`, `tryAudit` (fungsi asynchronous)
- **Meng-import (internal)**: `src/lib/db.js`
- **Dipakai oleh**: `src/app/api/auth/login/route.js`, `src/app/api/auth/logout/route.js`, `src/app/api/auth/unlock/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/plc/reset/route.js`
- **Efek samping / dependensi eksternal**: Melakukan query SQL `INSERT INTO audit_log` (`src/lib/auditLog.js:29`).
- **Bukti**: `src/lib/auditLog.js:1-74`
- **Catatan**: Kolom `actor_name` otomatis disalin dari tabel `users.full_name` via database trigger (`src/lib/auditLog.js:3`).

---

### `src/lib/batchNo.js`
- **Tipe**: Util / Validasi String
- **Fungsi**: Memvalidasi string format Batch No agar tidak kosong, memiliki panjang maksimal 64 karakter, dan hanya berisi karakter alfanumerik, spasi, dash, underscore, atau slash.
- **Export utama**: `validateBatchNo`, `sanitizeBatchNo` (fungsi), `BATCH_NO_MAX_LEN`, `BATCH_NO_INVALID_CHARS_MSG` (konstanta)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/batch/start/route.js`, `src/components/StartDialog.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pure functions).
- **Bukti**: `src/lib/batchNo.js:1-49`
- **Catatan**: Dipakai di endpoint backend dan form dialog antarmuka klien.

---

### `src/lib/dateRange.js`
- **Tipe**: Util / Filter Tanggal SQL
- **Fungsi**: Mengonversi parameter string tanggal input 'from' dan 'to' menjadi kondisi klausa SQL PostgreSQL bertipe `timestamptz` dalam zona waktu Asia/Jakarta (WIB).
- **Export utama**: `buildDateRangeFilter` (fungsi)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/audit-log/export/route.js`, `src/app/api/audit-log/route.js`, `src/app/api/batch-records/export/route.js`, `src/app/api/batch-records/route.js`, `src/lib/alarmQuery.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pure function pembangun query).
- **Bukti**: `src/lib/dateRange.js:1-68`
- **Catatan**: Memastikan batas akhir tanggal mencakup hingga pukul 23:59:59.999 WIB (`src/lib/dateRange.js:60`).

---

### `src/lib/f0.js`
- **Tipe**: Util / Kalkulasi Fisika F0
- **Fungsi**: Menghitung nilai letalitas panas kumulatif F0 per menit untuk setiap sensor suhu menggunakan metode integrasi numerik trapesium dengan Tref 121.0°C dan z=10.
- **Export utama**: `calcF0`, `computeBatchF0`, `toTemp` (fungsi murni), `F0_T_REF`, `F0_Z`, `F0_MAX_GAP_SEC`, `F0_TEMP_MIN`, `F0_TEMP_MAX`, `F0_METHOD`, `F0_SENSORS` (konstanta)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/lib/batchFinalize.js`, `src/lib/f0.test.mjs`
- **Efek samping / dependensi eksternal**: Tidak ada (kalkulasi numerik murni).
- **Bukti**: `src/lib/f0.js:20-140`
- **Catatan**: Menolak interval gap antar titik data lebih dari 150 detik (`F0_MAX_GAP_SEC = 150`, `src/lib/f0.js:22`). Tidak ada vonis PASS/FAIL sesuai arahan pabrik.

---

### `src/lib/f0.test.mjs`
- **Tipe**: Test / Unit Test
- **Fungsi**: Menguji kalkulasi F0 terhadap data rekaman sterilisasi nyata tanggal 03 Oktober 2026 dan validasi toleransi galat di bawah 0.1 menit.
- **Export utama**: Tidak ada (file uji mandiri Node.js).
- **Meng-import (internal)**: `src/lib/f0.js`, `src/lib/__fixtures__/printout_2026-10-03.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mencetak log hasil uji ke stdout dan melempar assertion error jika batas toleransi terlampaui.
- **Bukti**: `src/lib/f0.test.mjs:1-85`
- **Catatan**: Dijalankan secara manual dengan `node src/lib/f0.test.mjs`.

---

### `src/lib/__fixtures__/printout_2026-10-03.js`
- **Tipe**: Test Fixture / Data Uji
- **Fungsi**: Menyediakan array 282 titik data deret waktu suhu riil dan nilai cetak referensi SCADA lama batch 03-10-2026.
- **Export utama**: `trendRows`, `referenceF0` (konstanta data array dan objek)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/lib/f0.test.mjs`
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `src/lib/__fixtures__/printout_2026-10-03.js:1-320`
- **Catatan**: Tidak di-import oleh kode aplikasi produksi, hanya oleh `f0.test.mjs`.

---

### `src/lib/batchFinalize.js`
- **Tipe**: Util / Finalisasi Batch
- **Fungsi**: Menghitung durasi fase waktu sterilisasi, menghitung nilai akhir F0 seluruh sensor, menentukan status batch (finished/aborted), dan mengupdate tabel `batch_records`.
- **Export utama**: `finalizeBatch` (fungsi asynchronous)
- **Meng-import (internal)**: `src/lib/batchFinalize.js`, `src/lib/db.js`, `src/lib/f0.js`
- **Dipakai oleh**: `src/app/api/batch/stop/route.js`, `src/lib/batchFinalize.js`, `src/lib/trendRecorder.js`
- **Efek samping / dependensi eksternal**: Melakukan transaksi query UPDATE pada tabel `batch_records` (`src/lib/batchFinalize.js:80`).
- **Bukti**: `src/lib/batchFinalize.js:1-160`
- **Catatan**: Menggunakan advisory lock anti-race condition saat finalisasi paralel (`src/lib/batchFinalize.js:25`).

---

### `src/lib/recipeSnapshot.js`
- **Tipe**: Util / Snapshot Resep
- **Fungsi**: Menyusun dan mengekstrak objek snapshot parameter formula resep saat batch dimulai untuk disimpan dalam format JSON pada kolom `batch_records.recipe_snapshot`.
- **Export utama**: `buildRecipeSnapshot`, `snapshotNumber`, `snapshotString` (fungsi)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/batch/start/route.js`, `src/app/api/batch-records/[batchNo]/route.js`, `src/lib/alarmMonitor.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pure functions).
- **Bukti**: `src/lib/recipeSnapshot.js:1-68`
- **Catatan**: Mencegah perubahan formula di tabel `recipes` merusak integritas data riwayat batch masa lalu.

---

### `src/lib/recipeGuard.js`
- **Tipe**: Util / Proteksi Resep
- **Fungsi**: Memeriksa apakah ada proses START batch yang sedang berlangsung via PostgreSQL advisory lock, dan menghitung jumlah penggunaan resep pada tabel `batch_records`.
- **Export utama**: `isStartInProgress`, `getRecipeUsage` (fungsi), `START_LOCK_KEY` (konstanta numerik `7401001`)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/batch/start/route.js`, `src/app/api/formulas/[formulaNo]/route.js`, `src/lib/alarmMonitor.js`
- **Efek samping / dependensi eksternal**: Menjalankan query `pg_advisory_lock` dan `SELECT COUNT(*)` ke PostgreSQL.
- **Bukti**: `src/lib/recipeGuard.js:1-55`
- **Catatan**: START_LOCK_KEY dipakai bersama oleh `src/app/api/batch/start/route.js` dan `src/app/api/formulas/[formulaNo]/route.js`.

---

### `src/lib/recipeValidation.js`
- **Tipe**: Util / Validasi Parameter Resep
- **Fungsi**: Memvalidasi batas fisik parameter suhu, tekanan, dan waktu resep sterilisasi sebelum data dikirim ke PLC atau disimpan ke database.
- **Export utama**: `validateRecipe` (fungsi), `RECIPE_CONSTRAINTS` (konstanta batas rentang nilai)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/batch/start/route.js`, `src/app/api/formulas/route.js`, `src/app/api/formulas/[formulaNo]/route.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pure function).
- **Bukti**: `src/lib/recipeValidation.js:1-135`
- **Catatan**: Mendukung opsi `{ strict: true }` untuk memeriksa kelengkapan nama formula dan material.

---

### `src/lib/atvProcess.js`
- **Tipe**: Util / Analisis Proses Autoclave
- **Fungsi**: Menganalisis deret data trend untuk mendeteksi waktu awal fase pemanasan, sterilisasi, dan pendinginan berdasarkan perubahan kode fase PLC.
- **Export utama**: `analyzeProcessPhases` (fungsi)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/page.js`, `src/components/AtvDiagram.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pure function).
- **Bukti**: `src/lib/atvProcess.js:1-65`
- **Catatan**: Mendeteksi transisi fase: 3 (heating), 4 (steril), dan 5 (cooling).

---

### `src/lib/alarmCatalog.js`
- **Tipe**: Konfigurasi / Katalog Alarm
- **Fungsi**: Mendefinisikan katalog 5 alarm PLC Autoclave Line 1: F_WATER, F_DOOR, OVER_PRES, WATER_EMPTY, dan DRAIN_FAIL beserta deskripsi penyebab, tindakan perbaikan, dan status konfirmasi teks.
- **Export utama**: `ALARM_CATALOG` (objek dictionary)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/alarms/active/route.js`, `src/lib/alarmMonitor.js`
- **Efek samping / dependensi eksternal**: Tidak ada (konstanta kamus).
- **Bukti**: `src/lib/alarmCatalog.js:1-52`
- **Catatan**: Setiap entri memuat `tag`, `title`, `cause`, `action`, dan flag `confirmed`.

---

### `src/lib/alarmEpisodes.js`
- **Tipe**: Util / State Machine Episode Alarm
- **Fungsi**: Mengelola transisi status aktif, pemulihan, dan deteksi gap pemantau alarm untuk menghasilkan UUID episode alarm yang konsisten pada tabel `alarm_log`.
- **Export utama**: `detectAlarmTransitions`, `createMonitorGapEpisode` (fungsi murni)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/lib/alarmEpisodes.test.mjs`, `src/lib/alarmMonitor.js`
- **Efek samping / dependensi eksternal**: Tidak ada (state engine murni).
- **Bukti**: `src/lib/alarmEpisodes.js:1-110`
- **Catatan**: Menghubungkan baris `alarm_active` dan `alarm_recovery` menggunakan UUID `episode_id` yang sama.

---

### `src/lib/alarmEpisodes.test.mjs`
- **Tipe**: Test / Unit Test
- **Fungsi**: Menguji skenario transisi aktif-pulih, gap pemantauan, dan konsistensi UUID episode pada state machine alarmEpisodes.
- **Export utama**: Tidak ada (script uji Node.js).
- **Meng-import (internal)**: `src/lib/alarmEpisodes.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mencetak hasil assert ke stdout.
- **Bukti**: `src/lib/alarmEpisodes.test.mjs:1-75`
- **Catatan**: Dijalankan secara mandiri dengan `node src/lib/alarmEpisodes.test.mjs`.

---

### `src/lib/alarmEventLabels.js`
- **Tipe**: Util / Formatter Label Alarm
- **Fungsi**: Menerjemahkan kode event type mentah database (seperti `alarm_active`, `alarm_recovery`, `monitor_gap`) menjadi teks deskriptif berbahasa Indonesia.
- **Export utama**: `eventLabel` (fungsi)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/alarm/page.js`, `src/app/print/alarm/page.js`, `src/app/print/data-report/[batchNo]/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pure function).
- **Bukti**: `src/lib/alarmEventLabels.js:1-25`
- **Catatan**: Dipakai di halaman web Alarm, dokumen cetak print alarm, dan laporan batch.

---

### `src/lib/alarmQuery.js`
- **Tipe**: Util / Pembangun Query Alarm
- **Fungsi**: Membangun klausa SQL `WHERE`, parameter array values, dan klausul `ORDER BY` untuk penyaringan log alarm berdasarkan search, eventType, dan rentang tanggal.
- **Export utama**: `buildAlarmFilter` (fungsi), `ALARM_FROM`, `ALARM_ORDER` (konstanta string SQL)
- **Meng-import (internal)**: `src/lib/dateRange.js`
- **Dipakai oleh**: `src/app/api/alarms/print-data/route.js`, `src/app/api/alarms/route.js`
- **Efek samping / dependensi eksternal**: Tidak ada (pembangun string query murni).
- **Bukti**: `src/lib/alarmQuery.js:1-75`
- **Catatan**: Menerapkan pengelompokan episode pemulihan tepat di atas alarm pemicunya (`src/lib/alarmQuery.js:10`).

---

### `src/lib/alarmView.js`
- **Tipe**: Util / Transformasi Data View Alarm
- **Fungsi**: Memformat baris data log alarm mentah dari database menjadi objek tampilan antarmuka yang siap dirender di tabel.
- **Export utama**: `formatAlarmViewRow` (fungsi)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/components/AlarmCenter.js`, `src/lib/alarmView.test.mjs`
- **Efek samping / dependensi eksternal**: Tidak ada (pure function).
- **Bukti**: `src/lib/alarmView.js:1-40`
- **Catatan**: Memformat nilai numerik sensor dan tanggal dalam format lokal Indonesia.

---

### `src/lib/alarmView.test.mjs`
- **Tipe**: Test / Unit Test
- **Fungsi**: Menguji formatting data baris tampilan alarm untuk berbagai skenario nilai null dan valid.
- **Export utama**: Tidak ada (script uji Node.js).
- **Meng-import (internal)**: `src/lib/alarmView.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mencetak hasil uji ke stdout.
- **Bukti**: `src/lib/alarmView.test.mjs:1-45`
- **Catatan**: Dijalankan dengan `node src/lib/alarmView.test.mjs`.

---

### `src/lib/plc.js`
- **Tipe**: Util / Komunikasi REST IoT Gateway PLC
- **Fungsi**: Menyediakan fungsi pembacaan data sensor PLC Siemens S7-200 via REST API KEPServerEX `/iotgateway/read`, scaling nilai suhu (°C/10) dan tekanan (kPa), serta deteksi fase proses.
- **Export utama**: `readPlcSnapshot`, `TAG_MAP`, `PHASE_MAP` (fungsi dan konstanta)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/batch/start/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/plc/reset/route.js`, `src/app/api/status/route.js`, `src/lib/alarmMonitor.js`, `src/lib/trendRecorder.js`
- **Efek samping / dependensi eksternal**: Melakukan HTTP request GET ke KEPServerEX IoT Gateway (`src/lib/plc.js:145`), membaca `process.env.IOT_GATEWAY_*`.
- **Bukti**: `src/lib/plc.js:1-290`
- **Catatan**: Catatan kode: tag L/VW122 konduktivitas dan WATER level air belum memiliki formula kalibrasi (`src/lib/plc.js:200-205`).

---

### `src/lib/plcCommandAlert.js`
- **Tipe**: Util / Peringatan Command PLC
- **Fungsi**: Menganalisis hasil pulsa perintah PLC untuk menghasilkan objek peringatan bila ada risiko tag tertahan aktif (`stuckRisk`).
- **Export utama**: `buildPlcCommandAlert` (fungsi)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/page.js`, `src/components/StartDialog.js`, `src/lib/plcCommandAlert.test.mjs`
- **Efek samping / dependensi eksternal**: Tidak ada (pure function).
- **Bukti**: `src/lib/plcCommandAlert.js:1-40`
- **Catatan**: Dipakai di antarmuka halaman utama Dashboard saat tombol START, STOP, atau Reset ditekan.

---

### `src/lib/plcCommandAlert.test.mjs`
- **Tipe**: Test / Unit Test
- **Fungsi**: Menguji pembentukan objek peringatan perintah PLC pada variasi kombinasi parameter kegagalan.
- **Export utama**: Tidak ada (script uji Node.js).
- **Meng-import (internal)**: `src/lib/plcCommandAlert.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mencetak hasil uji ke stdout.
- **Bukti**: `src/lib/plcCommandAlert.test.mjs:1-50`
- **Catatan**: Dijalankan dengan `node src/lib/plcCommandAlert.test.mjs`.

---

### `src/lib/plcWrite.js`
- **Tipe**: Util / Penulisan Tag PLC
- **Fungsi**: Menyediakan fungsi penulisan tag REST API KEPServerEX `/iotgateway/write` dan fungsi pulsa `pulsePlcTag` (tulis ON, jeda 1000 ms, tulis OFF).
- **Export utama**: `writePlcTags`, `pulsePlcTag` (fungsi asynchronous)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/api/batch/start/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/plc/reset/route.js`
- **Efek samping / dependensi eksternal**: Melakukan HTTP request POST ke KEPServerEX IoT Gateway (`src/lib/plcWrite.js:35`).
- **Bukti**: `src/lib/plcWrite.js:1-125`
- **Catatan**: Mencegah tag START (M1.4) atau STOP (M1.5) tertahan aktif pada ladder PLC.

---

### `src/lib/trendRecorder.js`
- **Tipe**: Background Worker / Perekam Trend
- **Fungsi**: Membaca snapshot PLC setiap 5 detik, menyimpan rekaman sensor ke tabel `batch_trend`, dan memicu auto-finalize batch jika mesin idle selama minimal 120 detik.
- **Export utama**: `recordTrendTick` (fungsi asynchronous)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/plc.js`, `src/lib/batchFinalize.js`
- **Dipakai oleh**: `server.js`
- **Efek samping / dependensi eksternal**: Menjalankan query `INSERT INTO batch_trend` dan memanggil `finalizeBatch` jika idle terdeteksi (`src/lib/trendRecorder.js:80`).
- **Bukti**: `src/lib/trendRecorder.js:1-140`
- **Catatan**: Dipanggil secara berkala via `setInterval` pada `server.js:46`.

---

### `src/lib/alarmMonitor.js`
- **Tipe**: Background Worker / Pemantau Alarm
- **Fungsi**: Memantau 5 bit fault alarm PLC setiap 1 detik, mencatat episode aktif dan pulih ke tabel `alarm_log`, memperbarui heartbeat ke tabel `monitor_heartbeat`, dan mengadopsi proses eksternal jika mesin jalan tanpa batch di web.
- **Export utama**: `startAlarmMonitor` (fungsi asynchronous)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/plc.js`, `src/lib/alarmCatalog.js`, `src/lib/alarmEpisodes.js`, `src/lib/recipeGuard.js`, `src/lib/recipeSnapshot.js`
- **Dipakai oleh**: `server.js`
- **Efek samping / dependensi eksternal**: Menjalankan query `UPDATE monitor_heartbeat`, `INSERT INTO alarm_log`, dan `INSERT INTO batch_records` untuk adopsi proses (`src/lib/alarmMonitor.js:100-150`).
- **Bukti**: `src/lib/alarmMonitor.js:1-210`
- **Catatan**: Dipanggil pada inisialisasi `server.js:52`.

---

### `src/components/ScreenLock.js`
- **Tipe**: Client Component / Security Overlay
- **Fungsi**: Mengunci antarmuka otomatis setelah 7 menit tanpa interaksi pengguna (inaktivitas mouse/keyboard) dan meminta verifikasi password untuk membuka kembali.
- **Export utama**: `default` ScreenLock (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/layout.js`
- **Efek samping / dependensi eksternal**: Menambahkan event listener global (`mousemove`, `keydown`), memanggil API `POST /api/auth/unlock` (`src/components/ScreenLock.js:150`), dan mengalihkan ke `/login` jika sesi kedaluwarsa.
- **Bukti**: `src/components/ScreenLock.js:1-180`
- **Catatan**: Waktu timeout ditentukan oleh konstanta `LOCK_TIMEOUT_MS = 7 * 60 * 1000` (`src/components/ScreenLock.js:7`).

---

### `src/components/Navbar.js`
- **Tipe**: Client Component / Navigasi
- **Fungsi**: Merender bar navigasi atas aplikasi, indikator status online/offline PLC, jam digital, menu utama (Dashboard, Trend, Data Report, Alarm, Formula, Master Produk), menu mesin HMI (Parameter Mesin, Kalibrasi, Jam PLC, Kontrol Manual, **Door Operate**), menu administrasi (Audit Log, Kelola User, Role Management), identitas pengguna aktif, dan tombol logout.
- **Export utama**: `default` Navbar (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/permissionCatalog.js` (`hasLevel`)
- **Dipakai oleh**: `src/app/(app)/layout.js`
- **Efek samping / dependensi eksternal**: Memanggil API `POST /api/auth/logout` saat tombol Logout diklik (`src/components/Navbar.js:87`), polling `/api/auth/me` setiap 60 detik (`src/components/Navbar.js:80`).
- **Bukti**: `src/components/Navbar.js:1-162`
- **Catatan**: Menu "Door Operate" ditambahkan ke `machineMenu` di baris 26, dengan `resource: "manual_control"`. Seluruh item menu disaring secara dinamis menggunakan `hasLevel(user?.permissions, item.resource, "view")` (`src/components/Navbar.js:92-95`). `eslint-disable-next-line @next/next/no-img-element` di baris 103.

---

### `src/components/AlarmCenter.js`
- **Tipe**: Client Component / Banner & Audio Alarm
- **Fungsi**: Melakukan polling alarm aktif ke `/api/alarms/active` setiap 2 detik, memutar audio peringatan loop (`/sounds/alarm.wav`), dan menampilkan modal daftar alarm dengan panduan tindakan perbaikan.
- **Export utama**: `default` AlarmCenter (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/alarmView.js`
- **Dipakai oleh**: `src/app/(app)/layout.js`
- **Efek samping / dependensi eksternal**: Membuat instance `window.Audio` (`src/components/AlarmCenter.js:77`), melakukan fetch berkala `/api/alarms/active`, dan memutar suara saat alarm aktif terdeteksi.
- **Bukti**: `src/components/AlarmCenter.js:1-240`
- **Catatan**: Menyediakan tombol mute suara alarm lokal untuk membungkam audio selama 5 menit (`src/components/AlarmCenter.js:84`).

---

### `src/components/StartDialog.js`
- **Tipe**: Client Component / Modal Form START
- **Fungsi**: Menyediakan antarmuka pop-up form input persiapan batch: pemilihan Batch No otomatis/manual, Loading No, Nama Produk (combobox pencarian & bebas), Spesifikasi Kemasan (combobox pencarian & bebas), Jumlah Botol (amount integer positif), dan Formula Resep sebelum memicu START ke mesin.
- **Export utama**: `default` StartDialog (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/batchNo.js`, `src/lib/plcCommandAlert.js`, `src/components/SearchableCombobox.js`
- **Dipakai oleh**: `src/app/(app)/page.js`
- **Efek samping / dependensi eksternal**: Memanggil endpoint API `GET /api/products?active=true`, `GET /api/product-specs?active=true`, `GET /api/formulas`, dan `POST /api/batch/start` (`src/components/StartDialog.js:130-195`).
- **Bukti**: `src/components/StartDialog.js:1-420`
- **Catatan**: Memvalidasi kelengkapan form, karakter Batch No via `validateBatchNo`, dan validasi numerik bulat positif `bottleCount` (`src/components/StartDialog.js:127-129`). Menggunakan layout grid 2 kolom responsif.

---

### `src/components/AtvDiagram.js`
- **Tipe**: Client Component / Diagram Visual Autoclave
- **Fungsi**: Menggambar skema visual bejana Autoclave Line 1 berbasis elemen SVG, memvisualisasikan status katup (valve), level air, posisi pintu depan/belakang, dan arah sirkulasi pompa secara interaktif.
- **Export utama**: `default` AtvDiagram (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/atvProcess.js`
- **Dipakai oleh**: `src/app/(app)/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada (komponen SVG presentasi berbasis props data sensor PLC).
- **Bukti**: `src/components/AtvDiagram.js:1-380`
- **Catatan**: Menerima props data snapshot PLC: `{ valves, door, level, pump, temp, pressure, phase }`.

---

### `src/app/globals.css`
- **Tipe**: Stylesheet Global
- **Fungsi**: Mengimpor framework Tailwind CSS v4, mendefinisikan variabel palet warna industrial SCADA (slate, water, steam, run, stop, idle), utilitas kelas `.no-scrollbar` (menyembunyikan scrollbar visual namun tetap fungsional di-scroll), dan styling custom scrollbar tipis abu-abu untuk area dokumen yang dapat digulir.
- **Export utama**: Tidak ada (berkas CSS global).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/layout.js`, `src/app/layout.js`
- **Efek samping / dependensi eksternal**: Diterapkan ke seluruh elemen DOM antarmuka via root layout.
- **Bukti**: `src/app/globals.css:1-70`
- **Catatan**: Menggunakan direktif `@import 'tailwindcss';` dan `@theme` bawaan Tailwind v4. Styling `.no-scrollbar` mendukung WebKit, Firefox (`scrollbar-width: none`), dan IE/Edge.

---

### `src/app/layout.js`
- **Tipe**: Server Component / Root Layout
- **Fungsi**: Menyediakan kerangka HTML dokumen dasar (`<html>` dan `<body>`) serta menyematkan metadata judul 'SCADA Autoclave Line 1'.
- **Export utama**: `default` RootLayout (fungsi komponen), `metadata` (objek konfigurasi metadata Next.js)
- **Meng-import (internal)**: `src/app/globals.css`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mengimpor stylesheet `src/app/globals.css` ke seluruh aplikasi.
- **Bukti**: `src/app/layout.js:1-24`
- **Catatan**: Bahasa dokumen disetel ke `lang='id'` (`src/app/layout.js:19`).

---

### `src/app/login/page.js`
- **Tipe**: Client Component / Halaman Login
- **Fungsi**: Merender form otentikasi login pengguna dengan dropdown pilihan username aktif, input password, proteksi batas percobaan gagal (throttle), dan logo perusahaan.
- **Export utama**: `default` LoginPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/users` untuk mengisi dropdown akun aktif dan `POST /api/auth/login` saat submit (`src/app/login/page.js:30-80`).
- **Bukti**: `src/app/login/page.js:1-205`
- **Catatan**: Membaca header respons HTTP `Retry-After` untuk menampilkan countdown detik saat login terblokir (`src/app/login/page.js:68`).

---

### `src/app/(app)/layout.js`
- **Tipe**: Client Component / App Layout
- **Fungsi**: Menyediakan kerangka tata letak utama aplikasi setelah login, mengintegrasikan komponen Navbar, AlarmCenter, ScreenLock, dan polling status user setiap 30 detik.
- **Export utama**: `default` AppLayout (fungsi komponen React)
- **Meng-import (internal)**: `src/app/globals.css`, `src/components/Navbar.js`, `src/components/AlarmCenter.js`, `src/components/ScreenLock.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil endpoint API `GET /api/auth/me` secara periodik (`src/app/(app)/layout.js:25`) dan mengarahkan ke `/login` jika sesi kedaluwarsa.
- **Bukti**: `src/app/(app)/layout.js:1-55`
- **Catatan**: Membungkus seluruh halaman rute `(app)`.

---

### `src/app/(app)/page.js`
- **Tipe**: Client Component / Dashboard Utama
- **Fungsi**: Merender dashboard pengawasan SCADA utama: polling data sensor PLC real-time setiap 1 detik, diagram interaktif Autoclave, kartu pembacaan 9 sensor suhu, tekanan, status pintu, tombol kontrol proses (START, STOP, Reset), blok Door Sealing/Release, dan panel detail resep berjalan.
- **Export utama**: `default` DashboardPage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/plcCommandAlert.js`, `src/components/AtvDiagram.js`, `src/lib/atvProcess.js`, `src/components/StartDialog.js`, `src/components/DeletedUserBadge.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/status` setiap 1000 ms, `POST /api/batch/stop`, `POST /api/plc/reset`, `POST /api/plc-door` untuk Door Sealing/Release (`src/app/(app)/page.js:385–410`).
- **Bukti**: `src/app/(app)/page.js:1-982`
- **Catatan**:
  - `startAllowed`: Baris 492 (`const startAllowed = !noData && data.plcOk === true && phaseRaw === 1 && !data.running;`) berjalan aktif penuh. Baris 493–494 adalah komentar pengembang toggle uji (`// Biarkan baris ini tetap ada untuk testing pop up start ya` dan `// const startAllowed = true;`) yang sengaja dibiarkan pemilik untuk pengujian pop-up modal tanpa terhubung ke mesin fisik (bukan bypass aktif).
  - State Door: `doorBusy` dan `doorMsg` di baris 213–214 (state dialog dan alasan lama seperti `releaseOpen`/`releaseReason` telah dihapus).
  - Handler `sendDoor` di baris 385–410 (fungsi lama `handleDoorRelease` telah dihapus).
  - Gating: `canDoor` baris 523, `sealAllowed` baris 526, `releaseAllowed` baris 527, `doorBlockReason` baris 528.
  - Blok tombol Door Sealing dan Door Release di baris 793–835 (tanpa modal/alasan, satu klik langsung mengirim ke API).
  - `eslint-disable-next-line react-hooks/set-state-in-effect` di baris 251 dan 278; `react-hooks/exhaustive-deps` di baris 256.

---

### `src/app/(app)/alarm/page.js`
- **Tipe**: Client Component / Halaman Alarm
- **Fungsi**: Menampilkan tabel riwayat pesan alarm gangguan mesin dengan fitur filter teks pencarian, tipe event alarm, rentang tanggal kejadian, dan tombol cetak laporan.
- **Export utama**: `default` AlarmPage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/alarmEventLabels.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/alarms`, `GET /api/alarms/event-types`, dan membuka jendela cetak baru ke `/print/alarm` (`src/app/(app)/alarm/page.js:60-120`).
- **Bukti**: `src/app/(app)/alarm/page.js:1-315`
- **Catatan**: Menampilkan badge status aktif dan pulih untuk setiap episode alarm.

---

### `src/app/(app)/audit-log/page.js`
- **Tipe**: Client Component / Halaman Audit Log
- **Fungsi**: Menampilkan tabel rekam jejak audit sistem khusus administrator: filter aksi, entitas, tanggal, pencarian aktor, tombol ekspor file Excel XLSX, dan tombol cetak.
- **Export utama**: `default` AuditLogPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/audit-log`, `GET /api/audit-log/filters`, dan mengunduh berkas binary dari `/api/audit-log/export` (`src/app/(app)/audit-log/page.js:80-150`).
- **Bukti**: `src/app/(app)/audit-log/page.js:1-398`
- **Catatan**: Memeriksa role `admin` pada mount; jika bukan admin dialihkan ke `/` (`src/app/(app)/audit-log/page.js:65`).

---

### `src/app/(app)/data-report/page.js`
- **Tipe**: Client Component / Halaman Daftar Batch
- **Fungsi**: Menampilkan tabel daftar riwayat seluruh batch proses sterilisasi dengan pagination, filter pencarian Batch No/produk/operator, filter status (running/finished/aborted), tombol ekspor XLSX, dan tautan ke detail batch.
- **Export utama**: `default` DataReportPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records` dan mengunduh berkas dari `/api/batch-records/export` (`src/app/(app)/data-report/page.js:40-100`).
- **Bukti**: `src/app/(app)/data-report/page.js:1-295`
- **Catatan**: Menghubungkan navigasi ke rute detail `/data-report/[batchNo]`.

---

### `src/app/(app)/data-report/[batchNo]/page.js`
- **Tipe**: Client Component / Halaman Detail Batch
- **Fungsi**: Menampilkan laporan lengkap satu batch sterilisasi: metadata batch, informasi produk (termasuk Amount / Jumlah Botol), parameter waktu tahapan fase, nilai akumulasi letalitas F0 seluruh sensor, tabel deret waktu trend sensor, dan tombol navigasi cetak laporan.
- **Export utama**: `default` BatchDetailPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records/[batchNo]` dan membuka tab cetak `/print/data-report/[batchNo]` (`src/app/(app)/data-report/[batchNo]/page.js:35-80`).
- **Bukti**: `src/app/(app)/data-report/[batchNo]/page.js:1-355`
- **Catatan**: Menampilkan jumlah botol (`batch.bottleCount`) pada kartu Informasi Produk (`src/app/(app)/data-report/[batchNo]/page.js:255-261`) dan peringatan jika kalkulasi F0 dihitung dari data trend yang tidak lengkap (`f0Meta.complete === false`).

---

### `src/app/(app)/formula/page.js`
- **Tipe**: Client Component / Halaman Kelola Formula
- **Fungsi**: Menyediakan tabel daftar resep sterilisasi dan modal form CRUD resep (tambah, edit, hapus) dengan validasi batas nilai fisik dan proteksi saat batch berjalan.
- **Export utama**: `default` FormulaPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil endpoint API `GET /api/formulas`, `POST /api/formulas`, `PUT /api/formulas/[formulaNo]`, dan `DELETE /api/formulas/[formulaNo]` (`src/app/(app)/formula/page.js:70-160`).
- **Bukti**: `src/app/(app)/formula/page.js:1-633`
- **Catatan**: Tombol aksi tambah, edit, dan hapus hanya aktif untuk pengguna ber-role `admin`.

---

### `src/app/(app)/products/page.js`
- **Tipe**: Client Component / Halaman Master Produk & Spesifikasi
- **Fungsi**: Menyediakan antarmuka manajemen dua tab untuk master Nama Produk dan Spesifikasi Kemasan (tambah, edit, hapus, toggle aktif/nonaktif).
- **Export utama**: `default` ProductsPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET/POST/PUT/DELETE /api/products` dan `/api/product-specs` (`src/app/(app)/products/page.js:90-220`).
- **Bukti**: `src/app/(app)/products/page.js:1-721`
- **Catatan**: Menyediakan konfirmasi modal dialog sebelum melakukan penghapusan master data.

---

### `src/app/(app)/trend/page.js`
- **Tipe**: Client Component / Halaman Visualisasi Trend
- **Fungsi**: Menampilkan grafik kurva suhu 9 sensor dan tekanan (kPa) berbasis Recharts untuk batch yang dipilih dari dropdown, dengan dual Y-axis dan tooltip interaktif.
- **Export utama**: `default` TrendPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/status`, `GET /api/batch-records?limit=100`, dan `GET /api/batch-records/[batchNo]` (`src/app/(app)/trend/page.js:90-145`).
- **Bukti**: `src/app/(app)/trend/page.js:1-334`
- **Catatan**: Otomatis memilih batch yang sedang berjalan (`running`) sebagai pilihan default pada mount.

---

### `src/app/(app)/users/page.js`
- **Tipe**: Client Component / Halaman Kelola Pengguna
- **Fungsi**: Menyediakan antarmuka administrasi akun pengguna bagi admin: pendaftaran user baru, pengubahan nama lengkap/role, aktivasi/penonaktifan akun, dan reset kata sandi.
- **Export utama**: `default` UsersPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil endpoint API `GET /api/auth/me`, `GET/POST/PUT/DELETE /api/users`, dan `POST /api/users/[username]/reset-password` (`src/app/(app)/users/page.js:40-220`).
- **Bukti**: `src/app/(app)/users/page.js:1-484`
- **Catatan**: Dilindungi proteksi level halaman: pengguna non-admin langsung dialihkan ke `/` (`src/app/(app)/users/page.js:383`).

---

### `src/app/api/alarms/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan endpoint query data log alarm dari tabel `alarm_log` dengan pagination limit/offset dan filter pencarian.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/alarmQuery.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query SQL `SELECT COUNT(*)` dan `SELECT ... FROM alarm_log` (`src/app/api/alarms/route.js:16-34`).
- **Bukti**: `src/app/api/alarms/route.js:1-56`
- **Catatan**: Menghubungkan baris pemulihan tepat di atas baris alarm pasangannya via `ALARM_ORDER`.

---

### `src/app/api/alarms/active/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengembalikan daftar episode alarm yang saat ini sedang aktif (belum ada event recovery) serta status keaktifan monitor berdasarkan tabel `monitor_heartbeat`.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/alarmCatalog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query database pada tabel `alarm_log` dan `monitor_heartbeat` (`src/app/api/alarms/active/route.js:17-29`).
- **Bukti**: `src/app/api/alarms/active/route.js:1-60`
- **Catatan**: Memeriksa batas kedaluwarsa detak jantung monitor `MONITOR_STALE_SEC = 30` detik (`src/app/api/alarms/active/route.js:12`).

---

### `src/app/api/alarms/by-batch/[batchNo]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil semua baris kejadian alarm_log yang terjadi selama satu proses batch sterilisasi tertentu.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query database `SELECT ... FROM alarm_log WHERE batch_no = $1` (`src/app/api/alarms/by-batch/[batchNo]/route.js:20`).
- **Bukti**: `src/app/api/alarms/by-batch/[batchNo]/route.js:1-62`
- **Catatan**: Diurutkan kronologis secara ascending berdasarkan `COALESCE(alarm_date, event_date)`.

---

### `src/app/api/alarms/event-types/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengembalikan daftar nilai unik kolom `event_type` dari tabel `alarm_log` untuk mengisi opsi dropdown filter.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query `SELECT DISTINCT event_type FROM alarm_log` (`src/app/api/alarms/event-types/route.js:8`).
- **Bukti**: `src/app/api/alarms/event-types/route.js:1-22`
- **Catatan**: Jika query gagal, mengembalikan array kosong `[]` sebagai fallback.

---

### `src/app/api/alarms/print-data/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan seluruh baris data alarm yang cocok dengan parameter filter untuk dicetak pada dokumen print alarm tanpa paginasi (maksimal 50.000 baris).
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/alarmQuery.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query `SELECT ... FROM alarm_log` ke database (`src/app/api/alarms/print-data/route.js:32`).
- **Bukti**: `src/app/api/alarms/print-data/route.js:1-59`
- **Catatan**: Memformat waktu ke zona waktu Asia/Jakarta (WIB) pada sisi server.

---

### `src/app/api/audit-log/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pembacaan rekam jejak audit sistem dari tabel `audit_log` khusus untuk pengguna ber-role administrator dengan pagination dan filter.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/dateRange.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memeriksa sesi admin via `requireAdmin`, menjalankan query database `SELECT ... FROM audit_log` (`src/app/api/audit-log/route.js:52`).
- **Bukti**: `src/app/api/audit-log/route.js:1-88`
- **Catatan**: Menolak akses dengan respons 403 Forbidden bila aktor bukan administrator.

---

### `src/app/api/audit-log/export/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengekspor data audit log ke file spreadsheet Excel (`.xlsx`) atau array JSON (untuk halaman cetak) serta mencatat tindakan ekspor tersebut ke dalam audit log.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/dateRange.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menghasilkan binary buffer Excel melalui `exceljs` (`src/app/api/audit-log/export/route.js:122`), mencatat aktivitas ekspor ke `audit_log` (`src/app/api/audit-log/export/route.js:87`).
- **Bukti**: `src/app/api/audit-log/export/route.js:1-180`
- **Catatan**: Membatasi ekspor maksimal 50.000 baris data (`src/app/api/audit-log/export/route.js:6`).

---

### `src/app/api/audit-log/filters/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengembalikan daftar unik kategori aksi (`action`) dan tipe entitas (`entity_type`) yang tersimpan di database untuk pilihan filter.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query `SELECT DISTINCT action` dan `SELECT DISTINCT entity_type` pada tabel `audit_log` (`src/app/api/audit-log/filters/route.js:12`).
- **Bukti**: `src/app/api/audit-log/filters/route.js:1-26`
- **Catatan**: Memeriksa otorisasi role admin melalui `requireAdmin`.

---

### `src/app/api/auth/login/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Memverifikasi kredensial username dan password via bcrypt, membatasi percobaan gagal maksimal 5 kali per 15 menit, memperbarui last_login_at, menyetel cookie sesi JWT, dan mencatat log aktivitas login.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query ke tabel `users` dan `audit_log`, menyetel cookie HTTP `session_token` (`src/app/api/auth/login/route.js:146`).
- **Bukti**: `src/app/api/auth/login/route.js:1-160`
- **Catatan**: Menggunakan perbandingan hash palsu `DUMMY_HASH` untuk mencegah serangan timing analysis (`src/app/api/auth/login/route.js:22`).

---

### `src/app/api/auth/logout/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mencatat tindakan logout pengguna ke tabel `audit_log` dan menghapus cookie `session_token` dari browser klien.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/auth.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menghapus cookie HTTP `session_token` (`src/app/api/auth/logout/route.js:24`), memanggil `tryAudit` ke tabel `audit_log`.
- **Bukti**: `src/app/api/auth/logout/route.js:1-31`
- **Catatan**: Kegagalan penulisan audit log tidak membatalkan penghapusan cookie sesi (fail-open).

---

### `src/app/api/auth/me/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil data identitas pengguna terkini dari database berdasarkan token JWT aktif untuk memastikan akun masih berstatus aktif (`is_active = true`).
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/auth.js`, `src/lib/db.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membaca cookie `session_token` dan menjalankan query ke tabel `users` (`src/app/api/auth/me/route.js:17`).
- **Bukti**: `src/app/api/auth/me/route.js:1-46`
- **Catatan**: Jika akun pengguna telah dinonaktifkan di database, cookie sesi otomatis dihapus (`src/app/api/auth/me/route.js:23`).

---

### `src/app/api/auth/unlock/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Memverifikasi kata sandi pengguna saat layar terkunci untuk membuka kembali antarmuka tanpa perlu login ulang penuh.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membaca cookie sesi, memeriksa password terhadap `users.password_hash`, dan mencatat aksi ke `audit_log` (`src/app/api/auth/unlock/route.js:63`).
- **Bukti**: `src/app/api/auth/unlock/route.js:1-88`
- **Catatan**: Mencatat entri `unlock_screen_failed` jika password salah.

---

### `src/app/api/auth/users/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Endpoint publik penyedia daftar username dan nama lengkap seluruh pengguna yang aktif untuk dropdown pemilihan akun di halaman login.
- **Export utama**: `GET` (fungsi handler HTTP), `dynamic = 'force-dynamic'`
- **Meng-import (internal)**: `src/lib/db.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query `SELECT username, full_name FROM users WHERE is_active = true` (`src/app/api/auth/users/route.js:12`).
- **Bukti**: `src/app/api/auth/users/route.js:1-22`
- **Catatan**: Sengaja tidak mengembalikan informasi password hash, role, atau id untuk meminimalkan paparan data.

---

### `src/app/api/batch/start/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Memvalidasi parameter resep, memeriksa keunikan Batch No, memvalidasi input `bottleCount`, memeriksa interlock pintu/seal PLC, menulis setpoint ke register PLC, memverifikasi baca-balik setpoint, mengirim pulsa START (M1.4), menunggu fase proses, dan mencatat data ke `batch_records` (termasuk kolom `bottle_count`).
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/plc.js`, `src/lib/plcWrite.js`, `src/lib/recipeValidation.js`, `src/lib/batchNo.js`, `src/lib/recipeSnapshot.js`, `src/lib/recipeGuard.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membuka koneksi PostgreSQL advisory lock (`src/app/api/batch/start/route.js:35`), menulis ke REST API PLC (`src/app/api/batch/start/route.js:390`), menjalankan query `INSERT INTO batch_records` (`src/app/api/batch/start/route.js:606`) dan `audit_log`.
- **Bukti**: `src/app/api/batch/start/route.js:1-743`
- **Catatan**: Membaca `bottleCount` / `amount` dari request body (`src/app/api/batch/start/route.js:134-141`). Menyertakan fallback penanganan error `colErr.code === "42703"` (kolom `bottle_count` belum dimigrasi di database) sehingga alur START tidak gagal fatal saat migrasi 006 belum dijalankan.

---

### `src/app/api/batch/stop/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Membaca fase PLC saat ini, mengirim pulsa STOP (M1.5) ke PLC, menghitung F0 akhir, memfinalisasi status batch (finished/aborted), dan mencatat log audit. Handler POST tidak menerima body; aktor diambil langsung dari sesi JWT terverifikasi.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/plc.js`, `src/lib/plcWrite.js`, `src/lib/batchFinalize.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (dipanggil via fetch oleh `src/app/(app)/page.js`)
- **Efek samping / dependensi eksternal**: Mengirim HTTP POST pulsa STOP ke PLC KEPServerEX, memanggil `finalizeBatch` untuk mengupdate tabel `batch_records`, dan menulis ke `audit_log`. Dilindungi guard ganda `dashboard = edit` dan `action.batch_control = edit`.
- **Bukti**: `src/app/api/batch/stop/route.js:1-141`
- **Catatan**: STOP merupakan tindakan keselamatan: finalisasi batch di database tetap dijalankan meskipun komunikasi pulsa ke PLC mengalami kegagalan (`src/app/api/batch/stop/route.js:60`).

---

### `src/app/api/batch-records/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengembalikan daftar ringkasan catatan batch dari tabel `batch_records` dengan pagination, pencarian teks, filter status, dan filter rentang tanggal.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/dateRange.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "data_report", "view")`, menjalankan query SQL `SELECT COUNT(*)` dan `SELECT ... FROM batch_records`.
- **Bukti**: `src/app/api/batch-records/route.js:1-98`
- **Catatan**: Diurutkan secara descending berdasarkan `COALESCE(run_begin, created_at)`.

---

### `src/app/api/batch-records/export/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengekspor data riwayat batch ke format spreadsheet Excel XLSX atau JSON serta mencatat jejak audit aktivitas ekspor, termasuk kolom Jumlah Botol (`bottle_count`).
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/dateRange.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menghasilkan berkas binary spreadsheet menggunakan pustaka `exceljs` dan mencatat audit ke database. Dilindungi `requirePermission(cookieStore, "data_report", "view")`.
- **Bukti**: `src/app/api/batch-records/export/route.js:1-265`
- **Catatan**: Menyertakan fallback query `NULL::integer AS bottle_count` jika kolom belum ada di skema PostgreSQL (`colErr.code === "42703"`). Menambahkan kolom Excel "Jumlah Botol" (width: 14) pada baris header dan format JSON.

---

### `src/app/api/batch-records/[batchNo]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil data lengkap satu record batch beserta seluruh titik data sensor dari tabel `batch_trend` yang diurutkan secara kronologis.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/recipeSnapshot.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requireAnyPermission` (`data_report >= view` atau `trend >= view`). Menjalankan query SQL ke tabel `batch_records` dan `batch_trend`.
- **Bukti**: `src/app/api/batch-records/[batchNo]/route.js:1-127`
- **Catatan**: Mengembalikan field `bottleCount` dan `amount` (alias angka) dari kolom `batch_records.bottle_count` (`src/app/api/batch-records/[batchNo]/route.js:59-60`), serta parameter `recipeSource`.

---

### `src/app/api/formulas/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pembacaan seluruh daftar formula resep sterilisasi untuk pengguna berizin formula view, serta penambahan formula baru khusus untuk pengguna berizin formula edit.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/recipeValidation.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "formula", ...)`. Menjalankan query `SELECT ... FROM recipes` dan transaksi `INSERT INTO recipes` serta `INSERT INTO audit_log`.
- **Bukti**: `src/app/api/formulas/route.js:1-175`
- **Catatan**: Penambahan formula baru divalidasi dengan `validateRecipe({ strict: true })` sebelum disimpan.

---

### `src/app/api/formulas/[formulaNo]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pengambilan detail, pembaruan parameter, dan penghapusan satu formula resep sterilisasi dengan proteksi advisory lock saat START dan blokir bila resep sedang dipakai batch aktif.
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/recipeValidation.js`, `src/lib/recipeGuard.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "formula", ...)`. Mengeksekusi transaksi query UPDATE atau DELETE pada tabel `recipes` serta mencatat aksi ke tabel `audit_log`.
- **Bukti**: `src/app/api/formulas/[formulaNo]/route.js:1-330`
- **Catatan**: Menolak penghapusan formula jika resep pernah digunakan oleh batch riwayat mana pun.

---

### `src/app/api/plc/reset/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengirim pulsa perintah STOP ke PLC ketika mesin tertahan pada fase Selesai (kode 6) dan tidak ada batch running di database untuk mereset status mesin kembali ke Idle.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/plc.js`, `src/lib/plcWrite.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "dashboard", "edit")` dan `requirePermission(cookieStore, "action.batch_control", "edit")`. Membaca status PLC via `readPlcSnapshot`, mengirim pulsa STOP, dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/plc/reset/route.js:1-160`
- **Catatan**: Ditolak dengan status 409 jika masih ada batch yang berstatus `running` di database.

---

### `src/app/api/products/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil daftar master nama produk dan menangani penambahan nama produk baru oleh pengguna berizin products edit.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "products", ...)`. Menjalankan `INSERT INTO product_names`, dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/products/route.js:1-135`
- **Catatan**: Mendukung parameter query `?active=true` untuk filter nama produk yang aktif saja.

---

### `src/app/api/products/[id]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pengambilan detail, pengeditan nama, pengubahan status aktif, dan penghapusan data nama produk pada tabel `product_names`.
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "products", ...)`. Menjalankan query transaksi UPDATE atau DELETE pada tabel `product_names` dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/products/[id]/route.js:1-190`
- **Catatan**: Memvalidasi keunikan nama secara case-insensitive sebelum update.

---

### `src/app/api/product-specs/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil daftar master spesifikasi kemasan dan menangani penambahan spesifikasi baru oleh pengguna berizin products edit.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "products", ...)`. Menjalankan query `INSERT INTO product_specs`, dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/product-specs/route.js:1-135`
- **Catatan**: Mendukung parameter query `?active=true` untuk filter spesifikasi yang aktif saja.

---

### `src/app/api/product-specs/[id]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pengambilan detail, pengeditan teks spesifikasi, pengubahan status aktif, dan penghapusan data spesifikasi pada tabel `product_specs`.
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "products", ...)`. Menjalankan query transaksi UPDATE atau DELETE pada tabel `product_specs` dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/product-specs/[id]/route.js:1-190`
- **Catatan**: Memvalidasi keunikan spesifikasi kemasan secara case-insensitive sebelum update.

---

### `src/app/api/status/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Membaca snapshot data sensor dari PLC via REST API KEPServerEX, mengambil informasi batch aktif dari database (termasuk status operatorDeleted akun pengguna), dan mengembalikan status teragregasi secara real-time.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/plc.js`, `src/lib/db.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil `readPlcSnapshot` dan query ke `batch_records` join `users` untuk mengecek `deleted_at`.
- **Bukti**: `src/app/api/status/route.js:1-75`
- **Catatan**: Mengembalikan flag `operatorDeleted` boolean untuk rendering `DeletedUserBadge` di dashboard dan trend.

---

### `src/app/api/users/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan daftar seluruh akun pengguna aktif/nonaktif yang belum dihapus-lunak (`GET`), dan pembuatan akun pengguna baru dengan penugasan `role_id` serta hashing bcrypt (`POST`).
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/auditLog.js`, `src/lib/roleAdmin.js`, `src/lib/userQueries.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "users", ...)`. Menjalankan query `USER_SELECT` join `roles`, validasi username terhadap akun berstatus `deleted_at`, dan menulis ke `audit_log`.
- **Bukti**: `src/app/api/users/route.js:1-113`
- **Catatan**: Penugasan peran pengguna menggunakan foreign key `role_id` ke tabel `roles`. Kolom legacy `users.role` sudah dihapus.

---

### `src/app/api/users/[username]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menangani pembaruan data pengguna (nama lengkap, `role_id`) melalui `PUT` dan penonaktifan akun sementara (`is_active = false`) melalui `DELETE`.
- **Export utama**: `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/auditLog.js`, `src/lib/roleAdmin.js`, `src/lib/userQueries.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "users", "edit")`. Menjalankan transaksi serialisasi `lockRoleMutations`, query UPDATE tabel `users`, mencatat audit, dan mengecek `assertRoleManagerRemains`.
- **Bukti**: `src/app/api/users/[username]/route.js:1-150`
- **Catatan**: Hapus-lunak akun dialihkan ke endpoint terpisah `POST /api/users/[username]/delete`.

---

### `src/app/api/users/[username]/reset-password/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengatur ulang kata sandi akun pengguna oleh pengelola pengguna dengan hashing bcrypt baru dan mencatat aktivitas ke audit log tanpa menyertakan plaintext password.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/auth.js`, `src/lib/auditLog.js`, `src/lib/roleAdmin.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Dilindungi `requirePermission(cookieStore, "users", "edit")`. Menjalankan query UPDATE `password_hash` di dalam transaksi `withTransaction` dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/users/[username]/reset-password/route.js:1-68`
- **Catatan**: Panjang password baru minimal 6 karakter.

---

### `src/app/print/alarm/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menampilkan tata letak cetak dokumen log alarm mesin dalam format A4 landscape dengan penomoran halaman, cap waktu cetak otomatis, dan blok tanda tangan pengesahan (SignOffBlock).
- **Export utama**: `default` PrintAlarmPage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/alarmEventLabels.js`, `src/components/PermissionGate.js`, `src/components/SignOffBlock.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me`, `GET /api/alarms/print-data`, memodifikasi `document.title`, dan memasang event listener `beforeprint`/`afterprint` (`src/app/print/alarm/page.js:77-96`).
- **Bukti**: `src/app/print/alarm/page.js:1-248`
- **Catatan**: Menyematkan `SignOffBlock` di akhir tabel cetak dan styling print `.keep-together { page-break-inside: avoid; break-inside: avoid; }`. Dibungkus komponen React `Suspense` untuk mengakomodasi hook `useSearchParams`.

---

### `src/app/print/audit-log/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menampilkan format cetak laporan audit log aktivitas sistem dalam tata letak A4 landscape dengan header kolom lengkap.
- **Export utama**: `default` PrintAuditLogPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me`, `GET /api/audit-log/export?format=json`, memodifikasi `document.title`, dan memicu dialog `window.print()` (`src/app/print/audit-log/page.js:80-143`).
- **Bukti**: `src/app/print/audit-log/page.js:1-246`
- **Catatan**: Dibungkus komponen React `Suspense` untuk pembacaan parameter URL pencarian.

---

### `src/app/print/batch-records/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menampilkan format cetak tabel ringkasan 23 kolom seluruh data batch proses sterilisasi dalam orientasi A4 landscape.
- **Export utama**: `default` PrintBatchRecordsPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me` dan `GET /api/batch-records/export?format=json` (`src/app/print/batch-records/page.js:38-62`).
- **Bukti**: `src/app/print/batch-records/page.js:1-182`
- **Catatan**: Menerapkan CSS `@page { size: A4 landscape; margin: 8mm 8mm 10mm 8mm; }` (`src/app/print/batch-records/page.js:71`).

---

### `src/app/print/data-report/[batchNo]/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menyajikan dokumen cetak terintegrasi 3 bagian: Bagian 1 Data Record proses (A4 portrait), Bagian 2 Temperature Pressure Curve berbasis Recharts (A4 portrait), dan Bagian 3 Log Alarm & Event batch (A4 landscape), dilengkapi informasi Jumlah Botol (Amount) dan blok tanda tangan pengesahan (SignOffBlock).
- **Export utama**: `default` PrintDataReport (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/alarmEventLabels.js`, `src/lib/operatorLabel.js`, `src/components/PermissionGate.js`, `src/components/SignOffBlock.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records/[batchNo]` dan `GET /api/alarms/by-batch/[batchNo]`, memanipulasi CSS injection untuk penomoran halaman independen per bagian (`src/app/print/data-report/[batchNo]/page.js:130-185`).
- **Bukti**: `src/app/print/data-report/[batchNo]/page.js:1-668`
- **Catatan**: Header menyertakan field `Amount :` (`batch.bottleCount`). Menyematkan komponen `<SignOffBlock />` di akhir Bagian 1, Bagian 2, dan Bagian 3. Menggunakan CSS named pages (`@page sec-data`, `@page sec-curve`, `@page sec-alarm`).

---

### `src/app/print/data-report/[batchNo]/curve/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menyajikan halaman cetak khusus kurva suhu 9 sensor dan tekanan (kPa) satu halaman penuh dalam orientasi A4 landscape dengan fixed width 940px, informasi Jumlah Botol (Amount), dan blok tanda tangan pengesahan (SignOffBlock).
- **Export utama**: `default` PrintCurvePage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/operatorLabel.js`, `src/components/SignOffBlock.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records/[batchNo]`, memicu dialog browser `window.print()` (`src/app/print/data-report/[batchNo]/curve/page.js:115-194`).
- **Bukti**: `src/app/print/data-report/[batchNo]/curve/page.js:1-320`
- **Catatan**: Header menyertakan field `Amount :` (`batch.bottleCount`). Menyematkan `<SignOffBlock />` di bawah grafik kurva (`src/app/print/data-report/[batchNo]/curve/page.js:317`). Grafik Recharts dikonfigurasi `isAnimationActive={false}`.

---

### `fase1/tests/matrix.mjs`
- **Tipe**: Script Test / Harness
- **Fungsi**: Menguji otomatis matriks hak akses seluruh endpoint API terhadap role akun uji (OPERATOR, MAINTAINER, QA, ADMIN, DASH) dan memverifikasi status HTTP 403 untuk aksi terlarang serta status valid untuk aksi yang diizinkan.
- **Export utama**: Tidak ada (script mandiri Node.js).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan `fetch`, `url`).
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membutuhkan environment `CONFIRM_DEV=yes`, variabel kredensial akun uji `ACC_*`, dan melakukan HTTP request ke server dev lokal.
- **Bukti**: `fase1/tests/matrix.mjs:1-239`
- **Catatan**: Tidak menyentuh aksi mesin fisik (START/STOP/Reset).

---

### `migrations/005_drop_legacy_role.sql`
- **Tipe**: SQL Migration
- **Fungsi**: Skrip migrasi DDL PostgreSQL untuk menghapus kolom legacy `users.role`, trigger sinkronisasi `trg_users_sync_legacy_role`, fungsi trigger, dan check constraint `users_role_check`.
- **Export utama**: Tidak ada (skrip SQL DDL).
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: Dijalankan manual via pgAdmin / psql
- **Efek samping / dependensi eksternal**: Mengubah skema tabel `users` pada database PostgreSQL.
- **Bukti**: `migrations/005_drop_legacy_role.sql:1-107`
- **Catatan**: Menyertakan guard pemeriksaan awal `DO $$` untuk mencegah eksekusi ulang.

---

### `migrations/005_drop_legacy_role_rollback.sql`
- **Tipe**: SQL Migration Rollback
- **Fungsi**: Skrip rollback DDL PostgreSQL untuk mengembalikan kolom `users.role`, constraint, dan fungsi trigger sinkronisasi otomatis dari `role_id` bila migrasi 005 perlu dibatalkan.
- **Export utama**: Tidak ada (skrip SQL DDL).
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: Dijalankan manual via pgAdmin / psql bila rollback diperlukan
- **Efek samping / dependensi eksternal**: Menambahkan kembali kolom `role` pada tabel `users`.
- **Bukti**: `migrations/005_drop_legacy_role_rollback.sql:1-74`
- **Catatan**: Skrip pemulihan darurat migrasi 005.

---

### `migrations/backup_271026.sql`
- **Tipe**: Database Dump / Backup
- **Fungsi**: Berkas backup dump SQL skema dan data database `scada-atv1` yang dibuat sebelum eksekusi migrasi 005 pada 27 Oktober 2026.
- **Export utama**: Tidak ada (berkas SQL dump).
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: Tidak di-import oleh file mana pun (arsip pemulihan bencana)
- **Efek samping / dependensi eksternal**: Berisi DDL dan data tabel sistem SCADA.
- **Bukti**: `migrations/backup_271026.sql:1-1769`
- **Catatan**: Berkas arsip SQL backup statis.

---

### `src/app/(app)/roles/page.js`
- **Tipe**: Client Component / Halaman Aplikasi
- **Fungsi**: Menyediakan antarmuka visual Role Management untuk melihat daftar role, membuat custom role baru (dengan opsi kloning izin), mengubah nama/deskripsi, mengonfigurasi matriks izin per resource (none/view/edit), dan menghapus custom role non-sistem.
- **Export utama**: `default` RolesPage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/permissionCatalog.js`
- **Dipakai oleh**: Di-render melalui routing Next.js App Router pada path `/roles`
- **Efek samping / dependensi eksternal**: Memanggil endpoint `GET /api/roles`, `GET /api/roles/[id]`, `POST /api/roles`, `PUT /api/roles/[id]`, `DELETE /api/roles/[id]`, dan `GET /api/auth/me`.
- **Bukti**: `src/app/(app)/roles/page.js:1-624`
- **Catatan**: Role sistem (`is_system = true`, mis. admin/operator/qa/maintainer) dikunci key dan penghapusannya.

---

### `src/app/api/roles/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan daftar seluruh role beserta izin dan jumlah penggunanya (`GET`, proteksi `roles >= view`), serta pembuatan custom role baru (`POST`, proteksi `roles = edit`).
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/auditLog.js`, `src/lib/permissionCatalog.js`, `src/lib/roleAdmin.js`, `src/lib/roleQueries.js`
- **Dipakai oleh**: Dipanggil oleh `src/app/(app)/roles/page.js`
- **Efek samping / dependensi eksternal**: Menjalankan transaksi database `INSERT INTO roles`, `upsertPermissions`, dan mencatat ke tabel `audit_log`.
- **Bukti**: `src/app/api/roles/route.js:1-90`
- **Catatan**: Dilindungi transaksi serialisasi advisory lock `7001` via `lockRoleMutations`.

---

### `src/app/api/roles/[id]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengembalikan detail role tunggal (`GET`), memperbarui nama/deskripsi/matriks izin role (`PUT`), dan menghapus custom role non-sistem (`DELETE`).
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/auditLog.js`, `src/lib/permissionCatalog.js`, `src/lib/roleAdmin.js`, `src/lib/roleQueries.js`
- **Dipakai oleh**: Dipanggil oleh `src/app/(app)/roles/page.js`
- **Efek samping / dependensi eksternal**: Melakukan update/delete pada tabel `roles` & `role_permissions`, mencatat ke `audit_log`, dan memvalidasi `assertRoleManagerRemains`.
- **Bukti**: `src/app/api/roles/[id]/route.js:1-158`
- **Catatan**: Menolak penghapusan role sistem atau role yang masih memiliki anggota akun aktif.

---

### `src/app/api/roles/options/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan daftar ringkas pilihan role (id, key, name) untuk pengisian opsi dropdown pada formulir pengguna.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/roleAdmin.js`
- **Dipakai oleh**: Dipanggil oleh `src/app/(app)/users/page.js`
- **Efek samping / dependensi eksternal**: Menjalankan query `SELECT id, key, name FROM roles ORDER BY is_system DESC, id`.
- **Bukti**: `src/app/api/roles/options/route.js:1-24`
- **Catatan**: Boleh diakses oleh pemegang izin `users >= view` ATAU `roles >= view` via `requireAnyPermission`.

---

### `src/app/api/users/[username]/delete/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengeksekusi hapus-lunak (soft-delete) akun pengguna (`deleted_at = now()`, `is_active = false`, `role_id = NULL`), mengunci username selamanya, dan mencatat jejak audit `delete_user`.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/auth.js`, `src/lib/auditLog.js`, `src/lib/userQueries.js`, `src/lib/roleAdmin.js`
- **Dipakai oleh**: Dipanggil oleh dialog hapus pada `src/app/(app)/users/page.js`
- **Efek samping / dependensi eksternal**: Menjalankan query `UPDATE users SET deleted_at = now() ...`, mencatat ke `audit_log`, dan memastikan `assertRoleManagerRemains`.
- **Bukti**: `src/app/api/users/[username]/delete/route.js:1-93`
- **Catatan**: Terpisah dari `DELETE /api/users/[username]` yang hanya berfungsi menonaktifkan akun sementara (`is_active = false`).

---

### `src/components/DeletedUserBadge.js`
- **Tipe**: UI Component
- **Fungsi**: Merender lencana visual kecil teks "deleted user" dengan border abu-abu di samping nama operator/pengguna yang akunnya telah dihapus-lunak.
- **Export utama**: `default` DeletedUserBadge (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/app/(app)/page.js`, `src/app/(app)/alarm/page.js`, `src/app/(app)/audit-log/page.js`, `src/app/(app)/data-report/page.js`, `src/app/(app)/data-report/[batchNo]/page.js`, `src/app/(app)/trend/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada (komponen presentasi murni).
- **Bukti**: `src/components/DeletedUserBadge.js:1-16`
- **Catatan**: Dokumen cetak dan ekspor tidak memakai komponen ini melainkan format string teks `operatorText`.

---

### `src/components/PermissionGate.js`
- **Tipe**: Client Component / Wrapper Guard
- **Fungsi**: Membungkus komponen anak (children) dengan verifikasi izin berbasis `hasLevel` dari hasil fetch `/api/auth/me`. Menampilkan pesan akses ditolak (fail-closed) jika izin tidak mencukupi.
- **Export utama**: `default` PermissionGate (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/permissionCatalog.js`
- **Dipakai oleh**: `src/app/(app)/alarm/page.js`, `src/app/(app)/data-report/page.js`, `src/app/(app)/data-report/[batchNo]/page.js`, `src/app/(app)/formula/page.js`, `src/app/(app)/products/page.js`, `src/app/(app)/trend/page.js`, `src/app/print/alarm/page.js`, `src/app/print/batch-records/page.js`, `src/app/print/data-report/[batchNo]/page.js`
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me` pada saat komponen mount.
- **Bukti**: `src/components/PermissionGate.js:1-78`
- **Catatan**: Mencegah kebocoran UI pada route baca bagi pengguna tanpa izin.

---

### `src/lib/operatorLabel.js`
- **Tipe**: Util / Formatter Teks
- **Fungsi**: Memformat nama operator untuk tampilan cetak dan ekspor: menambahkan teks akhiran ` (deleted user)` bila parameter `deleted` bernilai `true`.
- **Export utama**: `operatorText` (fungsi)
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/app/print/data-report/[batchNo]/page.js`, `src/app/print/data-report/[batchNo]/curve/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada (fungsi murni).
- **Bukti**: `src/lib/operatorLabel.js:1-20`
- **Catatan**: Dipakai khusus untuk laporan cetak yang tidak mendukung komponen lencana interaktif.

---

### `src/lib/permissionCatalog.js`
- **Tipe**: Config / Util Otorisasi
- **Fungsi**: Sumber kebenaran daftar resource izin sistem (13 halaman, 3 kunci aksi kritis), level izin (`none`, `view`, `edit`), serta fungsi pembantu verifikasi izin (`hasLevel`, `normalizePermissions`, `isLevelAllowed`).
- **Export utama**: `LEVELS`, `LEVEL_LABELS`, `RESOURCES`, `getResource`, `isKnownResource`, `isValidLevel`, `isLevelAllowed`, `hasLevel`, `normalizePermissions`
- **Meng-import (internal)**: Tidak ada (dapat di-import di server maupun browser / "use client")
- **Dipakai oleh**: `src/lib/auth.js`, `src/lib/roleQueries.js`, `src/components/PermissionGate.js`, `src/components/Navbar.js`, `src/app/(app)/roles/page.js`, `src/app/api/roles/route.js`, `src/app/api/roles/[id]/route.js`
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `src/lib/permissionCatalog.js:1-84`
- **Catatan**: Aman di-import di lingkungan browser karena tidak meng-import modul database `pg`.

---

### `src/lib/roleAdmin.js`
- **Tipe**: Util / Transaksi & Guard Admin (Server-Only)
- **Fungsi**: Menyediakan wrapper transaksi database `withTransaction`, penguncian serialisasi `lockRoleMutations` via advisory lock `7001`, penjaga invariant `assertRoleManagerRemains`, kelas `HttpError`, dan pengubah error `toErrorResponse`.
- **Export utama**: `HttpError`, `withTransaction`, `lockRoleMutations`, `assertRoleManagerRemains`, `toErrorResponse`
- **Meng-import (internal)**: `src/lib/db.js`
- **Dipakai oleh**: `src/lib/roleQueries.js`, `src/app/api/roles/route.js`, `src/app/api/roles/[id]/route.js`, `src/app/api/roles/options/route.js`, `src/app/api/users/route.js`, `src/app/api/users/[username]/route.js`, `src/app/api/users/[username]/delete/route.js`, `src/app/api/users/[username]/reset-password/route.js`
- **Efek samping / dependensi eksternal**: Memanggil `pg_advisory_xact_lock(7001)` dan query transaksi PostgreSQL.
- **Bukti**: `src/lib/roleAdmin.js:1-70`
- **Catatan**: Menjamin tidak akan terjadi lockout role management (selalu tersisa minimal 1 user aktif dengan izin `roles = edit`).

---

### `src/lib/roleQueries.js`
- **Tipe**: Util / Query & Validasi Role (Server-Only)
- **Fungsi**: Menyediakan query SQL konstan `ROLE_SELECT`, pemeta baris `rowToRole`, query `fetchRoleById`, parser `parseRoleId`, validasi nama/deskripsi/key/izin, fungsi `upsertPermissions`, dan kalkulasi selisih izin `diffPermissions`.
- **Export utama**: `ROLE_SELECT`, `rowToRole`, `fetchRoleById`, `parseRoleId`, `validatePermissionsInput`, `validateName`, `validateDescription`, `slugifyKey`, `validateKey`, `upsertPermissions`, `diffPermissions`
- **Meng-import (internal)**: `src/lib/permissionCatalog.js`, `src/lib/roleAdmin.js`
- **Dipakai oleh**: `src/app/api/roles/route.js`, `src/app/api/roles/[id]/route.js`
- **Efek samping / dependensi eksternal**: Mengeksekusi query PostgreSQL pada tabel `roles` dan `role_permissions`.
- **Bukti**: `src/lib/roleQueries.js:1-106`
- **Catatan**: Memetakan izin format JSONB agregat dari tabel `role_permissions`.

---

### `src/lib/userQueries.js`
- **Tipe**: Util / Query Pengguna (Server-Only)
- **Fungsi**: Menyediakan query SQL konstan `USER_SELECT` (join `users` dan `roles`), pemeta baris `rowToUser`, dan resolusi peran `resolveRole` (berdasarkan `roleId` numerik atau `role` string key).
- **Export utama**: `USER_SELECT`, `rowToUser`, `resolveRole`
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/app/api/users/route.js`, `src/app/api/users/[username]/route.js`, `src/app/api/users/[username]/delete/route.js`
- **Efek samping / dependensi eksternal**: Mengeksekusi query database PostgreSQL saat `resolveRole` dipanggil.
- **Bukti**: `src/lib/userQueries.js:1-41`
- **Catatan**: Memetakan kolom `role_id`, `role_key`, dan `role_name` tanpa mengekspos `password_hash`.

---

### `migrations/006_add_bottle_count.sql`
- **Tipe**: SQL Migration
- **Fungsi**: Menambahkan kolom `bottle_count` bertipe `integer` pada tabel `batch_records` untuk mencatat jumlah botol (amount) produk yang dimasukkan secara manual oleh operator saat pemicuan START batch.
- **Export utama**: DDL SQL (`ALTER TABLE public.batch_records ADD COLUMN IF NOT EXISTS bottle_count integer;`)
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: Tidak di-import langsung (dieksekusi manual via psql atau pgAdmin)
- **Efek samping / dependensi eksternal**: Memodifikasi skema tabel PostgreSQL `batch_records` dan menambahkan komentar kolom.
- **Bukti**: `migrations/006_add_bottle_count.sql:1-8`
- **Catatan**: Disertai migrasi rollback `migrations/006_add_bottle_count_rollback.sql`.

---

### `migrations/006_add_bottle_count_rollback.sql`
- **Tipe**: SQL Migration Rollback
- **Fungsi**: Membatalkan migrasi 006 dengan menghapus kolom `bottle_count` dari tabel `batch_records`.
- **Export utama**: DDL SQL (`ALTER TABLE public.batch_records DROP COLUMN IF EXISTS bottle_count;`)
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: Tidak di-import langsung (dieksekusi saat rollback skema)
- **Efek samping / dependensi eksternal**: Menghapus kolom `bottle_count` beserta seluruh data jumlah botol pada tabel `batch_records`.
- **Bukti**: `migrations/006_add_bottle_count_rollback.sql:1-5`
- **Catatan**: Disediakan sebagai skrip mitigasi rollback skema.

---

### `src/components/SearchableCombobox.js`
- **Tipe**: Client Component / Input Combobox ("use client")
- **Fungsi**: Antarmuka dropdown pencarian yang mendukung seleksi opsi master sekaligus pengisian nilai teks manual (free text), dilengkapi navigasi keyboard (panah atas/bawah, Enter, Escape) dan penutupan otomatis saat klik di luar area.
- **Export utama**: `default SearchableCombobox`
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/components/StartDialog.js`
- **Efek samping / dependensi eksternal**: Memasang event listener `mousedown` global pada dokumen (`src/components/SearchableCombobox.js:59`).
- **Bukti**: `src/components/SearchableCombobox.js:1-204`
- **Catatan**: Digunakan pada pemilihan Nama Produk dan Spesifikasi Kemasan di modal START.

---

### `src/components/SignOffBlock.js`
- **Tipe**: Komponen Cetak / Lembar Pengesahan
- **Fungsi**: Merender blok tanda tangan verifikasi fisik dokumen standar industri farmasi berisi baris pengesahan "Operated by: ____ DATE: ____" pada kolom kiri dan "Checked by: ____ DATE: ____" pada kolom kanan dengan aturan pemotongan halaman (`page-break-inside: avoid`).
- **Export utama**: `default SignOffBlock`
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/app/print/alarm/page.js`, `src/app/print/data-report/[batchNo]/page.js`, `src/app/print/data-report/[batchNo]/curve/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada (murni rendering visual dokumen cetak).
- **Bukti**: `src/components/SignOffBlock.js:1-43`
- **Catatan**: Mendukung kustomisasi lebar kolom via prop `columnWidth` (default: 260px).

---

### `src/components/PlcDialog.js`
- **Tipe**: Client Component / Modal Dialog ("use client")
- **Fungsi**: Menyediakan kerangka modal popup dialog konfirmasi berlatar semi-transparan (`fixed inset-0 z-50 bg-black/40`) dengan area judul header dan scroll vertikal konten responsif.
- **Export utama**: `default PlcDialog`
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/components/PlcParamEditor.js`, `src/app/(app)/plc-clock/page.js`, `src/app/(app)/manual/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `src/components/PlcDialog.js:1-20`
- **Catatan**: Menerima prop `wide` untuk tampilan tabel verifikasi multi-kolom yang lebar.

---

### `src/components/PlcParamEditor.js`
- **Tipe**: Client Component / Editor Parameter HMI ("use client")
- **Fungsi**: Menyediakan antarmuka interaktif pemantauan dan pengubahan parameter mesin PLC per grup (Setting 1, Setting 2, Coef, Calibration), integrasi pengecekan izin pengguna via `/api/auth/me`, dialog konfirmasi perubahan nilai lama vs baru dengan input alasan wajib, peringatan parameter keselamatan (`danger`), dan tabel hasil verifikasi baca-balik dari PLC.
- **Export utama**: `default PlcParamEditor`
- **Meng-import (internal)**: `src/lib/permissionCatalog.js` (`hasLevel`), `src/lib/plcParamCatalog.js` (`PLC_GROUPS`, `PLC_FIELDS`, `formatValue`, `validateField`, `rawEquals`), `src/components/PlcDialog.js`
- **Dipakai oleh**: `src/app/(app)/machine-params/page.js`, `src/app/(app)/calibration/page.js`
- **Efek samping / dependensi eksternal**: Melakukan HTTP fetch ke `/api/auth/me`, `GET /api/plc-params?group=...`, dan `PUT /api/plc-params`.
- **Bukti**: `src/components/PlcParamEditor.js:1-401`
- **Catatan**: Menangani proteksi disable tombol saat mesin berstatus tidak idle atau saat pengguna tidak memiliki izin edit.

---

### `src/lib/plcAccess.js`
- **Tipe**: Lib / Akses On-Demand PLC (Server-Only)
- **Fungsi**: Menyediakan abstraksi komunikasi PLC on-demand untuk modul HMI-web (di luar TAG_MAP polling 1 detik dashboard): pembacaan raw tag tanpa scaling (`readPlcRaw`), serialisasi penguncian tulis via advisory lock `PLC_WRITE_LOCK_KEY` (847291035) dan `START_LOCK_KEY` (`withPlcLocks`), pengecekan fase mesin idle & ketiadaan batch aktif (`checkMachineIdle`), serta fungsi tulis dan verifikasi baca-balik berulang hingga 4,5 detik (`writeAndVerify`, `verifyRaw`).
- **Export utama**: `PLC_WRITE_LOCK_KEY`, `readPlcRaw`, `withPlcLocks`, `checkMachineIdle`, `writeAndVerify`, `verifyRaw`
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/plcWrite.js` (`writePlcTags`), `src/lib/recipeGuard.js` (`START_LOCK_KEY`), `src/lib/plcParamCatalog.js` (`rawEqualsKind`)
- **Dipakai oleh**: `src/app/api/plc-params/route.js`, `src/app/api/plc-clock/route.js`, `src/app/api/plc-manual/route.js`
- **Efek samping / dependensi eksternal**: Memanggil REST API KEPServerEX `/iotgateway/read`, mengelola lock sesi PostgreSQL `pg_try_advisory_lock`, dan mengakses env `IOT_GATEWAY_*` secara fail-closed.
- **Bukti**: `src/lib/plcAccess.js:1-185`
- **Catatan**: Server-only runtime. Kunci advisory lock selalu dilepaskan pada blok `finally`.

---

### `src/lib/plcClock.js`
- **Tipe**: Util / Konversi Jam RTC PLC Siemens S7-200
- **Fungsi**: Memuat definisi tag jam Real-Time Clock (RTC) Siemens S7-200 (`CLOCK_READ_TAGS`, `CLOCK_WRITE_TAGS`, `CLOCK_TRIGGER_TAG`), fungsi konversi bilangan BCD (`toBcd`, `fromBcd`), validasi kalender tahun 2000-2099 (`validateClockInput`), encoding buffer tulis BCD (`encodeClockWrites`), decoding nilai BCD raw menjadi bagian waktu (`decodeClock`), serta formatting tanggal/jam (`formatClock`).
- **Export utama**: `CLOCK_READ_TAGS`, `CLOCK_WRITE_TAGS`, `CLOCK_TRIGGER_TAG`, `CLOCK_PARTS`, `toBcd`, `fromBcd`, `daysInMonth`, `validateClockInput`, `encodeClockWrites`, `decodeClock`, `clockToNaiveMs`, `partsFromDate`, `formatClock`
- **Meng-import (internal)**: Tidak ada (dapat di-import di klien maupun server)
- **Dipakai oleh**: `src/app/api/plc-clock/route.js`, `src/app/(app)/plc-clock/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `src/lib/plcClock.js:1-92`
- **Catatan**: Jam PLC dibaca dari register VB2000..VB2005 (instruksi TODR) dan ditulis ke VB3000..VB3005 sebelum dieksekusi via pulsa tepi naik M31.0 (instruksi TODW).

---

### `src/lib/plcManualCatalog.js`
- **Tipe**: Config / Katalog Kontrol Manual PLC
- **Fungsi**: Mendefinisikan katalog 10 item kontrol manual aktuator mesin (katup steam 1/2, cooling 1/2, udara chamber, drain, exhaust, pengisian air murni, pompa air, buzzer) yang dipetakan ke subrutin PLC SBR9, tag mode manual `MANUAL_MODE_TAG = "MANUAL_OPER"` (M5.0), fase idle yang diizinkan (`IDLE_PHASES_MANUAL = [0, 1]`), serta aturan validasi interlock keselamatan web (`checkManualCommand`).
- **Export utama**: `MANUAL_MODE_TAG`, `IDLE_PHASES_MANUAL`, `MANUAL_ITEMS`, `MANUAL_COMMAND_TAGS`, `getManualItem`, `checkManualCommand`
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/app/api/plc-manual/route.js`, `src/app/(app)/manual/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `src/lib/plcManualCatalog.js:1-66`
- **Catatan**: Validasi `checkManualCommand` memastikan katup steam hanya dapat dibuka saat pintu tertutup rapat dan seal aktif, serta melarang pengaktifan bersamaan antara katup steam dan cooling.

---

### `src/lib/plcParamCatalog.js`
- **Tipe**: Config / Katalog Parameter & Pagar Server PLC
- **Fungsi**: Sumber kebenaran daftar field parameter PLC yang diizinkan dibaca/ditulis oleh HMI-web (`PLC_FIELDS`: `param1`, `param2`, `coef`, `calibration`), metadata skala/unit/batas min-max, grup resource (`PLC_GROUPS`), fase idle (`IDLE_PHASES_PARAMS = [0, 1, 6]`), kunci aksi keselamatan `SAFETY_ACTION = "action.write_safety_params"`, validasi rentang fisik (`validateField`), perbandingan presisi float32 (`rawEquals`), cross-check relasi suhu antar-field (`crossCheck`), dan formatting teks (`formatValue`).
- **Export utama**: `SAFETY_ACTION`, `PLC_GROUPS`, `IDLE_PHASES_PARAMS`, `PLC_FIELDS`, `getFields`, `getField`, `rawToValue`, `rawEqualsKind`, `rawEquals`, `validateField`, `crossCheck`, `formatValue`
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: `src/lib/plcAccess.js`, `src/components/PlcParamEditor.js`, `src/app/api/plc-params/route.js`, `src/app/api/plc-clock/route.js`
- **Efek samping / dependensi eksternal**: Tidak ada.
- **Bukti**: `src/lib/plcParamCatalog.js:1-230`
- **Catatan**: Menjadi batas pagar keamanan server terhadap tag R/W di KEPServerEX agar penulisan di luar field katalog ditolak secara mutlak.

---

### `src/app/api/plc-clock/route.js`
- **Tipe**: API Route Handler (Server-Only)
- **Fungsi**: Menangani pembacaan jam RTC PLC dan selisihnya terhadap waktu PC/server (`GET`), serta pengaturan jam RTC PLC dengan input alasan wajib (`PUT`).
- **Export utama**: `GET`, `PUT`
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js` (`requirePermission`), `src/lib/auditLog.js` (`insertAudit`, `tryAudit`), `src/lib/plcWrite.js` (`writePlcTags`, `pulsePlcTag`), `src/lib/plcParamCatalog.js` (`IDLE_PHASES_PARAMS`), `src/lib/plcAccess.js` (`readPlcRaw`, `withPlcLocks`, `checkMachineIdle`), `src/lib/plcClock.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (dipanggil via fetch oleh `src/app/(app)/plc-clock/page.js`)
- **Efek samping / dependensi eksternal**: Menulis tag BCD ke PLC via `writePlcTags`, mengirim pulsa eksekusi `ENTER_RTC` via `pulsePlcTag`, membaca balik jam baru dengan batas toleransi waktu ±6 detik, dan mencatat log audit berjenjang (`plc_clock_write_requested`, `plc_clock_write_failed`, `plc_clock_write_success`).
- **Bukti**: `src/app/api/plc-clock/route.js:1-184`
- **Catatan**: Dilindungi guard `requirePermission(cookieStore, "plc_clock", "view" | "edit")`.

---

### `src/app/api/plc-manual/route.js`
- **Tipe**: API Route Handler (Server-Only)
- **Fungsi**: Mengembalikan status seluruh perintah manual, output aktual PLC, dan status pintu/interlock (`GET`), serta mengeksekusi kontrol manual aktuator (`POST` dengan aksi `enter`, `exit`, atau `set`).
- **Export utama**: `GET`, `POST`
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js` (`requirePermission`), `src/lib/auditLog.js` (`insertAudit`, `tryAudit`), `src/lib/plcManualCatalog.js`, `src/lib/plcAccess.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (dipanggil via fetch oleh `src/app/(app)/manual/page.js`)
- **Efek samping / dependensi eksternal**: Menulis tag perintah `MANUAL_OPER` dan `MAN_*` ke PLC via `writeAndVerify`, serta mencatat jejak audit `plc_manual_command`.
- **Bukti**: `src/app/api/plc-manual/route.js:1-217`
- **Catatan**: Aksi `exit` (keluar mode manual) didesain sebagai aksi keselamatan: selalu diizinkan tanpa penguncian dan mematikan seluruh perintah aktuator terlebih dahulu sebelum menurunkan bit mode manual M5.0.

---

### `src/app/api/plc-params/route.js`
- **Tipe**: API Route Handler (Server-Only)
- **Fungsi**: Mengembalikan pembacaan nilai PLC saat ini beserta status kesiapan mesin untuk grup parameter yang diminta (`GET`), serta memperbarui nilai parameter mesin atau offset kalibrasi PLC (`PUT`).
- **Export utama**: `GET`, `PUT`
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js` (`requirePermission`), `src/lib/auditLog.js` (`insertAudit`, `tryAudit`), `src/lib/plcParamCatalog.js`, `src/lib/plcAccess.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (dipanggil via fetch oleh `src/components/PlcParamEditor.js`)
- **Efek samping / dependensi eksternal**: Dilindungi izin granular bertingkat (`machine_params` atau `calibration`, ditambah `action.write_calibration` dan `action.write_safety_params` untuk field keselamatan). Mengeksekusi penulisan dengan `withPlcLocks` dan verifikasi baca-balik.
- **Bukti**: `src/app/api/plc-params/route.js:1-223`
- **Catatan**: Mewajibkan isian teks alasan perubahan (minimal 3 karakter) yang dicatat ke tabel `audit_log`.

---

### `src/app/(app)/calibration/page.js`
- **Tipe**: Client Component / Halaman Antarmuka ("use client")
- **Fungsi**: Menyajikan antarmuka HMI kalibrasi offset sensor suhu (TH, T1-T6, TM, TL), tekanan (P1, P2), dan konduktivitas (L) yang terhubung ke PLC.
- **Export utama**: `default CalibrationPage`
- **Meng-import (internal)**: `src/components/PermissionGate.js`, `src/components/PlcParamEditor.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (rute halaman `/calibration`)
- **Efek samping / dependensi eksternal**: Tidak ada (dibungkus `PermissionGate resource="calibration" minLevel="view"`).
- **Bukti**: `src/app/(app)/calibration/page.js:1-16`
- **Catatan**: Menggunakan komponen `PlcParamEditor` dengan grup `["calibration"]`.

---

### `src/app/(app)/machine-params/page.js`
- **Tipe**: Client Component / Halaman Antarmuka ("use client")
- **Fungsi**: Menyajikan antarmuka HMI pengelolaan parameter mesin Autoclave: Parameter Setting 1, Parameter Setting 2, dan Pressure Coefficient.
- **Export utama**: `default MachineParamsPage`
- **Meng-import (internal)**: `src/components/PermissionGate.js`, `src/components/PlcParamEditor.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (rute halaman `/machine-params`)
- **Efek samping / dependensi eksternal**: Tidak ada (dibungkus `PermissionGate resource="machine_params" minLevel="view"`).
- **Bukti**: `src/app/(app)/machine-params/page.js:1-16`
- **Catatan**: Menggunakan komponen `PlcParamEditor` dengan tab grup `["param1", "param2", "coef"]`.

---

### `src/app/(app)/manual/page.js`
- **Tipe**: Client Component / Halaman Kontrol Manual ("use client")
- **Fungsi**: Menyajikan antarmuka pengoperasian manual aktuator mesin sterilisasi (katup, pompa sirkulasi, buzzer), indikator lampu perintah vs output fisik aktual, tombol mulai/keluar mode manual, dan polling status interlock secara real-time setiap 1,5 detik.
- **Export utama**: `default function ManualPage`
- **Meng-import (internal)**: `src/lib/permissionCatalog.js` (`hasLevel`), `src/lib/plcManualCatalog.js` (`MANUAL_ITEMS`), `src/components/PermissionGate.js`, `src/components/PlcDialog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (rute halaman `/manual`)
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me`, `GET /api/plc-manual` setiap 1500 ms, dan `POST /api/plc-manual`.
- **Bukti**: `src/app/(app)/manual/page.js:1-264`
- **Catatan**: Dilindungi `PermissionGate resource="manual_control" minLevel="view"`. Menampilkan visualisasi lampu hijau/merah/abu-abu untuk membedakan bit perintah vs output relay aktual.

---

### `src/app/(app)/plc-clock/page.js`
- **Tipe**: Client Component / Halaman Jam PLC ("use client")
- **Fungsi**: Menyajikan antarmuka pemantauan jam RTC PLC secara real-time (polling tiap 2 detik), perbandingan selisih waktu terhadap PC/server, pengisian cepat waktu lokal PC, dan form sinkronisasi jam PLC dengan dialog konfirmasi alasan.
- **Export utama**: `default function ClockPage`
- **Meng-import (internal)**: `src/lib/permissionCatalog.js` (`hasLevel`), `src/lib/plcClock.js`, `src/components/PermissionGate.js`, `src/components/PlcDialog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (rute halaman `/plc-clock`)
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me`, `GET /api/plc-clock` setiap 2000 ms, dan `PUT /api/plc-clock`.
- **Bukti**: `src/app/(app)/plc-clock/page.js:1-259`
- **Catatan**: Dilindungi `PermissionGate resource="plc_clock" minLevel="view"`. Menampilkan peringatan warna kuning bila jam yang dimasukkan berselisih lebih dari 5 menit dari waktu PC.

---

### `src/lib/plcDoorCatalog.js` ⚠ *[UNTRACKED — belum di-commit]*
- **Tipe**: Config / Katalog Pintu PLC (aman klien & server)
- **Fungsi**: Katalog pagar, konstanta waktu, dan tag perintah untuk fitur Door Operate. Mendefinisikan fase idle yang diizinkan (`IDLE_PHASES_DOOR = [0, 1]`), waktu pulsa (`SEAL_PULSE_MS = 1500`, `RELEASE_PULSE_MS = 3000` — tebakan), deadman timeout (`DEADMAN_TIMEOUT_MS = 1000`), auto-OFF timer (`AUTO_OFF_MS = 60_000`), daftar tag perintah (`DOOR_CMD_TAGS`), tag wajib (`REQUIRED_TAGS`), tag opsional (`OPTIONAL_TAGS`), serta fungsi `buildDoorState`, `pressureSafe`, dan `checkDoorCommand`.
- **Export utama**: `IDLE_PHASES_DOOR`, `SEAL_PULSE_MS`, `RELEASE_PULSE_MS`, `DEADMAN_TIMEOUT_MS`, `AUTO_OFF_MS`, `DOOR_CMD_TAGS`, `REQUIRED_TAGS`, `OPTIONAL_TAGS`, `ALL_STATE_TAGS`, `buildDoorState`, `pressureSafe`, `checkDoorCommand`
- **Meng-import (internal)**: `src/lib/plcManualCatalog.js` (`MANUAL_MODE_TAG`, baris 24) — satu-satunya impor internal.
- **Dipakai oleh**: `src/lib/plcDeadman.js`, `src/app/api/plc-door/route.js`, `src/app/(app)/door-operate/page.js`
- **Efek samping / dependensi eksternal**: Tidak ada (konstanta dan fungsi murni).
- **Bukti**: `src/lib/plcDoorCatalog.js:1-163`
- **Catatan**: Komentar baris 29 menyatakan `RELEASE_PULSE_MS` adalah tebakan `[BELUM]`, perlu dikonfirmasi ke mesin fisik. Fungsi `checkDoorCommand` memvalidasi pagar per aksi (seal/release/drain/unlock/fwd/bwd) secara fail-closed: nilai null = tolak.

---

### `src/lib/plcDeadman.js` ⚠ *[UNTRACKED — belum di-commit]*
- **Tipe**: Lib / Pengaman Waktu Door Operate (Server-Only)
- **Fungsi**: Menyediakan pengaman waktu untuk fitur Door Operate: deadman rantai Forward/Backward (bit rantai mati sendiri bila tidak ada sinyal "run" dalam `DEADMAN_TIMEOUT_MS = 1000` ms) dan auto-OFF Water Drain / Door Unlock setelah `AUTO_OFF_MS = 60_000` ms. Seluruh operasi diserialkan via antrean Promise. Singleton produksi disimpan di `globalThis.__plcDoorSafety`.
- **Export utama**: `readDoorState`, `createDoorSafety`, `getDoorSafety`
- **Meng-import (internal)**: `src/lib/plcDoorCatalog.js` (impor statis, baris 21–23); `src/lib/plcAccess.js` dan `src/lib/plcWrite.js` via **dynamic import** lazy di objek `realDeps` (baris 31–35) agar modul dapat di-tes tanpa PostgreSQL/gateway.
- **Dipakai oleh**: `src/app/api/plc-door/route.js`
- **Efek samping / dependensi eksternal**: Memanggil KEPServerEX via `plcAccess.js`/`plcWrite.js`, mengelola `setTimeout` internal. **Server-Only** — jangan di-import dari komponen "use client".
- **Bukti**: `src/lib/plcDeadman.js:1-246`
- **Catatan**: Keterbatasan kritis (baris 14–17): bila proses server/PC mati saat bit rantai true, tidak ada yang menulis false — rantai jalan sampai syarat PLC memotong. `server.js` menyiasatinya dengan reset best-effort saat startup (baris 92–105). Perlindungan penuh membutuhkan timeout di ladder PLC.

---

### `src/app/api/plc-door/route.js` ⚠ *[UNTRACKED — belum di-commit]*
- **Tipe**: API Route Handler (Server-Only)
- **Fungsi**: Mengembalikan status pintu, rantai, dan auto-OFF timer (`GET`), serta mengeksekusi aksi pintu: pulsa `seal`/`release`, toggle `drain`/`unlock` dengan auto-OFF, dan deadman `chain` Forward/Backward (`POST`).
- **Export utama**: `GET`, `POST`
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js` (`requirePermission`), `src/lib/auditLog.js` (`insertAudit`, `tryAudit`), `src/lib/plcDoorCatalog.js`, `src/lib/plcAccess.js` (`withPlcLocks`, `checkMachineIdle`, `writeAndVerify`, `verifyRaw`), `src/lib/plcWrite.js` (`pulsePlcTag`), `src/lib/plcDeadman.js` (`readDoorState`, `getDoorSafety`)
- **Dipakai oleh**: Tidak di-import oleh file mana pun (dipanggil via fetch oleh `src/app/(app)/door-operate/page.js` dan `src/app/(app)/page.js`)
- **Efek samping / dependensi eksternal**: Menulis tag PLC via KEPServerEX, mencatat audit `plc_door_command`, `plc_door_command_failed`, `plc_door_chain`.
- **Bukti**: `src/app/api/plc-door/route.js:1-236`
- **Catatan**:
  - **GET** (baris 23–46): guard `requirePermission(cookieStore, "manual_control", "view")` (baris 26).
  - **POST** (baris 57–236): guard utama `requirePermission(cookieStore, "manual_control", "edit")` (baris 60). **Jalur izin kedua berlaku untuk SEMUA aksi** (`seal`, `release`, `drain`, `unlock`, `chain`) di baris 74–79: lolos bila pemegang `dashboard >= edit` DAN `action.batch_control = edit` (hak yang sama dengan START/STOP), selaras dengan operasi di HMI fisik mesin. Bila kedua jalur gagal, server mengembalikan error 403 dari jalur utama (`manual_control`).
  - Seluruh aksi satu klik langsung tanpa dialog konfirmasi dan tanpa validasi field alasan `reason`.
  - Audit `plc_door_command` ditulis fail-closed sebelum menulis PLC untuk perintah ON (baris 199–203) dengan deskripsi `"<Label> dijalankan oleh <username> menggunakan SCADA."`; kegagalan audit membatalkan pengiriman perintah ke PLC.
  - Audit `plc_door_chain` dicatat pada `onStart` (fail-closed, baris 99–103) dan `onEnd` (best-effort via `tryAudit`, baris 105–109).

---

### `src/app/(app)/door-operate/page.js` ⚠ *[UNTRACKED — belum di-commit]*
- **Tipe**: Client Component / Halaman Door Operate ("use client")
- **Fungsi**: Menyajikan antarmuka pengendalian pintu autoclave dari web: tombol Door Sealing, Door Release, Water Drain (toggle), Forward/Backward rantai (hold-to-run dengan pointer capture), Door Unlock (toggle), panel status sensor, dan lampu indikator pintu/seal. Seluruh tombol satu klik langsung tanpa modal dialog konfirmasi atau kolom alasan.
- **Export utama**: `default function DoorOperatePage`
- **Meng-import (internal)**: `src/lib/permissionCatalog.js` (`hasLevel`, baris 4), `src/lib/plcDoorCatalog.js` (`checkDoorCommand`, baris 5), `src/components/PermissionGate.js` (baris 6)
- **Dipakai oleh**: Tidak di-import oleh file mana pun (rute halaman `/door-operate`)
- **Efek samping / dependensi eksternal**: Polling `GET /api/plc-door` tiap 1500 ms (baris 108–114), memanggil `POST /api/plc-door` untuk aksi, memanggil `GET /api/auth/me` untuk izin (baris 97–102), menggunakan `navigator.sendBeacon` sebagai fallback saat tab ditutup/blur (baris 126).
- **Bukti**: `src/app/(app)/door-operate/page.js:1-335`
- **Catatan**: Dilindungi `PermissionGate resource="manual_control" minLevel="view"` (baris 331). Evaluasi hak aksi `canEdit` mendukung jalur ganda di baris 172–173 (`manual_control` edit ATAU `dashboard` edit + `action.batch_control` edit). Tombol Forward/Backward menggunakan `setPointerCapture` agar gesture tidak terputus saat pointer keluar elemen (baris 65). Sinyal "run" deadman dikirim tiap `HOLD_INTERVAL_MS = 250` ms (baris 13). Memasang listener `blur`/`pagehide`/`visibilitychange` untuk `endHold` (baris 133–142).

---

### `context/SiemensS7-200_pintu_NANTI.csv` ⚠ *[UNTRACKED — belum di-commit]*
- **Tipe**: Data Referensi
- **Fungsi**: Mendokumentasikan 6 tag PLC baru untuk fitur Door Operate yang perlu diimpor ke KEPServerEX sebelum fitur dapat digunakan.
- **Export utama**: Tidak ada (berkas teks CSV referensi).
- **Meng-import (internal)**: Tidak ada
- **Dipakai oleh**: Tidak di-import oleh file mana pun (referensi untuk konfigurasi KEPServerEX)
- **Efek samping / dependensi eksternal**: Tidak ada (berkas referensi).
- **Bukti**: `context/SiemensS7-200_pintu_NANTI.csv:1-7`
- **Catatan**: Enam tag: `DOOR_SEAL_CMD` (M1.2, baru), `CHAIN_FWD` (M11.0, baru), `CHAIN_BWD` (M11.1, baru), `CHAIN_FWD_OUT` (Q3.4, baru), `CHAIN_BWD_OUT` (Q3.5, baru), `DOOR_REL_OUT` (Q0.4, baru). Tag `DOOR_RELEASE` (M1.3) dan `DOOR_LOCK` (M6.0) sudah ada di CSV utama. Nama file berakhiran `_NANTI` menandakan belum diimpor.

---

### `fase1/tests/plc_door_mock.mjs` ⚠ *[UNTRACKED — belum di-commit]*
- **Tipe**: Test / Unit Test Mock
- **Fungsi**: Menguji 21 skenario pagar `checkDoorCommand` dan mekanisme deadman `createDoorSafety` tanpa membutuhkan gateway PLC nyata atau database (semua dependency di-inject sebagai mock).
- **Export utama**: Tidak ada (script uji Node.js mandiri).
- **Meng-import (internal)**: `src/lib/plcDoorCatalog.js`, `src/lib/plcDeadman.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun (tidak tercakup dalam `fase1/tests/matrix.mjs`)
- **Efek samping / dependensi eksternal**: Mencetak hasil uji ke stdout.
- **Bukti**: `fase1/tests/plc_door_mock.mjs` (dijalankan, output: "Semua lolos (21 lolos)")
- **Catatan**: Dijalankan secara mandiri dengan `node fase1/tests/plc_door_mock.mjs`. Tidak ada konfigurasi khusus yang dibutuhkan.

---

## Change Log

- [2026-11-02] ADDED: Menambahkan dokumentasi teknis 6 file baru (untracked, fitur Door Operate): `src/lib/plcDoorCatalog.js`, `src/lib/plcDeadman.js`, `src/app/api/plc-door/route.js`, `src/app/(app)/door-operate/page.js`, `context/SiemensS7-200_pintu_NANTI.csv`, `fase1/tests/plc_door_mock.mjs`.
- [2026-11-02] MODIFIED: Memperbarui entri `server.js` (nomor baris bergeser ke 108 baris, tambahkan blok reset rantai M11.0/M11.1 di baris 92–105), `src/app/(app)/page.js` (bergeser ke 1025 baris; perbarui state Door, handler, gating; TEMUAN KRITIS `startAllowed = true` masih ada di baris 501), `src/components/Navbar.js` (bergeser ke 162 baris; menu door-operate di baris 26), `src/lib/recipeGuard.js` (koreksi nilai `START_LOCK_KEY`).
- [2026-10-29] ADDED: Menambahkan dokumentasi teknis 17 file baru di codebase: `migrations/006_add_bottle_count.sql`, `migrations/006_add_bottle_count_rollback.sql`, `src/components/SearchableCombobox.js`, `src/components/SignOffBlock.js`, `src/components/PlcDialog.js`, `src/components/PlcParamEditor.js`, `src/lib/plcAccess.js`, `src/lib/plcClock.js`, `src/lib/plcManualCatalog.js`, `src/lib/plcParamCatalog.js`, `src/app/api/plc-clock/route.js`, `src/app/api/plc-manual/route.js`, `src/app/api/plc-params/route.js`, `src/app/(app)/machine-params/page.js`, `src/app/(app)/calibration/page.js`, `src/app/(app)/plc-clock/page.js`, dan `src/app/(app)/manual/page.js`.
- [2026-10-29] MODIFIED: Memperbarui deskripsi dan antarmuka ekspor/impor pada `src/app/globals.css` (penambahan `.no-scrollbar`), `src/components/Navbar.js` (menu HMI mesin dan perizinan dinamis), `src/components/StartDialog.js` (penambahan `bottleCount`, combobox, layout 2 kolom), `src/app/(app)/page.js` (catatan bypass pengujian `startAllowed = true`), `src/app/(app)/data-report/[batchNo]/page.js` (kolom jumlah botol), `src/app/api/batch/start/route.js` (penanganan `bottle_count` dan fallback 42703), `src/app/api/batch-records/export/route.js` (kolom Jumlah Botol pada Excel/JSON), `src/app/api/batch-records/[batchNo]/route.js` (field `bottleCount`), serta halaman cetak `print/alarm/page.js`, `print/data-report/[batchNo]/page.js`, dan `print/data-report/[batchNo]/curve/page.js` (penambahan `SignOffBlock` dan `Amount`).
- [2026-10-28] ADDED: Menambahkan dokumentasi teknis 16 file baru yang lahir pada Fase 1: `fase1/tests/matrix.mjs`, `migrations/005_drop_legacy_role.sql`, `migrations/005_drop_legacy_role_rollback.sql`, `migrations/backup_271026.sql`, `src/app/(app)/roles/page.js`, `src/app/api/roles/route.js`, `src/app/api/roles/[id]/route.js`, `src/app/api/roles/options/route.js`, `src/app/api/users/[username]/delete/route.js`, `src/components/DeletedUserBadge.js`, `src/components/PermissionGate.js`, `src/lib/operatorLabel.js`, `src/lib/permissionCatalog.js`, `src/lib/roleAdmin.js`, `src/lib/roleQueries.js`, dan `src/lib/userQueries.js`.
- [2026-10-28] MODIFIED: Memperbarui deskripsi dan antarmuka ekspor `src/lib/auth.js` (penghapusan `requireAdmin`, penambahan `requirePermission`/`requireAnyPermission`), handler `src/app/api/batch/stop/route.js` (penghapusan pembacaan body mati), handler `src/app/api/users/route.js` (penugasan `role_id` dan validasi soft-delete), `src/app/api/users/[username]/route.js` (pemisahan fungsi hapus-lunak ke route delete tersendiri), serta skrip `scripts/hash-password.js` (contoh insert menggunakan `role_id`).
- [2026-10-28] REMOVED: Menghapus referensi guard usang `requireAdmin` dari seluruh file route API setelah digantikan penuh oleh `requirePermission`. File harness `fase1/tests/fase1_integration.mjs` diverifikasi telah dihapus dari repositori.
