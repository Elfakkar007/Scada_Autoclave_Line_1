# ROADMAP Perbaikan Web SCADA Autoclave (SG-40)

Status proyek: **development**. Semua data di database saat ini adalah data uji coba. Web **belum tersambung ke PLC fisik** (KEPServerEX dijalankan tanpa PLC; dashboard menampilkan "NO DATA" dan itu perilaku yang benar).
Dokumen ini dipakai sebagai konteks untuk sesi AI agent. Isinya: status per item, fakta yang sudah diverifikasi, urutan perbaikan, file yang perlu di-attach, dan kriteria selesai.
Terakhir diperbarui: 12 Oktober 2026 (verifikasi kodebase: item 9, 11a, 17a, 21a/c/e dikonfirmasi sudah di-commit dan aktif di kode; item 21d label PREPARE→IDLE dikonfirmasi masih BELUM). Sebelumnya 9 Oktober 2026 (prioritas baru setelah uji dual-monitoring dengan ODOT; jawaban pemilik atas A1–A13 sudah dicatat; item 19 dibatalkan; hasil pembacaan `export_atv.awl`, `SiemensS7-200.csv`, dan `plc.js` dicatat di bagian 3 dan item 21). Sebelumnya 8 Oktober 2026 (setelah item 10; item 15b dan 15c ditutup lewat pemeriksaan; commit, migrasi, pembersihan data uji, uji pemilik 8c/8d, dan penggantian `alarm.wav` selesai).

Effort: **S** = kurang dari 1 sesi AI, **M** = 1–2 sesi, **L** = beberapa sesi.

---

## 0. Status ringkas

| # | Item | Status |
|---|---|---|
| 1 | Matikan fallback dummy | **SELESAI** (di-commit; NO DATA terverifikasi dengan KEPServerEX hidup tanpa PLC) |
| 2 | Koreksi tag dan alarm per bit | **Kode selesai, verifikasi di mesin menunggu** (di-commit; 9 tag baru sudah diimport ke KEPServerEX; cek Good/nilai 0 saat tersambung, lihat bagian 5) |
| 3 | `UNIQUE(batch_no)` dan poles `batch/start` | **SELESAI** (opsi B: `batch_no` tetap kunci dan unik; checkbox "Run kosongan"; lock anti-klik ganda). `lint` 0 error, `build` lolos, uji manual lolos (duplikat ditolak, run kosongan menyembunyikan field). Commit dan migrasi `item3_migration.sql` **sudah selesai**. Sisa: uji klik ganda dan START sungguhan menunggu mesin tersambung |
| 4 | Rework F0 dan laporan | **SELESAI** (6 Okt 2026; 18 tes F0 lulus, `lint` 0 error dan 14 warning, `build` lolos, migrasi `f0_meta` terpasang). Commit dan migrasi `item4_migration.sql` **sudah selesai**. Sisa: uji dengan batch sungguhan saat mesin tersambung |
| 5 | Sampling 15 detik | BELUM (opsional, default tidak dikerjakan) |
| 6 | Snapshot resep dan integritas resep | **SELESAI** (7 Okt 2026; `build` lolos, `lint` 0 error dan 14 warning, migrasi `recipe_snapshot` terpasang, uji manual skenario edit/hapus/snapshot lolos lewat batch uji SQL). Commit dan migrasi `item6_migration.sql` **sudah selesai**. Sisa: uji START sungguhan (snapshot terisi, `ster_time_min` dari snapshot di fase 5) menunggu mesin tersambung |
| 7 | Integritas audit dan login | **SELESAI** (7 Okt 2026; sudah di-commit; `lint` 0 error dan 14 warning, `build` lolos 31 halaman; uji manual login, batas percobaan, `actor_name`, dropdown login, halaman cetak, logout lolos). Sisa: uji START sungguhan (`plc_setpoints_written` sebelum `start_batch`) saat mesin bebas, lihat bagian 5 butir 7 |
| 8 | Alarm dan popup | **KODE SELESAI** (8 Okt 2026). Diuji pemilik: migrasi terpasang, pemantau berjalan (heartbeat bergeser), `/api/alarms/active`, popup dan banner minimize, tombol STOP tidak tertutup, indikator "Suara belum aktif"; `alarmEpisodes.test.mjs` 8 tes dan `alarmView.test.mjs` 7 tes lulus; `build` lolos. Uji pemilik untuk label/kolom Keterangan halaman Alarm (8c) dan filter tanggal + halaman cetak (8d) **sudah selesai**. Commit, migrasi `item8_migration.sql`, pembersihan data uji/seed, dan penggantian `alarm.wav` **sudah selesai**. Sisa: teks alarm masih **draf**; uji dengan PLC sungguhan (bagian 5 butir 8) |
| 9 | Adopsi proses dari luar web (menggantikan item 9 lama) | **KODE SELESAI & DI-COMMIT** (10 Okt 2026; dikonfirmasi 12 Okt). `adoptRunningProcess()`, `ADOPT_PHASES`, `adoptStreak` terverifikasi ada di `alarmMonitor.js`. Sisa: uji dengan PLC (rencana uji di item 9) |
| 10 | `stuckRisk` dan kegagalan START/STOP di UI | **SELESAI** (8 Okt 2026; `lint` 0 error dan 15 warning (tidak bertambah), `build` lolos 34 halaman, 20 tes `plcCommandAlert` lulus, uji manual pemilik lolos, sudah di-commit). Sisa: uji dengan mesin (bagian 5 butir 9) dan cek dropdown Audit Log untuk `start_batch_critical` |
| 11 | Dashboard: 11a perbaikan kebenaran data (timer, START gating, valve), 11b visual interaktif | **SEBAGIAN — 11a dan 11b SELESAI & DI-COMMIT** (10 Okt 2026; dikonfirmasi 12 Okt). 11a: `startAllowed`, `machineRunningExternal`, `startBlockReason` terverifikasi ada di `page.js`; `bitOrNull` semua valve terverifikasi di `plc.js`; `detectPhase` sudah dihapus (`resolvePhase` menggantikannya). 11b: `AtvDiagram.js`, LIVE/PELAJARI, timer durasi, SOFT WATER via `wtrFill` — aktif. Sisa: label **"PREPARE"→"IDLE" di `atvProcess.js` BELUM** (dikonfirmasi 12 Okt: `STEPS[0]` masih `"PREPARE"`); uji valve dengan mesin |
| 12–14 | Lihat bagian 2 | BELUM |
| 17 | Prepare jadi popup, Mach. ID default SG-40, master produk/spesifikasi | **17a SELESAI & DI-COMMIT** (10 Okt 2026; dikonfirmasi 12 Okt). Halaman `/prepare` dihapus (folder tidak ada di `(app)/`); `StartDialog.js` ada di `src/components/`, di-import di `page.js`. Alur: (1) form isian (batch no, loading, mach. ID default SG-40, produk, formula, run kosongan), (2) konfirmasi akhir sebelum kirim ke PLC. Peringatan `stuckRisk` terintegrasi. 17b master produk **BELUM** |
| 18 | Laporan batch gabungan (data + kurva + alarm dalam satu cetak) | **BELUM** (menggantikan sebagian item 15d) |
| 19 | Mode tulis PLC (`PLC_WRITE_ENABLED`) | **DIBATALKAN** (9 Okt; ditambahkan AI tanpa diminta, pemilik memutuskan tidak perlu) |
| 20 | Rerun batch aborted dengan nomor batch sama | **BELUM** (diputuskan 9 Okt; lihat item 20) |
| 21 | Koreksi `plc.js`, tag KEPServerEX, label fase | **SEBAGIAN — (a)(c)(e) SELESAI & DI-COMMIT** (10 Okt 2026; dikonfirmasi 12 Okt). (a) `resolvePhase()` menggantikan `detectPhase` — VW98 null → `unknown`. (c) `bitOrNull()` untuk semua valve: `steam1`, `steam2`, `steamExhs`, `cooling1`, `cooling2`, `wtrFill`, `wtrDrain`, `wtrPump`. (e) `wtrFill: "WTR_FILL"` di TAG_MAP, `wtrFill: bitOrNull(v.wtrFill)` di valves. (d) Label "PREPARE"→"IDLE" di `atvProcess.js` **BELUM** (dikonfirmasi 12 Okt: `STEPS[0]` masih `"PREPARE"`, `PHASE_CODE_TO_STEP` masih petakan ke `"PREPARE"`; perlu update `STEPS`, `PHASE_CODE_TO_STEP`, `STEP_COLOR`, `PhaseGuide`) |
| 15 | Lain-lain | **SEBAGIAN**: `/api/status` dijaga middleware (diperiksa) dan logout tahan gangguan DB (sudah terpasang) **SELESAI**; sisanya BELUM (lihat item 15) |
| 16 | Bersihkan lint | **Stopgap diterapkan dan di-commit** (lint kini 0 error, 15 warning; lihat item 16). Perbaikan sebenarnya BELUM, lihat item 16 |

Pemeriksaan setelah item 10 (8 Okt 2026): `npm run lint` 0 error dan **15 warning** (sama dengan sebelum item 10; tidak ada warning baru dari file item 10), `npm run build` lolos **34 halaman** (peringatan `middleware` deprecated tetap ada). Sebelumnya, pemeriksaan setelah item 8 (8 Okt 2026, sebelum bagian cetak/8d): `npm run lint` 0 error dan **15 warning** (14 lama + 1 baru di `login/page.js:53`, `window.location.href`, dari perubahan di luar item 8; tidak ada warning dari file item 8), `npm run build` lolos 32 halaman (route baru `/api/alarms/active` terdaftar; `/print/alarm` dan `/api/alarms/print-data` menambah route berikutnya). `node --test` memberi peringatan `MODULE_TYPELESS_PACKAGE_JSON` yang tidak berbahaya; **jangan** menambah `"type": "module"` ke `package.json` (merusak file konfigurasi CommonJS).

**Catatan 10 Okt 2026:** ✅ **SUDAH DI-COMMIT** (dikonfirmasi ulang 12 Okt 2026 dari pembacaan langsung kode). File yang diubah/dibuat: `src/lib/plc.js` (`resolvePhase` menggantikan `detectPhase`; `bitOrNull` untuk semua valve; `wtrFill: "WTR_FILL"` di TAG_MAP), `src/lib/alarmMonitor.js` (adopsi otomatis: `adoptRunningProcess`, `ADOPT_PHASES`, `adoptStreak`), `src/app/(app)/page.js` (`startAllowed`, `machineRunningExternal`, `startBlockReason`, import `StartDialog`), `src/components/StartDialog.js` (modal baru). Halaman `/prepare` dihapus (dikonfirmasi: folder tidak ada). `npm run lint` **0 error, 15 warning**; `npm run build` **sukses**.

Pemeriksaan setelah item 7 (7 Okt 2026, setelah semua perubahan akhir): `npm run lint` 0 error dan 14 warning (jumlah sama seperti sebelum item 7: 10 `set-state-in-effect` termasuk `print/audit-log` dan `print/batch-records`, 1 `exhaustive-deps`, 3 di `Navbar.js`), `npm run build` lolos 31 halaman (Next.js 16.3.5; peringatan `middleware` deprecated tetap ada; route baru `/api/auth/users` terdaftar). Sebelumnya, pemeriksaan setelah item 6 (7 Okt 2026): `npm run build` lolos, `npm run lint` 0 error dan 14 warning (sama seperti sebelumnya). Sebelumnya: `npm run build` lolos (Next.js 16.3.5, Turbopack, 31 halaman). `npm run lint`: 0 error, 14 warning (10 di antaranya `react-hooks/set-state-in-effect` yang diturunkan dari error lewat stopgap, 4 sisanya `exhaustive-deps` dan `Navbar.js`; semuanya sudah ada sebelum item 1 dan 2, lihat item 16). Build setelah item 3: 31 halaman, lolos; muncul peringatan baru bahwa konvensi `middleware` deprecated di Next 16 (lihat item 16). Catatan: perintahnya `npm run build`, bukan `next build` (`next` tidak terpasang global).

### 0A. Prioritas utama (9 Okt 2026)

Latar: uji dual-monitoring (ODOT di PLC, SCADA lama tetap master, web hanya membaca) menunjukkan web **tidak mengikuti proses yang dimulai dari luar**: tidak ada `batch_records` (jadi tidak ada trend, F0, laporan), "Waktu berjalan" tetap `--:--:--`, tombol START web tetap aktif walau mesin sedang berjalan, STOP web nonaktif, dan sebagian valve P&ID tidak cocok dengan SCADA lama.

Prinsip urutan: kerjakan dulu yang **tidak bergantung pada bukti dari mesin** dan yang **membuat uji mesin berikutnya menghasilkan data validasi**. Jangan menambah animasi di atas data valve yang belum benar, dan jangan mengubah alur START/STOP yang sudah dikeraskan (item 3, 6, 7, 10) di sekitar hari uji tanpa perlu.

| Urutan | Item | Isi | Ukuran | Waktu |
|---|---|---|---|---|
| 1 | 9 (adopsi otomatis) + 11a (START gating) | START hanya aktif bila PLC fase 1 dan tidak ada batch; begitu proses dimulai dari luar web, batch EXT dibuat **otomatis dalam 3–5 detik**, STOP aktif, data record berjalan | M | Hari ini |
| 2 | 21 + 11a (valve dan fase) | Label "PREPARE" menjadi "IDLE"; SOFT WATER dihubungkan ke `WTR_FILL` (diverifikasi di mesin); tag tambahan untuk pengamatan; koreksi `plc.js` | S–M | Hari ini (kode); verifikasi di mesin |
| 3 | 17a | Prepare menjadi popup (UI saja), Mach. ID default SG-40, hapus banner dan checkbox risiko diganti konfirmasi | M | Hari ini bila waktu cukup |
| 4 | 18 | Laporan batch gabungan (data, kurva, alarm periode batch) satu tombol | M | Setelah uji mesin |
| 5 | 20 | Rerun batch aborted dengan nomor batch yang sama | S | Setelah uji mesin (menyentuh `batch/start`) |
| 6 | 17b | Master produk dan spesifikasi (tabel + dropdown) | M | Setelah uji mesin |
| 7 | 14 (idle logout) | Idle logout 7 menit, hanya saat mesin idle | S–M | Setelah uji mesin |
| 8 | 11b | Dashboard visual interaktif dan edukatif | L | **KODE SELESAI** (10 Okt: `AtvDiagram`, mode LIVE/PELAJARI, `PhaseGuide`, `PhaseTimeline`, timer durasi, SOFT WATER terhubung ke `wtrFill`); tinggal diverifikasi dengan data valve nyata di mesin |

Catatan 9 Okt (A3): pemilik mengerjakan **sebagian** dashboard dan Prepare dengan AI lain agar siap ditunjukkan ke operator besok. Panel peringatan item 10 dan `plcCommandAlert.js` **sudah terjaga** — terverifikasi masih ada di `page.js`. Catatan 10 Okt: seluruh item urutan 1 (adopsi + START gating) dan sebagian urutan 2 (bitOrNull valve, hapus detectPhase) **sudah dikerjakan** di sesi ini. Belum di-commit — jalankan lint+build dulu.

Sisanya (12–16, Fase 3) mengikuti urutan lama.

---

## 1. Aturan kerja dengan AI agent

**Paket konteks dasar (attach di setiap sesi):**
- `export_atv.awl` (program PLC S7-200)
- `SiemensS7-200.csv` (export tag KEPServerEX **versi terbaru**, 60 tag)
- dump **skema** DB (`web_scada_autoclave_line1`). Format terbaik: SQL polos tanpa data (`pg_dump -s -F p`). Dump format custom (`PGDMP`) tidak bisa dibaca sebagai teks. Jangan kirim dump yang berisi tabel `users` (ada `password_hash`)
- `plc.js` terbaru, `DOKUMENTASI.md` (hanya sebagai petunjuk, isinya banyak tebakan) dan `ROADMAP.md` ini

**Aturan:**
1. Satu item per sesi. Minta agen menulis rencana dan daftar file yang akan diubah sebelum mengedit.
2. Agen harus menjawab "file ini belum saya lihat" daripada menebak.
3. Akhiri setiap item dengan `npm run lint`, `npm run build`, dan satu commit terpisah.
4. Saat upload, beri nama file unik (mis. `api_batch_start_route.js`). File bernama `route.js` saling menimpa.
5. Jangan kirim `.env.local` apa adanya. Ganti nilai rahasia dengan placeholder.
6. Agen **membaca program PLC dan memverifikasi** klaim di dokumen ini sebelum mengandalkannya. Dokumen ini pernah salah (mis. logika `M8.0` pernah tertulis terbalik) dan sudah dikoreksi.
7. Setelah sesi selesai, perbarui bagian 0 (status) dan bagian 1/3 (fakta, pertanyaan terbuka) di dokumen ini.

---

## 2. Roadmap

### Fase 0: sebelum menyambung ke PLC fisik

#### 1. Matikan fallback dummy di produksi (S) — SELESAI
- `plc.js`: saat PLC putus, `readPlcSnapshot()` mengembalikan `plcOk=false` dan semua nilai `null` (valve/pintu/alarm juga `null`, bukan `false`). Dummy hanya aktif bila `ENABLE_DUMMY_PLC=true` **dan** `NODE_ENV` bukan `production`; snapshot dummy bertanda `isDummy: true`.
- Dashboard (`(app)/page.js`): "NO DATA" di semua gauge, valve di P&ID tampil "-", pintu/bypass "NO DATA", banner "PLC tidak terhubung". Tambahan: jika `/api/status` sendiri gagal dijangkau, dashboard juga NO DATA (sebelumnya menampilkan angka basi).
- `trendRecorder.js` sudah aman: tick dilewati bila `!plcOk` dan state idle tidak berubah.

#### 2. Koreksi tag dan alarm per bit (S) — KODE SELESAI
- 51 tag KEPServerEX cocok persis dengan `TAG_MAP` (tanpa selisih/duplikat). `HEAT_TIME` di KEPServerEX sudah `VW600`.
- Dilepas dari pembacaan web: `F0_VAL` (tidak dipakai PLC), `BUZZER` (`M10.6` tidak pernah di-set PLC), dan tag word `ALRM_DOR` (`MW8`), `WARNING_BUZ` (`MW10`), `ALRM_TEMP` (`MW17`). Tag-tag itu boleh tetap ada di KEPServerEX.
- Ditambah 9 tag bit (Read Only) di KEPServerEX: `ALM_M8_0`, `ALM_M8_1`, `ALM_M8_2`, `ALM_M8_3`, `ALM_M8_4`, `ALM_M8_7`, `ALM_M10_1`, `ALM_M10_2`, `ALM_M10_3`.
- `OVER_TEMP` (÷10) dan `SAFETY_PRESS` (tanpa scale) kini ada di `snapshot.limits`, bukan di alarm.
- Bit alarm dibagi dua grup (lihat bagian 3). `snapshot.alarms = { bits, active, readOk, reviewActive, reviewKeys }`. Alias lama (`buzzer`, `warningBuz`, `alrmTemp`, `alrmDor`) sudah dihapus (terbukti tidak dipakai file lain).
- **Sisa:** verifikasi di mesin (bagian 5).

#### 3. `UNIQUE(batch_no)` dan poles `batch/start` (S) — SELESAI
**Keputusan (6 Okt 2026, opsi B):** `batch_no` tetap kunci URL/audit/ekspor dan dibuat **unik global** tanpa membedakan huruf besar/kecil dan spasi ujung (`lower(btrim(batch_no))`). Tes tanpa produk memakai checkbox **"Run kosongan"** di Prepare: server mengisi `KOSONGAN dd.mm.yy` (WIB; akhiran `-2`, `-3` bila sudah ada), Loading `N/A`, Product Name/Spec `-`. Batch `aborted` tetap memakai nomornya (operator memakai akhiran mis. `-R1`). Alternatif yang ditolak: kolom `run_code` + `run_type` + partial index (opsi A; lebih besar, mengubah kunci di URL/audit/ekspor/halaman cetak). Bisa jadi item terpisah bila rerun dengan nomor sama ternyata dibutuhkan.

Yang dikerjakan:
- Migrasi `item3_migration.sql`: cek duplikat (harus 0 baris), lalu `CREATE UNIQUE INDEX batch_records_batch_no_uniq`. Index parsial `one_running_batch` tidak disentuh.
- `batch/start`: validasi format `batch_no` (huruf, angka, spasi, `.`, `_`, `-`; maks 50; modul bersama `src/lib/batchNo.js`), cek duplikat **sebelum** menyentuh PLC, pesan 409 yang jelas, penanganan `23505` pada INSERT sebagai jaring pengaman (respons `critical: true`).
- Lock anti-klik ganda sisi server: PostgreSQL advisory lock (`pg_try_advisory_lock`) di koneksi khusus selama seluruh alur START; request kedua mendapat 409.
- Klien (`prepare`): penjaga `useRef`, tombol tetap nonaktif setelah sukses sampai pindah halaman, checkbox "Run kosongan", umpan balik format `batch_no`.
- Cek seal: sudah benar (`DOOR_SEAL` = `Q0.5`, diverifikasi ke `plc.js` dan `export_atv.awl`); hanya komentar ditambah.
- Dihapus: konstanta `VALID_PLC_INT_MAX` dan TODO `ALRM_PRES` (kPa, tidak di-scale).
- `error.message` tidak lagi dikirim ke klien di 5 tempat: `batch/start`, `status` (`dbError` kini teks generik), `batch-records` (list, `[batchNo]`, `export`). `[batchNo]` mengembalikan 400 untuk URL rusak.
- URL `data-report/[batchNo]`: list dan detail sudah memakai `encodeURIComponent`; karakter berbahaya (`/ ? # %`) dicegah di sumbernya lewat aturan format `batch_no`. Titik tidak di-encode (tidak perlu).
- File: `src/app/api/batch/start/route.js`, `src/app/(app)/prepare/page.js`, `src/lib/batchNo.js` (baru), `src/app/api/status/route.js`, `src/app/api/batch-records/route.js`, `.../[batchNo]/route.js`, `.../export/route.js`, `item3_migration.sql`.
- Selesai bila: batch_no duplikat ditolak dengan pesan jelas dan klik ganda tidak mengirim dua START.
- **Sudah diuji:** `npm run lint` (0 error), `npm run build` (lolos), uji manual: nomor batch yang sudah ada ditolak, checkbox "Run kosongan" menyembunyikan field Batch/Loading/Produk dan menyisakan Mach. ID dan Formula. Di luar itu: lock, penamaan run kosongan, dan unique index diuji pada PostgreSQL 16 lokal.
- ~~Commit terpisah; pastikan `item3_migration.sql` sudah dijalankan di DB yang dipakai~~ → **selesai**.
- **Sisa:** uji klik ganda dan START sungguhan ke PLC saat mesin tersambung.

### Fase 1: sebelum uji dengan produk

#### 4. Rework F0 dan laporan (M) — SELESAI
**Status 6 Okt 2026.** Sudah dikerjakan dan diuji pemilik: `node --test src/lib/f0.test.mjs` 18 tes lulus, `npm run lint` 0 error (14 warning, sama seperti sebelum item 4), `npm run build` lolos 31 halaman, kolom `f0_meta` terkonfirmasi ada di DB:
- `src/lib/f0.js` (baru, fungsi murni): trapesium, T_ref 121,0, z 10, gap > 150 detik tidak diintegrasikan dan dicatat, suhu null/di luar 0–200 °C dilewati dan dicatat, `numeric` pg dikonversi eksplisit, `fo_min` tidak lagi terseret ke 0 oleh sensor null. `batchFinalize.js` memakainya dan menyimpan `f0_meta` (jsonb); kolom `sterilization_result` tidak lagi ditulis.
- PASS/FAIL dihapus dari: halaman detail `data-report/[batchNo]`, API `batch-records` (list dan detail), ekspor Excel/JSON (kolom "Hasil" dibuang, kolom "FOVal Setting" ditambah di samping F0 Min), respons `batch/stop`, audit auto-finalize. Cetak: baris `F0 Min ... FOVal ...`. Halaman daftar `data-report` dan cetak daftar batch (`print/batch-records`): kolom "Hasil" diganti kolom "F0 Min" (daftar) atau dibuang (cetak). `grep sterilizationResult src` kini bersih kecuali komentar di `batchFinalize.js`.
- `FOVAL` opsional (angka positif bebas, tanpa batas atas). `Control Type` dikunci "Time" di validasi (strict), route formulas, dan dropdown. Data baris `Level` yang sudah ada **sengaja dibiarkan** (keputusan pemilik); resep lama tampil sebagai Time dan menjadi Time saat disimpan.
- Migrasi: `item4_migration.sql` (kolom `f0_meta`). **Sudah dijalankan.** Jalankan sebelum memasang kode, kalau tidak finalisasi batch gagal.
- `Total.Time`: sementara Run.Begin→Run.Finish (kode lama), ditandai TODO. Tidak ada backfill: batch lama tetap dengan nilai F0 lama (right-endpoint) dan `f0_meta` NULL.
- ~~Sisa: `FOVAL` di laporan masih dibaca langsung dari resep~~ → **diselesaikan di item 6** (dibaca dari `recipe_snapshot`; batch lama tanpa snapshot memakai resep live).
- Catatan fixture: transkripsi printout 2026/10/3 (66 baris) cocok dengan printout dalam ±0,08 untuk F01–F06, FOM, FOL. FOH hitungan +3,15 (trapesium); dikecualikan dari tes.
- (Spesifikasi awal) Pindahkan rumus ke `src/lib/f0.js` (fungsi murni). Gunakan metode trapesium, T_ref 121,0, z = 10.
- Interval yang melebihi ambang (usul 150 detik) tidak diintegrasikan dan ditandai sebagai gap. Nilai null atau di luar rentang masuk akal dicek eksplisit dan ditandai. Konversi `numeric` dari pg ke angka secara eksplisit.
- Simpan parameter hitung per batch (`f0_meta` jsonb).
- **Hapus vonis PASS/FAIL** dari tampilan dan laporan. Tampilkan `F0 min` berdampingan dengan `FOVAL` tanpa vonis. Batch yang dibatalkan tidak lagi dipaksa jadi "fail" (kolom DB `sterilization_result` dengan check `pass/fail/pending` dibiarkan).
- `FOVAL` menjadi opsional (angka positif bebas). Hapus aturan wajib 1–100 di validasi strict.
- Kunci `Control Type` ke "Time". Bersihkan baris uji yang bernilai "Level" (ada di `recipes` dan batch uji `Test-01`).
- Tes: gunakan printout 2026/10/3 sebagai fixture (toleransi ±0,15 untuk T1–T6, FOM, FOL. FOH dikecualikan sebagai deviasi yang diketahui). Tambahkan tes kasus gap.
- Putuskan definisi `Total.Time` (printout lama 60,0 menit vs Run.Begin→Run.Finish 58,4 menit).
- File: `batchFinalize.js`, `trendRecorder.js`, `recipeValidation.js`, route `formulas`, halaman `formula`, halaman dan cetak `data-report`, ekspor Excel
- Selesai bila: tes fixture lulus dan laporan tidak menampilkan PASS/FAIL.

#### 5. Sampling 15 detik di fase 3–5 (S, opsional, default tidak dikerjakan)
- SCADA lama akurat dengan 60 detik dan tabel laporan harus identik dengan printout lama, jadi default-nya **tidak dikerjakan**. Kalau tetap diinginkan, simpan terpisah atau lakukan down-sample di laporan.
- File: `trendRecorder.js`

#### 6. Snapshot resep dan integritas resep (M) — SELESAI
**Status 7 Okt 2026.** Sudah dikerjakan dan diuji pemilik: `npm run build` lolos, `npm run lint` 0 error (14 warning, sama seperti sebelum item 6), kolom `batch_records.recipe_snapshot` (jsonb) terkonfirmasi ada di DB, uji manual lolos memakai batch uji yang dibuat lewat SQL (tanpa PLC):
- Snapshot dibuat di `batch/start` dari baris `recipes` yang SAMA dengan yang ditulis dan diverifikasi ke PLC (`SELECT *`), disimpan saat INSERT `batch_records`, dan ikut dicatat di audit `start_batch`. Isi (camelCase): `version`, `capturedAt`, `recipeId`, `formulaNo`, `recipeUpdatedAt`, `controlTemp`, `spaceTemp`, `sterilTemp`, `sterilTimeMin`, `alarmPres`, `coolingTemp1`, `coolingTemp2`, `foValSetting` (null bila kosong), `controlType`, `sterilMaterial`. Builder: `src/lib/recipeSnapshot.js` (fungsi murni).
- Kolom `ctrl_type`, `ster_temp`, `cool_temp` memang sudah diisi saat START; dipertahankan untuk header laporan dan kini nilainya diturunkan dari snapshot.
- Route `formulas` (POST) dan `formulas/[formulaNo]` (PUT, DELETE): resep dan audit dalam SATU transaksi; duplikat `formulaNo` ditangkap lewat `23505` (409). `error.message` tidak lagi dikirim ke klien di route ini dan di `batch/stop`.
- PUT dan DELETE ditolak 409 bila resep dipakai batch yang sedang berjalan. DELETE ditolak 409 (pesan ramah) bila resep pernah dipakai batch berstatus apa pun (FK `batch_records_recipe_id_fkey`); `23503` ditangkap sebagai jaring pengaman. Edit resep yang hanya dipakai batch selesai/dibatalkan tetap boleh karena nilainya ada di snapshot.
- PUT dan DELETE juga ditolak selama alur START berjalan (advisory lock bersama pada kunci START yang sama; `src/lib/recipeGuard.js`). Alasan: START membaca resep di awal tetapi baru INSERT batch belasan detik kemudian; tanpa ini resep yang dihapus di jendela itu membuat INSERT gagal (FK) padahal PLC sudah jalan. Efek samping: START yang kebetulan masuk persis saat transaksi edit/hapus mendapat 409 "START lain sedang diproses" selama beberapa milidetik.
- `trendRecorder.js`: `ster_time_min` di fase 5/7/6 diambil dari snapshot; fallback ke `recipes` hanya bila snapshot NULL (batch yang sedang berjalan saat item 6 dipasang).
- Pembaca nilai resep lain dipindah ke snapshot: `batch-records/[batchNo]` (`foValSetting`, plus `recipeSnapshot` dan `recipeSource`: `"snapshot"` | `"live"`) dan `batch-records/export` (kolom FOVal; memakai `CASE`, bukan `COALESCE`, supaya snapshot yang kosong tidak terisi dari resep yang baru diberi nilai). `batch/stop`: join ke `recipes` dibuang (tidak dipakai). `batchFinalize.js` tidak perlu diubah (sejak item 4 tidak membaca `recipes`). `status` tidak diubah (hanya membaca `formula_no`, yang tidak bisa berubah).
- Migrasi: `item6_migration.sql` (kolom `recipe_snapshot`). **Sudah dijalankan.** Jalankan sebelum memasang kode. Tidak ada backfill: batch lama (snapshot NULL) tetap dibaca dari resep live dan ditandai `recipeSource: "live"`.
- File: `src/lib/recipeSnapshot.js` (baru), `src/lib/recipeGuard.js` (baru), `src/lib/trendRecorder.js`, `src/app/api/batch/start/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/formulas/route.js`, `src/app/api/formulas/[formulaNo]/route.js`, `src/app/api/batch-records/[batchNo]/route.js`, `src/app/api/batch-records/export/route.js`, `item6_migration.sql`.
- Sisa (butuh mesin): START sungguhan harus mengisi `recipe_snapshot` (`SELECT recipe_snapshot FROM batch_records ORDER BY id DESC LIMIT 1`); `ster_time_min` batch selesai harus sama dengan nilai snapshot; START saat PLC tersambung belum teruji (sama seperti item 3).
- Selesai bila: mengedit resep tidak mengubah batch yang sudah berjalan atau selesai. (Terpenuhi.)

#### 7. Integritas audit dan login (M) — SELESAI (sisa: uji START sungguhan saat mesin bebas)
**Status 7 Okt 2026.** Keputusan pemilik: web selalu berjalan di **satu PC lokal** yang tersambung ke PLC, jadi **deteksi IP/user agent tidak dipakai** (sempat dibuat, ternyata `x-client-ip` tidak sampai ke route dan selalu `unknown`, lalu dihapus). Kolom `audit_log.ip_address` dan `user_agent` tetap ada di skema tetapi tidak diisi. **Koreksi 8 Okt 2026:** `server.js` terbaru milik pemilik **masih memuat blok `x-client-ip` / `TRUST_PROXY`** dari percobaan IP itu (roadmap sebelumnya keliru mencatat "tidak diubah"). Menurut temuan di atas header itu tidak sampai ke route, jadi blok tersebut tidak dipakai dan tidak berbahaya; boleh dihapus di commit terpisah (pertanyaan terbuka #14). Item 8 menambah dua baris di `server.js` tanpa menyentuh blok itu.

Yang dikerjakan:
- **Audit sebelum aksi PLC.** `batch/start`: `plc_setpoints_written` (nilai ditulis, nilai baca-balik, snapshot resep; `entity_id` = `batch_no`) ditulis setelah verifikasi setpoint dan **sebelum** pulsa START; bila audit gagal, START **tidak dikirim** (fail-closed; setpoint yang sudah tertulis tanpa START tidak berbahaya). `batch/stop`: `stop_requested`; `plc/reset`: `plc_reset_requested`; keduanya ditulis sebelum pulsa dan bila audit gagal, STOP/reset **tetap dikirim** (tindakan keselamatan tidak boleh diblokir database). Helper bersama: `src/lib/auditLog.js` (`insertAudit` melempar error, `tryAudit` tidak).
- **Login.** `login_failed` dicatat (alasan sebenarnya `wrong_password` / `unknown_or_inactive_user` hanya di audit; klien selalu menerima pesan generik). Batas **5 gagal per username dalam 15 menit**, dihitung dari `audit_log`, direset oleh login berhasil; di atas batas: HTTP 429 + `Retry-After`, dicatat satu baris `login_blocked` per username per jendela. Percobaan yang ditolak tidak memperpanjang blokir. bcrypt async, hash palsu untuk menyamakan waktu respons, validasi tipe/panjang input (sebelumnya username non-string menyebabkan 500).
- **Cookie `secure`** kini ditentukan env `COOKIE_SECURE` (bukan `NODE_ENV`); default `false` agar login lewat `http://IP-lokal` berhasil. Helper: `sessionCookieOptions()` di `src/lib/auth.js`.
- **Nama lengkap aktor.** Kolom `audit_log.actor_name` diisi **trigger BEFORE INSERT** dari `users.full_name`, jadi semua route yang menulis audit ikut terisi tanpa diubah. Nilainya snapshot saat kejadian. Baris lama diisi sekali oleh migrasi (57 baris pada DB uji). Ditampilkan di halaman Audit Log (nama tebal + username kecil), pencarian, ekspor Excel (kolom Nama dan Username), dan halaman cetak.
- **Login dropdown.** Endpoint publik `GET /api/auth/users` (hanya `username` dan `fullName` user aktif) dipakai dropdown di halaman login; didaftarkan di `PUBLIC_API_PATHS` pada `middleware.js`.
- `error.message` tidak lagi dikirim ke klien di `plc/reset`, `audit-log` (list) dan `audit-log/export`.
- Aksi audit baru: `plc_setpoints_written`, `stop_requested`, `plc_reset_requested`, `login_failed`, `login_blocked`. Dropdown filter Audit Log memuatnya otomatis.
- File: `src/lib/auditLog.js` (baru), `src/lib/auth.js`, `src/middleware.js`, `src/app/api/auth/login/route.js`, `src/app/api/auth/users/route.js` (baru), `src/app/api/batch/start/route.js`, `.../batch/stop/route.js`, `.../plc/reset/route.js`, `.../audit-log/route.js`, `.../audit-log/export/route.js`, `src/app/(app)/audit-log/page.js`, `src/app/print/audit-log/page.js`, `src/app/login/page.js`, `item7b_migration.sql`. (`item7_migration.sql`, index IP, sudah tidak dipakai; indexnya dibuang oleh 7b.)
- **Halaman cetak Audit Log** (`print/audit-log`), tambahan di luar rencana awal: kolom Nama dan Username; nama file PDF otomatis dari judul halaman, berformat `Log Senin, 02 Mei 2077` (satu hari), `Log 02052077 - 02062077` (rentang ddmmyyyy), `Log Semua Data` (tanpa filter), **ditambah `(dicetak dd-mm-yyyy hh.mm.ss)` WIB** saat cetak (tombol Cetak atau Ctrl+P, via event `beforeprint`) supaya file tidak saling menimpa; footer di setiap halaman: kiri `<label> | Dicetak oleh <nama> pada <waktu>`, kanan `Halaman X dari Y` (CSS margin box `@page`, butuh Chrome/Brave 131+; cadangan: centang "Headers and footers" di dialog cetak). Tombol **Kembali** menutup tab cetak dan memfokuskan tab Audit Log asli (halaman Audit Log membuka cetak lewat `window.open` **tanpa** `noopener` agar ini bisa jalan); cadangan bila tab tidak bisa ditutup: pindah ke `/audit-log` di tab yang sama.
- Migrasi: `item7b_migration.sql` (buang index IP, kolom `actor_name`, trigger, isi baris lama). Aman dijalankan berulang.
- Env baru: `COOKIE_SECURE` (`true` hanya bila diakses lewat HTTPS). `TRUST_PROXY` **tidak dipakai**.
- **Sudah diuji (pemilik, 7 Okt 2026):** salah password 5 kali memblokir percobaan berikutnya dengan pesan jelas dan hanya satu baris `login_blocked`; `login_failed`, `login_blocked`, `logout` muncul di halaman Audit Log; migrasi 7b terpasang tanpa error (trigger dibuat, 57 baris lama terisi); `actor_name` terisi pada baris baru; dropdown login dan halaman cetak (kolom Nama/Username, nomor halaman, nama file, tombol Kembali) berfungsi; `lint` 0 error dan 14 warning, `build` lolos 31 halaman; login lewat `http://IP-lokal` diuji pemilik.
- **Route logout (`auth/logout/route.js`) ditinjau:** tidak perlu memakai `sessionCookieOptions()`. Penghapusan cookie (`cookieStore.delete`) tidak bergantung pada atribut `secure`, jadi aman untuk HTTP LAN maupun HTTPS. Audit `logout` otomatis memperoleh `actor_name` dari trigger. Satu kelemahan kecil dicatat di item 15 (logout gagal bila penulisan audit gagal).
- **Sisa (butuh mesin):** uji START sungguhan: `plc_setpoints_written` harus muncul di Audit Log **sebelum** `start_batch`, berisi nilai tulis dan baca-balik yang sama dengan resep; STOP dari web meninggalkan `stop_requested` sebelum `stop_batch` (bagian 5 butir 7). Perubahan item 7 sudah di-commit.
- Catatan desain: siapa pun di PC itu bisa mengunci satu username maksimal 15 menit (hanya login baru; sesi yang sudah login dan tombol STOP fisik tidak terpengaruh). Hitungan percobaan tidak memakai lock, jadi login paralel bisa melewati batas satu-dua percobaan. `/api/auth/users` terbuka tanpa login; hapus atau lindungi bila web suatu hari dibuka ke jaringan pabrik.
- Selesai bila: setiap START, STOP, reset, dan login gagal meninggalkan jejak audit sebelum/saat kejadian, login dibatasi, dan login lewat HTTP LAN berfungsi. (Terpenuhi; sisa hanya uji START sungguhan.)

#### 8. Alarm dan popup (L) — KODE SELESAI (uji dengan mesin menunggu)
**Status 8 Okt 2026.** Dikerjakan dalam empat bagian: 8a backend, 8b popup, 8c halaman Alarm, 8d filter tanggal dan cetak.

**Keputusan desain**
- Sumber alarm: **bit PLC grup fault** (`M8.0`, `M8.1`, `M8.2`, `M10.2`, `M10.3`). Bit grup review **tidak** memicu popup dan tidak ditulis ke `alarm_log`. `M10.0`/`M10.4` tidak dibaca (buzzer pemberitahuan menit ke-5, terkonfirmasi pengamatan mesin).
- Web hanya pendamping; buzzer dan interlock PLC tetap pengaman utama. Alarm **dicatat juga saat tidak ada batch** (`batch_no` NULL).
- Model log mengikuti layar ALARM MESSAGE SCADA lama dan `alarm_log` **append-only (tanpa UPDATE)**: dua baris per episode, diikat `episode_id`. `alarm_active` (`alarm_date` = onset, `event_date` kosong) dan `alarm_recovery` (`alarm_date` sama, `event_date` = waktu pulih). Event lain: `server_start`, `monitor_gap`, `communication_abnormal`, `communication_normal`.
- Popup berupa **panel di dalam alur layout, bukan overlay**, supaya tidak pernah menutupi tombol STOP (STOP ada di panel kanan `page.js`, bukan di `Navbar`).

**8a Backend**
- `src/lib/alarmMonitor.js`: dijalankan `server.js` tiap **1 detik**, terpisah dari `trendRecorder` (5 detik); berjalan walau dashboard tidak dibuka. Logika deteksi ada di `src/lib/alarmEpisodes.js` (fungsi murni): satu episode dibuka saat bit pertama ON dan ditutup bila bit mati terus **10 detik** (`RECOVERY_DEBOUNCE_MS`); denyut 120 detik dengan jeda satu scan tetap satu episode. Bit tidak terbaca (null) tidak membuka/menutup apa pun. Data dummy (`isDummy`) tidak dicatat.
- `alarm_value`/`limit_value`: `m8_0` = tekanan P1 (kPa) dan `SAFETY_PRESS`; `m10_2` = suhu terendah T1–T6/TM dan `STER_SET`; `m10_3` = suhu tertinggi dan `OVER_TEMP`; sensor null tidak dihitung 0 °C. Bit murni (`m8_1`, `m8_2`): 1 / 1, pemulihan 0.
- `src/lib/alarmCatalog.js`: tag, jenis nilai, judul, penyebab, tindakan. **Semua `confirmed: false` (DRAF)** sampai teknisi/QA mengoreksi; popup menampilkan catatan "Teks draf".
- Restart server: episode terbuka di DB dilanjutkan bila bitnya masih ON, atau ditutup dengan keterangan "pemulihan tidak teramati".
- **PC/server mati atau PLC putus:** bit PLC hanya denyut, jadi alarm yang terjadi saat web mati **tidak bisa dipulihkan** (SCADA lama punya batas sama). Web mengakuinya: heartbeat tiap 10 detik di `monitor_heartbeat`; saat start dengan celah >= 30 detik dicatat `monitor_gap` ("Alarm pada rentang ini TIDAK terekam"). `server_start` dicatat tiap start (setiap restart saat development menambah satu baris). PLC putus >= 5 detik dicatat `communication_abnormal` satu kali (tidak berulang lintas restart); pulih = `communication_normal`.
- **Sumber kebenaran popup = DB.** Route handler Next dan `alarmMonitor` (dimuat `server.js`) adalah instance modul berbeda, jadi `GET /api/alarms/active` membaca `alarm_log` (episode tanpa pemulihan) dan umur heartbeat.

**8b Popup**
- `src/components/AlarmCenter.js` di `src/app/(app)/layout.js` (hanya grup `(app)`: bukan `/login`, bukan `/print/*`). Polling 1 detik. Alarm baru: panel merah terbuka (judul, tag, jam mulai, batch, nilai, penyebab, tindakan) dan bunyi diputar berulang; **tidak ada tombol tutup** selama alarm aktif. **Minimize:** banner merah permanen dan bunyi berhenti; klik banner membuka detail tanpa bunyi; episode baru membuka panel dan membunyikan lagi. Panel hilang sendiri saat semua pulih (pemulihan terdeteksi >= 10 detik setelah bit mati).
- Bunyi: `public/sounds/alarm.wav` (**sudah diganti dengan file suara sebenarnya**, nama sama). Browser memblokir bunyi sebelum ada interaksi, jadi muncul "Suara belum aktif. Klik di mana saja." Banner abu-abu bila status alarm gagal dimuat 3 kali berturut-turut; banner oranye bila heartbeat > 30 detik (pemantau mati).
- Logika tampilan di `src/lib/alarmView.js` (murni, dites). Tab browser yang tersembunyi lama dapat diperlambat browser (hingga sekitar 1 menit); biarkan tab dashboard terlihat di PC SCADA.

**8c Halaman Alarm**
- Label event ramah dan warna (alarm merah, pulih hijau, terputus/komunikasi putus oranye) lewat `src/lib/alarmEventLabels.js`; nilai mentah tetap untuk filter. Kolom **Keterangan** (`description`), pencarian ikut `description`, tombol Muat ulang.
- `GET /api/alarms`: mengirim `description`; `limit`/`offset` non-angka tidak lagi 500; `error.message` tidak dikirim ke klien.

**8d Filter tanggal dan cetak**
- Filter Dari/Sampai (+ Hari ini, 7 hari, 30 hari, Reset) memakai kolom turunan `log_time = COALESCE(alarm_date, event_date)` (baris pulih ikut tanggal onset-nya). Pembangun filter bersama: `src/lib/alarmQuery.js`, dipakai tabel dan cetak sehingga selalu identik (diuji: penomoran `$n` dan kesamaan SQL).
- Tombol **Cetak / PDF** membuka `/print/alarm` di tab baru (tanpa `noopener`), meniru `print/audit-log`: A4 landscape, nama file PDF `Log Alarm ...` + `(dicetak dd-mm-yyyy hh.mm.ss)`, footer `Halaman X dari Y`, tombol Kembali menutup tab. Data dari `GET /api/alarms/print-data` (maksimum 50.000 baris, 413 bila lebih). Halaman cetak tidak menambah warning lint baru (waktu cetak diisi dari callback fetch).
- **Belum ada:** Export Excel (bisa meniru `audit-log/export`), dan pencatatan cetak alarm ke `audit_log` (butuh melihat `auth.js` dan `auditLog.js`).
- `src/lib/dateRange.js` (`buildDateRangeFilter`) hanya dilihat dari cara pemanggilannya di route audit-log; filter alarm memanggilnya dengan pola yang sama dan kolom polos `log_time`.

**Migrasi:** `item8_migration.sql` (aman diulang): kolom `alarm_log.episode_id uuid`, `alarm_key`, `batch_no`, `phase_code`, `description`; indeks `alarm_log_episode_idx` dan `alarm_log_active_idx`; tabel `monitor_heartbeat` (satu baris).
**Perubahan `server.js`:** `await import("./src/lib/alarmMonitor.js")` dan `startAlarmMonitor()` di dalam `setTimeout` 10 detik (blok `x-client-ip` tidak diubah).
**File:** `item8_migration.sql`; `src/lib/{alarmMonitor,alarmEpisodes,alarmCatalog,alarmView,alarmQuery,alarmEventLabels}.js`; `src/lib/{alarmEpisodes,alarmView}.test.mjs`; `src/components/AlarmCenter.js`; `src/app/(app)/layout.js`; `src/app/(app)/alarm/page.js`; `src/app/print/alarm/page.js`; `src/app/api/alarms/{route,active/route,print-data/route}.js`; `public/sounds/alarm.wav`; `server.js`. `plc.js`, `trendRecorder.js`, `Navbar.js`, `page.js` **tidak diubah**.
**Sudah selesai (8 Okt 2026):** (1) commit terpisah setelah `lint` dan `build`; (2) baris uji `alarm_active` (`alarm_key='m10_2' AND alarm_value='118.0'`) dan data seed 23/9 sudah dihapus; (5) uji pemilik untuk 8c dan 8d lolos; migrasi `item8_migration.sql` terpasang; `alarm.wav` sudah diganti.
**Sisa:** (3) teknisi/QA mengoreksi teks di `alarmCatalog.js` lalu set `confirmed: true`; (4) uji dengan PLC sungguhan (bagian 5 butir 8)
**Catatan desain:** bila PLC putus saat alarm aktif, popup tetap tampil (pemulihan tidak bisa dikonfirmasi) sampai PLC kembali. Alarm tekanan tinggi/rendah **tidak ada** di PLC; bila QA menginginkannya, itu alarm buatan web dengan ambang dari QA (pertanyaan terbuka #12).
- Selesai bila: setiap bit fault yang menyala di mesin tercatat sebagai satu episode (alarm + pulih), popup tampil dan berbunyi tanpa menutupi STOP, dan celah pemantauan terlihat di log. (Kode terpenuhi; verifikasi dengan mesin menunggu.)

#### 9. Adopsi proses dari luar web (L) — PRIORITAS UTAMA, DRAFT 9 Okt 2026
Menggantikan item 9 lama (hanya peringatan). Catatan item 8 tetap: `alarmMonitor` sudah mencatat alarm dan menampilkan popup saat **tidak ada batch** (`batch_no` NULL).

**Latar dan keputusan pemilik.** Uji dual-monitoring 9 Okt: bila SCADA lama atau panel yang START, web tidak membuat batch. Pemilik memutuskan: **siapa pun yang memulai proses, web harus ikut merekam semuanya (termasuk `batch_records`, trend, F0, alarm) dan bisa STOP.** Ketentuan lama "proses dari panel tidak membuat `batch_records`" tidak berlaku lagi untuk target ini. Penyebab di kode: dashboard memakai `data.running` (dari batch DB) untuk timer, STOP, dan banner; `trendRecorder.js` langsung `return` bila tidak ada batch `running`.

**Keputusan pemilik 9 Okt (jawaban A4, A5, A8):** adopsi **otomatis** dengan **jeda 3–5 detik** (tidak boleh lama): begitu operator menekan START di SCADA lama (atau panel), web langsung ikut running, tombol STOP aktif, dan data record berjalan; **tidak ada tombol manual**. Batch hasil adopsi **tidak diberi penandaan khusus** (tidak ada label "bukan produksi"). Nomor batch asli disimpan di **kolom terpisah** `external_batch_no` (opsional, belakangan); `batch_no` tetap otomatis. Nomor batch, produk, dan keterangan (mis. "Kosongan") di SCADA lama kemungkinan besar **tidak terbaca**: itu diketik di aplikasi SCADA lama, bukan di PLC (cek `export_atv.awl` dan CSV untuk memastikan; pertanyaan #17). Karena itu batch adopsi bernama otomatis.

**Aturan perilaku.**
1. START di web hanya aktif bila `plcOk` dan fase PLC = 1 dan tidak ada batch `running` (diberi alasan tertulis bila nonaktif). Tidak bergantung pada adopsi.
2. STOP di web aktif selama ada batch `running`, termasuk batch hasil adopsi.
3. Proses fase 2/3/4/5/7 tanpa batch **diadopsi otomatis**; dashboard cukup menampilkan info "Proses dimulai dari luar web, direkam sebagai batch EXT ...".

**Tahap (sederhana, tanpa over-engineering).**
- **Adopsi otomatis (hari ini, M):** di `trendRecorder.js` (cabang yang saat ini `return` bila tidak ada batch `running`): bila PLC online, fase 2/3/4/5/7, tidak ada batch `running`, dan kondisi **stabil 3 pembacaan berturut-turut dengan jeda 1 detik (±3 detik)**. Dipasang pada loop 1 detik (pemantau alarm), **bukan** tick 5 detik `trendRecorder`, karena tick 5 detik tidak bisa memberi jeda sependek itu. Kode fase `VW98` adalah variabel deterministik PLC (bukan sinyal berisik) dan fase 2 berlangsung lama, jadi 3 detik cukup aman, panggil satu helper `adoptRunningProcess()` yang: (a) mengambil `pg_try_advisory_lock` yang **sama dengan START** dan melewati tick bila lock dipegang (agar fase 2–4 milik START web tidak terbaca sebagai proses luar, yang akan membuat INSERT batch START gagal lewat `one_running_batch` dan memunculkan `critical` palsu); (b) INSERT `batch_records` (`status=running`, `batch_no` otomatis `EXT dd.mm.yy HH.mm` dengan akhiran `-2` bila bentrok, operator = penanda sistem karena tidak ada sesi); (c) `recipe_snapshot` dibangun dari setpoint yang dibaca balik dari PLC (`formulaNo: null`, `source: "plc_readback"`, Control Type Time); (d) audit `batch_adopted` (actor sistem). Perekaman trend, peristiwa fase, 2 baris setelah fase 6, dan auto-finalize memakai jalur yang sudah ada. Fase 6 tanpa batch **tidak** diadopsi (proses sudah selesai; Reset yang ada tetap berlaku).
- **Lanjutan (belakangan, bukan hari ini):** migrasi kolom `source`, `adopted_at`, `adopted_phase`, `external_batch_no`; form opsional untuk mengisi `external_batch_no`, Loading No, Produk, Spesifikasi; tag "EXT" dan catatan "direkam sejak fase X jam Y; data sebelumnya tidak ada" di Data Report dan cetak; `f0_meta` diisi `adoptedAtPhase`/`dataStartAt`. `batch_no` **tidak diganti** (kunci URL/audit/ekspor, `audit_log` append-only).
- Catatan skema: nullability `recipe_id`, `operator`, `loading_no`, `product_name` belum dipastikan; periksa dump sebelum migrasi. Versi hari ini sebaiknya tidak butuh migrasi bila kolom yang ada cukup (kolom `source` dan sejenisnya baru dibutuhkan di tahap lanjutan).

**Risiko.** (1) Data sebelum adopsi tidak ada (web telat atau mati; sama dengan batas `monitor_gap` item 8). (2) Jalur tulis dari web: pemilik sudah mencoba STOP dari web (saat dual-monitoring) dan START/STOP penuh dari web (9 Okt), tetapi hasilnya belum dicatat (pertanyaan #22). (3) Dua master (web dan SCADA lama) bersamaan: STOP berupa pulsa, aman secara logika tetapi belum teruji. (4) Perekaman dimulai ±3–5 detik setelah SCADA lama START (jeda stabilisasi); data sebelum itu tidak ada, dampaknya kecil pada F0 karena kontribusi suhu rendah sangat kecil. (5) Web restart di tengah proses: bila batch `running` masih ada di DB perekaman lanjut; bila tidak, proses diadopsi sebagai batch EXT baru.

**Rencana uji (setup ODOT).** (1) START dari SCADA lama: dalam ±3–5 detik batch EXT muncul otomatis, timer berjalan, trend tercatat, STOP web aktif. (2) Bandingkan trend dan F0 web dengan printout SCADA lama; ini sekaligus uji F0 sungguhan (item 4) dan petunjuk untuk FOH (#1). (3) Restart web di tengah proses: batch lanjut, celah tercatat. (4) STOP dari SCADA lama: web menutup batch otomatis setelah PLC idle ≥ 120 detik. (5) Uji tulis STOP dari web hanya pada run kosongan dengan orang di tombol STOP fisik.

**File.** Dump skema DB (tanpa `users`), `trendRecorder.js`, `plc.js`, `batchFinalize.js`, `recipeSnapshot.js`, `recipeGuard.js`, `alarmMonitor.js`, `server.js`, `api/status/route.js`, `api/batch/start/route.js` (pola lock), `(app)/page.js`, halaman Data Report dan cetaknya.

**Selesai bila:** proses yang dimulai dari SCADA lama atau panel terekam di web sebagai batch, STOP web berfungsi, START web nonaktif selama mesin berjalan, dan trend/F0 batch hasil adopsi cocok dengan printout SCADA lama dalam toleransi yang sudah dipakai di item 4.

#### 10. Tampilkan `stuckRisk` dan kegagalan START/STOP di UI (S) — SELESAI (sisa: uji dengan mesin)
**Status 8 Okt 2026.** Diuji pemilik: `node --test src/lib/plcCommandAlert.test.mjs` 20 tes lulus, `npm run lint` 0 error dan 15 warning (tidak bertambah), `npm run build` lolos 34 halaman, uji manual di browser lolos, sudah di-commit. Tidak ada migrasi DB.

**Temuan di kode lama:** `handleStop` mengabaikan seluruh respons server (hasil `plcStopWritten`/`plcStuckRisk` tidak pernah dibaca UI); halaman Prepare mengabaikan `warning`/`stuckRisk` pada START sukses dan langsung pindah ke dashboard; respons `critical: true` tampil seperti error biasa dan tombol Mulai aktif lagi; koneksi putus saat START menampilkan "periksa jaringan" padahal mesin mungkin sudah jalan; `pulse.error` (route reset) dan `details` (route start, 502) mengirim teks error mentah gateway ke klien; kasus `critical` tidak meninggalkan jejak audit. `Navbar.js` tidak perlu diubah.

**Yang dikerjakan**
- `src/lib/plcCommandAlert.js` (baru, fungsi murni, 20 tes): `describeStopResponse`, `describeResetPulse`, `describeStartResponse`. Keluaran `{ level, title, lines }`; tidak pernah menampilkan `error.message` mentah.
- Dashboard `(app)/page.js`: hasil STOP dan kegagalan pulsa reset ditampilkan sebagai panel di bawah tombol STOP (di dalam alur layout, bukan overlay, jadi STOP tidak tertutup). Panel **tidak hilang sendiri**; operator menekan "Sudah dicek, tutup". Pesan sukses reset tidak lagi mengklaim "kembali ke Idle" sebelum fase terverifikasi.
- `batch/stop`: respons ditambah `plcPulse { wroteOn, wroteOff }`; exception saat kirim STOP kini menandai `plcStuckRisk = true` (nasib pulsa tidak diketahui); audit `stop_batch` mencatat hasil pulsa (`new_value`) dan baris PERINGATAN di deskripsi bila STOP tidak terkonfirmasi (lewat `tryAudit`).
- `plc/reset`: `pulse.error` tidak lagi dikirim ke klien (detail tetap di log server dan audit).
- Halaman Prepare: lima hasil dibedakan: **started** (langsung ke dashboard); **started_warn** (batch tercatat tetapi START mungkin tertahan ON; tanpa redirect otomatis, tidak bisa ditutup); **critical** (mesin jalan tetapi batch gagal dicatat; anjuran STOP fisik karena STOP web tidak berfungsi tanpa batch `running`; tidak bisa ditutup); **rejected_stuck** (PLC tidak mulai tetapi START mungkin tertahan; bisa ditutup setelah dicek); **unknown** (koneksi putus atau respons bukan JSON; periksa dashboard dulu; bisa ditutup). Penolakan biasa tetap memakai banner merah lama. Tombol Mulai terkunci selama panel ada.
- `batch/start`: audit baru `start_batch_critical` saat INSERT `batch_records` gagal setelah PLC jalan; `details` pada respons 502 setpoint kini hanya `{ tag }` (teks error gateway hanya di log server).
- File: `src/lib/plcCommandAlert.js` + `.test.mjs` (baru), `src/app/(app)/page.js`, `src/app/(app)/prepare/page.js`, `src/app/api/batch/start/route.js`, `src/app/api/batch/stop/route.js`, `src/app/api/plc/reset/route.js`.

**Catatan desain dan keterbatasan**
- Panel peringatan hanya di state halaman: hilang saat refresh atau pindah halaman. Bukti kejadian tetap ada di Audit Log. Bila ingin tahan refresh, butuh `sessionStorage` atau penanda di DB (hati-hati pola `set-state-in-effect`, jangan menambah warning lint).
- **STOP dari web bergantung pada database** (`requireAuth` dan pencarian batch `running` terjadi sebelum pulsa). Bila DB mati, STOP web tidak terkirim; UI kini menyarankan STOP fisik. **Diputuskan 9 Okt: START dan STOP tetap bergantung DB, tidak diubah** (pertanyaan #16 selesai).
- Pada kasus `critical`, dashboard menampilkan `running: false` padahal PLC di fase proses; peringatan ini baru ada di item 9. Server menolak START kedua karena fase PLC bukan idle.
- Body `actor` yang dikirim `handleStop` tidak dipakai server (aktor dari sesi); aman dihapus.
- Aksi audit baru: `start_batch_critical`.
- **Sisa (butuh mesin):** `stuckRisk` sungguhan untuk STOP/reset/START, `critical`, dan 409 dengan `stuckRisk` (bagian 5 butir 9). Cek juga bahwa `start_batch_critical` muncul di dropdown filter Audit Log setelah ada kejadiannya.
- Selesai bila: kegagalan dan risiko tertahan START/STOP terlihat jelas di UI. (Terpenuhi.)

### Fase 2: sebelum go-live

#### 11. Dashboard (L) — dipecah 9 Okt 2026
**Temuan dari uji dual-monitoring, pemeriksaan kode (`(app)/page.js`), dan pembacaan AWL/CSV (9 Okt):**
- **"Waktu berjalan"** memakai `data.running ? formatElapsed(data.runBegin) : "--:--:--"`; `data.running` berasal dari batch di DB. Tanpa batch (proses dari luar web) timer tidak jalan walau fase PLC berpindah. Diselesaikan oleh adopsi (item 9), bukan oleh perubahan timer.
- **Valve:** P&ID menggambar 9 valve. Enam dibaca dari `data.valves` (`steam1`, `steam2`, `wtrDrain`, `cooling1`, `cooling2`, `steamExhs`); tiga (DRAIN, COMPRESSED AIR, SOFT WATER) di-hardcode `unknown`. **`plc.js` ternyata sudah membaca `wtrFill` (Q2.0, PWCV, "isi air murni ke chamber") dan `wtrPump` (Q3.0), tetapi dashboard tidak menggambarnya.** Dugaan kuat: SOFT WATER = `wtrFill`. Kandidat COMPRESSED AIR: `Q1.3`/`Q1.6` (ON saat tekanan ≤ batas bawah VW214, tidak punya tag). DRAIN (vertikal di bawah) belum teridentifikasi. Lihat tabel output per fase di bagian 3.
- Enam valve bertag: alamat dan tipe tag di CSV cocok dengan `TAG_MAP` dan dengan logika AWL. Bila di mesin masih tidak cocok dengan SCADA lama, penyebab paling mungkin adalah SCADA lama menganimasikan dari bit lain (bukan salah alamat); lihat bagian 5 butir 10.
- Label timeline **"PREPARE"** dipetakan dari fase idle (`idle_door_open`, `idle_ready`), yaitu SEBELUM START; bukan fase sesudah START. Diganti "IDLE" (item 21).

**Review `atvProcess.js` dan `AtvDiagram.js` (kiriman pemilik 9 Okt, dibandingkan dengan pembacaan AWL):**
- **Cocok dengan AWL:** histeresis STEAM 1 (buka bila TH < CTRL_TEMP − 1 °C, bertahan sampai TH ≥ CTRL_TEMP), STEAM 2 sebagai satu-satunya pengatur di steril, syarat HEATING→STERIL (8 kanal suhu ≥ STER_SET selama 5 detik), COOLING (CWV2 setelah 30 detik, CWV1 bila suhu acuan ≤ COOL1_TEMP, selesai bila ≤ COOL2_TEMP), urutan DRAIN lalu vent, END bertahan sampai STOP/release, SOFT WATER ← `WTR_FILL` (Q2.0). Kode fase di `PHASE_CODE_TO_STEP` cocok dengan `PHASE_MAP`.
- **Ketidakkonsistenan 1 (kemungkinan penyebab valve tidak cocok):** `LIVE_TAG.waterDrain` memakai `wtrDrain` (tag `WTR_DRAIN` = **Q1.4**, hanya ON di fase DRAIN), sedangkan dokumentasi di file yang sama menyebut Q1.4 = DRAIN bawah dan **Q2.1** = WATER DRAIN (ON saat idle, isi air, awal pemanasan, 30 detik awal pendinginan). Akibatnya di mode LIVE elemen WATER DRAIN tertutup saat idle/isi air, padahal ladder dan profil PREPARE/FILLING mengatakan terbuka. Perbaikan: `drain` ← `wtrDrain` (live); `waterDrain` ← tag baru untuk **Q2.1** (butuh tag; sementara estimasi dari profil). Ini membuat tag Q2.1 di `SiemensS7-200_tambahan.csv` berguna (bukan sekadar opsional).
- **Ketidakkonsistenan 2 (pompa):** `PROFILES` FILLING dan DRAIN men-set `pump: true` dan header menyebut Q1.0/Q1.2 "pompa sirkulasi" sebagai "Pasti", tetapi AWL tidak menamai Q1.0/Q1.2 pompa; tag `WTR_PUMP` (**Q3.0**) hanya ON di pemanasan, steril, pendinginan (setelah tunda 5 detik; atau manual). Mode LIVE memakai Q3.0 (pompa mati saat isi air), mode PELAJARI menampilkan pompa menyala saat isi air: tidak konsisten. Cek di mesin apakah pompa berputar saat isi air; tag `Q1.0`/`Q1.2` di CSV tambahan membantu.
- **Minor:** profil COOLING menetapkan `cool2: 1` (terbuka sepanjang fase) padahal teks yang sama menyebut 30 detik pertama belum dibuka; kode legacy `prepare`/`end` di `PHASE_CODE_TO_STEP` tidak akan muncul bila `plc.js` terkoreksi dipasang; kotak pertama timeline masih "PREPARE" (diganti IDLE).
- **`AtvDiagram.js` bersih:** animasi CSS murni, satu `useState`, tidak ada `useEffect`/acak saat render. `resolveStates` sudah memperlakukan nilai valve `null` sebagai `unknown`, **tetapi** `plc.js` membulatkan valve dengan `!!v.x` sehingga tag gagal-baca tiba di diagram sebagai `false` (CLOSED), bukan `null`. Perbaikan `bitOrNull` di `plc.js` (item 21 butir c) kini punya manfaat langsung.

**11a. Kebenaran data (prioritas utama, hari ini):**
- START gating dan info "proses dimulai dari luar web" (lihat item 9).
- SOFT WATER ← `valves.wtrFill` (dan bila perlu pompa `wtrPump`); verifikasi di mesin dengan SCADA lama berdampingan.
- Label "PREPARE" → "IDLE" (sub-label "pintu belum siap" untuk VW98=0 dan "siap" untuk VW98=1).
- Tag tambahan di KEPServerEX untuk pengamatan valve (`SiemensS7-200_tambahan.csv`, item 21).
- File: `(app)/page.js`, `plc.js`, foto layar SCADA lama per fase. **Koordinasi:** pemilik sedang mengubah `(app)/page.js` dengan AI lain; attach versi terbaru dulu.

**11b. Visual interaktif dan edukatif (setelah 11a terverifikasi). Status 9 Okt:** pemilik mengunggah `(app)/page.js` versi baru hasil kerja AI lain: diagram P&ID baru di `src/components/AtvDiagram.js` dengan animasi, mode LIVE/PELAJARI (putar siklus otomatis tiap 8 detik, klik kotak fase), `PhaseGuide`, dan data proses per fase di `src/lib/atvProcess.js` (disebut diturunkan dari `export_atv.awl`). Valve tanpa tag (DRAIN bawah, COMPRESSED AIR, buang PHE) tampil sebagai estimasi "≈" dari fase aktif, bukan sinyal mesin. Panel peringatan item 10 dan `plcCommandAlert` tetap utuh. **Belum berubah:** START masih `Link` ke `/prepare` yang hanya dinonaktifkan oleh `data.running` (belum mengikuti fase PLC), timer masih `data.running ? formatElapsed(...) : "--:--:--"`. Belum diverifikasi saya: `AtvDiagram.js` dan `atvProcess.js` belum dikirim (perlu untuk mencocokkan data per fase dengan AWL dan memastikan SOFT WATER ← `wtrFill`). warna dan posisi valve mengikuti status tag, animasi aliran air dan steam saat valve aktif, stepper fase dengan penjelasan singkat. Sengaja ditunda: animasi di atas data valve yang belum benar adalah pekerjaan ulang.
- File: `page.js`, `StatCard.js`, `globals.css`, screenshot dashboard, daftar tag valve.

#### 12. Operasional (M)
- Server sebagai service dengan auto-restart dan UPS langsung mengurangi celah `monitor_gap` (alarm saat PC/server mati tidak terekam, lihat item 8).
- Backup `pg_dump` terjadwal dan uji restore (PostgreSQL 17.5, locale DB `English_Indonesia.1252` menandakan Windows, jadi kemungkinan lewat Task Scheduler).
- Jalankan server sebagai service dengan auto-restart (NSSM atau PM2).
- Retensi `batch_trend`. Putuskan nasib `tag_readings` (belum dipakai) dan kolom `modbus_*` (NULL semua).
- File: skema DB, info server

#### 13. Satu sumber kebenaran tag (M)
- Sumber kebenaran tag yang dibaca web adalah `TAG_MAP` di `plc.js` dan nama tag di KEPServerEX (kini cocok persis). Tabel DB `tags` (105 baris) **tidak dipakai `plc.js`**, memakai penamaan lain (mis. "DRAIN TIME", "VW 238"; hanya 44 nama persis sama dengan KEPServerEX). Putuskan: hapus, atau sinkronkan. Belum dicek apakah ada file lain yang membacanya.
- ~~Verifikasi alamat tag yang DITULIS web~~ → **selesai (9 Okt)** dari `export_atv.awl` dan `SiemensS7-200.csv`: `STER_SET`=`VW200` (suhu steril; ambang transisi pemanasan→steril), `STER_SET_TIME`=`VW202` (menit; PLC ×60), `CTRL_TEMP`=`VW204` (target pemanasan: SV1/SV2 buka bila TH < CTRL_TEMP), `TEMP_SPACE`=`VW206` (selisih di atas STER_SET untuk kendali steam di steril: batas = VW200 + VW206), `COOL1_TEMP`=`VW208` (CWV1 buka bila VW126 ≤ nilai ini), `COOL2_TEMP`=`VW210` (**suhu akhir pendinginan**: fase 5 selesai bila VW126 ≤ nilai ini), `ALRM_PRES`=`VW228` (dibandingkan langsung dengan P1 dalam kPa, **tanpa scaling**; dipakai PLC hanya di fase idle untuk membuka vent `Q1.5`, bukan alarm). Skala ×10 pada suhu cocok (dibandingkan dengan `VW100`–`VW116` raw). `START`=`M1.4`, `STOP`=`M1.5` (level; wajib pulsa). Read-back setpoint tetap hanya membuktikan jalur tulis. Komentar `plcWrite.js` yang menyebut scaling `ALRM_PRES` "BELUM JELAS" sudah usang: tidak ada scaling.
- Validasi saat startup bahwa semua nama di `TAG_MAP` ada di KEPServerEX. Bersihkan data uji. Perbarui `DOKUMENTASI.md` dan `rekap.md` (banyak tebakan dan klaim yang keliru).
- File: `plc.js`, CSV `tags`, export KEPServerEX

#### 14. Audit dan sesi (L)
- Catatan item 8: `alarmMonitor` tidak pernah `UPDATE`/`DELETE` `alarm_log` (model dua baris), jadi aman untuk dicabut hak ubahnya. Hapus dulu baris uji dan data seed sebelum mencabut hak.
- `audit_log` dan `alarm_log` append-only (cabut `UPDATE`/`DELETE`, trigger). Catatan item 7: trigger `trg_audit_log_actor_name` bekerja saat INSERT sehingga tidak terganggu; backfill `UPDATE` sudah dijalankan sekali oleh `item7b_migration.sql`. Idle logout 15 menit. Tanda tangan elektronik rilis batch.
- Naik ke Fase 1 kalau produk masuk regulasi farmasi (BPOM, CFR 21 Part 11).
- **Keputusan 9 Okt (A12, diperjelas pemilik):** idle logout **7 menit, hanya berlaku saat mesin idle** (di luar fase masak). **Selama proses berjalan (fase 2–5 dan 7) tidak ada logout otomatis.** "Idle" = tidak ada input pengguna (mouse, keyboard, sentuh), bukan polling dashboard 1 detik. Asumsi: fase 0/1 dan 6 (END) dianggap bukan proses; ubah bila fase 6 harus dikecualikan. Pelacak aktivitas di klien membaca fase dari `/api/status` dan memanggil `/api/auth/logout`; JWT 8 jam tetap valid sampai kedaluwarsa (batasan yang sudah dicatat di Fase 3). Bukan pekerjaan hari ini; pertanyaan #21 selesai.
- File: skema DB, `auth.js`, `middleware.js`, halaman dan API `data-report`

#### 15. Lain-lain (S)
- **Cetak alarm (item 8d)** sudah mengikuti pola `print/audit-log` (tombol Kembali, nama file, nomor halaman). Cetak alarm belum menulis `audit_log`; samakan dengan export audit-log bila dibutuhkan (perlu `auth.js` dan `auditLog.js`).
- Validasi lintas-field resep (butuh keputusan QA).
- **Migrasi `middleware` ke `proxy`**: build Next 16.3.5 sudah memperingatkan konvensi `middleware` deprecated (masih berfungsi). Ada codemod resmi: `npx @next/codemod@canary middleware-to-proxy .`. Lakukan di commit terpisah.
- ~~Pastikan `/api/status` dijaga `requireAuth`~~ → **selesai (diperiksa 8 Okt 2026)**: route dijaga `middleware.js` (JWT valid wajib; tanpa cookie → redirect 307 ke `/login`). Route tidak memakai `requireAuth` **dengan sengaja**: `requireAuth` mengecek DB dan menelan error DB sebagai "akun tidak aktif", sehingga dashboard kehilangan data PLC saat DB bermasalah. Konsekuensi diterima: akun yang dinonaktifkan masih bisa membaca status sampai token habis (maks. 8 jam). Catatan: penolakan berupa redirect HTML, bukan 401 JSON; pertimbangkan 401 untuk `/api/*` bersama item 15a. `db-test` dan `plc-test` hanya dijaga middleware dan isinya belum dilihat.
- ~~**Logout tahan gangguan database**~~ → **selesai (diperiksa 8 Okt 2026)**: `auth/logout/route.js` yang terpasang sudah memakai `tryAudit` dan menghapus cookie apa pun hasil audit; tidak ada perubahan kode. Catatan terkait tetap: token JWT tidak dicabut saat logout (valid sampai 8 jam), tercatat di Fase 3 (`token_version`). Opsional: pastikan `db.js` punya `connectionTimeoutMillis` (belum dilihat) agar logout tidak menggantung saat DB macet.
- **Catatan 9 Okt:** bagian `data-report` dari butir berikut diambil alih item 18 (laporan gabungan). **Samakan halaman cetak lain** dengan `print/audit-log` (dari item 7): `print/batch-records` dan `print/data-report/[batchNo]` (+ `/curve`) perlu tombol Kembali yang menutup tab (dan halaman pembukanya membuka cetak tanpa `noopener`), nama file PDF dengan keterangan dan waktu cetak (`(dicetak dd-mm-yyyy hh.mm.ss)`), serta nomor halaman `Halaman X dari Y`. Belum dilihat filenya; attach halaman cetak dan halaman yang membukanya. Utamakan `data-report/[batchNo]` karena dibaca auditor/QA.
- File: `recipeValidation.js`, `middleware.js`, `api/status/route.js`

#### 16. Bersihkan lint (S–M) — BARU
- `npm run lint` melaporkan 10 error `react-hooks/set-state-in-effect` (pola memanggil fungsi fetch di dalam `useEffect`), di: `(app)/alarm`, `audit-log`, `data-report/[batchNo]`, `data-report`, `formula`, `(app)/page.js`, `trend`, `users`, `print/audit-log`, `print/batch-records`. Plus warning `exhaustive-deps` di `(app)/page.js` dan 3 warning di `Navbar.js` (`window.location.href` → `useRouter`, `<img>` → `next/image`).
- Semuanya sudah ada **sebelum** item 1 dan 2 (aturan baru di Next 16).
- **Stopgap (sudah diterapkan dan di-commit):** `eslint.config.mjs` dengan override `"react-hooks/set-state-in-effect": "warn"`.
- Pekerjaan sebenarnya: perbaiki ke-10 halaman (mis. bungkus fetch di callback async yang dipanggil dari effect, atau pakai pola data-fetching yang disarankan), lalu **hapus override** di `eslint.config.mjs`.
- Status 6 Okt 2026: stopgap sudah diterapkan, `npm run lint` = 0 error, 14 warning. Override belum dihapus.
- Status 8 Okt 2026: **15 warning**. Tambahan: `login/page.js:53` (`window.location.href`; ikut dibereskan bersama `Navbar.js`). File item 8 (`AlarmCenter.js`, `alarmView.js`, `print/alarm`, route alarm) tidak menambah warning; satu-satunya warning item 8 yang tersisa adalah `set-state-in-effect` lama di `(app)/alarm/page.js` (efek pagination).
- Tambahan dari output `npm run build`: Next 16 menandai file `middleware` sebagai deprecated, gantinya `proxy` (codemod: `npx @next/codemod@canary middleware-to-proxy .`). Belum mengganggu; kerjakan bersama item ini atau setelahnya, jangan saat uji mesin.
- Selesai bila: `npm run lint` bersih tanpa override.

#### 17. Prepare menjadi popup, master produk (M) — BARU 9 Okt 2026
**Usulan pemilik:** popup sederhana, Mach. ID otomatis "SG-40", Product Name dan Specification dipilih dari master (bukan diketik), hapus banner dan checkbox "Saya memahami risiko".
- **17a (hari ini bila waktu cukup, UI saja):** komponen `StartDialog` yang dibuka dari dashboard dan memakai **payload dan API START yang sama** (`/api/batch/start` tidak diubah, jadi seluruh pengerasan item 3/6/7/10 tetap). `/prepare` dipertahankan sebagai cadangan sampai popup terverifikasi, baru dihapus. Mach. ID default `SG-40` dari satu konstanta konfigurasi, tampil read-only. Banner dan checkbox risiko dihapus (**disetujui pemilik 9 Okt, A6: tanpa checkbox, cukup popup konfirmasi**), diganti **satu langkah konfirmasi eksplisit** (ringkasan formula, setpoint, nomor batch, "Mulai") di dalam popup, supaya tetap ada satu lapis sebelum menulis ke PLC. Panel peringatan hasil START (item 10) dipindahkan ke popup tanpa mengubah perilakunya (lock anti-klik ganda, `critical`, `stuckRisk`, hasil tidak diketahui). State popup tidak boleh ter-reset oleh polling dashboard 1 detik.
- **17b (setelah uji mesin):** tabel `products` (nama, spesifikasi, aktif) dengan kelola oleh admin (tempat: halaman Formula atau halaman baru) dan dropdown di popup; teks bebas tetap tersedia sampai master terisi. **Diputuskan 9 Okt (A7): master terpisah** (bukan melekat ke formula).
- File 17a: `(app)/page.js`, `(app)/prepare/page.js`, `plcCommandAlert.js`. File 17b: skema DB, halaman Formula, `api/formulas/route.js`.
- Selesai bila: START lewat popup menghasilkan batch yang identik dengan START lewat halaman lama (uji dengan PLC mati: semua penolakan dan panel tetap muncul).

#### 18. Laporan batch gabungan (M) — BARU 9 Okt 2026
**Usulan pemilik:** satu tombol cetak per batch menghasilkan satu berkas berisi data record, kurva, dan daftar alarm selama periode proses (seperti SCADA lama). Halaman Alarm dan Trend tetap ada dan bisa dicetak mandiri (cetak alarm sudah ada dari item 8d).
- Saat ini kurva dan laporan batch dicetak dari dua halaman (`print/data-report/[batchNo]` dan `.../curve`) menjadi dua berkas.
- Alarm periode batch: `alarm_log` punya kolom `batch_no` (item 8). Ambil baris dengan `batch_no` batch itu, ditambah baris tanpa `batch_no` yang waktunya jatuh di antara `run_begin` dan selesai (alarm sebelum adopsi atau tanpa batch). Tampilkan dua baris per alarm (alarm dan pulih) sesuai model SCADA lama.
- Risiko: kurva berorientasi lanskap, tabel potret. Chromium mendukung `@page` bernama dengan `size` berbeda per halaman; bila ternyata bermasalah, jadikan semua lanskap atau skalakan kurva di potret. Tabel trend (satu baris per menit) panjang; jaga pemotongan halaman dan footer "Halaman X dari Y".
- Samakan dengan pola `print/audit-log` (tombol Kembali, nama file `Laporan Batch <no> (dicetak ...)`, nomor halaman). Ini **menggantikan** bagian `data-report` dari item 15d; `print/batch-records` tetap di 15d.
- Rute kurva lama dipertahankan sampai laporan gabungan terverifikasi dengan data batch nyata.
- File: `print/data-report/[batchNo]/page.js` dan `/curve/page.js`, `(app)/data-report/[batchNo]/page.js`, `api/batch-records/[batchNo]/route.js`, `api/alarms/print-data/route.js`.
- Selesai bila: satu tombol menghasilkan satu PDF lengkap dan jumlah alarm di dalamnya cocok dengan halaman Alarm untuk rentang waktu batch yang sama.

#### 19. ~~Mode tulis PLC~~ — DIBATALKAN 9 Okt 2026
Ditambahkan AI tanpa diminta pemilik; pemilik memutuskan tidak perlu (terlalu rumit, dan tidak berguna saat web berjalan mandiri). Perlindungan klik tidak sengaja cukup dari START gating (hanya aktif di fase 1 dan tanpa batch) ditambah popup konfirmasi (item 17). Pada hari dual-monitoring cukup aturan operasional: jangan klik START di web. Nomor 19 tidak dipakai ulang.

#### 20. Rerun batch aborted dengan nomor sama (S) — BARU 9 Okt 2026
**Keputusan pemilik (A13):** nomor batch harus berbeda dan tidak boleh sama, **kecuali rerun batch yang aborted** (agar batch yang masih bisa diselamatkan bisa diulang). Saat ini (item 3) `batch_no` unik global tanpa membedakan huruf besar/kecil dan spasi ujung, sehingga rerun dengan nomor yang sama ditolak.
- **Usulan rancangan (menunggu konfirmasi):** pengguna mengetik nomor yang sama (mis. `B-001`); bila semua batch dengan nomor itu berstatus `aborted` (tidak ada `finished` atau `running`), START diizinkan dan sistem menyimpannya sebagai `B-001-R1` (lalu `-R2`, dst.), dengan catatan "rerun dari B-001" di audit. Kunci `batch_no` tetap unik, URL/audit/ekspor tidak berubah. Alternatif (nomor persis sama dengan kolom urutan) lebih besar dan memengaruhi URL, audit, dan ekspor, jadi tidak disarankan.
- Perlu: validasi `batchNo.js` tetap lolos untuk akhiran `-R<n>` (maks. 50 karakter), pesan penolakan yang jelas bila nomor sudah dipakai batch `finished`/`running`, dan umpan balik di popup ("nomor ini batch aborted; akan dijalankan sebagai B-001-R1").
- File: `api/batch/start/route.js`, `batchNo.js`, `(app)/prepare/page.js` atau `StartDialog`, `item3_migration.sql` (unique index `lower(btrim(batch_no))`; kemungkinan tidak berubah).
- Selesai bila: nomor milik batch `finished` atau `running` ditolak; nomor milik batch yang semuanya `aborted` bisa dijalankan ulang dengan akhiran `-R<n>`.

#### 21. Koreksi `plc.js`, tag KEPServerEX, dan label fase (S–M) — BARU 9 Okt 2026
Hasil memeriksa `plc.js`, `SiemensS7-200.csv` (60 tag), dan `export_atv.awl`:
- **Nama tag cocok:** ke-55 nama di `TAG_MAP` ada di CSV. Tag di CSV yang sengaja tidak dibaca web: `ALRM_DOR`, `ALRM_TEMP`, `BUZZER`, `F0_VAL`, `WARNING_BUZ`.
- **`plc.js` terkoreksi (dikirim 9 Okt, perlu dipasang):** (a) tebakan fase lama `detectPhase` dihapus; bila `PROCCES_TEXT` (VW98) tidak terbaca, fase = `unknown` (rawValue null, START tertahan oleh guard fase). Tebakan lama keliru: ia menjawab "PREPARE" bila `RUN_LAMP` mati padahal lampu juga mati di fase END (VW98=6), dan tidak mengenal fase drain. (b) Komentar `ALRM_PRES` dan `VW126` dikoreksi sesuai AWL.
- **Belum dikerjakan (menunggu `page.js` terbaru dari AI lain):** (c) valve yang tag-nya gagal dibaca dipaksa `false` lewat `!!v.x` sehingga tampak CLOSED, bukan tidak diketahui (bertentangan dengan prinsip NO DATA); perlu `bitOrNull` di `plc.js` dan penanganan `unknown` per valve di P&ID (saat ini `valves?.x ?? false` mengubah null menjadi false lagi). (d) Label timeline "PREPARE" → "IDLE". (e) SOFT WATER ← `wtrFill`.
- **Tag tambahan** (file `SiemensS7-200_tambahan.csv`; **OPSIONAL, belum diimport pemilik (9 Okt)**; hanya untuk pengamatan di Quick Client, tidak dibaca web dan tidak mengubah perilaku web/PLC; bila diimport, 8 tag paling berguna: `Q1.0`, `Q1.2`, `Q1.3`, `Q1.6`, `Q2.1` untuk mengganti estimasi valve "≈" dengan sinyal asli, dan `I2.1`, `I2.2`, `M5.0` untuk mendiagnosis START yang ditolak PLC): `Q1.0`, `Q1.2`, `Q1.3`, `Q1.6`, `Q2.1` (output tanpa tag), `I2.1`, `I2.2` (syarat START), `I0.7` (hanya di `M8.7`), `M5.0` (mode manual), `Q3.3` dan `Q2.5` (buzzer), `VW126` (suhu produk acuan PLC), `VW212`/`VW214` (jendela tekanan hasil hitung PLC), `VW234`, `VW238` (parameter tersimpan).
- **Pra-cek START (opsional, kecil):** PLC menolak START bila `I2.1`/`I2.2` aktif atau `M5.0` (mode manual) aktif; web tidak membaca ketiganya, jadi START ditolak diam-diam (web menunggu 10 detik lalu 409). Setelah tag dibaca, tambahkan sebagai guard dengan pesan jelas.
- **KEPServerEX:** semua tag (termasuk sensor dan `ALM_*`) masih `R/W`; rencana awal `ALM_*` Read Only. Disarankan Read Only untuk sensor, status, dan alarm.
- File: `plc.js` (terkoreksi), `SiemensS7-200_tambahan.csv`, `(app)/page.js` (versi terbaru).
- Selesai bila: `plc.js` terpasang (`lint`/`build` bersih), tag tambahan terimport, label IDLE tampil, dan SOFT WATER mengikuti `wtrFill` yang terverifikasi di mesin.

### Fase 3: boleh ditunda
Notifikasi Telegram, dark mode, dashboard OEE, auto-archiving data lama, pencabutan token (`token_version`), polesan ekspor.

---

## 3. Fakta yang sudah diverifikasi

### PLC (dari `export_atv.awl`)
- Kode fase `VW98` (`PROCCES_TEXT`): 0 = idle pintu belum siap, 1 = idle siap, 2 = isi air (`M3.1`), 3 = pemanasan (`M3.2`), 4 = sterilisasi (`M3.3`), 5 = pendinginan (`M3.4`), 7 = buang (`M3.5`), 6 = selesai (`M3.6`). Urutan: 0/1 → 2 → 3 → 4 → 5 → 7 → 6.
- Keluar dari fase 6: STOP (`M1.5`) mereset semua fase ke idle, atau tombol release (`I0.6`/`M1.3`).
- Suhu raw dibagi 10. Sensor suhu `VW100`–`VW116` ditambah offset kalibrasi `VW300`–`VW316`. `VW102`–`VW114` = T1–T6 dan TM; `VW100` = TH; `VW116` = TL.
- Tekanan `VW118` = `(AIW−6400)/64 − 100`, dibandingkan langsung dengan `VW228` (`ALRM_PRES`) dan `VW222` (`SAFETY_PRESS`), jadi **tidak perlu di-scale**. Konduktivitas (`VW122`) dan water (`VW124`) sudah di-scale di PLC.
- `OVER_TEMP` (`VW252`) dibandingkan dengan suhu raw, jadi **dibagi 10**. `OVER_TEMP` dan `SAFETY_PRESS` adalah ambang batas, bukan sinyal alarm.
- `STER_SET_TIME` (`VW202`) dalam menit. PLC mengalikannya 60 ke `VW240` (16-bit), jadi batas aman 546 menit (validasi saat ini max 500 sudah aman).
- Timer fase dalam detik: `HEAT_TIME` = `VW600` (counter C1), `ster_time` = `VW230` (C2), `COOL_TIME` = `VW602` (C3). Counter ster_time direset saat masuk fase 5.
- START (`M1.4`) dan STOP (`M1.5`) dibaca PLC sebagai level, jadi wajib ditulis sebagai pulsa.
- Syarat START di PLC: pintu depan dan belakang tertutup (`I0.2`, `I0.3`), output seal `Q0.5` aktif, `I2.1` dan `I2.2` tidak aktif.
- `M6.0` (`DOOR_LOCK`) berfungsi sebagai bypass interlock.
- Mode sterilisasi: `M15.0` = 0 (Time). Mode F0 mengandalkan bit `M13.2` yang tidak pernah diset di dalam PLC, dan **tidak dipakai produksi**.
- `F0_VAL` (`VW220`) dan `OVERTIME_STERIL_121` (`M30.0`) tidak dipakai program PLC (tidak ada satu pun referensi).
- Word `MW8` = `MB8`+`MB9` dan mencakup flag SAVE_VMEM `M9.x`; `MW10` mencakup `M11.0`/`M11.1` (tombol pintu); `MW17` mencakup `M17.x`/`M18.x` (flag suhu per sensor, sesaat). Karena itu tag alarm berupa word menimbulkan alarm palsu, dan sekarang dibaca per bit.

### Bit alarm PLC (SBR12, SBR2, SBR3, SBR4; verifikasi tingkat kode)

| Bit | Tag | Grup | Arti |
|---|---|---|---|
| `M8.0` | `ALM_M8_0` | fault | (`I1.5`/`I0.4` tombol buka pintu, `I0.6`/`M1.3` tombol release) **DAN** `P1 ≥ SAFETY_PRESS` = percobaan buka pintu saat tekanan masih di atas batas aman |
| `M8.1` | `ALM_M8_1` | fault | START ditekan **DAN** `I0.2` tidak aktif **DAN** `I0.3` tidak aktif (hanya bila **kedua** pintu tidak tertutup) |
| `M8.2` | `ALM_M8_2` | fault | START ditekan DAN seal `Q0.5` tidak aktif |
| `M10.2` | `ALM_M10_2` | fault | Fase steril DAN salah satu T1–T6/TM < `STER_SET`. Sesaat, tanpa tunda |
| `M10.3` | `ALM_M10_3` | fault | Fase steril DAN salah satu T1–T6/TM > `OVER_TEMP`. Sesaat, tanpa tunda |
| `M8.3` | `ALM_M8_3` | review | Fase steril DAN `VW126 > VW250`. `VW250` = `STER_SET` + 2,0 °C (AWL: `VW250 = VW200 + 20` raw). `VW126` seharusnya suhu turunan dari T2/T3/T4, tetapi semua cabang `MOVW` yang terlihat di export mengisinya dari `VW104` (T2), jadi tampak T2 saja (export mungkin terpotong). Tidak memicu buzzer |
| `M8.4` | `ALM_M8_4` | review | Fase steril DAN `VW126 < STER_SET`. Tidak memicu buzzer |
| `M8.7` | `ALM_M8_7` | review | TH/T1/T2/T3 > 150,0 °C, atau `I0.7` aktif (arti `I0.7` belum diketahui). Tidak memicu buzzer |
| `M10.1` | `ALM_M10_1` | review | Fase heating DAN counter C6 ≥ 3000 detik (50 menit). Mungkin batas waktu pemanasan; belum pernah teramati |

- Pemindahan bit dari "review" ke "fault": ubah `FAULT_BITS`/`REVIEW_BITS` di `plc.js` setelah bit terbukti tidak menyala di batch normal.
- **Tidak dibaca (disengaja):** `M10.0` (heating 5 menit, counter C5) dan `M10.4` (cooling 5 menit, counter C7) adalah buzzer **pemberitahuan** rutin: menyala 30 detik sekali, lalu mati sendiri, di setiap batch normal. **Terkonfirmasi dari pengamatan mesin dan keterangan operator.** Buzzer output `Q2.5` juga menyala saat fase END pada siklus normal, jadi bukan indikator alarm. `M10.5` bukan alarm, `M10.6` (`BUZZER`) tidak pernah di-set PLC.
- Bit alarm berupa **denyut**. `M8.0`–`M8.2` mengunci diri 5 detik (`T105`–`T107`, +50) lalu mati dan **tidak** menyala lagi sendiri; baru menyala lagi bila tombol atau START ditekan lagi. `M10.2`/`M10.3` berdenyut 120 detik (`T102`, +1200) lalu mati 1 scan dan menyala lagi bila kondisinya masih ada. `M10.1` berbeda: menyala sekali ~30 detik (`T116`, +300).
- **Fakta tambahan (diverifikasi ke AWL, 8 Okt 2026):**
  - Seluruh logika alarm ada di `SBR12` (nama asli "报警" = alarm); tidak ada rutin alarm lain.
  - Fase 4 (steril) baru dimasuki setelah **semua** 8 sensor >= `STER_SET` selama 5 detik (`T115`), jadi `M10.2` tidak menyala palsu saat masuk fase; ia menyala hanya bila suhu benar-benar turun saat steril.
  - **Tidak ada alarm tekanan di PLC** (tinggi maupun rendah). `M8.0` hanya soal percobaan buka pintu saat tekanan di atas batas aman. `ALRM_PRES` (`VW228`) hanya membandingkan tekanan lalu menggerakkan output `Q1.5` di `SBR0` (bukan bit alarm; fungsi fisik `Q1.5` belum diketahui). Tidak ada alarm PLC untuk level air, konduktivitas, atau sensor putus.
  - `M10.0` dan `M10.4` (buzzer menit ke-5, `T200`/`T201` 30 detik, counter `C5`/`C7` 300 detik) cocok dengan pengamatan: bunyi di menit ke-5 heating dan cooling, lalu mati sendiri. Tidak ada timer 5 menit di fase steril.
  - Output: `Q3.3` = OR dari `M10.0`–`M10.6` (tanpa `M8.x`); `Q2.5` = `M8.0` atau `M8.1` atau `M8.2` atau fase selesai (`M3.6`). Buzzer di sebelah pintu kemungkinan `Q3.3` (belum dikonfirmasi fisik).
  - `I1.5` dan `I0.4` terbukti tombol **buka pintu**: di `SBR0` pintu hanya boleh dibuka bila tekanan <= `VW222`. `I0.6`/`M1.3` tombol release. `I0.7` hanya muncul di `M8.7`; artinya belum diketahui.
  - `M5.0` = flag **mode manual** (`SBR9`, "手控程序" = program kontrol manual).

### Hasil pembacaan `export_atv.awl` dan CSV KEPServerEX (9 Okt 2026)
- **Idle dan "PREPARE":** `SBR0` (idle, `M3.0`) mengisi `VW98` = **0** bila salah satu pintu tidak tertutup (`I0.2`/`I0.3`) atau seal `Q0.5` tidak aktif, dan **1** bila kedua pintu tertutup dan seal aktif (seal diaktifkan oleh `M1.2` saat kedua pintu tertutup). START diterima **hanya** dari kondisi idle itu: `I0.2` dan `I0.3` aktif, `Q0.5` aktif, `I2.1` dan `I2.2` tidak aktif, dan `M1.4`; setelahnya `M3.1` (isi air, `VW98` = 2). Jadi **PREPARE = idle sebelum START**, bukan fase sesudah START. Kata "PREPARE" hanya ada di kotak timeline dashboard (dipetakan dari `idle_door_open`/`idle_ready`), di tebakan lama `detectPhase` di `plc.js`, dan sebagai nama halaman `/prepare` (form mulai).
- **STOP:** `M1.5` (level) atau **penurunan** `M5.0` mereset `M3.1`–`M3.8` dan output `Q2.0`–`Q2.7`, `Q0.6`–`Q1.7`, `Q3.0`–`Q3.7`, lalu kembali ke idle. Fase 6 (END) bertahan sampai STOP atau tombol release (`I0.6`/`M1.3`). `RUN_LAMP` (`Q2.4`) dinyalakan di isi air dan dimatikan di idle dan di END.
- **`M5.0` = mode manual** (`SBR9`: `M2.x` mengendalikan output langsung). Saat `M5.0` aktif, idle (`M3.0`) di-reset tiap scan sehingga START tidak diterima. Pulsa sesaat pada `M5.0` mereset PLC ke idle seperti STOP (kemungkinan terkait alarm "M5" di SCADA lama; dugaan).
- **Parameter yang DIHITUNG PLC tiap scan (jangan ditulis):** `VW224` = `VW200` + `VW206` (batas atas kendali steam di steril); `VW236` = `VW204` − 1,0 °C (histeresis SV1); `VW250` = `VW200` + 2,0 °C; `VW214` = batas bawah tekanan (kPa) yang dihitung dari suhu produk `VW126` (60 bila < 80 °C pada pemanasan/steril; 45 di bawah ambang pada pendinginan; selebihnya linear); `VW212` = `VW214` + 10 kPa. Aturan kendali tekanan: `Q1.5` (vent) buka bila P ≥ `VW212`; udara (`Q1.3`/`Q1.6`) buka bila P ≤ `VW214`.
- **Parameter tersimpan yang tidak diset ladder dan tidak ditulis web:** `VW234` (ambang suhu produk untuk `Q2.1` saat pemanasan), `VW238` (durasi drain; satuan 0,1 detik karena `T112` timer 100 ms), `VW252` OVER_TEMP, `VW222` SAFETY_PRESS, `VW228` ALRM_PRES, offset kalibrasi `VW300`–`VW324`. Nilainya berasal dari layar parameter SCADA lama.
- **`VW126`:** keenam cabang `SBR10` Network 4 menyusun enam urutan T2/T3/T4 seperti pemilihan median, tetapi **semuanya memindahkan `VW104` (T2)**. Di export, `VW126` = T2. Bug PLC atau artefak export belum bisa dibedakan. Dampak: kendali tekanan, pendinginan, dan alarm review `M8.3`/`M8.4`.
- **Pendinginan:** CWV1 (`Q1.1`) buka bila `VW126` ≤ `COOL1_TEMP`; CWV2 (`Q1.7`) buka 30 detik setelah fase dimulai; fase selesai bila `VW126` ≤ `COOL2_TEMP`. Drain: `Q1.4` ON sampai waktu `VW238` habis, lalu vent `Q1.5`; selesai bila P ≤ SAFETY_PRESS.
- **PLC tidak menyimpan nomor batch, formula, atau produk**: tidak ada register untuk itu di AWL; hanya jam real-time (`VB4000`–`VB4005`), dan subrutin Modbus (`SBR13`–`SBR15`) tidak dipanggil. Nomor batch SCADA lama tidak bisa dibaca web.
- **Buzzer:** `Q3.3` = gabungan `M10.0`–`M10.6` (pemberitahuan 5 menit, alarm steril, `M10.5`); `Q2.5` = `M8.0`/`M8.1`/`M8.2`/END.
- **Input:** `I2.1`/`I2.2` hanya muncul sebagai syarat START (harus tidak aktif); `I0.7` hanya di `M8.7`; fungsi fisik ketiganya tidak terlihat dari AWL. `I2.6` berada di posisi reset pada instruksi CTU counter waktu (urutan `LD`), sehingga bila aktif counter waktu tidak menghitung.
- **Output per fase (otomatis, dari AWL) untuk membandingkan dengan SCADA lama:**

| Output | Tag | Kapan ON |
|---|---|---|
| `Q2.0` | `WTR_FILL` (PWCV) | Isi air saja, sampai level `I0.0` tercapai |
| `Q3.0` | `WTR_PUMP` | Pemanasan, steril, pendinginan (tunda 5 detik dari `I2.5`; `I1.1` tidak aktif) |
| `Q0.6` | `STEAM_1` (SV1) | Pemanasan: TH < CTRL_TEMP (histeresis 1,0 °C). Tidak ada di steril |
| `Q0.7` | `STEAM_2` (SV2) | Pemanasan: TH < CTRL_TEMP. Steril: TH < STER_SET + TEMP_SPACE |
| `Q1.1` | `COOLING_1` (CWV1) | Pendinginan, bila `VW126` ≤ COOL1_TEMP |
| `Q1.7` | `COOLING_2` (CWV2) | Pendinginan, setelah 30 detik pertama |
| `Q1.4` | `WTR_DRAIN` (DPWV) | Drain, sampai waktu `VW238` habis |
| `Q1.5` | `STEAM_EXHS` (SDFC, vent) | Isi air; idle bila P ≥ ALRM_PRES; P ≥ `VW212` di pemanasan (juga ≥ 100 kPa), steril, pendinginan; setelah drain; fase END |
| `Q1.0` | (tanpa tag) | Isi air, pemanasan, steril; mati saat pendinginan |
| `Q2.1` | (tanpa tag) | Idle; isi air; pemanasan bila `VW126` < `VW234`; 30 detik pertama pendinginan |
| `Q1.3` | (tanpa tag) | Pemanasan bila P ≤ `VW214` dan `VW126` ≥ 80 °C; pendinginan bila P ≤ `VW214` |
| `Q1.6` | (tanpa tag) | Steril bila P ≤ `VW214` (mode waktu) |
| `Q1.2` | (tanpa tag) | Seluruh pendinginan dan 8 detik pertama drain |
| `Q2.6` `Q2.7` `Q3.6` `Q3.7` | (tanpa tag) | Seluruh pendinginan |

### SCADA lama: layar ALARM MESSAGE (dari foto, 8 Okt 2026)
- Kolom (Mandarin): 报警日期 (alarm date), 报警时间 (alarm time), 事件日期 (event date), 事件时间 (event time), 变量名 (variable name), 报警类型 (alarm type), 报警值/旧值 (alarm value / old value), 恢复值/新值 (recovery value / new value), 界限值 (limit value), 事件类型 (event type), 操作员 (operator). Kolom `alarm_log` sudah sesuai dengan ini.
- Satu alarm = **dua baris**: merah saat alarm (nilai alarm, pulih kosong) dan hijau saat pulih (nilai pulih terisi, waktu kejadian terisi). Baris alarm di atas, event di bawah. Event non-alarm: 登录成功 (login berhasil, dengan operator) dan 启动 (start program SCADA, tanpa operator). Header menampilkan "COMMUNICATION: abnormal/normal".
- Satu alarm terlihat (3 Okt 2026 18:45:40): variabel `M5`, tipe "start pro…" (terpotong), nilai 1,0, batas 1,0; muncul dan pulih di detik yang sama. Bukan salah satu bit `SBR12`. Dugaan (belum diverifikasi): alarm buatan SCADA pada `M5.0` (mode manual) saat START ditekan. Lihat pertanyaan terbuka #11.
- Isi `alarm_log` bertanggal 23/9 (`P1` 245/240 `high_pressure_alarm`, `T1` 125,4/124,0 `high_temp_alarm`, login, start) **adalah data seed buatan dev**, bukan salinan SCADA lama; bukan sumber teks alarm.

### Hasil uji dual-monitoring (9 Okt 2026, ODOT, SCADA lama master)
- Bagus secara keseluruhan: web membaca data PLC.
- Kekurangan: START web tetap aktif walau mesin berjalan; tidak ada batch/trend/F0 untuk proses yang dimulai dari SCADA lama; "Waktu berjalan" tidak jalan padahal fase berpindah; banyak valve yang terbuka di SCADA lama tidak terbuka di web.
- Penyebab di kode: lihat item 9 (timer, START/STOP bergantung batch DB) dan item 11 (3 dari 9 valve tanpa tag; 6 lainnya belum diverifikasi).

### Kode web (hasil review)
- Sudah baik: `requireAuth` mengecek DB, actor audit dari session, `batch/start` memakai guard berlapis (PLC online, fase 1, pintu, seal, bypass, `CTRL_SEL`), setpoint dibaca balik, START dikonfirmasi lewat perubahan fase, `batch_records` baru dibuat setelah PLC terbukti mulai, `plc/reset` punya guard bagus.
- `trendRecorder.js` (dipanggil `server.js` tiap 5 detik): baris trend tiap 60 detik + baris peristiwa pada pergantian fase, maksimal 2 baris setelah fase 6; auto-finalize bila PLC idle (fase 0/1) ≥ 120 detik dan batch > 90 detik; melewati tick bila PLC offline; tidak menulis `alarm_log`.
- ~~`finalizeBatch` membaca `fo_val_setting` dari `recipes`~~: sejak item 4 sudah tidak membaca `recipes`. ~~Batch tidak punya snapshot resep~~ dan ~~resep dan audit tidak dalam satu transaksi~~: **diperbaiki di item 6** (snapshot di `batch_records.recipe_snapshot`; resep dan audit satu transaksi).
- `batch_no` tidak unik di DB (**diperbaiki di item 3**, menunggu migrasi dijalankan).
- Proses yang dimulai dari panel fisik atau SCADA lama tidak membuat `batch_records` (tidak ada trend dan F0). **Akan diubah oleh item 9 (adopsi).**
- `alarm_log` kini ditulis `alarmMonitor.js` (**item 8**); `trendRecorder.js` tetap tidak menulisnya. Baris lama tanggal 23/9 adalah data seed.
- ~~Cookie `secure: true` saat `NODE_ENV=production` membuat login gagal kalau diakses lewat `http://IP-lokal`~~: **diperbaiki di item 7** (env `COOKIE_SECURE`).
- ~~Login gagal tidak diaudit, tanpa batas percobaan; STOP/reset dan setpoint START tanpa audit sebelum aksi~~: **diperbaiki di item 7**.
- Env: `COOKIE_SECURE=true` hanya bila web diakses lewat HTTPS (default false); `ENABLE_DUMMY_PLC=true` (hanya dev) mengaktifkan data simulasi; `IOT_GATEWAY_HOST/PORT/USER/PASS` untuk KEPServerEX IoT Gateway.

### Skema DB (dari dump)
Tabel: `alarm_log` (sejak item 8 ada kolom `episode_id`, `alarm_key`, `batch_no`, `phase_code`, `description`), `monitor_heartbeat` (satu baris, item 8), `audit_log`, `batch_records`, `batch_trend`, `recipes`, `tag_readings` (tidak dipakai), `tags` (tidak dipakai `plc.js`), `users`.
Constraint penting: `batch_records.status` ∈ {running, finished, aborted}; `sterilization_result` ∈ {pass, fail, pending}; unique index parsial `one_running_batch`; `users.role` ∈ {operator, admin}. `batch_trend` menyimpan satu kolom tekanan `p` (= P1), `avg`, `cond`, `phase_code`.

### F0 dan laporan (dari printout SCADA lama 2026/10/3)
- Rumus F0: `Σ 10^((T−121.0)/10) × Δt(menit)` per sensor, dari Run.Begin sampai End (semua baris trend). T_ref **121,0** (bukan 121,1), z = 10.
- Terverifikasi: 8 dari 9 nilai F0 (F01–F06, FOM, FOL) cocok dengan printout dalam selisih ±0,1. **FOH (sensor TH) selisih +2,7** dan penyebabnya belum jelas (kolom TH penuh lonjakan sesaat yang bersamaan dengan lonjakan tekanan).
- Metode right-endpoint, trapesium, dan left menghasilkan angka hampir sama (selisih ≤ 0,1).
- Pola pencatatan SCADA lama: baris tiap 60 detik, ditambah baris peristiwa (Run.Begin, Heat.Begin, Ster.Begin, Cool.Begin, Run.Finish), lalu tepat 2 baris setelah Run.Finish. Ini sama dengan `trendRecorder.js`.
- `Avg` = rata-rata `TH`, `TM`, `TL`.
- Grafik lama: sumbu kiri 0–150 °C, sumbu kanan 0–304 kPa.

### Keputusan dari pemilik proyek
- Data hilang **tidak pernah terjadi** di SCADA lama.
- SCADA lama **tidak punya kriteria Pass/Fail**. Label PASS/FAIL di web ditambahkan agen AI, bukan fitur asli.
- Mode F0 tidak pernah dipakai. Control Type selalu **Time**.
- `FOVAL Setting` hanya "wadah": angka positif bebas dari QA per produk (contoh 6 menit), opsional.
- Buzzer 5 menit saat heating/cooling dianggap pemberitahuan biasa; web tidak membacanya.
- Pengembangan saat ini fokus ke web; ~~mesin belum tersambung~~ → **9 Okt 2026:** web sudah diuji tersambung **baca-saja** lewat perangkat ODOT ke PLC, bersamaan dengan SCADA lama yang tetap menjadi master dan menjalankan proses masak.
- (9 Okt) Target baru: **siapa pun yang memulai proses** (web, SCADA lama, panel), web harus ikut merekam semua data termasuk `batch_records`, dan web bisa STOP. Lihat item 9.
- (9 Okt) Cetak batch: satu tombol menghasilkan data record + kurva + daftar alarm periode batch (seperti SCADA lama); halaman Alarm dan Trend tetap bisa cetak mandiri. Lihat item 18.
- (9 Okt) Prepare menjadi popup dengan Mach. ID default SG-40 dan master produk/spesifikasi (master **terpisah**); checkbox risiko dihapus, cukup popup konfirmasi. Lihat item 17.
- (9 Okt) Adopsi proses luar: **otomatis** (tanpa tombol manual), STOP aktif dan data record berjalan begitu SCADA lama START; tanpa penandaan batch uji; nomor batch asli di kolom terpisah `external_batch_no`; nomor/keterangan batch SCADA lama kemungkinan tidak terbaca. Lihat item 9.
- (9 Okt) Nomor batch tidak boleh sama, **kecuali rerun batch aborted**. Lihat item 20.
- (9 Okt) Idle logout **diperlukan, 7 menit**. Lihat item 14 dan pertanyaan #21.
- (9 Okt) Export Excel dan audit cetak alarm **tidak diperlukan**. Blok `x-client-ip`/`TRUST_PROXY` di `server.js` **dihapus**.
- (9 Okt) Pemilik sudah menguji dua kali: dual-monitoring baca-saja (termasuk mencoba tombol STOP dari web), lalu START/STOP penuh dari web. Hasil rinci belum dicatat (#22).
- (9 Okt) **Item 19 dibatalkan.** START dan STOP **tetap bergantung database** (tidak ada jalur tanpa DB). Adopsi otomatis dengan jeda **3–5 detik**. Idle logout 7 menit **hanya saat mesin idle** (di luar fase masak).
- (9 Okt) "PREPARE" di web = fase **idle** (VW98 0/1) **sebelum START**, bukan fase sesudah START; label diganti "IDLE" (item 21).

### Peta rute (dari build)
Halaman: `/`, `/alarm`, `/print/alarm`, `/audit-log`, `/data-report`, `/data-report/[batchNo]`, `/formula`, `/login`, `/prepare`, `/trend`, `/users`, `/print/audit-log`, `/print/batch-records`, `/print/data-report/[batchNo]` (+ `/curve`).
API: `alarms` (+`active`, `event-types`, `print-data`), `audit-log` (+`export`, `filters`), `auth/{login,logout,me,users}`, `batch/{start,stop}`, `batch-records` (+`[batchNo]`, `export`), `db-test`, `formulas` (+`[formulaNo]`), `plc-test`, `plc/reset`, `status`, `users` (+`[username]`, `reset-password`).

---

## 4. Pertanyaan terbuka

| # | Pertanyaan | Untuk siapa |
|---|---|---|
| 1 | Kenapa FOH (TH) di printout lama 37,6 sedangkan hitungan dari tabel 40,3? | Pabrik / vendor SCADA lama |
| 2 | Definisi `Total.Time` di printout lama (60,0 vs 58,4 menit). Petunjuk (6 Okt): Run.Begin 15:18:47 sampai baris terakhir 16:18:53 = 60,1 menit, dekat 60,0; tetapi Cool.Time 21,2 tidak cocok dengan 15:53:57→16:17:13 (23,3 menit). Belum disimpulkan | Pabrik |
| 3 | ~~Boleh berulangkah `Batch No`?~~ **Diputuskan 9 Okt:** tidak boleh berulang kecuali rerun batch **aborted** (lihat item 20); run kosongan tetap bernama otomatis `KOSONGAN dd.mm.yy[-N]` | Selesai |
| 4 | **Sebagian (9 Okt):** `I2.1`/`I2.2` hanya muncul sebagai syarat START (harus tidak aktif) di `SBR0`; fungsi fisiknya tidak terlihat dari AWL. Web tidak membaca keduanya, jadi START ditolak PLC tanpa penjelasan bila salah satu aktif. Dapat dicek di mesin lewat Quick Client (tag di `SiemensS7-200_tambahan.csv`) | Teknisi / pengamatan di mesin |
| 5 | ~~Arti `VW212`, `VW214`, `VW224`, `VW236`, `VW250`, `VW252`~~ **Terjawab dari AWL (9 Okt):** `VW212`/`VW214` (jendela tekanan), `VW224`, `VW236`, `VW250` dihitung PLC tiap scan; `VW252` = OVER_TEMP (parameter). **Masih terbuka:** nilai `VW234` (ambang suhu produk untuk `Q2.1`) dan `VW238` (durasi drain, 0,1 detik) yang tidak diset ladder; baca di mesin | Pengamatan di mesin |
| 6 | Teks alarm lengkap beserta penyebab dan solusinya. **Sebagian:** draf dari logika PLC sudah ada di `alarmCatalog.js` (`confirmed: false`); perlu dikoreksi teknisi/QA, terutama kolom "Tindakan" | Manual mesin / teknisi / QA |
| 7 | **Sebagian (9 Okt):** idle logout 7 menit diperlukan (item 14). **Masih terbuka:** apakah produk masuk regulasi farmasi teregulasi (BPOM/CFR 21 Part 11)? | Pemilik proyek |
| 8 | **Sebagian terjawab (9 Okt):** `I1.5`/`I0.4` tombol buka pintu, `I0.6` tombol release. `I0.7` hanya muncul di `M8.7`; fungsinya tidak terlihat dari AWL (kemungkinan input pengaman; tebakan). Cek di Quick Client apakah pernah aktif | Pengamatan di mesin |
| 9 | Apakah buzzer berbunyi di sekitar menit ke-50 pemanasan (`ALM_M10_1`)? Apakah itu alarm sungguhan? | Operator |
| 10 | **Terjawab sebagian (9 Okt):** `VW250` = `STER_SET` + 2,0 °C. Keenam cabang `SBR10` memindahkan `VW104` (T2) ke `VW126` walau kondisinya menyusun pemilihan median T2/T3/T4: di export `VW126` = T2. Bug PLC atau artefak export belum bisa dibedakan. Bandingkan `VW126` dengan T2/T3/T4 di Quick Client | Pengamatan di mesin |
| 11 | **Terjawab sebagian (9 Okt):** `M5.0` = mode manual (`SBR9`); pulsa sesaat pada `M5.0` mereset PLC ke idle seperti STOP. Alarm "M5" SCADA lama yang muncul dan pulih dalam detik yang sama kemungkinan pulsa itu (dugaan). Teks lengkap dan apa yang terjadi di mesin pada 3 Okt 18:45:40 masih terbuka | Operator |
| 12 | Perlukah alarm tekanan tinggi/rendah? PLC tidak punya. Bila ya, itu alarm buatan web dan QA harus menetapkan ambang | QA / pemilik proyek |
| 13 | ~~Fungsi `Q3.3` dan `Q1.5`~~ **Terjawab dari AWL (9 Okt):** `Q1.5` = vent/exhaust chamber (SDFC; lihat tabel output di bagian 3); `Q3.3` = keluaran buzzer gabungan `M10.0`–`M10.6`; `Q2.5` = buzzer untuk `M8.0`/`M8.1`/`M8.2`/END. Lokasi fisik buzzer tidak terlihat dari AWL | Selesai |
| 14 | ~~Hapus blok `x-client-ip`/`TRUST_PROXY` di `server.js`?~~ **Diputuskan 9 Okt: hapus** (commit terpisah) | Selesai |
| 15 | ~~Perlukah Export Excel dan audit cetak alarm?~~ **Diputuskan 9 Okt: tidak perlu** | Selesai |
| 17 | ~~Apakah SCADA lama menyimpan nomor formula/batch di memori PLC?~~ **Terjawab 9 Okt: tidak.** AWL tidak punya register nomor batch/formula/produk (hanya jam real-time `VB4000`–`VB4005`; subrutin Modbus tidak dipanggil). Nomor batch SCADA lama tidak bisa dibaca; batch adopsi bernama otomatis | Selesai |
| 18 | ~~Batch adopsi pendek ditandai "bukan produksi"?~~ **Diputuskan 9 Okt: tidak perlu penandaan**, biarkan | Selesai |
| 19 | ~~Produk dan spesifikasi melekat ke formula atau master terpisah?~~ **Diputuskan 9 Okt: master terpisah** | Selesai |
| 20 | **Sebagian (9 Okt):** CSV punya `WTR_FILL` (Q2.0, PWCV, isi air murni) yang sudah dibaca web tetapi tidak digambar; dugaan kuat valve **SOFT WATER**. Kandidat COMPRESSED AIR: `Q1.3`/`Q1.6` (ON saat P ≤ `VW214`; tanpa tag). **DRAIN** (vertikal) belum teridentifikasi (kandidat `Q1.2`/`Q1.0`/`Q2.1`, tanpa tag). Perlu bukti Quick Client dan foto SCADA lama (bagian 5 butir 10) | Pengamatan di mesin |
| 16 | ~~Perlukah STOP web tanpa DB?~~ **Diputuskan 9 Okt: START dan STOP tetap bergantung database** (tidak diubah); tombol STOP fisik tetap pengaman utama | Selesai |

| 21 | ~~Perilaku idle logout saat batch berjalan~~ **Diputuskan 9 Okt: idle logout 7 menit hanya saat mesin idle; tidak berlaku selama proses berjalan.** Asumsi: fase 0/1 dan 6 bukan proses (konfirmasi bila fase 6 harus dikecualikan) | Selesai (asumsi fase 6) |
| 22 | Hasil dua uji 9 Okt (dual baca-saja + tombol STOP dari web; lalu START/STOP penuh dari web): apakah START menulis setpoint dengan benar, fase berpindah, STOP mengembalikan ke idle, adakah hal tak terduga (STOP tertahan, setpoint salah, dsb.)? | Pemilik proyek |
| 23 | ~~Alamat, arti, satuan, scaling tag yang ditulis web~~ **Terjawab dari AWL dan CSV (9 Okt):** ketujuh tag setpoint menunjuk variabel yang benar dengan skala yang benar (rincian di item 13). `START`/`STOP` = `M1.4`/`M1.5` (level, pulsa) | Selesai |

*Terjawab:* buzzer 5 menit heating/cooling = pemberitahuan, bukan alarm (pengamatan mesin + operator; cocok dengan `M10.0`/`M10.4` di AWL, 8 Okt).

---

## 5. Checklist saat pertama kali tersambung ke PLC

Lakukan sekali, di Quick Client lalu di dashboard:
1. 60 tag KEPServerEX berstatus **Good**; nilai wajar (suhu ÷10 masuk akal, tekanan kPa, `HEAT_TIME`/`COOL_TIME` dalam detik).
2. 9 tag `ALM_*` bernilai **0** saat mesin idle dan pintu tertutup.
3. Dashboard berhenti menampilkan NO DATA dan banner PLC hilang.
4. Amati `ALM_M10_1` (dan bit grup review lain) sepanjang **satu batch normal**. Catat mana yang pernah menyala; jawaban untuk pertanyaan #9, #10 dan penentu pemindahan bit ke grup fault.
5. Uji auto-finalize: selesaikan batch tanpa STOP dari web, pastikan batch tertutup setelah PLC idle ≥ 120 detik.
6. (Item 6) START dari web: `recipe_snapshot` terisi (bukan NULL) dan nilainya sama dengan resep saat START. Setelah batch selesai, `ster_time_min` sama dengan `sterilTimeMin` di snapshot. Edit resep itu lalu buka Data Report batch tadi: nilai batch tidak berubah.
7. (Item 7) START dari web: di Audit Log, `plc_setpoints_written` muncul **sebelum** `start_batch`, berisi nilai tulis dan baca-balik yang sama dengan resep. STOP dari web meninggalkan `stop_requested` sebelum `stop_batch`.
8. (Item 8) Dengan PLC tersambung:
   - Terminal menampilkan `Alarm monitor berjalan`; di halaman Alarm muncul `communication_normal` setelah komunikasi pulih; `monitor_heartbeat.beat_at` bergeser tiap ~10 detik.
   - Saat idle dan pintu tertutup tidak ada alarm aktif (kelima bit fault = 0).
   - Picu `M8.1` (tekan START dengan kedua pintu terbuka, mesin kosong/aman): popup merah muncul dalam beberapa detik, bunyi terdengar, tercatat **satu** baris `alarm_active` lalu satu `alarm_recovery` sekitar 10 detik setelah bit mati; STOP tetap terlihat dan bisa ditekan.
   - Minimize: banner merah dan bunyi berhenti; alarm baru membuka panel lagi.
   - Selama satu batch normal: tidak ada alarm palsu, terutama `M10.2`/`M10.3` pada fase steril (denyut 120 detik harus tetap **satu** episode).
   - Matikan server >= 30 detik lalu nyalakan: tercatat `monitor_gap`. Cabut komunikasi PLC >= 5 detik: tercatat `communication_abnormal` satu kali.
   - Halaman Alarm: label dan warna benar; filter tanggal dan **Cetak / PDF** menghasilkan nama file `Log Alarm ...` dan nomor halaman.
9. (Item 10) Dengan PLC tersambung, uji hasil perintah yang tidak mulus:
   - STOP dari web dengan PLC normal: tidak ada panel peringatan; `stop_batch` di Audit Log tanpa kata PERINGATAN.
   - Putus komunikasi PLC/KEPServerEX sebentar lalu STOP dari web: panel merah "STOP TIDAK sampai ke mesin" atau "STOP mungkin tertahan aktif di PLC" muncul, bertahan sampai "Sudah dicek, tutup", dan Audit Log memuat baris PERINGATAN.
   - Bila `STOP` tertahan ON: pastikan nilainya bisa ditulis 0 lewat Quick Client dan mesin kembali normal.
   - START dengan pulsa tidak sempurna: halaman Prepare tidak pindah otomatis dan menampilkan panel "START mungkin tertahan aktif".
   - START saat pintu/seal tidak siap (409): banner merah biasa; bila `stuckRisk`, panel merah dengan langkah melepas `START = false`.
   - Cek `start_batch_critical` muncul di dropdown filter Audit Log setelah ada kejadiannya.
10. (Item 11a, 21) Bukti valve, dengan SCADA lama dan web berdampingan dan Quick Client terbuka. Import dulu `SiemensS7-200_tambahan.csv` ke KEPServerEX. Untuk **setiap fase** (idle siap, isi air, pemanasan, sterilisasi, pendinginan, buang, selesai) catat: valve apa yang menyala di layar SCADA lama; valve apa yang menyala di web; nilai bit output di Quick Client (`Q0.6`, `Q0.7`, `Q1.0`–`Q1.7`, `Q2.0`, `Q2.1`, `Q3.0`). Bandingkan dengan tabel "Output per fase" di bagian 3. Khusus DRAIN, COMPRESSED AIR, SOFT WATER: output mana yang menyala bersamaan dengan animasinya di SCADA lama. Foto kedua layar pada momen yang sama.
11. (Item 9) Uji adopsi dengan setup ODOT: lihat "Rencana uji" di item 9.

---

## 6. Template membuka sesi AI berikutnya (isi nomor item)

Attach: `ROADMAP.md`, `export_atv.awl`, `SiemensS7-200.csv`, `plc.js`, dump skema DB (SQL polos), `api_batch_start_route.js`, `api_status_route.js` (untuk `dbError`).

Prompt:
> Baca ROADMAP.md sepenuhnya. Kerjakan **hanya Item <N>** (lihat bagian 0 dan 2 untuk file yang diperlukan). Sebelum mengedit, tulis rencana dan daftar file yang akan diubah. Jangan menebak: jika sebuah file belum kamu lihat, katakan. Verifikasi klaim penting ke `export_atv.awl` dan skema DB. Setelah selesai berikan: perintah SQL migrasi (cek duplikat dulu), file yang diubah dengan nama unik, dan cara mengujinya. Lalu perbarui bagian status di ROADMAP.md.

---

## 7. Catatan keamanan
- Dump DB yang pernah dibagikan memuat hash password tabel `users` (3 akun, data uji). Reset password akun tersebut kalau file itu pernah tersebar, atau pastikan itu memang akun uji.
- `/api/auth/users` (item 7) publik: menampilkan username dan nama lengkap user aktif tanpa login, untuk dropdown halaman login. Aman selama web hanya diakses dari PC mesin; hapus bila web dibuka ke jaringan lain.
- Jangan commit `.env.local`. Isinya JWT secret, kredensial database, dan kredensial KEPServerEX.
