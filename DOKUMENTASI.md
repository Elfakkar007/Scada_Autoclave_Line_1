# Dokumentasi Struktur Proyek SCADA Sterilizer

Dokumen ini berisi penjelasan lengkap mengenai struktur direktori dan fungsi file-file yang ada di dalam proyek **SCADA Super Water Sterilizer**.

Proyek ini dibangun menggunakan **Next.js (App Router)** dan menggunakan struktur standar Next.js untuk pembagian *frontend* (UI) dan *backend* (API).

---

## 📁 Direktori Root Utama

Direktori root berisi file-file konfigurasi level proyek, dependensi, dan *environment variables*.

- **`.env.local`**
  File yang berisi variabel lingkungan lokal (environment variables) seperti konfigurasi host/port database, JWT secret, dan konfigurasi koneksi KEPServerEX IoT Gateway (`IOT_GATEWAY_HOST`, dll). File ini bersifat rahasia dan tidak di-commit ke Git.

- **`package.json` & `package-lock.json`**
  File konfigurasi npm yang mendefinisikan informasi proyek, skrip (seperti `npm run dev`), dan daftar *dependencies* (library) yang digunakan. Library utama di proyek ini meliputi: `next` & `react` (framework utama), `pg` (PostgreSQL client untuk koneksi database), `recharts` (untuk menggambar grafik tren historis), `jose` (penanganan JWT token), dan `bcryptjs` (hashing password).

- **`server.js`**
  *Custom server* Node.js yang dibuat secara khusus untuk menjalankan Next.js. Proyek ini tidak menggunakan `next dev` atau `next start` secara langsung karena membutuhkan **proses background yang persisten**. Melalui file ini, `trendRecorder.js` dijalankan sebagai *background task* dengan interval tertentu agar terus mencatat data *trend* ke database meskipun dashboard (UI) sedang tidak dibuka oleh siapa pun.

- **`next.config.mjs`**
  File konfigurasi utama untuk Next.js.

- **`eslint.config.mjs`**
  File konfigurasi untuk ESLint (linter) guna menjaga standar penulisan kode JavaScript/React.

- **`postcss.config.mjs`**
  Konfigurasi PostCSS yang digunakan oleh framework CSS seperti TailwindCSS.

- **`jsconfig.json`**
  Konfigurasi untuk *path alias* (seperti alias `@/` yang mengarah ke folder `src/`) dan preferensi JavaScript bagi editor (VSCode).

- **`README.md`**
  Dokumentasi bawaan proyek yang menjelaskan cara instalasi dan menjalankan aplikasi.

- **`middleware.js` (berada di dalam `src/`)**
  File middleware dari Next.js. Kemungkinan besar digunakan untuk mengecek token autentikasi (JWT) pada *cookies* dan meredirect user ke halaman `/login` jika belum login, atau melindungi akses ke endpoint `/api`.

- **📁 `public/`**
  Direktori untuk menyimpan aset-aset statis seperti gambar, logo, dan font yang bisa diakses secara publik oleh browser.

- **📁 `scripts/`**
  Kumpulan *script* utilitas atau *helper* yang bisa dijalankan terpisah via Node.js.
  - `hash-password.js`: Script utilitas yang kemungkinan digunakan untuk melakukan *hashing* password user sebelum dimasukkan ke database (misalnya menggunakan bcrypt).

---

## 📁 Direktori `src/` (Source Code)

Folder `src` (Source) berisi seluruh kode utama aplikasi, mencakup rute aplikasi (App Router), komponen UI, dan library pendukung.

### 1. 📁 `src/app/`
Folder utama untuk Next.js 13+ App Router. Setiap folder di dalamnya merepresentasikan struktur URL (routing).

- **`layout.js`**
  Root layout global untuk seluruh halaman. Berisi struktur dasar HTML, tag `<body>`, dan konfigurasi font utama (seperti IBM Plex Sans & IBM Plex Mono).
- **`globals.css`**
  File CSS global yang mengimpor utility dari TailwindCSS dan mendefinisikan styling dasar aplikasi.
- **`favicon.ico`**
  Icon website yang muncul di tab browser.

#### 📁 `src/app/(app)/`
Menggunakan *route group* `(app)`. Folder ini mengelompokkan halaman-halaman yang sudah terlindungi *auth* (dashboard area) dan berbagi layout yang sama tanpa menambahkan `(app)` ke dalam struktur URL (contoh: `/users` bukan `/(app)/users`).
- **`layout.js`**: Layout khusus untuk halaman-halaman dalam dashboard. Biasanya mengimpor komponen `Navbar.js` sebagai navigasi utama.
- **`page.js`**: Halaman utama / Dashboard Monitoring (path URL: `/`). Menampilkan UI P&ID (*Piping and Instrumentation Diagram*), grafik working principle, status valve, dan pembacaan sensor secara *real-time* dengan memanggil `/api/status`.
- Sub-folder halaman lainnya (masing-masing memiliki file `page.js`):
  - **`alarm/`**: Halaman daftar alarm/peringatan.
  - **`audit-log/`**: Halaman catatan audit trail (aktivitas user).
  - **`data-report/`**: Halaman laporan data / *batch record*.
  - **`formula/`**: Halaman manajemen resep/formula proses.
  - **`prepare/`**: Halaman antarmuka untuk persiapan memulai *batch* baru.
  - **`trend/`**: Halaman grafik tren historis data (suhu, tekanan).
  - **`users/`**: Halaman manajemen *user* dan akses.

#### 📁 `src/app/login/`
- **`page.js`**: Halaman antarmuka login. Mengirimkan kredensial user ke `/api/auth` untuk mendapatkan token.

#### 📁 `src/app/api/`
Kumpulan endpoint *backend API* yang dieksekusi di sisi server Node.js. Dipanggil oleh frontend untuk mengambil/mengirim data.
- **`alarms/`**: Endpoint CRUD dan list data alarm.
- **`audit-log/`**: Endpoint untuk mengambil catatan aktivitas (audit).
- **`auth/`**: Endpoint untuk autentikasi (login, logout, verifikasi token/session).
- **`batch/`**: Endpoint untuk memulai (`start`) atau menghentikan (`stop`) sebuah batch/proses.
- **`batch-records/`**: Endpoint untuk mengambil laporan data historis suatu batch.
- **`db-test/`**: Endpoint utilitas untuk memeriksa dan melakukan testing koneksi ke database SQL.
- **`formulas/`**: Endpoint manajemen formula/resep (CRUD).
- **`plc/reset/`**: Endpoint untuk mengirim sinyal reset/stop ke PLC (terutama jika proses selesai/idle).
- **`plc-test/`**: Endpoint khusus yang dibuat untuk testing / *debugging* koneksi membaca data tag secara langsung ke agen KEPServerEX IoT Gateway.
- **`status/`**: Endpoint paling penting yang dipanggil setiap 1 detik oleh dashboard. Endpoint ini menarik data aktual (suhu, tekanan, status mesin) dari PLC via KEPServerEX (atau *mock data*) untuk dikembalikan ke frontend.
- **`users/`**: Endpoint manajemen data pengguna (tambah, edit, hapus user).

---

### 2. 📁 `src/components/`
Berisi komponen-komponen antarmuka React yang *reusable* (bisa digunakan kembali di banyak halaman).
- **`Navbar.js`**: Komponen bilah navigasi utama di bagian atas aplikasi dashboard. Biasanya berisi link ke menu-menu (Trend, Alarm, Report, dll) dan tombol Logout.
- **`StatCard.js`**: Komponen kotak kecil (card) yang digunakan untuk menampilkan indikator atau nilai sensor secara individu (misal: suhu T1, T2) dengan rapi.

---

### 3. 📁 `src/lib/`
Kumpulan kode *library*, utilitas, dan konfigurasi pendukung yang tidak memiliki UI, tapi menunjang kerja sistem.
- **`auth.js`**: Kumpulan fungsi utilitas terkait autentikasi. Biasanya berisi kode untuk memverifikasi password, men-generate JSON Web Token (JWT), atau memverifikasi otorisasi/role pengguna (contoh: cek apakah user punya role 'admin' atau 'operator').
- **`db.js`**: File konfigurasi koneksi ke *database* (misalnya MySQL, PostgreSQL, atau SQL Server). Mengekspor *connection pool* yang akan digunakan oleh endpoint-endpoint di folder `/api/` untuk *query* data.
- **`dummyData.js`**: Kumpulan data simulasi/dummy untuk keperluan *development* dan testing ketika data sebenarnya dari database atau PLC belum tersedia.
- **`plc.js`**: Menangani koneksi pembacaan data (snapshot) langsung dari PLC via KEPServerEX, termasuk fungsi *scaling* untuk mengubah nilai raw sensor menjadi satuan standar (seperti °C dan kPa) dan mendeteksi fase mesin.
- **`plcWrite.js`**: Menangani fungsi untuk menulis tag atau mengirim pulsa perintah (seperti Start/Stop) ke PLC.
- **`trendRecorder.js`**: Script Node.js murni (*background task*) yang mencatat *trend* data (suhu, tekanan, dan F0) ke dalam tabel database secara periodik selama *batch* mesin sedang berjalan (running).
- **`batchFinalize.js`**: Fungsi utilitas yang terpusat untuk memfinalisasi *record batch*, memperbarui status menjadi selesai, serta merekap total waktu, nilai minimum F0, dan status kelulusan sterilisasi.
- **`recipeValidation.js`**: Modul yang bertugas memvalidasi nilai input parameter resep (formula) sebelum disimpan ke dalam database atau sebelum dimulai ke PLC (mencegah input 0 pada field krusial atau suhu yang keluar dari rentang batas aman QA).
