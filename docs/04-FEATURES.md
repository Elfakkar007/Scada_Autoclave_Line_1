# Daftar Fitur & Penelusuran Alur Kode (Features)

Dokumen ini mendokumentasikan seluruh fitur fungsional sistem `scada-sterilizer` yang memiliki rantai keterhubungan kode lengkap: rute antarmuka → komponen → endpoint API backend → modul logika bisnis / driver PLC / query database.

---

## 1. Fitur Autentikasi Pengguna & Pembatasan Percobaan Login

### Deskripsi Faktual
Pengguna memilih akun dari dropdown nama pengguna aktif dan memasukkan password. Sistem memeriksa batas percobaan gagal (maksimal 5 kali salah per username dalam 15 menit). Jika password cocok, sistem mencatat waktu login, menulis entri audit log, dan menerbitkan cookie sesi JWT HTTP-only berdurasi 8 jam. Bila login salah 5 kali berturut-turut, sistem memblokir login untuk akun tersebut dan mengembalikan header respons HTTP `Retry-After`.

### Rantai Alur Kode
1. **Halaman UI**: Pengguna mengakses rute login di `src/app/login/page.js`. Pada saat dimuat, fungsi `useEffect` memanggil endpoint publik `GET /api/auth/users` (`src/app/login/page.js:30`) untuk mengisi pilihan dropdown nama pengguna.
2. **Form Submit**: Pengguna memilih username dan mengetikkan password, memicu fungsi `handleSubmit` (`src/app/login/page.js:48`).
3. **API Handler**: Permintaan HTTP `POST` diterima oleh `src/app/api/auth/login/route.js`.
4. **Pemeriksaan Batas Gagal (Throttling)**: Fungsi `checkThrottle(username)` (`src/app/api/auth/login/route.js:25-50`) memeriksa tabel `audit_log` untuk menghitung event `login_failed` dalam 15 menit terakhir. Jika `>= 5`, endpoint mengembalikan status 429 Too Many Requests (`src/app/api/auth/login/route.js:98`).
5. **Verifikasi Hash Password & Status Akun**: Handler mengambil data pengguna dari tabel `users` join `roles` (`src/app/api/auth/login/route.js:108-115`) dengan filter `deleted_at IS NULL`. Password diverifikasi menggunakan `bcrypt.compare` (`src/app/api/auth/login/route.js:119`). Jika user tidak aktif (`is_active = false`), login ditolak (`src/app/api/auth/login/route.js:139`).
6. **Pencatatan Audit & Terbit Token**:
   - Jika berhasil: Memperbarui kolom `last_login_at` (`src/app/api/auth/login/route.js:154`), memanggil `insertAudit` (`src/app/api/auth/login/route.js:156`), membuat JWT via `createSessionToken` (`src/lib/auth.js:23`) yang membawa `roleKey`, `roleId`, `roleName`, dan menyetel cookie `session_token` dengan opsi keamanan `sessionCookieOptions` (`src/app/api/auth/login/route.js:176`).
   - Jika gagal: Memanggil `tryAudit` dengan action `login_failed` (`src/app/api/auth/login/route.js:123`) dan mengembalikan status 401.
7. **Proteksi Akses Halaman**: Setiap permintaan ke rute terproteksi diperiksa oleh middleware `src/proxy.js:10-38` yang membaca cookie `session_token` dan memvalidasinya menggunakan `verifySessionToken` (`src/lib/auth.js:36`).
8. **Logout**: Tombol logout pada `src/components/Navbar.js:33` mengirimkan `POST /api/auth/logout/route.js`, mencatat audit log, dan menghapus cookie `session_token` (`src/app/api/auth/logout/route.js:24`).

### Bukti Kode
- `src/app/login/page.js:48-95`
- `src/app/api/auth/login/route.js:12-146`
- `src/lib/auth.js:25-50`
- `src/proxy.js:10-38`

---

## 2. Fitur Pengunci Layar Otomatis & Buka Kunci (Screen Lock)

### Deskripsi Faktual
Setelah 7 menit tanpa adanya interaksi fisik (pergerakan mouse atau penekanan tombol keyboard), antarmuka menampilkan overlay pengunci layar penuh untuk mengamankan konsol SCADA. Pengguna harus memasukkan kembali kata sandi akunnya untuk membuka kunci tanpa membatalkan proses yang sedang berjalan.

### Rantai Alur Kode
1. **Layout Wrapper**: Komponen `src/components/ScreenLock.js` dipasang di `src/app/(app)/layout.js:49`.
2. **Deteksi Inaktivitas**: Event listener `mousemove`, `mousedown`, `keydown`, `touchstart`, dan `scroll` memperbarui timestamp `lastActivityRef` (`src/components/ScreenLock.js:29`). Jika waktu inaktivitas melebihi `LOCK_TIMEOUT_MS = 420000` (7 menit), state `locked` diubah menjadi `true` (`src/components/ScreenLock.js:36`).
3. **Form Buka Kunci**: Pengguna memasukkan password ke input modal dan memicu `handleUnlock` (`src/components/ScreenLock.js:45`).
4. **API Handler**: Permintaan dikirim ke `POST /api/auth/unlock/route.js`.
5. **Verifikasi & Audit**: Endpoint mengambil user dari database (`src/app/api/auth/unlock/route.js:30`), mencocokkan password dengan `bcrypt.compare`, dan mencatat aksi `unlock_screen` ke `audit_log` (`src/app/api/auth/unlock/route.js:63`).
6. **Buka Kunci**: Jika valid, komponen menyetel `locked = false` dan mereset timer inaktivitas (`src/components/ScreenLock.js:58`).

### Bukti Kode
- `src/components/ScreenLock.js:7-65`
- `src/app/api/auth/unlock/route.js:8-75`

---

## 3. Fitur Pengawasan Proses & Visualisasi Autoclave Real-Time

### Deskripsi Faktual
Halaman dashboard utama secara berkala setiap 1000 ms melakukan polling data status mesin ke backend. Data sensor ditampilkan dalam bentuk kartu metrik digital, status posisi pintu, kartu detail resep berjalan (termasuk F0 Target jika ada), kontrol tombol proses (START, STOP, Reset), blok pengendali pintu interaktif (Door Sealing dan tombol cerdas Door Release / MATIKAN), serta diagram visual interaktif yang menggambarkan animasi katup, level air, dan status pompa sirkulasi.

### Rantai Alur Kode
1. **Polling Dashboard**: Komponen `src/app/(app)/page.js:102` menjalankan `setInterval` setiap 1000 ms yang memanggil `fetch("/api/status")`.
2. **Backend Agregator**: Handler `src/app/api/status/route.js:17` memanggil fungsi `readPlcSnapshot()` dari `src/lib/plc.js:125`.
3. **Komunikasi IoT Gateway**:
   - `readPlcSnapshot` mengirim HTTP GET ke endpoint KEPServerEX `/iotgateway/read` (`src/lib/plc.js:145`).
   - Menerima array tag pembacaan PLC Siemens S7-200.
   - Melakukan penskalaan nilai: suhu dibagi 10 (`src/lib/plc.js:189-197`), tekanan kPa diambil langsung (`src/lib/plc.js:198`), target F0 dibagi 10 ke satuan menit (`src/lib/plc.js:78`), serta memetakan nilai integer register `PROCCES_TEXT` (VW98) ke objek fase proses (`src/lib/plc.js:213-233`).
4. **Pengambilan Status Batch**: Handler `src/app/api/status/route.js:23` menjalankan query `SELECT ... FROM batch_records WHERE status = 'running'` untuk menyematkan metadata batch aktif.
5. **Rendering Visual**:
   - Komponen internal `Gauge` pada `src/app/(app)/page.js:50-65` merender kartu indikator suhu dan tekanan (`src/app/(app)/page.js:471-488`).
   - Kartu Formula pada `src/app/(app)/page.js:754-759` menampilkan "F0 Target" bila `data.setpoints?.f0Val` terdefinisi.
   - Tombol Door Sealing dan Door Release pada `src/app/(app)/page.js:818-848`: Tombol Door Release kini berstatus cerdas (toggle); bila release sedang aktif (`releaseOn = !!data.door?.releaseCmd`), tombol berubah label menjadi "Release: MATIKAN" dengan warna merah (`#A23B2E`) untuk menonaktifkan pelepasan seal; bila tidak aktif, berlabel "Door Release" untuk mengaktifkan seal lepas.
   - Komponen `src/components/AtvDiagram.js` menerima properti sensor dan merender gambar bejana SVG beserta indikator katup aktif berwarna hijau/merah (`src/components/AtvDiagram.js:120-280`).

### Bukti Kode
- `src/app/(app)/page.js:102-120, 754-759, 818-848`
- `src/app/api/status/route.js:17-60`
- `src/lib/plc.js:78, 125-240`
- `src/components/AtvDiagram.js:120-280`

---

## 4. Fitur Memulai Batch Sterilisasi (Start Batch Sequence)

### Deskripsi Faktual
Operator membuka modal START, memasukkan Batch No, Loading No, memilih Nama Produk (dropdown/ketik manual), Spesifikasi Kemasan (dropdown/ketik manual), Jumlah Botol (amount integer positif), dan Formula Resep. Sistem mengunci eksekusi START dengan advisory lock `START_LOCK_KEY` agar tidak bisa ditekan ganda, memvalidasi resep, memeriksa ketiadaan batch aktif lain, memeriksa interlock fisik PLC (kedua pintu tertutup dan segel aktif), menulis setpoint resep (7 parameter dasar ditambah target F0 `F0_VAL` jika diisi) ke register PLC, melakukan verifikasi baca-balik setpoint hingga 4000 ms, mencatat audit setpoint terverifikasi, mengirim pulsa START (M1.4), menunggu konfirmasi PLC masuk fase proses (kode 2/3/4) maksimal 10 detik, dan membuat record baru di tabel `batch_records` (termasuk kolom `bottle_count`).

### Rantai Alur Kode
1. **Dialog Input**: Tombol "START BATCH" di `src/app/(app)/page.js:380` membuka modal `src/components/StartDialog.js`. Modal menyediakan form 2 kolom responsif, combobox pencarian `SearchableCombobox` untuk Nama Produk dan Spesifikasi Kemasan, serta validasi bilangan bulat positif untuk Jumlah Botol (`bottleCount`).
2. **Kirim START**: Operator menekan tombol "MULAI PROSES", memicu `handleStartSubmit` yang mengirim request `POST /api/batch/start` (`src/components/StartDialog.js:180`).
3. **Advisory Lock Server**: Handler `src/app/api/batch/start/route.js:105` memanggil `acquireStartLock()` menggunakan kunci advisory `START_LOCK_KEY` (`7401001` dari `src/lib/recipeGuard.js:10`) pada PostgreSQL (`src/app/api/batch/start/route.js:35`).
4. **Validasi Parameter**:
   - Memvalidasi Batch No melalui `validateBatchNo` (`src/lib/batchNo.js:16`).
   - Memeriksa keunikan Batch No pada tabel `batch_records` (`src/app/api/batch/start/route.js:218`).
   - Membaca dan memvalidasi `bottleCount` (atau `amount`) dari body (`src/app/api/batch/start/route.js:134-141`).
   - Memvalidasi rentang fisik resep melalui `validateRecipe` (`src/lib/recipeValidation.js:52`).
   - Membaca `recipe.fo_val_setting` jika ada untuk parameter F0 target (`src/app/api/batch/start/route.js:206`).
   - Membangun snapshot formula resep melalui `buildRecipeSnapshot` (`src/lib/recipeSnapshot.js:18`).
5. **Guard Interlock Mesin**:
   - Membaca snapshot PLC via `readPlcSnapshot` (`src/app/api/batch/start/route.js:245`).
   - Menolak jika rawPhase !== 1 (Idle siap) (`src/app/api/batch/start/route.js:290`).
   - Menolak jika pintu terbuka (`opnFrnt` / `opnRear`), pintu belum rapat tertutup (`!clsFrnt` / `!clsRear`), atau door seal belum aktif (`!door.seal`) (`src/app/api/batch/start/route.js:309-335`).
   - Menolak jika `ctrlSel === true` (mesin dalam mode F0 manual) (`src/app/api/batch/start/route.js:357`).
6. **Penulisan Setpoint ke PLC**:
   - Menyusun pasangan tag: `CTRL_TEMP`, `TEMP_SPACE`, `STER_SET`, `STER_SET_TIME`, `ALRM_PRES`, `COOL1_TEMP`, `COOL2_TEMP`, dan menyertakan `F0_VAL` (`Math.round(foValSetting * 10)`) bila target F0 terdefinisi (`src/app/api/batch/start/route.js:387-393`).
   - Mengirim request ke KEPServerEX via `writePlcTags` (`src/lib/plcWrite.js:16`).
7. **Verifikasi Pasca-Tulis**:
   - Melakukan polling pembacaan ulang setpoint ke PLC hingga 4000 ms (`src/app/api/batch/start/route.js:418-453`), mencocokkan seluruh setpoint dasar dan `F0_VAL`.
   - Jika terjadi selisih nilai, membatalkan START dan mencatat audit `start_batch_rejected` (`src/app/api/batch/start/route.js:468`).
8. **Audit Pre-Start (Fail-Closed)**:
   - Mencatat aksi `plc_setpoints_written` ke tabel `audit_log` via `insertAudit` (`src/app/api/batch/start/route.js:508`). Jika pencatatan audit gagal, proses START dibatalkan.
9. **Kirim Pulsa START**:
   - Mengirim pulsa tag START (M1.4): menulis true, jeda 1000 ms, menulis false melalui `pulsePlcTag("START")` (`src/lib/plcWrite.js:58`).
10. **Polling Fase PLC**:
    - Memanggil `pollUntilPhase([2, 3, 4], 10000, 500)` (`src/app/api/batch/start/route.js:547`) menunggu hingga register `PROCCES_TEXT` berubah menjadi kode 2 (Filling), 3 (Heating), atau 4 (Steril).
11. **Pencatatan Batch Record**:
    - Menjalankan `INSERT INTO batch_records` dengan kolom `bottle_count`, status `'running'`, dan snapshot resep JSON (`src/app/api/batch/start/route.js:618`).
    - Menyediakan fallback bila kolom `bottle_count` belum ada di database (`colErr.code === "42703"`, `src/app/api/batch/start/route.js:630`).
    - Mencatat aksi `start_batch` ke tabel `audit_log` (`src/app/api/batch/start/route.js:685`).

### Bukti Kode
- `src/components/StartDialog.js:1-420`
- `src/components/SearchableCombobox.js:1-204`
- `src/app/api/batch/start/route.js:1-755`
- `src/lib/recipeGuard.js:1-55`
- `src/lib/recipeValidation.js:52-120`
- `src/lib/plcWrite.js:16-85`

---

## 5. Fitur Menghentikan Batch Sterilisasi (Stop Batch)

### Deskripsi Faktual
Operator menekan tombol STOP pada dashboard untuk menyelesaikan atau membatalkan siklus sterilisasi. Sistem mencatat audit permintaan stop, mengirimkan pulsa STOP (M1.5) ke PLC, menghitung durasi akhir fase proses, menghitung integrasi nilai F0 seluruh sensor, menentukan status akhir batch (`finished` jika fase PLC = 6/Selesai, atau `aborted` jika dihentikan paksa sebelum selesai), dan memperbarui tabel `batch_records`.

### Rantai Alur Kode
1. **Aksi Tombol**: Operator menekan tombol "STOP BATCH" dan menyetujui dialog konfirmasi di `src/app/(app)/page.js:220`.
2. **API Handler**: Permintaan `POST` dikirim ke `/api/batch/stop/route.js`.
3. **Pencarian Batch Berjalan**: Mengambil baris batch berstatus `running` dari tabel `batch_records` (`src/app/api/batch/stop/route.js:19`).
4. **Baca Fase Mesin**: Membaca fase PLC sesaat sebelum STOP melalui `readPlcSnapshot` (`src/app/api/batch/stop/route.js:36`).
5. **Kirim Pulsa STOP PLC**: Memanggil `pulsePlcTag("STOP")` untuk menyalakan tag STOP (M1.5) selama 1000 ms lalu mematikannya kembali (`src/app/api/batch/stop/route.js:67`).
6. **Eksekusi Finalisasi Batch**: Memanggil `finalizeBatch(batch.id, { plcPhase })` dari `src/lib/batchFinalize.js:19`:
   - Mengambil data deret waktu dari tabel `batch_trend` (`src/lib/batchFinalize.js:35`).
   - Menganalisis waktu mulai tiap tahapan melalui `analyzeProcessPhases` (`src/lib/atvProcess.js:10`).
   - Menghitung nilai letalitas panas F0 untuk 9 sensor suhu (T1-T6, TH, TM, TL) dan nilai minimum F0 melalui `computeBatchF0` (`src/lib/f0.js:140`).
   - Menentukan status akhir: `'finished'` jika `plcPhase === 6`, atau `'aborted'` jika selain itu (`src/lib/batchFinalize.js:69`).
   - Menjalankan `UPDATE batch_records` dengan nilai kalkulasi durasi menit dan F0 (`src/lib/batchFinalize.js:80`).
7. **Pencatatan Audit**: Memanggil `tryAudit` dengan action `stop_batch` ke tabel `audit_log` (`src/app/api/batch/stop/route.js:110`).

### Bukti Kode
- `src/app/(app)/page.js:220-250`
- `src/app/api/batch/stop/route.js:9-135`
- `src/lib/batchFinalize.js:19-120`
- `src/lib/f0.js:90-135`

---

## 6. Fitur Perekaman Data Trend Latar Belakang & Finalisasi Otomatis

### Deskripsi Faktual
Proses latar belakang berjalan secara independen di Node.js server setiap 5 detik. Jika ada batch yang berstatus `running`, data sensor saat itu disimpan ke tabel `batch_trend`. Jika mesin terdeteksi telah kembali ke status Idle (kode 0 atau 1) selama minimal 120 detik berturut-turut pada batch yang telah berjalan lebih dari 90 detik, sistem secara otomatis menutup dan memfinalisasi batch tersebut.

### Rantai Alur Kode
1. **Inisialisasi Interval**: `server.js:46` menjalankan `setInterval(recordTrendTick, 5000)`.
2. **Pengecekan Batch Berjalan**: `src/lib/trendRecorder.js:26` memeriksa apakah ada batch berstatus `running` di tabel `batch_records`.
3. **Perekaman Titik Sensor**: Membaca snapshot sensor via `readPlcSnapshot` dan menjalankan `INSERT INTO batch_trend (batch_id, ts, t1, t2, t3, t4, t5, t6, p, th, tm, tl, avg, cond, phase_code)` (`src/lib/trendRecorder.js:60`).
4. **Deteksi Idle & Auto-Finalize**:
   - Memeriksa durasi berjalan batch (`durationSec > 90`) dan fase mesin (`rawPhase === 0 || rawPhase === 1`) (`src/lib/trendRecorder.js:75-80`).
   - Menghitung waktu akumulasi idle mesin. Jika `idleDurationSec >= 120` detik, fungsi memanggil `finalizeBatch(batch.id, { plcPhase: rawPhase })` (`src/lib/trendRecorder.js:80`).
   - Menulis catatan ke `audit_log` dengan deskripsi bahwa batch difinalisasi otomatis karena mesin idle (`src/lib/trendRecorder.js:85`).

### Bukti Kode
- `server.js:46-48`
- `src/lib/trendRecorder.js:20-110`

---

## 7. Fitur Pemantau Alarm Latar Belakang & Adopsi Proses Eksternal

### Deskripsi Faktual
Background worker berjalan setiap 1 detik untuk membaca 5 register alarm fisik PLC Siemens S7-200. Jika bit alarm aktif, sistem mencatat episode baru ke `alarm_log`. Saat bit alarm kembali normal, sistem mencatat waktu dan nilai recovery pada episode yang sama. Selain itu, worker memperbarui timestamp `beat_at` ke tabel `monitor_heartbeat`. Jika mesin terdeteksi berjalan pada fase sterilisasi aktif (kode 2, 3, 4, 5, atau 7) tanpa adanya batch berstatus `running` di web (misalnya dimulai manual dari panel tombol fisik), worker secara otomatis mengadopsi proses tersebut dan membuat baris batch baru di `batch_records`.

### Rantai Alur Kode
1. **Inisialisasi Worker**: `server.js:52` memanggil fungsi `startAlarmMonitor()` dari `src/lib/alarmMonitor.js`.
2. **Polling Loop**: Fungsi `tick()` berjalan setiap 1000 ms (`src/lib/alarmMonitor.js:40`).
3. **Detak Jantung (Heartbeat)**: Menjalankan query `UPDATE monitor_heartbeat SET beat_at = now() WHERE id = 1` setiap 10 detik (`src/lib/alarmMonitor.js:55`).
4. **Evaluasi Transisi Alarm**:
   - Membaca 5 tag alarm PLC: `m8_0` (F_WATER), `m8_1` (F_DOOR), `m8_2` (OVER_PRES), `m10_2` (WATER_EMPTY), `m10_3` (DRAIN_FAIL) (`src/lib/alarmMonitor.js:70`).
   - Menjalankan `detectAlarmTransitions` dari `src/lib/alarmEpisodes.js:25`.
   - Menulis entri `alarm_active` atau `alarm_recovery` ke tabel `alarm_log` dengan UUID `episode_id` yang konsisten (`src/lib/alarmMonitor.js:90-120`).
5. **Adopsi Proses Eksternal**:
   - Jika `rawPhase` masuk dalam `[2, 3, 4, 5, 7]` namun query `SELECT id FROM batch_records WHERE status = 'running'` menghasilkan 0 baris (`src/lib/alarmMonitor.js:140`).
   - Memanggil `adoptRunningProcess`: mencari formula resep default, menghasilkan Batch No otomatis dengan awalan `EXT-`, dan menyisipkan baris baru ke `batch_records` (`src/lib/alarmMonitor.js:160-195`).
   - Mencatat kejadian adopsi proses eksternal ke tabel `audit_log`.

### Bukti Kode
- `server.js:52-54`
- `src/lib/alarmMonitor.js:40-205`
- `src/lib/alarmEpisodes.js:25-95`

---

## 8. Fitur Pusat Peringatan Suara & Notifikasi Alarm Real-Time (Alarm Center)

### Deskripsi Faktual
Komponen global AlarmCenter melakukan polling ke backend setiap 2 detik. Jika terdapat alarm yang aktif, komponen memunculkan baris peringatan merah menyala di bagian atas layar dan memutar audio suara alarm loop `/sounds/alarm.wav`. Pengguna dapat mengklik tombol "Lihat Detail" untuk membuka modal panduan tindakan perbaikan berdasarkan `ALARM_CATALOG`, atau menekan "Bungkam Suara" untuk mematikan audio selama 5 menit.

### Rantai Alur Kode
1. **Polling Status Alarm**: `src/components/AlarmCenter.js:40` memanggil `GET /api/alarms/active` setiap 2000 ms.
2. **Query Database**: Handler `src/app/api/alarms/active/route.js:17` mencari baris `alarm_log` yang memiliki `event_type = 'alarm_active'` dan belum memiliki record `alarm_recovery` pada `episode_id` yang sama.
3. **Pencocokan Katalog**: Handler menggabungkan informasi dari `ALARM_CATALOG` (`src/lib/alarmCatalog.js:10`) untuk menyertakan judul alarm, dugaan penyebab (`cause`), dan tindakan perbaikan (`action`).
4. **Audio & UI Trigger**:
   - Jika array `active.length > 0` dan tidak dalam kondisi dibungkam (`!isMuted`), komponen memanggil `audio.play()` secara berulang (`src/components/AlarmCenter.js:78`).
   - Merender banner merah berkedip di bawah navbar (`src/components/AlarmCenter.js:130`).
   - Menampilkan modal detail interaktif dengan daftar tindakan yang disarankan bagi operator (`src/components/AlarmCenter.js:180-230`).

### Bukti Kode
- `src/components/AlarmCenter.js:35-110`
- `src/app/api/alarms/active/route.js:14-55`
- `src/lib/alarmCatalog.js:1-50`

---

## 9. Fitur Reset Mesin dari Fase Selesai ke Siap (PLC Reset Sequence)

### Deskripsi Faktual
Saat proses sterilisasi telah selesai (kode fase PLC = 6) namun tidak ada batch aktif di web, mesin memerlukan pulsa STOP untuk mereset status logika ladder PLC kembali ke posisi Siap/Idle (kode 1). Operator dapat menekan tombol "RESET MESIN" pada dashboard utama untuk mengirimkan pulsa perintah tersebut.

### Rantai Alur Kode
1. **Trigger UI**: Operator menekan tombol "RESET MESIN (SELESAI → IDLE)" di `src/app/(app)/page.js:410`.
2. **API Handler**: Permintaan dikirim ke `POST /api/plc/reset/route.js`.
3. **Guard Validasi**:
   - Menolak jika masih ada batch `running` di tabel `batch_records` (`src/app/api/plc/reset/route.js:34`).
   - Membaca snapshot PLC; menolak jika fase mesin bukan kode 6 (Finished) (`src/app/api/plc/reset/route.js:72`).
4. **Audit Permintaan**: Memanggil `tryAudit` dengan action `plc_reset_requested` (`src/app/api/plc/reset/route.js:85`).
5. **Kirim Pulsa**: Memanggil `pulsePlcTag("STOP")` ke KEPServerEX (`src/app/api/plc/reset/route.js:97`).
6. **Audit Hasil**: Mencatat hasil pulsa ke tabel `audit_log` (`src/app/api/plc/reset/route.js:109`).

### Bukti Kode
- `src/app/(app)/page.js:260-285`
- `src/app/api/plc/reset/route.js:22-155`

---

## 10. Fitur Pengelolaan Formula Resep Sterilisasi (Formula CRUD)

### Deskripsi Faktual
Administrator sistem dapat menambah, mengedit parameter fisik, dan menghapus formula resep sterilisasi. Setiap input diverifikasi ketat terhadap batasan fisik autoclave. Resep yang sedang digunakan oleh batch yang berstatus `running` diblokir dari pengeditan atau penghapusan, dan resep yang memiliki riwayat batch masa lalu dilindungi dari penghapusan demi menjaga integritas data audit trail.

### Rantai Alur Kode
1. **Halaman UI**: Antarmuka diakses pada rute `src/app/(app)/formula/page.js`.
2. **Pengambilan Daftar**: Halaman memanggil `GET /api/formulas/route.js` yang mengembalikan seluruh resep dan status validasinya (`validateRecipe`).
3. **Penyimpanan Resep Baru**:
   - Admin mengisi form modal dan menekan Simpan (`src/app/(app)/formula/page.js:210`).
   - Request `POST /api/formulas/route.js` memvalidasi batasan nilai dengan `validateRecipe(..., { strict: true })` (`src/app/api/formulas/route.js:89`).
   - Menjalankan transaksi SQL: `INSERT INTO recipes` dan `INSERT INTO audit_log` (`src/app/api/formulas/route.js:109-150`).
4. **Pembaruan Resep**:
   - Request `PUT /api/formulas/[formulaNo]/route.js` membuka transaksi dengan kunci baris `FOR UPDATE` (`src/app/api/formulas/[formulaNo]/route.js:96`).
   - Memeriksa apakah START sedang berlangsung via `isStartInProgress` dan memeriksa apakah resep sedang dipakai batch aktif via `getRecipeUsage` (`src/app/api/formulas/[formulaNo]/route.js:107`).
   - Memperbarui tabel `recipes` dan mencatat selisih perubahan nilai lama dan baru ke `audit_log` (`src/app/api/formulas/[formulaNo]/route.js:180-205`).
5. **Penghapusan Resep**:
   - Request `DELETE /api/formulas/[formulaNo]/route.js` memeriksa `usage.total > 0`. Jika resep pernah dipakai oleh batch masa lalu mana pun, request ditolak dengan status 409 Conflict (`src/app/api/formulas/[formulaNo]/route.js:266`).
   - Jika belum pernah dipakai, resep dihapus dan dicatat ke `audit_log`.

### Bukti Kode
- `src/app/(app)/formula/page.js:70-250`
- `src/app/api/formulas/route.js:29-168`
- `src/app/api/formulas/[formulaNo]/route.js:61-320`
- `src/lib/recipeGuard.js:25-50`

---

## 11. Fitur Pengelolaan Master Produk & Spesifikasi Kemasan

### Deskripsi Faktual
Menyediakan pengelolaan master data terpisah untuk Nama Produk (tabel `product_names`) dan Spesifikasi Kemasan (tabel `product_specs`). Admin dapat menambah nama/spesifikasi baru, mengubah teks, mengaktifkan/menonaktifkan status agar tampil di pop-up START, serta menghapus data.

### Rantai Alur Kode
1. **Halaman UI**: Menggunakan komponen tab navigasi ganda di `src/app/(app)/products/page.js`.
2. **API Handler Produk**:
   - `GET /api/products/route.js`: Membaca daftar nama produk (opsi `?active=true`).
   - `POST /api/products/route.js`: Validasi keunikan case-insensitive `lower(btrim(name))`, insert ke `product_names`, dan mencatat audit `create_product_name`.
   - `PUT /api/products/[id]/route.js`: Mengubah nama atau status `isActive`, mencatat audit `update_product_name`.
   - `DELETE /api/products/[id]/route.js`: Menghapus baris dari `product_names`, mencatat audit `delete_product_name`.
3. **API Handler Spesifikasi**:
   - Rantai yang sama diterapkan untuk entitas spesifikasi kemasan melalui `src/app/api/product-specs/route.js` dan `src/app/api/product-specs/[id]/route.js` pada tabel `product_specs`.

### Bukti Kode
- `src/app/(app)/products/page.js:90-230`
- `src/app/api/products/route.js:41-125`
- `src/app/api/products/[id]/route.js:42-180`
- `src/app/api/product-specs/route.js:41-125`
- `src/app/api/product-specs/[id]/route.js:42-180`

---

## 12. Fitur Manajemen Akun Pengguna & Reset Password

### Deskripsi Faktual
Administrator dapat melihat daftar seluruh akun operator dan admin, mendaftarkan user baru dengan password minimal 6 karakter, mengubah nama lengkap dan role, menonaktifkan akun (soft-delete), serta mereset kata sandi pengguna tanpa menghapus riwayat audit aktor tersebut.

### Rantai Alur Kode
1. **Halaman UI**: Rute `src/app/(app)/users/page.js` dilindungi proteksi level halaman yang memeriksa `json.user.role === 'admin'` (`src/app/(app)/users/page.js:379`).
2. **Tambah User**:
   - Form `AddUserForm` mengirim `POST /api/users/route.js` (`src/app/(app)/users/page.js:45`).
   - Handler memvalidasi keunikan username, melakukan hash password dengan `bcrypt.hashSync(password, 10)`, menyimpan ke tabel `users`, dan mencatat ke `audit_log` (`src/app/api/users/route.js:82-105`).
3. **Ubah Data & Nonaktifkan Akun**:
   - Edit inline mengirim `PUT /api/users/[username]/route.js`. Terdapat self-protection: admin dilarang menonaktifkan akun dirinya sendiri (`src/app/api/users/[username]/route.js:43`).
   - Tombol "Nonaktifkan" mengirim `DELETE /api/users/[username]/route.js` yang menjalankan soft delete: `UPDATE users SET is_active = false` (`src/app/api/users/[username]/route.js:130`).
4. **Reset Password**:
   - Form Reset PW mengirim `POST /api/users/[username]/reset-password/route.js` (`src/app/(app)/users/page.js:207`).
   - Handler meng-hash password baru, mengupdate `password_hash` di tabel `users`, dan mencatat audit `reset_password` tanpa menyimpan string password (`src/app/api/users/[username]/reset-password/route.js:40-58`).

### Bukti Kode
- `src/app/(app)/users/page.js:35-230`
- `src/app/api/users/route.js:39-110`
- `src/app/api/users/[username]/route.js:18-150`
- `src/app/api/users/[username]/reset-password/route.js:7-62`

---

## 13. Fitur Riwayat Data Report & Ekspor Excel Batch

### Deskripsi Faktual
Pengguna dapat mencari data batch berdasarkan nomor batch, nama operator, atau produk, memfilter status batch, menyaring rentang tanggal WIB, membuka detail data laporan (termasuk informasi Jumlah Botol / Amount), serta mengekspor seluruh catatan batch ke dalam berkas spreadsheet Microsoft Excel (`.xlsx`) dan format JSON.

### Rantai Alur Kode
1. **Halaman Daftar**: `src/app/(app)/data-report/page.js:40` memanggil `GET /api/batch-records/route.js` dengan parameter query URL.
2. **Detail Batch**: Mengklik salah satu batch membuka `src/app/(app)/data-report/[batchNo]/page.js:35` yang mengambil data detail dan seluruh titik rekaman sensor dari `GET /api/batch-records/[batchNo]/route.js`. Kartu Informasi Produk menampilkan Amount / Jumlah Botol (`batch.bottleCount`).
3. **Ekspor Spreadsheet**:
   - Tombol "Export Excel" pada `src/app/(app)/data-report/page.js:140` mengarahkan browser ke `/api/batch-records/export?format=xlsx`.
   - Handler `src/app/api/batch-records/export/route.js:54` memvalidasi rentang baris (maksimal 50.000), mengambil data dari `batch_records` (termasuk kolom `bottle_count` dengan fallback), mencatat audit `export_batch_records`, dan membangun worksheet 26 kolom melalui `exceljs` (`src/app/api/batch-records/export/route.js:180-230`).
   - Mengembalikan response binary dengan header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### Bukti Kode
- `src/app/(app)/data-report/page.js:35-150`
- `src/app/(app)/data-report/[batchNo]/page.js:250-265`
- `src/app/api/batch-records/route.js:4-90`
- `src/app/api/batch-records/export/route.js:54-265`
- `src/app/api/batch-records/[batchNo]/route.js:4-127`

---

## 14. Fitur Audit Trail & Ekspor Log Aktivitas

### Deskripsi Faktual
Menyediakan pelacakan kepatuhan terhadap seluruh perubahan sistem SCADA: mencatat aktor, waktu kejadian WIB, tipe aksi, entitas yang diubah, serta payload nilai lama dan nilai baru dalam format JSON. Admin dapat memfilter jejak audit dan mengekspornya ke berkas Excel XLSX.

### Rantai Alur Kode
1. **Halaman UI**: `src/app/(app)/audit-log/page.js:80` memanggil `GET /api/audit-log/route.js` dan `GET /api/audit-log/filters/route.js`.
2. **Query Database**: Handler `src/app/api/audit-log/route.js:52` menjalankan query SQL dinamis pada tabel `audit_log` dengan pembatasan hak akses via `requirePermission(cookieStore, "audit_log", "view")`.
3. **Ekspor Excel**: Tombol "Export Excel" memanggil `GET /api/audit-log/export?format=xlsx` (`src/app/api/audit-log/export/route.js:52`). Handler menghasilkan file spreadsheet Excel 11 kolom melalui pustaka `exceljs` dan mencatat aktivitas ekspor tersebut kembali ke tabel `audit_log`.
4. **Translasi Label Aksi UI**: Seluruh 37 aksi teknis diterjemahkan ke bahasa Indonesia dan diberikan warna visual terstandarisasi menggunakan fungsi pembantu `auditActionLabel(action)` dan `auditActionTone(action)` dari `src/lib/auditActionLabels.js:72-80` baik pada tabel web (`src/app/(app)/audit-log/page.js:203`) maupun lembar cetak (`src/app/print/audit-log/page.js:154`).

### Bukti Kode
- `src/app/(app)/audit-log/page.js:75-215`
- `src/app/api/audit-log/route.js:6-85`
- `src/app/api/audit-log/export/route.js:52-175`
- `src/lib/auditActionLabels.js:1-80`

---

## 15. Fitur Visualisasi Trend & Grafik Dinamis Recharts

### Deskripsi Faktual
Menampilkan grafik multi-sensor interaktif suhu (9 sensor) dan tekanan (kPa) untuk batch sterilisasi yang dipilih pengguna dari dropdown, serta menyediakan tombol cetak mandiri untuk mencetak grafik kurva langsung ke lembar A4 landscape.

### Rantai Alur Kode
1. **Inisialisasi Halaman**: `src/app/(app)/trend/page.js:88` memanggil paralel `GET /api/status` dan `GET /api/batch-records?limit=100`. Jika ada batch `running`, batch tersebut otomatis terpilih; jika tidak, batch terbaru di list yang terpilih.
2. **Pengambilan Data Trend**: Perubahan pilihan batch memicu fetch ke `GET /api/batch-records/[batchNo]` (`src/app/(app)/trend/page.js:134`).
3. **Rendering Grafik**: Komponen merender `ComposedChart` Recharts dengan sumbu Y kiri domain 0-150°C dan sumbu Y kanan domain 0-320 kPa (`src/app/(app)/trend/page.js:246-311`).
4. **Pencetakan Kurva Mandiri**: Tombol "🖨 Cetak / PDF" (`src/app/(app)/trend/page.js:213-221`) memicu fungsi `handlePrint` (`src/app/(app)/trend/page.js:158-163`) yang membuka rute cetak mandiri `/print/trend/${encodeURIComponent(selectedBatchNo)}` di tab baru peramban.

### Bukti Kode
- `src/app/(app)/trend/page.js:88-165`
- `src/app/(app)/trend/page.js:213-315`

---

## 16. Fitur Pencetakan Dokumen Laporan Produksi (Print Layouts)

### Deskripsi Faktual
Menyediakan tata letak dokumen yang diformat khusus untuk dicetak ke printer kertas atau disimpan sebagai berkas PDF (A4 Portrait dan A4 Landscape) dengan penomoran halaman otomatis, informasi Jumlah Botol (Amount), serta blok tanda tangan pengesahan fisik (`SignOffBlock` - Operated by & Checked by) sesuai standar industri farmasi.

### Rantai Alur Kode
1. **Cetak Laporan Gabungan Data Report**:
   - Rute: `src/app/print/data-report/[batchNo]/page.js`.
   - Mengambil data dari `GET /api/batch-records/[batchNo]` dan `GET /api/alarms/by-batch/[batchNo]` (`src/app/print/data-report/[batchNo]/page.js:130`). Header menampilkan `Amount :` (`batch.bottleCount`).
   - Merender 3 seksi: Data Record tabel trend (A4 portrait), Kurva grafik Recharts lebar 680px (A4 portrait), dan Log Alarm batch (A4 landscape) dengan penomoran halaman yang diatur via CSS named pages. Tabel trend menyisipkan baris pemisah fase proses secara konsisten untuk setiap fase termasuk fase pertama (`lastPhase === undefined`) sehingga seluruh fase selalu diawali header `▶ LABEL`. Menyematkan `<SignOffBlock />` di setiap akhir seksi.
2. **Cetak Kurva Penuh (Data Report)**:
   - Rute: `src/app/print/data-report/[batchNo]/curve/page.js`.
   - Merender kurva suhu dan tekanan berorientasi A4 landscape dengan fixed width 940px tanpa animasi grafik (`src/app/print/data-report/[batchNo]/curve/page.js:250`), header `Amount :`, dan blok `<SignOffBlock />`.
3. **Cetak Log Alarm**:
   - Rute: `src/app/print/alarm/page.js`.
   - Mengambil seluruh baris filter dari `GET /api/alarms/print-data` dan merender tabel landscape A4 (`src/app/print/alarm/page.js:131`), diakhiri blok `<SignOffBlock />` dengan styling `.keep-together`.
4. **Cetak Log Audit**:
   - Rute: `src/app/print/audit-log/page.js`.
   - Mengambil data dari `GET /api/audit-log/export?format=json` dan merender tabel landscape A4 (`src/app/print/audit-log/page.js:135`) dengan translasi label aksi via `auditActionLabel`.
5. **Cetak Daftar Batch**:
   - Rute: `src/app/print/batch-records/page.js`.
   - Mengambil data dari `GET /api/batch-records/export?format=json` dan merender tabel 23 kolom landscape A4 (`src/app/print/batch-records/page.js:53`).
6. **Format Cetak Kurva Trend Mandiri (`/print/trend/[batchNo]`)**:
   - Rute: `src/app/print/trend/[batchNo]/page.js`.
   - Orientasi A4 landscape khusus dengan margin cetak `12mm 10mm` (`@page { size: A4 landscape; margin: 12mm 10mm; }`) dan penamaan otomatis judul dokumen (`document.title = ...`).
   - Mengambil data batch tunggal via `GET /api/batch-records/[batchNo]` (`src/app/print/trend/[batchNo]/page.js:145`). Peringatan ESLint `react-hooks/set-state-in-effect` telah diselesaikan dengan memanggil `Promise.resolve().then(() => setLoading(false))` pada baris 176.
   - Merender header dokumen bergaya thermal/dot-matrix ("TEMPERATURE PRESSURE CURVE"), tabel metadata batch 3 kolom (Batch No, Prod Name, Operator, Ster. Temp, Heat Begin/Time, Ster Begin/Time, Cool Begin/Time, Total Time), grafik kurva `LineChart` Recharts 940x360px dengan sumbu ganda (°C kiri domain 0-150, kPa kanan domain 0-320) dan garis putus-putus vertikal pembatas fase (`ReferenceLine` untuk Heat, Ster, Cool), serta blok tanda tangan `<SignOffBlock />` yang dibungkus `.signoff-container { break-inside: avoid; }` agar tidak terputus ke halaman baru.

### Bukti Kode
- `src/components/SignOffBlock.js:1-43`
- `src/app/print/data-report/[batchNo]/page.js:1-667`
- `src/app/print/data-report/[batchNo]/curve/page.js:1-320`
- `src/app/print/alarm/page.js:1-248`
- `src/app/print/audit-log/page.js:58-235`
- `src/app/print/batch-records/page.js:24-170`
- `src/app/print/trend/[batchNo]/page.js:1-394`

---

## 17. Pembersihan Kode Mati & File Yatim (Dead Code Cleanup)

1. **Aset Boilerplate & Komponen Prototipe yang Telah Dihapus**:
   - Berkas: `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`, `src/components/StatCard.js`, dan `src/lib/dummyData.js`.
   - Keterangan: Berkas-berkas tersebut sudah dihapus dari proyek karena tidak digunakan (StatCard digantikan oleh Gauge internal di Dashboard, dummyData digantikan oleh getEmptySnapshot pada kegagalan koneksi PLC).
2. **Fixture Data Uji Sterilisasi**:
   - Berkas: `src/lib/__fixtures__/printout_2026-10-03.js`.
   - Bukti: Hanya di-import oleh berkas unit test `src/lib/f0.test.mjs:7`, tidak digunakan oleh aplikasi web produksi.
3. **Guard Interlock Bypass yang Dinonaktifkan**:
   - Berkas: `src/app/api/batch/start/route.js:342-347`.
   - Bukti: Pengecekan status tag bypass `DOOR_LOCK` (M6.0) dinonaktifkan dalam blok komentar karena berdasarkan pengujian fisik mesin di pabrik dapat berjalan normal saat tag tersebut aktif.
4. **Penghapusan Kolom Legacy `users.role` (Migrasi 005)**:
   - Berkas: `migrations/005_drop_legacy_role.sql`, `src/lib/auth.js`, `src/app/api/auth/login/route.js`, `src/app/api/users/route.js`, `scripts/hash-password.js`.
   - Bukti: Kolom teks `users.role`, trigger `trg_users_sync_legacy_role`, fungsi trigger terkait, dan constraint `users_role_check` telah dihapus sepenuhnya dari skema database dan kode. Otorisasi dialihkan penuh ke `users.role_id` mengarah ke tabel `roles` dan perizinan via `role_permissions`.
5. **Penghapusan Payload Body Mati pada Permintaan STOP**:
   - Berkas: `src/app/(app)/page.js:326-330` dan `src/app/api/batch/stop/route.js:9`.
   - Bukti: Pemanggilan fetch `/api/batch/stop` di Dashboard sebelumnya mengirim payload `body: JSON.stringify({ actor: ... })` beserta header `Content-Type: application/json`. Karena handler server mengambil aktor langsung dari sesi JWT terverifikasi, payload body dan header tersebut telah dihapus.
6. **Penghapusan Harness Uji Usang `fase1_integration.mjs`**:
   - Berkas: `fase1/tests/fase1_integration.mjs`.
   - Bukti: Harness integrasi lama yang masih mengasumsikan adanya kolom `users.role` telah dihapus dari repositori. Pengujian matriks perizinan kini menggunakan `fase1/tests/matrix.mjs`.
7. **Catatan Toggle Uji Kesiapan Mesin pada Dashboard**:
   - Berkas: `src/app/(app)/page.js:492-494`.
   - Bukti: Variabel evaluasi kesiapan mesin `startAllowed` di baris 492 (`const startAllowed = !noData && data.plcOk === true && phaseRaw === 1 && !data.running;`) berjalan aktif penuh (bukan bypass aktif). Komentar pengembang di baris 493–494 memuat `// Biarkan baris ini tetap ada untuk testing pop up start ya` dan `// const startAllowed = true;` yang sengaja dibiarkan pemilik untuk pengujian pop-up dialog START tanpa harus terhubung ke mesin fisik. Pengecekan server-side di `/api/batch/start` tetap memvalidasi interlock dan fase mesin secara fail-closed. Dianjurkan untuk membersihkan baris komentar ini sebelum rilis resmi produksi.

---

## 18. Fitur Manajemen Peran & Matriks Otorisasi Granular (Role-Based Access Control / RBAC)

### Deskripsi Faktual
Menggantikan sistem peran monolitik statis dengan sistem perizinan berbasis peran (RBAC) dinamis. Admin dapat membuat peran baru (atau mengkloning dari peran yang sudah ada), mengubah nama/deskripsi, dan mengatur matriks hak akses per resource sistem (`none`, `view`, `edit`). Sistem mencakup 13 resource halaman dan 3 kunci aksi kritis (`action.batch_control`, `action.write_calibration`, `action.write_safety_params`) yang seluruhnya telah terhubung ke modul antarmuka dan backend API fungsional. Peran sistem bawaan (`admin`, `operator`, `qa`, `maintainer`) dikunci dari penghapusan dan pengubahan key. Setiap mutasi peran dilindungi oleh advisory lock transaksi database `7001` serta invariant guard yang memastikan selalu tersisa minimal satu user aktif yang memegang izin Role Management (`roles = edit`).

### Rantai Alur Kode
1. **Halaman UI**: Admin mengakses `src/app/(app)/roles/page.js`. Halaman mengambil daftar peran via `GET /api/roles` (`src/app/api/roles/route.js:25`).
2. **Katalog Perizinan**: Definisi resource, level izin yang diizinkan per resource, dan pemetaan rank diatur secara terpusat pada `src/lib/permissionCatalog.js:23-42`.
3. **Pemberian / Pengubahan Izin**: Admin memilih level izin pada tabel matriks perizinan di UI dan menyimpan perubahan via `PUT /api/roles/[id]` (`src/app/api/roles/[id]/route.js:41`).
4. **Pencegahan Lockout Sistem**: Handler mengeksekusi `assertRoleManagerRemains(client)` (`src/lib/roleAdmin.js:40`). Bila perubahan akan menyebabkan tidak ada lagi pengguna aktif pemegang izin `roles = edit`, transaksi otomatis dibatalkan (`ROLLBACK`) dan mengembalikan HTTP 409 Conflict.
5. **Penjagaan Sisi Server**: Setiap route API memverifikasi izin pengguna secara real-time dari database via `requirePermission(cookieStore, resource, minLevel)` (`src/lib/auth.js:158`).
6. **Penjagaan Sisi Klien**: Komponen `src/components/PermissionGate.js` membungkus antarmuka seluruh halaman terproteksi (Trend, Formula, Master Produk, Data Report, Alarm, Parameter Mesin, Kalibrasi, Jam PLC, Kontrol Manual, Dokumen Cetak) untuk menyembunyikan konten dari pengguna tanpa hak akses. Menu navigasi pada `src/components/Navbar.js:89-130` secara otomatis menyembunyikan tautan menu utama, menu mesin, dan menu admin yang memiliki izin `none`.

### Bukti Kode
- `src/lib/permissionCatalog.js:1-84`
- `src/lib/roleAdmin.js:1-70`
- `src/lib/roleQueries.js:1-106`
- `src/components/PermissionGate.js:1-78`
- `src/app/(app)/roles/page.js:1-624`
- `src/app/api/roles/route.js:1-90`
- `src/app/api/roles/[id]/route.js:1-158`
- `src/app/api/roles/options/route.js:1-24`

---

## 19. Fitur Hapus-Lunak Akun Pengguna & Penguncian Username (Soft-Delete & Account Deletion)

### Deskripsi Faktual
Menyediakan mekanisme penghapusan akun pengguna yang patuh terhadap integritas jejak audit industri farmasi: data akun tidak pernah dihapus secara fisik (hard-delete) dari database agar seluruh riwayat batch dan catatan log aktivitas masa lalu tetap utuh. Akun yang dihapus ditandai dengan `deleted_at = now()`, `is_active = false`, dan `role_id = NULL`. Username akun terkunci secara permanen sehingga tidak dapat didaftarkan ulang oleh pengguna lain. Seluruh antarmuka SCADA dan laporan cetak menampilkan penanda eksplisit bahwa operator/pengguna terkait berstatus "deleted user".

### Rantai Alur Kode
1. **Konfirmasi Penghapusan di UI**: Admin membuka dialog hapus akun pada `src/app/(app)/users/page.js:442`. Dialog mengonfirmasi bahwa akun akan dihapus, tidak bisa login lagi, riwayat tetap tersimpan, dan username tidak dapat dipakai ulang.
2. **Eksekusi API**: Penekanan tombol konfirmasi memicu `POST /api/users/[username]/delete` (`src/app/api/users/[username]/delete/route.js:16`).
3. **Pencegahan Self-Delete**: Endpoint menolak penghapusan akun sendiri dengan HTTP 400 (`src/app/api/users/[username]/delete/route.js:25`).
4. **Transaksi Hapus-Lunak**:
   - Memperoleh advisory lock `lockRoleMutations(client)` (`src/lib/roleAdmin.js:36`).
   - Menjalankan `UPDATE users SET deleted_at = now(), is_active = false, role_id = NULL WHERE username = $1` (`src/app/api/users/[username]/delete/route.js:63-71`).
   - Menulis jejak audit `delete_user` ke tabel `audit_log` dengan rincian status hapus-lunak (`src/app/api/users/[username]/delete/route.js:74-82`).
   - Memeriksa `assertRoleManagerRemains(client)` (`src/app/api/users/[username]/delete/route.js:85`) untuk memastikan masih ada admin aktif lain.
5. **Penguncian Username**: Endpoint pendaftaran akun baru `POST /api/users` memeriksa tabel `users` dengan query `WHERE username = $1 AND deleted_at IS NOT NULL` (`src/app/api/users/route.js:63`). Jika ditemukan, pendaftaran ditolak dengan status HTTP 409 Conflict.
6. **Penanda Visual Pada Antarmuka**:
   - Komponen `src/components/DeletedUserBadge.js` merender lencana "deleted user" di samping nama operator pada Dashboard (`page.js`), Trend (`trend/page.js`), Data Report (`data-report/page.js`), dan Log Alarm (`alarm/page.js`).
   - Fungsi helper `operatorText` (`src/lib/operatorLabel.js:16`) menyematkan teks akhiran ` (deleted user)` pada dokumen cetak (`print/data-report/[batchNo]/page.js` dan `print/data-report/[batchNo]/curve/page.js`).
   - Rute ekspor server-side (`export/route.js`) menambahkan akhiran ` (deleted user)` pada file Excel dan data ekspor.

### Bukti Kode
- `src/app/api/users/[username]/delete/route.js:1-93`
- `src/app/api/users/route.js:63-71`
- `src/components/DeletedUserBadge.js:1-16`
- `src/lib/operatorLabel.js:1-20`
- `src/app/(app)/users/page.js:340-470`

---

## 20. Fitur Pengaturan Parameter Mesin PLC (Machine Parameters)

### Deskripsi Faktual
Menyediakan antarmuka HMI-web untuk memantau dan mengubah parameter mesin sterilisasi autoclave yang tersimpan pada register PLC Siemens S7-200. Parameter dikelompokkan dalam 3 tab: Parameter Setting 1 (Ster. Temp, Control Temp, Temp. Space, Ster. Time, FO Value, Alarm Press., Cool. Temp 1 & 2), Parameter Setting 2 (Safety Press., Regu. Press, Over. Temp, Drain Time, Exhau. Temp, Select Press), dan Pressure Coefficient (a1, b1, a2, b2, Heat/Ster/Cool Coeff). Seluruh operasi penulisan dilindungi oleh PostgreSQL advisory lock `PLC_WRITE_LOCK_KEY` (847291035) dan `START_LOCK_KEY`, validasi batas nilai fisik, cross-check logika antar-field, isian alasan wajib untuk audit trail, serta verifikasi baca-balik dari PLC hingga 4,5 detik. Parameter keselamatan kritis (`SAFETY_PRESS`, `ALRM_PRES`, `SEL_PRESU`) mewajibkan izin khusus `action.write_safety_params`.

### Rantai Alur Kode
1. **Halaman UI**: Pengguna mengakses `/machine-params` (`src/app/(app)/machine-params/page.js`) yang dibungkus `PermissionGate resource="machine_params" minLevel="view"`. Komponen `PlcParamEditor` memuat tab `["param1", "param2", "coef"]`. Khusus Setting 1, memuat 8 parameter termasuk `foValue` (tag `F0_VAL`, register VW220, skala 10, unit MIN, rentang 0–99, `recipeDriven: true`).
2. **Pembacaan Tag On-Demand**: `PlcParamEditor` memanggil `GET /api/plc-params?group=...` (`src/app/api/plc-params/route.js:19`).
3. **Akses PLC Server-Side**: Handler memanggil `readPlcRaw` (`src/lib/plcAccess.js:48`) via REST API KEPServerEX `/iotgateway/read`, mengonversi raw ke nilai teknik via `rawToValue` (`src/lib/plcParamCatalog.js:133`), dan memeriksa status mesin via `checkMachineIdle(IDLE_PHASES_PARAMS)`.
4. **Form Edit & Konfirmasi**: Pengguna dengan hak `machine_params >= edit` mengubah nilai, memicu dialog modal `PlcDialog` (`src/components/PlcParamEditor.js:58`) yang menampilkan perbandingan nilai lama vs baru, tanda bahaya merah untuk field keselamatan (`danger`), dan input teks alasan wajib minimal 3 karakter.
5. **Eksekusi Penulisan ke API**: Permintaan dikirim ke `PUT /api/plc-params` (`src/app/api/plc-params/route.js:57`).
6. **Guard Otorisasi & Serialisasi**:
   - Handler memverifikasi izin `machine_params >= edit` dan `action.write_safety_params >= edit` (bila field keselamatan diubah).
   - Menjalankan `withPlcLocks` (`src/lib/plcAccess.js:89`) yang memegang `START_LOCK_KEY` (7401001) dan `PLC_WRITE_LOCK_KEY` (847291035).
   - Memastikan mesin idle (`checkMachineIdle`) dan tidak ada batch berjalan di database.
7. **Pencatatan Audit Pre-Write**: Menulis entri `plc_parameter_write_attempt` ke tabel `audit_log` via `insertAudit`. Jika gagal, proses dibatalkan (fail-closed).
8. **Tulis & Verifikasi Baca-Balik**:
   - Memanggil `writeAndVerify` (`src/lib/plcAccess.js:152`) yang menulis tag via `writePlcTags` ke KEPServerEX, kemudian melakukan polling pembacaan ulang hingga 4500 ms untuk memastikan register PLC cocok dengan nilai baru (`rawEqualsKind`).
   - Jika verifikasi gagal, mencatat audit `plc_parameter_verify_failed` dan mengembalikan HTTP 502.
   - Jika cocok, mencatat audit `plc_parameter_write_success` dan mengembalikan HTTP 200 beserta nilai `readBack`.
9. **Hasil di Antarmuka**: Modal menampilkan tabel hijau berisi konfirmasi nilai yang sukses terbaca kembali dari PLC (`src/components/PlcParamEditor.js:21-54`).

### Bukti Kode
- `src/app/(app)/machine-params/page.js:1-16`
- `src/components/PlcParamEditor.js:1-415`
- `src/components/PlcDialog.js:1-20`
- `src/lib/plcParamCatalog.js:1-236`
- `src/lib/plcAccess.js:1-192`
- `src/app/api/plc-params/route.js:1-245`

---

## 21. Fitur Kalibrasi Offset Sensor PLC (Sensor Calibration)

### Deskripsi Faktual
Menyediakan antarmuka HMI-web untuk melihat nilai aktual sensor bersandingan dengan offset kalibrasi bertanda pada sensor autoclave yang terhubung ke PLC: 9 sensor suhu (TH, T1, T2, T3, T4, T5, T6, TM, TL pada tag `CAL_TH` s.d. `CAL_TL`), 2 sensor tekanan bejana (P1 pada `CAL_P1` dan P2 pada `CAL_P2`), konduktivitas air (L pada `CAL_L`, register VW322), serta level air bejana (WATER pada `CAL_WATER`, register VW324). Antarmuka menampilkan kolom 'Nilai Sensor' secara live yang membaca suhu, tekanan, konduktivitas, dan level air riil saat ini (atau '—' saat offline), berdampingan dengan kolom 'Offset Kalibrasi' sehingga operator memiliki visibilitas identik dengan layar fisik HMI Siemens SmartLine di mesin. Mengubah offset kalibrasi dilindungi guard ganda: pengguna wajib memiliki hak akses `calibration >= edit` dan izin aksi kritis `action.write_calibration = edit`. Penulisan tunduk pada serialisasi penguncian mesin, pemeriksaan fase idle, pencatatan jejak audit lengkap dengan alasan, serta verifikasi baca-balik real-time.

### Rantai Alur Kode
1. **Halaman UI**: Pengguna mengakses `/calibration` (`src/app/(app)/calibration/page.js`) yang dibungkus `PermissionGate resource="calibration" minLevel="view"`. Komponen `PlcParamEditor` memuat grup `["calibration"]`. Pada grup kalibrasi, tabel mengaktifkan flag `showSensorColumn` yang merender kolom "Nilai Sensor" (angka biru tebal) di sebelah kolom "Offset Kalibrasi" (`src/components/PlcParamEditor.js:154-158, 303-315`).
2. **Pembacaan Offset & Nilai Sensor Live**: Handler `GET /api/plc-params?group=calibration` membaca tag `CAL_*` melalui `readPlcRaw` dan secara bersamaan membaca snapshot sensor aktual (`TH`, `T1`–`T6`, `TM`, `TL`, `P1`, `P2`, `L`, `WATER`) melalui `readPlcRaw(LIVE_TAGS)` (`src/app/api/plc-params/route.js:46-55`), mengembalikan objek `{ success: true, values, liveValues, idle, rawPhase }`.
3. **Pemberian Nilai Baru**: Pengguna memasukkan offset baru pada input desimal. Rentang offset suhu dibatasi -10 s.d. +10 °C, tekanan -50 s.d. +50 kPa, serta konduktivitas dan level air -500 s.d. +500 unit raw (`src/lib/plcParamCatalog.js:111-125`).
4. **Validasi Hak Aksi Kritis**: Permintaan `PUT /api/plc-params` memeriksa izin `action.write_calibration >= edit` (`src/app/api/plc-params/route.js:69`). Jika ditolak, mengembalikan status 403 Forbidden.
5. **Penulisan Terkunci & Audit**: Handler memperoleh kunci advisory `withPlcLocks`, memastikan fase idle `[0, 1, 6]`, mencatat jejak audit `plc_calibration_write_attempt`, menulis ke KEPServerEX, dan memverifikasi baca-balik tag `CAL_*`.
6. **Audit Sukses**: Mencatat jejak audit `plc_calibration_write_success` dengan rincian nilai lama dan nilai baru ke tabel `audit_log`.

### Bukti Kode
- `src/app/(app)/calibration/page.js:1-16`
- `src/components/PlcParamEditor.js:154-158, 303-315`
- `src/lib/plcParamCatalog.js:1-236`
- `src/lib/plcAccess.js:1-192`
- `src/app/api/plc-params/route.js:1-245`

---

## 22. Fitur Pemantauan & Sinkronisasi Jam RTC PLC (PLC Clock Sync)

### Deskripsi Faktual
Memantau waktu Real-Time Clock (RTC) pengontrol Siemens S7-200 secara real-time dan menyediakan fungsi sinkronisasi jam PLC terhadap waktu sistem PC server atau pengisian waktu manual. Jam PLC dibaca dari register BCD VB2000..VB2005 (instruksi ladder TODR) dan diperbarui ke register buffer BCD VB3000..VB3005 sebelum dieksekusi melalui pulsa tepi naik tag `ENTER_RTC` (M31.0 untuk instruksi ladder TODW). Pengaturan jam dilindungi guard `plc_clock >= edit`, syarat mesin idle, pencatatan alasan wajib ke audit log, dan verifikasi baca-balik dengan jendela toleransi waktu ±6 detik.

### Rantai Alur Kode
1. **Halaman UI**: Antarmuka diakses di `/plc-clock` (`src/app/(app)/plc-clock/page.js`) dengan proteksi `PermissionGate resource="plc_clock" minLevel="view"`. Halaman melakukan polling ke `GET /api/plc-clock` setiap 2000 ms.
2. **Pembacaan Waktu RTC**: Handler `src/app/api/plc-clock/route.js:27` membaca 6 tag BCD `R_YEAR`, `R_MONTH`, `R_DAY`, `R_HOURS`, `R_MINUTE`, `R_SECOND` via `readPlcRaw`, mendekode format BCD ke desimal melalui `decodeClock` (`src/lib/plcClock.js:67`), membandingkan selisih detik naif dengan waktu server (`clockToNaiveMs`), serta mengembalikan objek `{ plc, server, diffSec, idle }`.
3. **Form Penyesuaian Jam**: Operator dapat menekan tombol pintas "Waktu PC" untuk mengisi cepat form dengan waktu jam komputer saat ini (`src/app/(app)/plc-clock/page.js:68`), atau mengisi angka manual (tahun 2000-2099, bulan 1-12, hari sesuai kalender, jam 0-23, menit 0-59, detik 0-59).
4. **Konfirmasi Dialog**: Tombol "Atur Jam PLC" membuka modal `PlcDialog` yang menampilkan waktu baru, perbandingan terhadap jam PC, dan input alasan perubahan wajib minimal 3 karakter.
5. **Eksekusi API**: Penekanan tombol konfirmasi mengirim `PUT /api/plc-clock` (`src/app/api/plc-clock/route.js:57`).
6. **Validasi & Penulisan Buffer BCD**:
   - Memvalidasi input via `validateClockInput` (`src/lib/plcClock.js:39`).
   - Memegang advisory lock `withPlcLocks` dan memastikan mesin idle (`checkMachineIdle`).
   - Mencatat audit `plc_clock_write_requested` ke tabel `audit_log`.
   - Mengonversi waktu target ke format BCD via `encodeClockWrites` (`src/lib/plcClock.js:58`) dan menulis 6 byte ke VB3000..VB3005 via `writePlcTags`.
7. **Pemicuan Pulsa TODW**: Handler mengirim pulsa ke tag `ENTER_RTC` (M31.0) melalui `pulsePlcTag(CLOCK_TRIGGER_TAG)` (`src/lib/plcWrite.js:58`) yang memicu tepi naik ladder PLC untuk menjalankan fungsi sistem TODW (Set RTC).
8. **Verifikasi Baca-Balik Toleran**: Handler melakukan polling pembacaan ulang jam PLC hingga 6 detik. Karena waktu terus berjalan, verifikasi dinyatakan cocok jika selisih waktu terbaca dengan target waktu yang diperhitungkan dengan elapsed time berada dalam rentang toleransi `VERIFY_TOLERANCE_SEC` (±6 detik).
9. **Pencatatan Audit Akhir**: Mencatat `plc_clock_write_success` ke `audit_log` dan mengembalikan status jam baru ke antarmuka.

### Bukti Kode
- `src/app/(app)/plc-clock/page.js:1-259`
- `src/lib/plcClock.js:1-92`
- `src/app/api/plc-clock/route.js:1-184`
- `src/lib/plcAccess.js:1-185`

---

## 23. Fitur Kontrol Manual Aktuator PLC (Manual Control)

### Deskripsi Faktual
Menyediakan antarmuka pengoperasian manual aktuator mesin sterilisasi (10 item: katup steam 1 & 2, katup cooling 1 & 2, udara chamber, buang air drain, buang steam exhaust, pengisian air murni, pompa sirkulasi air, dan buzzer) yang dipetakan langsung ke subrutin PLC SBR9. Antarmuka menampilkan indikator lampu status perintah web vs status output relay fisik aktual secara real-time setiap 500 ms. Fitur ini dirancang dengan prinsip keselamatan industri farmasi:
- **Masuk Mode Manual**: Hanya dapat diaktifkan saat mesin idle (kode fase 0 atau 1) dan memastikan seluruh 10 perintah mati terlebih dahulu.
- **Keluar Mode Manual**: Dirancang sebagai tindakan darurat (emergency/safety action) yang SELALU diizinkan tanpa penguncian advisory lock dan tanpa syarat fase mesin. Prosedur keluar mematikan seluruh bit perintah katup terlebih dahulu, baru kemudian menurunkan bit `MANUAL_OPER` (M5.0) sehingga PLC mereset seluruh output proses.
- **Pagar Interlock Katup**: Katup steam hanya dapat dibuka jika kedua pintu bejana tertutup rapat dan seal pintu aktif (`clsFrnt && clsRear && seal`). Katup steam dan katup cooling dilarang aktif secara bersamaan (mutually exclusive).
- **Responsivitas Eksekusi**: Menggunakan konstanta verifikasi respons cepat `BOOL_VERIFY` ({ timeoutMs: 800, intervalMs: 100 }) untuk menulis perintah katup sehingga relay merespons tanpa delay setpoint.

### Rantai Alur Kode
1. **Halaman UI**: Antarmuka diakses di `/manual` (`src/app/(app)/manual/page.js`) dengan proteksi `PermissionGate resource="manual_control" minLevel="view"`. Melakukan polling ke `GET /api/plc-manual` setiap 500 ms.
2. **Pemantauan Status Aktuator**: Handler `src/app/api/plc-manual/route.js:47` membaca seluruh tag perintah manual (`MAN_*`), tag output fisik aktual (`STEAM_1`, `COOLING_1`, `WTR_PUMP`, dll.), status pintu, dan status batch berjalan secara paralel (`Promise.all`) tanpa round-trip redundant ke database.
3. **Mulai Mode Manual**:
   - Operator dengan izin `manual_control >= edit` menekan "Mulai Mode Manual", mengisi alasan pada dialog modal, dan mengirim `POST /api/plc-manual` dengan `{ action: "enter", reason }` (`src/app/api/plc-manual/route.js:145`).
   - Handler memperoleh advisory lock `withPlcLocks`, memeriksa mesin idle, mematikan seluruh perintah `MAN_*` dengan `BOOL_VERIFY`, menulis `MANUAL_OPER = true` (M5.0), dan mencatat jejak audit `plc_manual_command`.
4. **Pemberian Perintah Aktuator**:
   - Operator menekan tombol "Nyalakan" / "Matikan" pada kartu aktuator.
   - Mengirim `POST /api/plc-manual` dengan `{ action: "set", key, value }`.
   - Jika `value === false` (mematikan), permintaan langsung dieksekusi via `writeAndVerify(..., BOOL_VERIFY)` tanpa syarat interlock.
   - Jika `value === true` (menyalakan), handler memeriksa status idle mesin, memvalidasi pagar interlock keselamatan `checkManualCommand` (`src/lib/plcManualCatalog.js:48`), menulis bit perintah ke PLC dengan `BOOL_VERIFY`, dan mencatat jejak audit.
5. **Keluar Mode Manual (Fail-Safe Exit)**:
   - Operator menekan "Keluar Mode Manual". Mengirim `{ action: "exit" }` (`src/app/api/plc-manual/route.js:111`).
   - Eksekusi berjalan tanpa penguncian lock agar tidak terhalang. Handler mematikan seluruh perintah `MAN_*` ke `false`, memverifikasi katup menutup via `BOOL_VERIFY`, lalu menurunkan `MANUAL_OPER` ke `false` (tepi turun M5.0 memicu ladder PLC mereset seluruh output proses), dan mencatat jejak audit.

### Bukti Kode
- `src/app/(app)/manual/page.js:1-264`
- `src/lib/plcManualCatalog.js:1-66`
- `src/app/api/plc-manual/route.js:1-238`
- `src/lib/plcAccess.js:1-192`

---

## 24. Fitur Pencatatan Jumlah Botol (Bottle Count / Amount Tracking)

### Deskripsi Faktual
Menambahkan pelacakan data jumlah botol (amount) produk dalam siklus sterilisasi autoclave. Data ini diisi secara manual oleh operator saat persiapan batch pada modal START, divalidasi sebagai bilangan bulat positif, dan disimpan ke kolom database `batch_records.bottle_count` melalui migrasi 006. Data jumlah botol disajikan secara komprehensif pada ringkasan modal START, kartu informasi produk detail batch, baris header laporan cetak proses dan kurva, serta diekspor ke berkas Excel spreadsheet XLSX dan format JSON.

### Rantai Alur Kode
1. **Input Modal START**: Komponen `src/components/StartDialog.js:127` memvalidasi input `bottleCount`. Nilai wajib diisi dan harus berupa integer > 0.
2. **Pengiriman & Penyimpanan Server**:
   - Handler `src/app/api/batch/start/route.js:134` mengekstrak `bottleCount` (atau alias `amount`), membersihkan karakter non-digit, dan memparsing menjadi integer.
   - Menyisipkan nilai ke kolom `bottle_count` pada query `INSERT INTO batch_records` (`src/app/api/batch/start/route.js:618`).
   - Menyediakan fallback bila skema database belum dimigrasi (`colErr.code === "42703"`, `src/app/api/batch/start/route.js:630`).
3. **Penyajian di Antarmuka**:
   - Halaman detail batch `src/app/(app)/data-report/[batchNo]/page.js:255` menampilkan baris "Amount / Jumlah Botol" dengan format angka pemisah ribuan (misal: `1.200 Botol`).
   - Header dokumen cetak `src/app/print/data-report/[batchNo]/page.js:405` dan `src/app/print/data-report/[batchNo]/curve/page.js:223` menampilkan `Amount : <jumlah> Botol`.
4. **Ekspor Spreadsheet & API**:
   - Handler `src/app/api/batch-records/export/route.js:189` menambahkan kolom Excel "Jumlah Botol" (width: 14) pada baris data dan JSON payload.
   - Endpoint `src/app/api/batch-records/[batchNo]/route.js:59` mengembalikan properti `bottleCount` dan `amount`.

### Bukti Kode
- `migrations/006_add_bottle_count.sql:1-8`
- `migrations/006_add_bottle_count_rollback.sql:1-5`
- `src/components/StartDialog.js:127-207`
- `src/app/api/batch/start/route.js:134-141`
- `src/app/api/batch-records/export/route.js:86-189`
- `src/app/api/batch-records/[batchNo]/route.js:59-60`
- `src/app/(app)/data-report/[batchNo]/page.js:255-261`

---

## 25. Fitur Blok Pengesahan Tanda Tangan Cetak (Print Sign-Off Block)

### Deskripsi Faktual
Menyediakan komponen lembar pengesahan tanda tangan fisik standar Good Manufacturing Practice (GMP) industri farmasi untuk seluruh laporan dokumen cetak autoclave. Komponen merender dua kolom tanda tangan formal: sisi kiri untuk operator pelaksana proses ("Operated by: ____ DATE: ____") dan sisi kanan untuk verifikator/penyelia pemastian mutu ("Checked by: ____ DATE: ____"). Dilengkapi aturan cetak CSS `page-break-inside: avoid` dan `.keep-together` guna menjamin blok tanda tangan tidak terpotong atau terpisah antar lembar kertas.

### Rantai Alur Kode
1. **Definisi Komponen**: Komponen `src/components/SignOffBlock.js` menerima properti opsional `columnWidth` (default: 260px) dan style inline tambahan.
2. **Integrasi Dokumen Cetak**:
   - `src/app/print/data-report/[batchNo]/page.js`: Disematkan pada akhir Bagian 1 (Data Record), Bagian 2 (Grafik Kurva F0), dan Bagian 3 (Tabel Log Alarm).
   - `src/app/print/data-report/[batchNo]/curve/page.js`: Disematkan pada bagian bawah grafik kurva landscape satu halaman penuh.
   - `src/app/print/alarm/page.js`: Disematkan pada akhir tabel log alarm mesin dengan kelas pembungkus `.keep-together`.
3. **Pencegahan Potong Halaman (Page-Break)**: Menerapkan properti CSS `breakInside: "avoid"` dan `pageBreakInside: "avoid"` pada container flexbox serta deklarasi `@media print { .keep-together { page-break-inside: avoid; break-inside: avoid; } }`.

### Bukti Kode
- `src/components/SignOffBlock.js:1-43`
- `src/app/print/data-report/[batchNo]/page.js:489, 588, 663`
- `src/app/print/data-report/[batchNo]/curve/page.js:317`
- `src/app/print/alarm/page.js:235`

---

## 26. Fitur Pengendalian Pintu Autoclave dari Web (Door Operate)

### Deskripsi Faktual
Menyediakan antarmuka HMI-web untuk mengendalikan pintu autoclave: pulsa Door Sealing (mengembangkan seal), kontrol Door Release cerdas (toggle ON untuk melepas seal, dan tombol "Release: MATIKAN" untuk menonaktifkan pelepasan seal), toggle Water Drain, toggle Door Unlock (bypass interlock tekanan), dan kontrol rantai Forward/Backward dengan mekanisme deadman (loop fire-and-forget 100 ms, auto-stop bila tombol dilepas atau koneksi terputus). Water Drain dan Door Unlock mati sendiri setelah 60 detik (auto-OFF timer). Semua perintah hanya diizinkan saat mesin idle (fase 0 atau 1). Keadaan rantai dan timer hidup di `globalThis.__plcDoorSafety` (singleton tahan duplikasi bundle Next.js).

Seluruh operasi pintu (baik Door Release maupun Door Unlock) dieksekusi secara **satu klik langsung tanpa dialog konfirmasi dan tanpa kolom alasan** (baik di halaman Door Operate maupun tombol di Dashboard), menyelaraskan pengalaman pengguna dengan HMI fisik mesin pabrik. Setiap tindakan dicatat secara otomatis ke Audit Log dengan keterangan "menggunakan SCADA" (sebelumnya aksi di HMI mesin tidak memiliki rekam jejak audit).

### Pagar per Aksi (`checkDoorCommand`)

| Aksi | Kondisi yang Diperiksa Sebelum Menyalakan |
|:---|:---|
| `seal` | Fase ∈ {0,1}, tidak mode manual, kedua pintu tertutup (`clsFrnt && clsRear`), seal belum aktif, tidak ada Release aktif, tidak ada rantai bergerak |
| `release` | Fase ∈ {0,1}, tidak mode manual, tidak ada Sealing aktif. Bila kedua pintu tertutup (atau fase 1), butuh P1 ≤ Safety Press (keduanya terbaca). Bila pintu terbuka (fase 0), diizinkan langsung karena tekanan chamber dijamin aman |
| `drain` | Fase ∈ {0,1}, tidak mode manual, seal sudah lepas, kedua pintu TIDAK tertutup |
| `unlock` | Fase ∈ {0,1}, tidak mode manual, P1 ≤ Safety Press (keduanya terbaca) |
| `fwd` (rantai maju) | Fase ∈ {0,1}, tidak mode manual, seal sudah lepas, pintu belakang tidak tertutup, arah bwd tidak aktif |
| `bwd` (rantai mundur) | Fase ∈ {0,1}, tidak mode manual, seal sudah lepas, pintu depan tidak tertutup, arah fwd tidak aktif |

Sumber: `src/lib/plcDoorCatalog.js:125–168`. Nilai null apa pun di state = tolak (fail-closed).

### Jalur Izin Ganda & Keputusan Desain (POST /api/plc-door)

- **Jalur utama**: `manual_control >= edit` — berlaku untuk semua aksi (`seal`, `release`, `drain`, `unlock`, `chain`).
- **Jalur kedua (berlaku untuk SEMUA aksi)**: `dashboard >= edit` **DAN** `action.batch_control = edit` (hak yang sama dengan START/STOP).
- **Penolakan**: Bila kedua jalur gagal, server mengembalikan error 403 dari jalur utama (`manual_control` edit).
- **Akses Baca (GET)**: `GET /api/plc-door` memerlukan `manual_control >= view` (`src/app/api/plc-door/route.js:27`). Menu "Door Operate" di `src/components/Navbar.js:26` dikaitkan dengan resource `manual_control`.
- **Evaluasi di UI**: Halaman `src/app/(app)/door-operate/page.js:180-181` menghitung `canEdit` dengan dua jalur yang sama.

### Rantai Alur Kode

1. **Halaman UI**: Pengguna mengakses `/door-operate` (`src/app/(app)/door-operate/page.js`) yang dibungkus `PermissionGate resource="manual_control" minLevel="view"`.
2. **Polling Status**: Halaman memanggil `GET /api/plc-door` setiap 500 ms (baris 106–113). Respons mencakup keadaan pintu, seal, `releaseCmd`, fase, mode manual, status rantai, dan sisa auto-OFF timer.
3. **Aksi Seal/Release**: Pengguna menekan tombol Door Sealing atau Door Release satu klik langsung (tanpa modal/dialog alasan). Tombol Door Release mendukung penonaktifan via tombol "Release: MATIKAN" yang mengirim `{ action: "release", value: false }`.
4. **API POST**: Permintaan `POST /api/plc-door` (`src/app/api/plc-door/route.js:61`) diterima, melewati guard izin ganda, mengambil advisory locks `withPlcLocks`, memeriksa `checkMachineIdle(IDLE_PHASES_DOOR)`, membaca keadaan via `readDoorState()`, dan mengevaluasi `checkDoorCommand`.
5. **Audit Fail-Closed**: Sebelum menulis PLC untuk perintah ON, `insertAudit` dicatat ke database — kegagalan DB membatalkan perintah.
6. **Penulisan PLC**: Menggunakan `BOOL_VERIFY` (800ms / 100ms) untuk respons cepat bit boolean.
7. **Deadman Rantai**: Tombol Forward/Backward menggunakan `HoldButton` dengan pointer capture. Loop async mengirim `{ action: "chain", mode: "run", dir }` setiap interval 100 ms secara fire-and-forget. Server memanggil `safety.chainRun()` yang memperbarui timer deadman 1000 ms; bila tombol dilepas atau koneksi putus >1000 ms, server menulis false otomatis ke kedua arah (`M11.0` dan `M11.1`).
8. **Auto-OFF**: Water Drain dan Door Unlock ON memasang timer `AUTO_OFF_MS = 60_000` ms via `safety.armAutoOff()`. Timer mati otomatis menulis false dan mencatat audit.
9. **Dashboard Integration**: Panel kanan Dashboard (`src/app/(app)/page.js:818–848`) menyediakan tombol Door Sealing dan tombol toggle dinamis Door Release ("Release: MATIKAN").

### Format Deskripsi & Aksi Audit Trail

Setiap perintah pintu dicatat dengan teks deskriptif spesifik mencantumkan aktor dan penanda `menggunakan SCADA`:

| Aksi Audit | Peristiwa / Pemicu | Format Deskripsi Faktual di Kode | Payload `newValue` |
|:---|:---|:---|:---|
| `plc_door_command` | Perintah ON / Pulsa berhasil (Seal, Release, Drain, Unlock) | `"<Label> dijalankan oleh <username> menggunakan SCADA."` | `{ command, value: true, via: "scada", p1, safetyPress }` |
| `plc_door_command` | Perintah OFF manual berhasil (Release, Drain, Unlock) | `"<Label> dimatikan oleh <username> menggunakan SCADA."` | `{ command, value: false }` |
| `plc_door_command` | Auto-OFF 60 detik berhasil (Drain, Unlock) | `"<Label> dimatikan otomatis oleh SCADA setelah 60 dtk."` | `{ command, value: false, auto: true }` |
| `plc_door_command_failed` | Perintah gagal kirim / verifikasi gagal | `"<Label>: <pesan error>"` atau `"<Label> dimatikan oleh ... (TIDAK terverifikasi)"` | `{ command, value: ... }` |
| `plc_door_chain` | Mulai penahanan rantai (onStart, fail-closed) | `"Rantai <Forward\|Backward> dijalankan oleh <username> menggunakan SCADA (ditahan, berhenti otomatis bila dilepas)."` | `{ direction, event: "start" }` |
| `plc_door_chain` | Akhir penahanan rantai (onEnd, best-effort) | `"Rantai <Forward\|Backward> (SCADA) berhenti setelah <dtk> dtk (<alasan>)"` | `{ direction, event: "end", durationMs, reason, offVerified }` |

### Konstanta Kunci

| Konstanta | Nilai | Keterangan |
|:---|:---|:---|
| `IDLE_PHASES_DOOR` | `[0, 1]` | Fase yang membolehkan perintah pintu |
| `SEAL_PULSE_MS` | `1500` | Durasi pulsa Door Sealing (ms) |
| `RELEASE_PULSE_MS` | `3000` | Durasi pulsa Door Release saat mode pulsa (ms) |
| `DEADMAN_TIMEOUT_MS` | `1000` | Rantai mati bila sinyal "run" tidak datang dalam (ms) |
| `AUTO_OFF_MS` | `60_000` | Water Drain dan Door Unlock mati otomatis setelah (ms) |

### Keterbatasan yang Diketahui

- **Server mati saat rantai bergerak**: Rantai terus jalan sampai syarat batas fisik PLC memotong (`I1.7`/`I2.0`). `server.js` menyiasatinya dengan reset best-effort `CHAIN_FWD`/`CHAIN_BWD` saat startup (baris 101–111).
- **Integrasi Tag**: Seluruh tag pintu dan perintah kini 100% terdaftar pada berkas master CSV `context/tag_paling_baru.csv` (116 tag).

### Bukti Kode
- `src/lib/plcDoorCatalog.js:1-168`
- `src/lib/plcDeadman.js:1-248`
- `src/app/api/plc-door/route.js:1-263`
- `src/app/(app)/door-operate/page.js:1-364`
- `src/components/Navbar.js:26` (menu Door Operate)
- `server.js:101-111` (reset rantai saat startup)

---

## 27. Matriks Hak Akses & Perizinan Seluruh Endpoint API (Audit 2026-11-02)

Tabel berikut mendokumentasikan aturan hak akses, guard otorisasi, dan status cakupan pengujian otomatis pada skrip harness `fase1/tests/matrix.mjs` untuk seluruh 40 berkas route handler backend (`src/app/api/**/route.js`):

| Endpoint Route | Metode | Guard / Aturan Izin yang Diminta | Status Publik / Sensitif | Cakupan `matrix.mjs` |
|:---|:---:|:---|:---|:---:|
| `/api/auth/login` | POST | **TANPA GUARD** (publik disengaja, rate-limited) | Publik | Di luar E (otentikasi) |
| `/api/auth/logout` | POST | **TANPA GUARD** (menghapus cookie session token) | Publik / Sesi | Di luar E (otentikasi) |
| `/api/auth/users` | GET | **TANPA GUARD** (publik disengaja; daftar user aktif) | Publik (Dropdown Login) | Di luar E (pre-check host) |
| `/api/auth/me` | GET | `getSessionFromCookies` (wajib cookie sesi JWT valid) | Terotentikasi (Sesi) | ❌ Belum tercakup |
| `/api/auth/unlock` | POST | `getSessionFromCookies` + verifikasi password bcrypt | Terotentikasi (Sesi) | ❌ Belum tercakup |
| `/api/status` | GET | `requireAnyPermission`: `dashboard >= view` ∨ `trend >= view` | Internal SCADA | ✅ Tercakup |
| `/api/batch-records` | GET | `requireAnyPermission`: `data_report >= view` ∨ `trend >= view` | Laporan Batch | ✅ Tercakup |
| `/api/batch-records/[batchNo]` | GET | `requireAnyPermission`: `data_report >= view` ∨ `trend >= view` | Laporan Batch | ✅ Tercakup |
| `/api/batch-records/export` | GET | `requireAnyPermission`: `data_report >= view` | Ekspor Laporan | ✅ Tercakup |
| `/api/alarms` | GET | `requireAnyPermission`: `alarm >= view` | Alarm | ✅ Tercakup |
| `/api/alarms/active` | GET | `requireAuth` (semua user login aktif) | Banner & Audio Alarm | ✅ Tercakup |
| `/api/alarms/event-types` | GET | `requireAnyPermission`: `alarm >= view` | Alarm Filter | ✅ Tercakup |
| `/api/alarms/print-data` | GET | `requireAnyPermission`: `alarm >= view` | Cetak Alarm | ✅ Tercakup |
| `/api/alarms/by-batch/[batchNo]`| GET | `requireAnyPermission`: `data_report >= view` | Laporan Batch Alarm | ✅ Tercakup |
| `/api/formulas` | GET | `requireAnyPermission`: `formula >= view` ∨ `dashboard >= view` | Resep Formula | ✅ Tercakup |
| `/api/formulas` | POST | `requirePermission`: `formula >= edit` | Resep Formula | ✅ Tercakup |
| `/api/formulas/[formulaNo]` | GET | `requirePermission`: `formula >= view` | Resep Formula | ✅ Tercakup |
| `/api/formulas/[formulaNo]` | PUT | `requirePermission`: `formula >= edit` | Resep Formula | ✅ Tercakup |
| `/api/formulas/[formulaNo]` | DELETE | `requirePermission`: `formula >= edit` | Resep Formula | ✅ Tercakup |
| `/api/products` | GET | `requireAnyPermission`: `products >= view` ∨ `dashboard >= view` | Master Produk | ✅ Tercakup |
| `/api/products` | POST | `requirePermission`: `products >= edit` | Master Produk | ✅ Tercakup |
| `/api/products/[id]` | GET | `requirePermission`: `products >= view` | Master Produk | ✅ Tercakup |
| `/api/products/[id]` | PUT | `requirePermission`: `products >= edit` | Master Produk | ✅ Tercakup |
| `/api/products/[id]` | DELETE | `requirePermission`: `products >= edit` | Master Produk | ✅ Tercakup |
| `/api/product-specs` | GET | `requireAnyPermission`: `products >= view` ∨ `dashboard >= view` | Spesifikasi Produk | ✅ Tercakup |
| `/api/product-specs` | POST | `requirePermission`: `products >= edit` | Spesifikasi Produk | ✅ Tercakup |
| `/api/product-specs/[id]` | GET | `requirePermission`: `products >= view` | Spesifikasi Produk | ✅ Tercakup |
| `/api/product-specs/[id]` | PUT | `requirePermission`: `products >= edit` | Spesifikasi Produk | ✅ Tercakup |
| `/api/product-specs/[id]` | DELETE | `requirePermission`: `products >= edit` | Spesifikasi Produk | ✅ Tercakup |
| `/api/audit-log` | GET | `requirePermission`: `audit_log >= view` | Audit Trail | ✅ Tercakup |
| `/api/audit-log/filters` | GET | `requirePermission`: `audit_log >= view` | Audit Trail | ✅ Tercakup |
| `/api/audit-log/export` | GET | `requirePermission`: `audit_log >= view` | Ekspor Audit | ✅ Tercakup |
| `/api/users` | GET | `requirePermission`: `users >= view` | Manajemen Pengguna | ✅ Tercakup |
| `/api/users` | POST | `requirePermission`: `users >= edit` | Manajemen Pengguna | ✅ Tercakup |
| `/api/users/[username]` | PUT | `requirePermission`: `users >= edit` | Manajemen Pengguna | ✅ Tercakup |
| `/api/users/[username]` | DELETE | `requirePermission`: `users >= edit` | Hapus-Lunak Pengguna | ✅ Tercakup |
| `/api/users/[username]/delete` | POST | `requirePermission`: `users >= edit` | Hapus-Lunak Pengguna | ✅ Tercakup |
| `/api/users/[username]/reset-password` | POST | `requirePermission`: `users >= edit` | Reset Sandi | ✅ Tercakup |
| `/api/roles` | GET | `requirePermission`: `roles >= view` | Role Management | ✅ Tercakup |
| `/api/roles` | POST | `requirePermission`: `roles >= edit` | Role Management | ✅ Tercakup |
| `/api/roles/[id]` | GET | `requirePermission`: `roles >= view` | Role Management | ✅ Tercakup |
| `/api/roles/[id]` | PUT | `requirePermission`: `roles >= edit` | Role Management | ✅ Tercakup |
| `/api/roles/[id]` | DELETE | `requirePermission`: `roles >= edit` | Role Management | ✅ Tercakup |
| `/api/roles/options` | GET | `requireAnyPermission`: `users >= view` ∨ `roles >= view` | Dropdown Peran | ✅ Tercakup |
| `/api/batch/start` | POST | `dashboard >= edit` ∧ `action.batch_control = edit` | **KONTROL KRITIS** | ❌ Belum tercakup |
| `/api/batch/stop` | POST | `dashboard >= edit` ∧ `action.batch_control = edit` | **KONTROL KRITIS** | ❌ Belum tercakup |
| `/api/plc/reset` | POST | `dashboard >= edit` | **KONTROL KRITIS** | ❌ Belum tercakup |
| `/api/plc-clock` | GET | `requirePermission`: `plc_clock >= view` | HMI Jam PLC | ❌ Belum tercakup |
| `/api/plc-clock` | PUT | `requirePermission`: `plc_clock >= edit` | HMI Jam PLC | ❌ Belum tercakup |
| `/api/plc-manual` | GET | `requirePermission`: `manual_control >= view` | HMI Kontrol Manual | ❌ Belum tercakup |
| `/api/plc-manual` | POST | `requirePermission`: `manual_control >= edit` | HMI Kontrol Manual | ❌ Belum tercakup |
| `/api/plc-params` | GET | Dinamis: `meta.resource >= view` (`machine_params` atau `calibration`) | HMI Parameter Mesin | ❌ Belum tercakup |
| `/api/plc-params` | PUT | Dinamis: `meta.resource >= edit` + `writeAction` + `restrictedActions` | HMI Parameter Mesin | ❌ Belum tercakup |
| `/api/plc-door` | GET | `requirePermission`: `manual_control >= view` | HMI Door Operate | ❌ Belum tercakup |
| `/api/plc-door` | POST | **Jalur Ganda (Semua Aksi)**:<br>1. `manual_control >= edit`<br>2. `dashboard >= edit` ∧ `action.batch_control = edit` | **KONTROL KRITIS** | ❌ Belum tercakup |
| `/api/backup` | GET | `requirePermission`: `backup >= view` | Layanan Backup | ❌ Belum tercakup |
| `/api/backup` | PUT | `requirePermission`: `backup >= edit` | Konfigurasi Backup | ❌ Belum tercakup |
| `/api/backup` | POST | `requirePermission`: `backup >= edit` | Eksekusi Backup | ❌ Belum tercakup |
| `/api/backup/download` | GET | `requirePermission`: `backup >= edit` | Unduhan Backup | ❌ Belum tercakup |

**Catatan Cakupan Pengujian**: Skrip `fase1/tests/matrix.mjs` telah diperbarui dengan safe probe untuk endpoint PLC (`/api/plc-door`, `/api/plc-manual`, `/api/plc-clock`, `/api/plc-params`, `/api/batch/start`, serta penolakan mesin kondisional `/api/batch/stop` dan `/api/plc/reset` via bendera `PROBE_MACHINE_DENY=yes`). Hanya `POST /api/auth/unlock` (potensi memicu throttle login) dan field bertingkat `restricted` pada `/api/plc-params` yang belum tercakup probe otomatis.

---

## 28. Inventarisasi Aksi Audit Log & Pemetaan Label UI (Audit 2026-11-05)

Terdapat **55 nama aksi unik** yang dicatat ke tabel database `audit_log` di seluruh aplikasi melalui modul `insertAudit`/`tryAudit` dan proses latar belakang. Sejak implementasi modul `src/lib/auditActionLabels.js`, seluruh aksi audit memiliki label tampilan resmi berbahasa Indonesia dan pewarnaan badge yang terstandarisasi untuk antarmuka web (`src/app/(app)/audit-log/page.js:203`) dan lembar cetak (`src/app/print/audit-log/page.js:154`), sedangkan nilai string kode teknis mentah tetap dipertahankan pada level database PostgreSQL, rute API query, dan format ekspor data mentah:

| No | Nama Aksi Audit (`action`) | Entity Type | Berkas & Baris Pemanggil | Label Tampilan UI (Bahasa Indonesia) | Tone Badge UI |
|:---:|:---|:---|:---|:---|:---:|
| 1 | `login` | `user` | `src/app/api/auth/login/route.js:157` | Login | `plain` (netral) |
| 2 | `login_failed` | `user` | `src/app/api/auth/login/route.js:123, 138` | Login gagal | `stop` (merah) |
| 3 | `login_blocked` | `user` | `src/app/api/auth/login/route.js:89` | Login diblokir | `stop` (merah) |
| 4 | `logout` | `user` | `src/app/api/auth/logout/route.js:13` | Logout | `idle` (abu-abu) |
| 5 | `unlock_screen` | `user` | `src/app/api/auth/unlock/route.js:69` | Buka kunci layar | `plain` (netral) |
| 6 | `unlock_screen_failed` | `user` | `src/app/api/auth/unlock/route.js:53` | Buka kunci layar gagal | `stop` (merah) |
| 7 | `create_user` | `user` | `src/app/api/users/route.js:92` | Buat user | `run` (hijau) |
| 8 | `update_user` | `user` | `src/app/api/users/[username]/route.js:75` | Ubah user | `water` (biru) |
| 9 | `user_role_change` | `user` | `src/app/api/users/[username]/route.js:87` | Ubah role user | `water` (biru) |
| 10 | `deactivate_user` | `user` | `src/app/api/users/[username]/route.js:144` | Ubah status aktif user | `water` (biru) |
| 11 | `delete_user` | `user` | `src/app/api/users/[username]/delete/route.js:74` | Hapus user | `stop` (merah) |
| 12 | `reset_password` | `user` | `src/app/api/users/[username]/reset-password/route.js:44` | Reset password | `steam` (oranye) |
| 13 | `role_create` | `role` | `src/app/api/roles/route.js:74` | Buat role | `run` (hijau) |
| 14 | `role_update` | `role` | `src/app/api/roles/[id]/route.js:78` | Ubah role | `water` (biru) |
| 15 | `role_permissions_update` | `role` | `src/app/api/roles/[id]/route.js:96` | Ubah izin role | `water` (biru) |
| 16 | `role_delete` | `role` | `src/app/api/roles/[id]/route.js:141` | Hapus role | `stop` (merah) |
| 17 | `start_batch_critical` | `batch` | `src/app/api/batch/start/route.js:672` | START batch | `steam` (oranye) |
| 18 | `plc_setpoints_written` | `batch` | `src/app/api/batch/start/route.js:519` | Setpoint resep ditulis ke PLC | `water` (biru) |
| 19 | `stop_requested` | `batch` | `src/app/api/batch/stop/route.js:49` | STOP batch diminta | `idle` (abu-abu) |
| 20 | `stop_batch` | `batch` | `src/app/api/batch/stop/route.js:112` | STOP batch | `stop` (merah) |
| 21 | `batch_auto_finalize` | `batch` | `src/lib/trendRecorder.js:283` | Batch ditutup otomatis | `idle` (abu-abu) |
| 22 | `plc_reset_requested` | `plc` | `src/app/api/plc/reset/route.js:87` | Reset PLC diminta | `idle` (abu-abu) |
| 23 | `plc_reset_stop` | `plc` | `src/app/api/plc/reset/route.js:106` | Reset PLC (STOP dikirim) | `steam` (oranye) |
| 24 | `plc_clock_write_requested` | `plc` | `src/app/api/plc-clock/route.js:81` | Set jam PLC diminta | `idle` (abu-abu) |
| 25 | `plc_clock_written` | `plc` | `src/app/api/plc-clock/route.js:156` | Jam PLC diubah | `water` (biru) |
| 26 | `plc_clock_write_failed` | `plc` | `src/app/api/plc-clock/route.js:103, 137` | Set jam PLC gagal | `stop` (merah) |
| 27 | `plc_manual_command` | `plc` | `src/app/api/plc-manual/route.js:97, 118, 157, 189` | Kontrol manual | `water` (biru) |
| 28 | `plc_manual_command_failed` | `plc` | `src/app/api/plc-manual/route.js:97, 118, 172, 199` | Kontrol manual gagal | `stop` (merah) |
| 29 | `plc_parameter_write_requested` | `plc` | `src/app/api/plc-params/route.js:147` | Tulis parameter mesin diminta | `idle` (abu-abu) |
| 30 | `plc_parameter_written` | `plc` | `src/app/api/plc-params/route.js:201` | Parameter mesin diubah | `water` (biru) |
| 31 | `plc_parameter_write_failed` | `plc` | `src/app/api/plc-params/route.js:168` | Tulis parameter mesin gagal | `stop` (merah) |
| 32 | `plc_calibration_write_requested` | `plc` | `src/app/api/plc-params/route.js:147` | Tulis kalibrasi diminta | `idle` (abu-abu) |
| 33 | `plc_calibration_written` | `plc` | `src/app/api/plc-params/route.js:201` | Kalibrasi diubah | `water` (biru) |
| 34 | `plc_calibration_write_failed` | `plc` | `src/app/api/plc-params/route.js:168` | Tulis kalibrasi gagal | `stop` (merah) |
| 35 | `plc_door_command` | `plc` | `src/app/api/plc-door/route.js:128, 179, 200` | Kontrol pintu | `water` (biru) |
| 36 | `plc_door_command_failed` | `plc` | `src/app/api/plc-door/route.js:128, 179, 212` | Kontrol pintu gagal | `stop` (merah) |
| 37 | `plc_door_chain` | `plc` | `src/app/api/plc-door/route.js:100, 106` | Rantai pintu | `water` (biru) |
| 38 | `create` | `formula` | `src/app/api/formulas/route.js:75` | Buat formula | `run` (hijau) |
| 39 | `update` | `formula` | `src/app/api/formulas/[formulaNo]/route.js:77` | Ubah formula | `water` (biru) |
| 40 | `delete` | `formula` | `src/app/api/formulas/[formulaNo]/route.js:125` | Hapus formula | `stop` (merah) |
| 41 | `create_product_name` | `product` | `src/app/api/products/route.js:52` | Buat nama produk | `run` (hijau) |
| 42 | `update_product_name` | `product` | `src/app/api/products/[id]/route.js:48` | Ubah nama produk | `water` (biru) |
| 43 | `delete_product_name` | `product` | `src/app/api/products/[id]/route.js:84` | Hapus nama produk | `stop` (merah) |
| 44 | `create_product_spec` | `spec` | `src/app/api/product-specs/route.js:52` | Buat spesifikasi produk | `run` (hijau) |
| 45 | `update_product_spec` | `spec` | `src/app/api/product-specs/[id]/route.js:48` | Ubah spesifikasi produk | `water` (biru) |
| 46 | `delete_product_spec` | `spec` | `src/app/api/product-specs/[id]/route.js:84` | Hapus spesifikasi produk | `stop` (merah) |
| 47 | `start_batch` | `batch` | `src/app/api/batch/start/route.js:688` | Batch dimulai | `steam` (oranye) |
| 48 | `start_batch_rejected` | `batch` | `src/app/api/batch/start/route.js:235, 417` | START batch ditolak | `stop` (merah) |
| 49 | `batch_adopted` | `batch` | `src/lib/alarmMonitor.js:154` | Batch diadopsi | `idle` (abu-abu) |
| 50 | `export_audit_log` | `audit_log` | `src/app/api/audit-log/export/route.js:88` | Ekspor audit log | `idle` (abu-abu) |
| 51 | `export_batch_records` | `batch_records` | `src/app/api/batch-records/export/route.js:76` | Ekspor data batch | `idle` (abu-abu) |
| 52 | `backup_created` | `backup` | `src/lib/backupService.js:238` | Backup dibuat | `run` (hijau) |
| 53 | `backup_failed` | `backup` | `src/lib/backupService.js:260` | Backup gagal | `stop` (merah) |
| 54 | `backup_settings_update` | `backup` | `src/lib/backupService.js:90` | Ubah pengaturan backup | `water` (biru) |
| 55 | `backup_downloaded` | `backup` | `src/lib/backupService.js:277` | Unduh backup | `steam` (oranye) |

---

## 29. Komparasi Faktual Tag PLC: Kode Sumber vs Dokumen CSV (Audit 2026-11-07)

Pemeriksaan komparatif dilakukan antara seluruh tag yang didefinisikan pada berkas master CSV `context/tag_paling_baru.csv` terhadap pemanggilan tag nyata di kode sumber (`src/lib/plc.js`, `plcManualCatalog.js`, `plcParamCatalog.js`, `plcDoorCatalog.js`, `plcWrite.js`, `plcClock.js`, `batch/start`, `batch/stop`, `plc/reset`, `server.js`):

- Total baris data tag pada `context/tag_paling_baru.csv`: **116 tag** (menggantikan berkas staging `tag_terbaru_kepsrvr.csv` 105 tag).
- Total tag aktif yang diakses kode sumber: **116 tag** (100% terpetakan).

### Integrasi Penuh Tag CSV Master Terbaru (`tag_paling_baru.csv`):
1. **Tag Kontrol Manual (11 Tag)**: Seluruh 11 tag kontrol manual yang sebelumnya belum terdaftar di CSV kini telah resmi masuk:
   - `MANUAL_OPER` (M5.0), `MAN_STEAM_1` (M2.0), `MAN_STEAM_2` (M2.1), `MAN_WTR_DRAIN` (M2.5), `MAN_COOLING_1` (M2.2), `MAN_COOLING_2` (M2.3), `MAN_STEAM_EXHS` (M2.6), `MAN_WTR_FILL` (M4.0), `MAN_AIR_CMBR` (M2.4), `MAN_WTR_PUMP` (M2.7), `MAN_BUZZER` (M10.6).
2. **Tag Offset Kalibrasi Level Air**: Tag `CAL_WATER` (register VW324) telah resmi masuk ke CSV dan katalog kalibrasi `src/lib/plcParamCatalog.js`.
3. **Resolusi Diskrepansi Penamaan Tag F0 (`F0_VAL`)**:
   - Tag register VW220 resmi dinamai `"F0_VAL"` pada `tag_paling_baru.csv:55` dan diselaraskan di `src/lib/plcParamCatalog.js:50`, `src/lib/plc.js:78`, `src/app/api/batch/start/route.js:390`, serta kartu ringkasan Dashboard (`src/app/(app)/page.js:754`).
4. **Resolusi Alamat Register Offset Konduktivitas (`CAL_L`)**:
   - Register `CAL_L` resmi beralamat `VW322` selaras antara kode katalog dan CSV.
5. **Tag Jam RTC PLC**:
   - Seluruh tag pembacaan BCD (`R_YEAR`..`R_SECOND` VB2000..VB2005), penulisan BCD (`S_YEAR`..`S_SECOND` VB3000..VB3005), dan picu eksekusi RTC (`ENTER_RTC` M31.0) terdaftar resmi di berkas CSV master.

Seluruh 116 tag PLC Siemens S7-200 kini telah memiliki pemetaan identik antara file CSV konfigurasi KEPServerEX dengan seluruh lapisan aplikasi SCADA web.

---

## 30. Fitur Backup & Pengarsipan Data Sistem (Backup Service)

### Deskripsi Faktual
Menyediakan sistem backup dan pengarsipan data batch, kurva trend sensor, riwayat alarm, dan jejak audit ke dalam berkas arsip ZIP tunggal yang berisi 4 file CSV (RFC 4180 dengan UTF-8 BOM dan CRLF) serta satu berkas `manifest.json`. Fitur ini mendukung dua metode:
1. **Backup Manual**: Pengguna berwenang dapat menentukan rentang tanggal tertentu atau mengosongkannya untuk mencakup seluruh data (arsip penuh vs parsial). Berkas manual disimpan di folder `<BACKUP_DIR>/manual/` dan tidak dihapus secara otomatis.
2. **Backup Otomatis Terjadwal**: Berjalan di latar belakang server (`server.js`) setiap menit memeriksa jadwal jatuh tempo. Mendukung interval harian (1 hari), mingguan (7 hari), atau 30 hari pada jam yang ditentukan (HH:MM), dengan rotasi otomatis mempertahankan N generasi berkas terbaru (1–10 file). Berkas terjadwal disimpan di `<BACKUP_DIR>/terjadwal/`.

Seluruh proses pembuatan arsip dilakukan dalam transaksi database tunggal `REPEATABLE READ READ ONLY` dengan pembacaan bertahap berbasis keyset (LIMIT 5000), dikompresi secara streaming menggunakan pustaka `fflate`, dan diverifikasi ulang integritasnya (mencocokkan hash SHA-256 setiap CSV ke manifest) sebelum berkas diresmikan. Sistem dilindungi oleh kunci eksklusif concurrency berkas `.backup.lock`, kontrol hak akses RBAC granular (`backup >= view` / `edit`), dan pencatatan audit log otomatis untuk setiap aktivitas pembuatan, kegagalan, perubahan konfigurasi, serta pengunduhan arsip.

### Rantai Alur Kode
1. **Halaman UI**: Pengguna mengakses `/backup` (`src/app/(app)/backup/page.js`). `useEffect` memanggil `GET /api/backup` dan `GET /api/auth/me`. Bila pengguna memiliki izin `backup >= edit`, formulir pembuatan manual, pengaturan jadwal, dan tombol "Unduh" diaktifkan.
2. **Status & Pengaturan Jadwal**:
   - `GET /api/backup`: Memeriksa izin `backup >= view`, memanggil `getStatus()` (`src/lib/backupService.js:161`) yang membaca `backup_settings.json`, menghitung waktu jatuh tempo `computeNextDue`, memeriksa status proses berjalan `isRunning()`, serta membaca daftar file di folder manual dan terjadwal.
   - `PUT /api/backup`: Memeriksa izin `backup >= edit`, memvalidasi input via `validateSettingsInput` (`src/lib/backupSchedule.js:63`), mencatat audit `backup_settings_update` ke `audit_log`, lalu memperbarui berkas `backup_settings.json` secara atomik via file temporer.
3. **Eksekusi Backup (Manual & Terjadwal)**:
   - Permintaan manual dikirim via `POST /api/backup` (`body: { from, to }`), sedangkan backup terjadwal dipicu oleh scheduler interval 60 detik di `server.js:92-97` via `startBackupScheduler()` (`src/lib/backupService.js:287`).
   - Handler memanggil `runBackup({ kind, range, actor, actorRole })`:
     a. **Kunci Concurrency**: Memanggil `acquireLock()` yang membuat file `.backup.lock` secara eksklusif (`wx`). Jika sedang berjalan atau kunci belum berumur > 1 jam, melempar error `BUSY` (status HTTP 409 pada API).
     b. **Penamaan File**: Format terjadwal `backup_terjadwal_YYYYMMDD-HHMMSS.zip` atau manual `backup_manual_{from}_{to}_dibuatYYYYMMDD-HHMMSS.zip` berbasis zona waktu WIB (`Asia/Jakarta`).
     c. **Streaming & Transaksi**: Memanggil `createBackupArchive()` (`src/lib/backupArchive.js:155`):
        - Menginisialisasi koneksi pool dan memulai transaksi `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`.
        - Membaca daftar kolom dinamis setiap tabel dari `information_schema.columns` (schema `public`).
        - Menulis CSV 4 tabel (`batch_records`, `batch_trend` yang di-join ke `batch_records` untuk field `batch_no`, `alarm_log`, dan `audit_log`) menggunakan keyset pagination `id > $1::bigint ORDER BY t.id ASC LIMIT 5000`.
        - Menghitung hash SHA-256 secara streaming untuk setiap berkas CSV.
        - Melakukan `COMMIT` transaksi.
        - Menulis `manifest.json` yang memuat metadata versi format, jenis backup, pembuat, rentang tanggal, status kelengkapan (`complete`), daftar kolom, jumlah baris, rentang min/max id, dan SHA-256 masing-masing berkas CSV.
     d. **Verifikasi Integritas Otomatis**: Memanggil `verifyArchive(tmpPath)` (`src/lib/backupArchive.js:286`) yang membaca ulang berkas ZIP dari disk secara streaming via `fflate.Unzip`, menghitung ulang SHA-256 setiap berkas CSV, dan mencocokkannya dengan `manifest.json`. Bila tidak cocok, proses dibatalkan dan berkas temporer dihapus.
     e. **Rotasi Berkas**: Pada mode terjadwal, memanggil `rotateScheduled(generations)` (`src/lib/backupService.js:184`) yang menghapus file terjadwal terlama melebihi kuota retensi yang dikonfigurasi.
     f. **Pencatatan Audit**: Memanggil `tryAudit` dengan aksi `backup_created` (mencatat ukuran file, SHA-256 berkas utuh, jumlah baris per tabel, dan flag kelengkapan) atau `backup_failed` saat terjadi galat.
     g. **Pelepasan Kunci**: Menghapus file `.backup.lock` dalam blok `finally`.
4. **Pengunduhan Berkas Arsip**:
   - Tautan unduh mengarah ke `GET /api/backup/download?kind=...&name=...`.
   - Handler memvalidasi izin `backup >= edit`.
   - Memanggil `resolveBackupFile(kind, name)` yang memvalidasi nama file terhadap regex ketat `SCHEDULED_RE` / `MANUAL_RE` guna mencegah path traversal.
   - Memanggil `auditDownload()` untuk mencatat aksi `backup_downloaded` ke `audit_log`. Catatan: fungsi ini wajib sukses sebelum transmisi file dimulai (fail-closed jika DB down).
   - Mengembalikan response stream file ZIP dengan header `Content-Disposition: attachment; filename="..."` dan `Cache-Control: no-store`.

### Bukti Kode
- `src/lib/backupSchedule.js:1-150`
- `src/lib/backupArchive.js:1-330`
- `src/lib/backupService.js:1-309`
- `src/lib/backup.test.mjs:1-197`
- `fase1/tests/backup_check.mjs:1-67`
- `src/app/api/backup/route.js:1-76`
- `src/app/api/backup/download/route.js:1-37`
- `src/app/(app)/backup/page.js:1-283`
- `server.js:92-97`

---

## Change Log

- [2026-11-07] MODIFIED: Memperbarui Seksi 29 (Komparasi Tag PLC) dengan master CSV baru `context/tag_paling_baru.csv` (116 tag, 100% terpetakan), mencatat resolusi integrasi 11 tag manual dan `CAL_WATER`, serta resolusi penamaan tag F0 `F0_VAL` dan register `CAL_L` VW322.
- [2026-11-07] MODIFIED: Memperbarui Fitur 3 (tampilan F0 target dan tombol cerdas toggle Door Release / MATIKAN), Fitur 4 (penulisan setpoint tag `F0_VAL` dan verifikasi baca-balik), Fitur 20 (`F0_VAL` VW220 `recipeDriven: true`), Fitur 21 (tag kalibrasi `CAL_WATER` VW324 dan live sensor L/WATER), Fitur 23 (polling 500ms, verifikasi cepat `BOOL_VERIFY`, GET non-blocking paralel), dan Fitur 26 (polling 500ms, loop rantai 100ms fire-and-forget, pelonggaran syarat Door Release).
- [2026-11-05] ADDED: Menambahkan dokumentasi Fitur 30 (Fitur Backup & Pengarsipan Data Sistem / Backup Service) mencakup alur manual & terjadwal, format arsip ZIP RFC 4180 + manifest SHA-256, verifikasi integritas, rotasi generasi, dan pengamanan unduhan.
- [2026-11-05] MODIFIED: Memperbarui Seksi 27 dengan penambahan 4 endpoint backup (`/api/backup` GET/PUT/POST dan `/api/backup/download` GET), memperbarui Seksi 28 dengan penambahan 18 aksi audit baru (total 55 aksi), serta memperbarui Fitur 16 terkait penanganan baris pemisah fase pertama print data report dan resolusi warning linting pada print trend.
- [2026-11-03] ADDED: Menambahkan dokumentasi sub-fitur 16.5 Format Cetak Kurva Trend Mandiri (`/print/trend/[batchNo]`) pada Fitur 16 dan tombol pintas cetak mandiri pada Fitur 15.
- [2026-11-03] MODIFIED: Memperbarui Fitur 14 dan Seksi 28 dengan kamus translasi 37 aksi audit berbahasa Indonesia dan penandaan warna badge via modul `src/lib/auditActionLabels.js`.
- [2026-11-03] MODIFIED: Memperbarui Fitur 20 dengan penambahan parameter `foValue` (VW220, 0-99 MIN) pada grup Setting 1.
- [2026-11-03] MODIFIED: Memperbarui Fitur 21 dengan penambahan pembacaan nilai sensor fisik secara live (`liveValues` di `/api/plc-params` dan kolom "Nilai Sensor" pada antarmuka `/calibration`).
- [2026-11-03] MODIFIED: Memperbarui Seksi 29 (Komparasi Tag PLC) berdasarkan master CSV terbaru `context/tag_terbaru_kepsrvr.csv` (105 tag), mencatat integrasi tag pintu dan parameter, mendokumentasikan sisa 11 tag kontrol manual yang belum terdaftar di CSV, serta mengungkap diskrepansi penamaan `FO_VALUE` vs `F0_VAL` dan alamat register `CAL_L` (VW144 vs VW322).
- [2026-11-02] ADDED: Menambahkan Seksi 27 (Matriks Hak Akses Seluruh 37 Endpoint API), Seksi 28 (Inventarisasi 36 Aksi Audit Log & Analisis Label UI), dan Seksi 29 (Komparasi Faktual Tag PLC: Kode Sumber vs CSV).
- [2026-11-02] RESOLVED: Mengoreksi status `startAllowed` di Dashboard (`page.js:492-494`) bukan bypass aktif; baris logika asli aktif penuh mengevaluasi kesiapan mesin, baris `// const startAllowed = true;` hanyalah komentar toggle uji yang sengaja dibiarkan pemilik.
- [2026-11-02] ADDED: Menambahkan dokumentasi Fitur 26 (Pengendalian Pintu Autoclave dari Web / Door Operate) termasuk tabel pagar per aksi, jalur izin ganda, rantai alur kode, tabel audit, konstanta kunci, dan keterbatasan yang diketahui.
- [2026-11-02] MODIFIED: Memperbarui Seksi 3 (Fitur Dashboard) — blok DOOR panel kanan sekarang adalah tombol Door Sealing + Door Release (bukan "Read only").
- [2026-10-29] ADDED: Menambahkan dokumentasi Fitur 20 (Pengaturan Parameter Mesin PLC), Fitur 21 (Kalibrasi Offset Sensor PLC), Fitur 22 (Pemantauan & Sinkronisasi Jam RTC PLC), Fitur 23 (Kontrol Manual Aktuator PLC), Fitur 24 (Pencatatan Jumlah Botol / Bottle Count Tracking), dan Fitur 25 (Blok Pengesahan Tanda Tangan Cetak / SignOffBlock). Menambahkan butir 7 pada Seksi 17 mengenai bypass pengujian `startAllowed = true` di Dashboard.
- [2026-10-29] MODIFIED: Memperbarui alur Fitur 4 (Start Batch Sequence) dengan nilai kunci advisory `START_LOCK_KEY` yang benar (`7401001`), pencatatan `bottle_count`, integrasi `SearchableCombobox`, dan penataan form 2 kolom. Memperbarui Fitur 13 (Data Report & Ekspor), Fitur 16 (Print Layouts), dan Fitur 18 (RBAC) sejalan dengan implementasi nyata antarmuka HMI dan pencatatan jumlah botol.
- [2026-10-28] ADDED: Menambahkan dokumentasi Fitur 18 (Manajemen Peran & Matriks Otorisasi Granular / RBAC) dan Fitur 19 (Hapus-Lunak Akun Pengguna & Penguncian Username). Menambahkan butir 4-6 pada Seksi 17 mengenai pembersihan kolom `users.role`, pembersihan payload `actor` mati pada permintaan STOP, dan penghapusan file uji usang `fase1_integration.mjs`.
- [2026-10-28] MODIFIED: Memperbarui alur verifikasi login pada Fitur 1 untuk membaca `role_id` join `roles` dan menolak akun terhapus-lunak, serta memperbarui guard `requireAdmin` menjadi `requirePermission` pada Fitur 14 (Audit Trail) dan fitur terkait lainnya.
