# Ringkasan Proyek & Konfigurasi Teknis

Dokumen ini mendokumentasikan spesifikasi teknis, arsitektur sistem, pustaka dependensi, script eksekusi, serta variabel lingkungan pada proyek `scada-sterilizer` berdasarkan verifikasi langsung pada kode sumber.

---

## 1. Identitas Proyek

- **Nama Aplikasi**: `scada-sterilizer` (`package.json:2`)
- **Versi**: `0.1.0` (`package.json:3`)
- **Tipe Paket**: Private application (`package.json:4`)
- **Arsitektur Router**: Next.js App Router pada direktori `src/app/` (`next.config.mjs:1`, `src/proxy.js:10`)
- **Bahasa**: JavaScript (ES modules dan CommonJS pada file server/scripts) dengan konfigurasi path alias `@/*` mengarah ke `./src/*` (`jsconfig.json:5`)

---

## 2. Tech Stack & Dependensi

Daftar pustaka dan versi yang tercantum pada `package.json`:

### Dependencies Utama (`package.json:11-20`)
- `next`: `16.3.5` — Framework web full-stack React.
- `react`: `19.2.8` — Library antarmuka komponen UI.
- `react-dom`: `19.2.8` — Renderer DOM untuk React.
- `pg`: `^8.23.0` — Driver PostgreSQL client pool (`src/lib/db.js:1`).
- `jose`: `^6.2.12` — Library JSON Web Token (JWT) untuk sesi autentikasi (`src/lib/auth.js:15`).
- `bcryptjs`: `^3.0.3` — Pustaka hashing password akun pengguna (`src/app/api/auth/login/route.js:1`, `scripts/hash-password.js:1`).
- `exceljs`: `^4.4.0` — Generator file spreadsheet `.xlsx` untuk ekspor laporan data (`src/app/api/batch-records/export/route.js:150`, `src/app/api/audit-log/export/route.js:122`).
- `recharts`: `^3.10.1` — Library visualisasi grafik kurva suhu dan tekanan (`src/app/(app)/trend/page.js:14`, `src/app/print/data-report/[batchNo]/page.js:8`, `src/app/print/trend/[batchNo]/page.js:6`).
- `fflate`: `^0.8.3` — Pustaka streaming kompresi ZIP untuk pembuatan dan verifikasi arsip backup data (`src/lib/backupArchive.js:23`, `src/lib/backup.test.mjs:5`).

### DevDependencies (`package.json:22-28`)
- `tailwindcss`: `^4` — Utility CSS framework versi 4 (`src/app/globals.css:1`).
- `@tailwindcss/postcss`: `^4` — Plugin PostCSS untuk Tailwind CSS v4 (`postcss.config.mjs:4`).
- `eslint`: `^9` — Linter JavaScript (`eslint.config.mjs:3`).
- `eslint-config-next`: `16.3.5` — Aturan lint standar Next.js (`eslint.config.mjs:4`).

---

## 3. Script Proyek

Daftar script yang terdaftar pada `package.json:5-10`:

| Script | Perintah | Fungsi Faktual |
| :--- | :--- | :--- |
| `dev` | `node server.js` | Menjalankan server HTTP kustom pada mode pengembangan (`server.js:15`). |
| `build` | `next build` | Mengompilasi aplikasi Next.js untuk produksi. |
| `start` | `NODE_ENV=production node server.js` | Menjalankan server HTTP kustom pada mode produksi (`server.js:15`). |
| `lint` | `eslint` | Menjalankan pemeriksaan kode menggunakan ESLint (`eslint.config.mjs:6`). |

---

## 4. Arsitektur Server Kustom (`server.js`)

Aplikasi dijalankan menggunakan server HTTP berbasis Node.js `http.createServer` (`server.js:46`), bukan melalui `next start` standar. Server ini menjalankan:

1. **Penanganan Permintaan HTTP**: Meneruskan request ke Next.js request handler (`server.js:61`).
2. **Ekstraksi Client IP**: Menyediakan header `x-client-ip` dari alamat koneksi TCP, atau dari entri pertama `x-forwarded-for` bila `TRUST_PROXY=true` (`server.js:53-59`).
3. **Background Worker 1 — Trend Recorder**: Memanggil fungsi `recordTrendTick()` setiap 5000 ms (5 detik) untuk merekam data sensor PLC ke tabel `batch_trend` (`server.js:75-79`). Dimulai 10 detik setelah server siap.
4. **Background Worker 2 — Alarm Monitor**: Memanggil fungsi `startAlarmMonitor()` yang memantau status alarm mesin setiap 1000 ms (1 detik) (`server.js:88-90`).
5. **Background Worker 3 — Backup Scheduler**: Memanggil fungsi `startBackupScheduler()` yang memeriksa jadwal backup data setiap 60 detik (`server.js:92-97`). Nonaktif secara default dan terisolasi dari proses utama.
6. **Blok Reset Rantai**: Saat server start, secara *best-effort* menulis `CHAIN_FWD` / `CHAIN_BWD` = false ke PLC (`server.js:101-111`) untuk memastikan rantai pintu tidak tertinggal menyala dari sesi sebelum server mati.
7. **Proxy Middleware Konvensi Next.js 16**: Menggunakan `src/proxy.js` dengan ekspor fungsi `proxy(request)` untuk memeriksa sesi token JWT pada route yang dilindungi. Verifikasi izin granular per resource/level dilakukan pada server runtime melalui fungsi `requirePermission` / `requireAnyPermission` di masing-masing route handler, serta komponen `PermissionGate` pada sisi klien.

---

## 5. Daftar Variabel Lingkungan (Environment Variables)

Variabel lingkungan yang diakses langsung melalui `process.env.*` pada kode sumber:

| Nama Variabel | Lokasi Pemanggilan | Nilai Default / Catatan Faktual |
| :--- | :--- | :--- |
| `DATABASE_URL` | `src/lib/db.js:14` | [TIDAK TERVERIFIKASI: format URL kredensial PostgreSQL aktual di server produksi]. |
| `JWT_SECRET` | `src/lib/auth.js:19`, `src/proxy.js:5` | Tidak ada fallback string dev (wajib didefinisikan pada environment host). Di-encode langsung via `new TextEncoder().encode(process.env.JWT_SECRET)`. |
| `COOKIE_SECURE` | `src/lib/auth.js:41` | Bernilai `true` hanya bila diset `"true"`. Default bernilai `false` (tidak lagi mengikuti `NODE_ENV` agar akses HTTP lokal mesin pabrik tidak tertolak browser, `src/lib/auth.js:33-41`). |
| `IOT_GATEWAY_PROTOCOL` | `src/lib/plc.js:31`, `src/lib/plcAccess.js:26` | Default `"http"`. |
| `IOT_GATEWAY_HOST` | `src/lib/plc.js:32`, `src/lib/plcAccess.js:27` | Default `"127.0.0.1"` di `plc.js`. Pada `plcAccess.js`, bernilai wajib (fail-closed jika tidak diset). |
| `IOT_GATEWAY_PORT` | `src/lib/plc.js:33`, `src/lib/plcAccess.js:28` | Default `39320` di `plc.js`. Pada `plcAccess.js`, bernilai wajib. |
| `IOT_GATEWAY_USER` | `src/lib/plc.js:34`, `src/lib/plcAccess.js:29` | Default string kosong `""` di `plc.js`. Pada `plcAccess.js`, bernilai wajib untuk autentikasi Basic KEPServerEX. |
| `IOT_GATEWAY_PASS` | `src/lib/plc.js:35`, `src/lib/plcAccess.js:30` | Default string kosong `""` di `plc.js`. [TIDAK TERVERIFIKASI: password gateway pada instalasi fisik]. Wajib pada `plcAccess.js`. |
| `NODE_ENV` | `server.js:15`, `src/lib/plc.js:37` | Menentukan mode eksekusi `"production"` atau `"development"`. |
| `PORT` | `server.js:16` | Nomor port listening HTTP server. Default `3001` (`server.js:16`). |
| `HOSTNAME` | `server.js:17` | Alamat host binding HTTP server. Default `"0.0.0.0"` (`server.js:17`). |
| `TRUST_PROXY` | `server.js:25` | Konfigurasi evaluasi header reverse proxy. Bernilai boolean atau string (`server.js:25`). |
| `BACKUP_DIR` | `src/lib/backupService.js:44` | Direktori root penyimpanan backup data. Default `"backups"` (folder lokal proyek). |

---

## Change Log

- [2026-11-05] ADDED: Menambahkan dependensi `fflate` (`^0.8.3`) pada Seksi 2, Background Worker 3 (Backup Scheduler, `server.js:92-97`) pada Seksi 4, variabel lingkungan `BACKUP_DIR` pada Seksi 5, serta memperbarui nomor baris blok reset rantai di `server.js` (baris 101–111).
- [2026-11-03] MODIFIED: Memperbarui Seksi 2 (`recharts`) dengan menambahkan referensi pemanggilan pada rute cetak kurva mandiri baru `src/app/print/trend/[batchNo]/page.js:6`.
- [2026-11-02] MODIFIED: Memperbarui Seksi 4 (Arsitektur `server.js`) — nomor baris disesuaikan dengan kode aktual (blok `createServer` ada di baris 46, IP di 53–59, trend recorder di 75–79, alarm monitor di 88–90); menambahkan **Blok Reset Rantai** (`server.js:95-105`) yang menulis `CHAIN_FWD`/`CHAIN_BWD` = false saat server start (bagian dari fitur Door Operate baru).
- [2026-10-29] MODIFIED: Memperbarui catatan faktual variabel `JWT_SECRET` (tanpa fallback string dev di `auth.js` dan `proxy.js`), memperbarui lokasi pemanggilan `IOT_GATEWAY_*` yang kini juga diakses oleh pustaka baru `src/lib/plcAccess.js:26-38`, dan mencatat integrasi 4 modul HMI-web (`machine_params`, `calibration`, `plc_clock`, `manual_control`).
- [2026-10-28] MODIFIED: Memperbarui versi pustaka dependensi `package.json` (`pg` ke `^8.23.0`, `jose` ke `^6.2.12`, `recharts` ke `^3.10.1`), baris pemanggilan `JWT_SECRET` (`src/lib/auth.js:19`), perilaku `COOKIE_SECURE` (`src/lib/auth.js:41`), serta menambahkan catatan arsitektur otorisasi granular runtime `requirePermission` dan `PermissionGate`.
