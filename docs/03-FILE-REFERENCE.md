# Referensi File Teknis (File Reference)

Dokumen ini memuat dokumentasi teknis lengkap dan faktual untuk setiap file dalam proyek `scada-sterilizer` (total 102 file). Seluruh deskripsi, nama fungsi, export, import, dan nomor baris diverifikasi langsung dari kode sumber tanpa praduga atau spekulasi.

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
- **Fungsi**: Membuat server HTTP kustom port 3001, mengintegrasikan Next.js request handler, serta menjalankan background interval 5 detik untuk trend recorder dan pemantau alarm.
- **Export utama**: Tidak ada (script eksekusi Node.js).
- **Meng-import (internal)**: `src/lib/trendRecorder.js`, `src/lib/alarmMonitor.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membuka port jaringan HTTP (`server.js:34`), membaca env `PORT`, `HOSTNAME`, `TRUST_PROXY`, dan menjalankan `setInterval` latar belakang.
- **Bukti**: `server.js:29-57`
- **Catatan**: Menggunakan dynamic import untuk memuat `src/lib/trendRecorder.js` dan `src/lib/alarmMonitor.js`.

---

### `scripts/hash-password.js`
- **Tipe**: Script CLI
- **Fungsi**: Menghasilkan string hash bcrypt dari argumen baris perintah atau input default untuk pendaftaran password pengguna manual di database.
- **Export utama**: Tidak ada (script mandiri CLI).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menulis output string hash password ke konsol stdout terminal.
- **Bukti**: `scripts/hash-password.js:1-17`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

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
- **Tipe**: Util / Autentikasi & Otorisasi
- **Fungsi**: Menyediakan pembuatan token sesi JWT berdurasi 8 jam, verifikasi sesi dari cookies, opsi keamanan cookie, dan middleware guard `requireAuth` serta `requireAdmin`.
- **Export utama**: `createSessionToken`, `verifySessionToken`, `sessionCookieOptions`, `getSessionFromCookies`, `requireAuth`, `requireAdmin` (fungsi)
- **Meng-import (internal)**: `src/lib/db.js`
- **Dipakai oleh**: `src/app/api/audit-log/export/route.js`, `src/app/api/audit-log/filters/route.js`, `src/app/api/audit-log/route.js`, `src/app/api/auth/login/route.js`, `src/app/api/auth/logout/route.js`, `src/app/api/auth/me/route.js`, `src/app/api/auth/unlock/route.js`, `src/app/api/batch/start/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/batch-records/export/route.js`, `src/app/api/formulas/route.js`, `src/app/api/formulas/[formulaNo]/route.js`, `src/app/api/plc/reset/route.js`, `src/app/api/product-specs/route.js`, `src/app/api/product-specs/[id]/route.js`, `src/app/api/products/route.js`, `src/app/api/products/[id]/route.js`, `src/app/api/users/route.js`, `src/app/api/users/[username]/reset-password/route.js`, `src/app/api/users/[username]/route.js`
- **Efek samping / dependensi eksternal**: Membaca variabel lingkungan `JWT_SECRET`, `COOKIE_SECURE`, `NODE_ENV` (`src/lib/auth.js:6-18`). Membaca dan memodifikasi cookies HTTP.
- **Bukti**: `src/lib/auth.js:1-100`
- **Catatan**: Tidak ada TODO/FIXME tertulis.

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
- **Export utama**: `isStartInProgress`, `getRecipeUsage` (fungsi), `START_LOCK_KEY` (konstanta numerik `847291034`)
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
- **Fungsi**: Merender bar navigasi atas aplikasi, indikator status online/offline PLC, jam digital, menu halaman, identitas pengguna aktif, dan tombol logout.
- **Export utama**: `default` Navbar (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/layout.js`
- **Efek samping / dependensi eksternal**: Memanggil API `POST /api/auth/logout` saat tombol Keluar diklik (`src/components/Navbar.js:33`), menjalankan `setInterval` jam digital 1 detik.
- **Bukti**: `src/components/Navbar.js:1-92`
- **Catatan**: Menu Kelola User dan Audit Log hanya dirender jika `user.role === 'admin'` (`src/components/Navbar.js:64`).

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
- **Fungsi**: Menyediakan antarmuka pop-up form input persiapan batch: pemilihan Batch No otomatis/manual, Loading No, Nama Produk, Spesifikasi Kemasan, dan Formula Resep sebelum memicu START ke mesin.
- **Export utama**: `default` StartDialog (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/batchNo.js`, `src/lib/plcCommandAlert.js`
- **Dipakai oleh**: `src/app/(app)/page.js`
- **Efek samping / dependensi eksternal**: Memanggil endpoint API `GET /api/products?active=true`, `GET /api/product-specs?active=true`, `GET /api/formulas`, dan `POST /api/batch/start` (`src/components/StartDialog.js:120-180`).
- **Bukti**: `src/components/StartDialog.js:1-350`
- **Catatan**: Memvalidasi kelengkapan form dan karakter Batch No menggunakan `validateBatchNo`.

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
- **Fungsi**: Mengimpor framework Tailwind CSS v4 dan mendefinisikan variabel palet warna industrial SCADA (slate, water, steam, run, stop, idle).
- **Export utama**: Tidak ada (berkas CSS global).
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: `src/app/(app)/layout.js`, `src/app/layout.js`
- **Efek samping / dependensi eksternal**: Diterapkan ke seluruh elemen DOM antarmuka via root layout.
- **Bukti**: `src/app/globals.css:1-60`
- **Catatan**: Menggunakan direktif `@import 'tailwindcss';` dan `@theme` bawaan Tailwind v4.

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
- **Fungsi**: Merender dashboard pengawasan SCADA utama: polling data sensor PLC real-time setiap 1 detik, diagram interaktif Autoclave, kartu pembacaan 9 sensor suhu, tekanan, status pintu, tombol kontrol proses (START, STOP, Reset), dan panel detail resep berjalan.
- **Export utama**: `default` DashboardPage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/plcCommandAlert.js`, `src/components/AtvDiagram.js`, `src/lib/atvProcess.js`, `src/components/StartDialog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/status` setiap 1000 ms, `POST /api/batch/stop`, dan `POST /api/plc/reset` (`src/app/(app)/page.js:100-250`).
- **Bukti**: `src/app/(app)/page.js:1-862`
- **Catatan**: File antarmuka terbesar (862 baris kode) yang memadukan visualisasi proses dan eksekusi perintah ke mesin.

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
- **Fungsi**: Menampilkan laporan lengkap satu batch sterilisasi: metadata batch, parameter waktu tahapan fase, nilai akumulasi letalitas F0 seluruh sensor, tabel deret waktu trend sensor, dan tombol navigasi cetak laporan.
- **Export utama**: `default` BatchDetailPage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records/[batchNo]` dan membuka tab cetak `/print/data-report/[batchNo]` (`src/app/(app)/data-report/[batchNo]/page.js:35-80`).
- **Bukti**: `src/app/(app)/data-report/[batchNo]/page.js:1-348`
- **Catatan**: Menampilkan peringatan jika kalkulasi F0 dihitung dari data trend yang tidak lengkap (`f0Meta.complete === false`).

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
- **Fungsi**: Memvalidasi parameter resep, memeriksa keunikan Batch No, memeriksa interlock pintu/seal PLC, menulis setpoint ke register PLC, memverifikasi baca-balik setpoint, mengirim pulsa START (M1.4), menunggu fase proses, dan mencatat data ke `batch_records`.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/plc.js`, `src/lib/plcWrite.js`, `src/lib/recipeValidation.js`, `src/lib/batchNo.js`, `src/lib/recipeSnapshot.js`, `src/lib/recipeGuard.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membuka koneksi PostgreSQL advisory lock (`src/app/api/batch/start/route.js:34`), menulis ke REST API PLC (`src/app/api/batch/start/route.js:377`), menjalankan query `INSERT INTO batch_records` (`src/app/api/batch/start/route.js:593`) dan `audit_log`.
- **Bukti**: `src/app/api/batch/start/route.js:1-698`
- **Catatan**: Memastikan proses START dilindungi advisory lock server-side untuk mencegah pemicuan ganda secara simultan.

---

### `src/app/api/batch/stop/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Membaca fase PLC saat ini, mengirim pulsa STOP (M1.5) ke PLC, menghitung F0 akhir, memfinalisasi status batch (finished/aborted), dan mencatat log audit.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/plc.js`, `src/lib/plcWrite.js`, `src/lib/batchFinalize.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mengirim HTTP POST pulsa STOP ke PLC KEPServerEX (`src/app/api/batch/stop/route.js:67`), memanggil `finalizeBatch` untuk mengupdate tabel `batch_records`, dan menulis ke `audit_log`.
- **Bukti**: `src/app/api/batch/stop/route.js:1-139`
- **Catatan**: STOP merupakan tindakan keselamatan: finalisasi batch di database tetap dijalankan meskipun komunikasi pulsa ke PLC mengalami kegagalan (`src/app/api/batch/stop/route.js:59`).

---

### `src/app/api/batch-records/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengembalikan daftar ringkasan catatan batch dari tabel `batch_records` dengan pagination, pencarian teks, filter status, dan filter rentang tanggal.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/dateRange.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query SQL `SELECT COUNT(*)` dan `SELECT ... FROM batch_records` (`src/app/api/batch-records/route.js:50-57`).
- **Bukti**: `src/app/api/batch-records/route.js:1-95`
- **Catatan**: Diurutkan secara descending berdasarkan `COALESCE(run_begin, created_at)`.

---

### `src/app/api/batch-records/export/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengekspor data riwayat batch ke format spreadsheet Excel XLSX atau JSON serta mencatat jejak audit aktivitas ekspor.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/dateRange.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menghasilkan berkas binary spreadsheet menggunakan pustaka `exceljs` (`src/app/api/batch-records/export/route.js:150`) dan mencatat audit ke database (`src/app/api/batch-records/export/route.js:101`).
- **Bukti**: `src/app/api/batch-records/export/route.js:1-233`
- **Catatan**: Mengambil nilai resep dari `recipe_snapshot` sebagai sumber utama, dengan fallback ke resep live untuk batch lama (`src/app/api/batch-records/export/route.js:87`).

---

### `src/app/api/batch-records/[batchNo]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil data lengkap satu record batch beserta seluruh titik data sensor dari tabel `batch_trend` yang diurutkan secara kronologis.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/recipeSnapshot.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query SQL ke tabel `batch_records` dan `batch_trend` (`src/app/api/batch-records/[batchNo]/route.js:20-87`).
- **Bukti**: `src/app/api/batch-records/[batchNo]/route.js:1-121`
- **Catatan**: Menyediakan parameter `recipeSource` ('snapshot' atau 'live') untuk transparansi sumber data resep batch.

---

### `src/app/api/formulas/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pembacaan seluruh daftar formula resep sterilisasi untuk pengguna login, serta penambahan formula baru khusus untuk admin.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/recipeValidation.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query `SELECT ... FROM recipes` dan transaksi `INSERT INTO recipes` serta `INSERT INTO audit_log` (`src/app/api/formulas/route.js:109-150`).
- **Bukti**: `src/app/api/formulas/route.js:1-173`
- **Catatan**: Penambahan formula baru divalidasi dengan `validateRecipe({ strict: true })` sebelum disimpan.

---

### `src/app/api/formulas/[formulaNo]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pengambilan detail, pembaruan parameter, dan penghapusan satu formula resep sterilisasi dengan proteksi advisory lock saat START dan blokir bila resep sedang dipakai batch aktif.
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/recipeValidation.js`, `src/lib/recipeGuard.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Mengeksekusi transaksi query UPDATE atau DELETE pada tabel `recipes` serta mencatat aksi ke tabel `audit_log` (`src/app/api/formulas/[formulaNo]/route.js:151-290`).
- **Bukti**: `src/app/api/formulas/[formulaNo]/route.js:1-326`
- **Catatan**: Menolak penghapusan formula jika resep pernah digunakan oleh batch riwayat mana pun (`src/app/api/formulas/[formulaNo]/route.js:266`).

---

### `src/app/api/plc/reset/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengirim pulsa perintah STOP ke PLC ketika mesin tertahan pada fase Selesai (kode 6) dan tidak ada batch running di database untuk mereset status mesin kembali ke Idle.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`, `src/lib/plc.js`, `src/lib/plcWrite.js`, `src/lib/auditLog.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membaca status PLC via `readPlcSnapshot`, mengirim pulsa STOP melalui `pulsePlcTag('STOP')`, dan mencatat ke `audit_log` (`src/app/api/plc/reset/route.js:97-111`).
- **Bukti**: `src/app/api/plc/reset/route.js:1-159`
- **Catatan**: Ditolak dengan status 409 jika masih ada batch yang berstatus `running` di database.

---

### `src/app/api/products/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil daftar master nama produk dan menangani penambahan nama produk baru oleh administrator.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membuat tabel `product_names` otomatis jika belum ada (`src/app/api/products/route.js:12`), menjalankan `INSERT INTO product_names`, dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/products/route.js:1-131`
- **Catatan**: Mendukung parameter query `?active=true` untuk filter nama produk yang aktif saja.

---

### `src/app/api/products/[id]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pengambilan detail, pengeditan nama, pengubahan status aktif, dan penghapusan data nama produk pada tabel `product_names`.
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query transaksi UPDATE atau DELETE pada tabel `product_names` dan mencatat ke `audit_log` (`src/app/api/products/[id]/route.js:89-160`).
- **Bukti**: `src/app/api/products/[id]/route.js:1-188`
- **Catatan**: Memvalidasi keunikan nama secara case-insensitive sebelum update.

---

### `src/app/api/product-specs/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengambil daftar master spesifikasi kemasan dan menangani penambahan spesifikasi baru oleh administrator.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Membuat tabel `product_specs` otomatis jika belum ada (`src/app/api/product-specs/route.js:12`), menjalankan query `INSERT INTO product_specs`, dan mencatat ke `audit_log`.
- **Bukti**: `src/app/api/product-specs/route.js:1-131`
- **Catatan**: Mendukung parameter query `?active=true` untuk filter spesifikasi yang aktif saja.

---

### `src/app/api/product-specs/[id]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan pengambilan detail, pengeditan teks spesifikasi, pengubahan status aktif, dan penghapusan data spesifikasi pada tabel `product_specs`.
- **Export utama**: `GET`, `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query transaksi UPDATE atau DELETE pada tabel `product_specs` dan mencatat ke `audit_log` (`src/app/api/product-specs/[id]/route.js:89-160`).
- **Bukti**: `src/app/api/product-specs/[id]/route.js:1-188`
- **Catatan**: Memvalidasi keunikan spesifikasi kemasan secara case-insensitive sebelum update.

---

### `src/app/api/status/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Membaca snapshot data sensor dari PLC via REST API KEPServerEX, mengambil informasi batch aktif dari database, dan mengembalikan status teragregasi secara real-time.
- **Export utama**: `GET` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/plc.js`, `src/lib/db.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil `readPlcSnapshot` (HTTP GET ke IoT Gateway) dan menjalankan query `SELECT ... FROM batch_records WHERE status = 'running'` (`src/app/api/status/route.js:14-36`).
- **Bukti**: `src/app/api/status/route.js:1-70`
- **Catatan**: Menyembunyikan detail pesan error database internal dari respons JSON publik.

---

### `src/app/api/users/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menyediakan daftar seluruh akun pengguna tanpa kolom password_hash dan pembuatan akun baru dengan hashing bcrypt khusus untuk admin.
- **Export utama**: `GET`, `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memeriksa role admin via `requireAdmin`, menjalankan query `SELECT/INSERT INTO users`, dan mencatat ke `audit_log` (`src/app/api/users/route.js:27-97`).
- **Bukti**: `src/app/api/users/route.js:1-116`
- **Catatan**: Password baru wajib memiliki panjang minimal 6 karakter (`src/app/api/users/route.js:62`).

---

### `src/app/api/users/[username]/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Menangani pembaruan data pengguna (nama lengkap, role, status aktif) dan penonaktifan akun (soft-delete `is_active = false`) oleh admin.
- **Export utama**: `PUT`, `DELETE` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query UPDATE pada tabel `users` dan mencatat perubahan ke `audit_log` (`src/app/api/users/[username]/route.js:68-135`).
- **Bukti**: `src/app/api/users/[username]/route.js:1-156`
- **Catatan**: Terdapat self-protection: admin dilarang menonaktifkan atau menurunkan role akun dirinya sendiri (`src/app/api/users/[username]/route.js:43`).

---

### `src/app/api/users/[username]/reset-password/route.js`
- **Tipe**: API Route Handler
- **Fungsi**: Mengatur ulang kata sandi akun pengguna oleh admin dengan hashing bcrypt baru dan mencatat aktivitas ke audit log tanpa menyertakan string password.
- **Export utama**: `POST` (fungsi handler HTTP)
- **Meng-import (internal)**: `src/lib/db.js`, `src/lib/auth.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Menjalankan query UPDATE `password_hash` pada tabel `users` dan mencatat aksi ke `audit_log` (`src/app/api/users/[username]/reset-password/route.js:40-59`).
- **Bukti**: `src/app/api/users/[username]/reset-password/route.js:1-67`
- **Catatan**: Panjang password baru minimal 6 karakter.

---

### `src/app/print/alarm/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menampilkan tata letak cetak dokumen log alarm mesin dalam format A4 landscape dengan penomoran halaman dan cap waktu cetak otomatis.
- **Export utama**: `default` PrintAlarmPage (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/alarmEventLabels.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/auth/me`, `GET /api/alarms/print-data`, memodifikasi `document.title`, dan memasang event listener `beforeprint`/`afterprint` (`src/app/print/alarm/page.js:77-96`).
- **Bukti**: `src/app/print/alarm/page.js:1-244`
- **Catatan**: Dibungkus komponen React `Suspense` untuk mengakomodasi hook `useSearchParams`.

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
- **Fungsi**: Menyajikan dokumen cetak terintegrasi 3 bagian: Bagian 1 Data Record proses (A4 portrait), Bagian 2 Temperature Pressure Curve berbasis Recharts (A4 portrait), dan Bagian 3 Log Alarm & Event batch (A4 landscape).
- **Export utama**: `default` PrintDataReport (fungsi komponen React)
- **Meng-import (internal)**: `src/lib/alarmEventLabels.js`
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records/[batchNo]` dan `GET /api/alarms/by-batch/[batchNo]`, memanipulasi CSS injection untuk penomoran halaman independen per bagian (`src/app/print/data-report/[batchNo]/page.js:130-185`).
- **Bukti**: `src/app/print/data-report/[batchNo]/page.js:1-656`
- **Catatan**: Menggunakan CSS named pages (`@page sec-data`, `@page sec-curve`, `@page sec-alarm`) untuk mereset penomoran halaman di setiap bagian.

---

### `src/app/print/data-report/[batchNo]/curve/page.js`
- **Tipe**: Client Component / Halaman Cetak
- **Fungsi**: Menyajikan halaman cetak khusus kurva suhu 9 sensor dan tekanan (kPa) satu halaman penuh dalam orientasi A4 landscape dengan fixed width 940px.
- **Export utama**: `default` PrintCurvePage (fungsi komponen React)
- **Meng-import (internal)**: Tidak ada (hanya library eksternal / Node.js bawaan)
- **Dipakai oleh**: Tidak di-import oleh file mana pun
- **Efek samping / dependensi eksternal**: Memanggil API `GET /api/batch-records/[batchNo]`, memicu dialog browser `window.print()` (`src/app/print/data-report/[batchNo]/curve/page.js:115-194`).
- **Bukti**: `src/app/print/data-report/[batchNo]/curve/page.js:1-315`
- **Catatan**: Grafik Recharts dikonfigurasi tanpa animasi (`isAnimationActive={false}`) agar kurva langsung tampil sempurna saat dicetak (`src/app/print/data-report/[batchNo]/curve/page.js:297`).
