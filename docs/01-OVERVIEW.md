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
- `pg`: `^8.18.0` — Driver PostgreSQL client pool (`src/lib/db.js:1`).
- `jose`: `^6.2.2` — Library JSON Web Token (JWT) untuk sesi autentikasi (`src/lib/auth.js:1`).
- `bcryptjs`: `^3.0.3` — Pustaka hashing password akun pengguna (`src/app/api/auth/login/route.js:1`, `scripts/hash-password.js:1`).
- `exceljs`: `^4.4.0` — Generator file spreadsheet `.xlsx` untuk ekspor laporan data (`src/app/api/batch-records/export/route.js:150`, `src/app/api/audit-log/export/route.js:122`).
- `recharts`: `^3.7.0` — Library visualisasi grafik kurva suhu dan tekanan (`src/app/(app)/trend/page.js:14`, `src/app/print/data-report/[batchNo]/page.js:8`).

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

Aplikasi dijalankan menggunakan server HTTP berbasis Node.js `http.createServer` (`server.js:29`), bukan melalui `next start` standar. Server ini menjalankan:

1. **Penanganan Permintaan HTTP**: Meneruskan request ke Next.js request handler (`server.js:30`).
2. **Ekstraksi Client IP**: Menyediakan header `x-forwarded-for` dan resolusi alamat IP klien berdasarkan variabel lingkungan `TRUST_PROXY` (`server.js:25-27`).
3. **Background Worker 1 — Trend Recorder**: Memanggil fungsi `recordTrendTick()` setiap 5000 ms (5 detik) untuk merekam data sensor PLC ke database tabel `batch_trend` (`server.js:46-48`).
4. **Background Worker 2 — Alarm Monitor**: Memanggil fungsi `startAlarmMonitor()` yang memantau status alarm mesin setiap 1000 ms (1 detik) (`server.js:52-54`).
5. **Proxy Middleware Konvensi Next.js 16**: Menggunakan `src/proxy.js` dengan ekspor fungsi `proxy(request)` untuk memeriksa sesi token JWT pada route yang dilindungi (`src/proxy.js:10-38`).

---

## 5. Daftar Variabel Lingkungan (Environment Variables)

Variabel lingkungan yang diakses langsung melalui `process.env.*` pada kode sumber:

| Nama Variabel | Lokasi Pemanggilan | Nilai Default / Catatan Faktual |
| :--- | :--- | :--- |
| `DATABASE_URL` | `src/lib/db.js:14` | [TIDAK TERVERIFIKASI: format URL kredensial PostgreSQL aktual di server produksi]. |
| `JWT_SECRET` | `src/lib/auth.js:6` | Default fallback: string hardcoded `"dev-jwt-secret-min-32-chars-scada-line1-change-in-prod"` (`src/lib/auth.js:7`). |
| `COOKIE_SECURE` | `src/lib/auth.js:18` | Default bernilai `true` jika `NODE_ENV === "production"`, atau `false` jika bernilai `"false"` (`src/lib/auth.js:18`). |
| `IOT_GATEWAY_PROTOCOL` | `src/lib/plc.js:31` | Default `"http"` (`src/lib/plc.js:31`). |
| `IOT_GATEWAY_HOST` | `src/lib/plc.js:32` | Default `"127.0.0.1"` (`src/lib/plc.js:32`). |
| `IOT_GATEWAY_PORT` | `src/lib/plc.js:33` | Default `39320` (`src/lib/plc.js:33`). |
| `IOT_GATEWAY_USER` | `src/lib/plc.js:34` | Default string kosong `""` (`src/lib/plc.js:34`). Digunakan pada autentikasi Basic KEPServerEX. |
| `IOT_GATEWAY_PASS` | `src/lib/plc.js:35` | Default string kosong `""` (`src/lib/plc.js:35`). [TIDAK TERVERIFIKASI: password gateway pada instalasi fisik]. |
| `NODE_ENV` | `server.js:15`, `src/lib/plc.js:37`, `src/lib/auth.js:18` | Menentukan mode eksekusi `"production"` atau `"development"`. |
| `PORT` | `server.js:16` | Nomor port listening HTTP server. Default `3001` (`server.js:16`). |
| `HOSTNAME` | `server.js:17` | Alamat host binding HTTP server. Default `"0.0.0.0"` (`server.js:17`). |
| `TRUST_PROXY` | `server.js:25` | Konfigurasi evaluasi header reverse proxy. Bernilai boolean atau string (`server.js:25`). |
