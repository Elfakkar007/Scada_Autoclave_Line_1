# Temuan Teknis, Hal Belum Terverifikasi, & Kode Yatim (Open Questions)

Dokumen ini memuat rangkuman faktual seluruh item yang berstatus `[TIDAK TERVERIFIKASI]`, kode mati (dead code), berkas yatim (tidak di-import), dan poin-poin yang memerlukan konfirmasi teknis oleh pengembang atau teknisi otomasi pabrik berdasarkan pemeriksaan langsung pada seluruh kode sumber.

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

Berdasarkan analisis graf dependensi impor (`dep_graph.json`), berkas-berkas berikut tidak di-import oleh berkas kode lain dalam aplikasi:

1. **Aset Gambar Vektor Bawaan Template Next.js (Sudah Dihapus)**:
   - `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`.
   - **Keterangan**: Berkas SVG default template `create-next-app` telah dihapus dari repositori bersama dengan berkas dead code lainnya (`StatCard.js`, `dummyData.js`) untuk meringankan proyek.

2. **Script Utilitas Baris Perintah (CLI)**:
   - `scripts/hash-password.js`
   - **Keterangan**: Berkas script independen yang dieksekusi secara manual via terminal (`node scripts/hash-password.js <password>`) untuk membuat hash kata sandi pengguna baru.

3. **Berkas Pengujian Mandiri Unit Test**:
   - `src/lib/f0.test.mjs`
   - `src/lib/alarmEpisodes.test.mjs`
   - `src/lib/alarmView.test.mjs`
   - `src/lib/plcCommandAlert.test.mjs`
   - **Keterangan**: Berkas script pengujian Node.js yang dijalankan secara mandiri untuk memverifikasi logika modul tanpa di-bundle ke dalam antarmuka web.

---

## 4. Hal yang Perlu Dikonfirmasi oleh Developer / Tim Otomasi

1. **Konfirmasi Skala Pengukuran Konduktivitas & Sensor Level Air**:
   - Perlu konfirmasi dari tim instrumen/otomasi mengenai rentang output sinyal analog transmitter 4-20mA (atau 0-10V) yang masuk ke register VW122 (konduktivitas) dan VW124 (level bejana) agar visualisasi bar level dan angka konduktivitas pada laporan memiliki satuan resmi (misal: µS/cm atau % volume).
2. **Penggantian Nilai Kunci Rahasia JWT di Lingkungan Produksi**:
   - Pada `src/lib/auth.js:7`, terdapat fallback secret string `"dev-jwt-secret-min-32-chars-scada-line1-change-in-prod"`. Perlu dipastikan bahwa variabel `JWT_SECRET` dengan string acak aman telah didefinisikan pada environment host server pabrik.
3. **Pembersihan Aset Bawaan Template**:
   - Berkas aset gambar vektor default pada folder `public/` dapat dihapus jika repositori dipersiapkan untuk perampingan bundle.
