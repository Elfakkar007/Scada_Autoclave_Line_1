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
5. **Verifikasi Hash Password**: Handler mengambil data pengguna dari tabel `users` (`src/app/api/auth/login/route.js:103`) dan memverifikasi kata sandi menggunakan `bcrypt.compare` (`src/app/api/auth/login/route.js:110`).
6. **Pencatatan Audit & Terbit Token**:
   - Jika berhasil: Memperbarui kolom `last_login_at` (`src/app/api/auth/login/route.js:127`), memanggil `insertAudit` (`src/app/api/auth/login/route.js:129`), membuat JWT via `createSessionToken` (`src/lib/auth.js:25`), dan menyetel cookie `session_token` (`src/app/api/auth/login/route.js:146`).
   - Jika gagal: Memanggil `tryAudit` dengan action `login_failed` (`src/app/api/auth/login/route.js:114`) dan mengembalikan status 401.
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
Halaman dashboard utama secara berkala setiap 1000 ms melakukan polling data status mesin ke backend. Data sensor ditampilkan dalam bentuk kartu metrik digital, status posisi pintu, serta diagram visual interaktif yang menggambarkan animasi katup, level air, dan status pompa sirkulasi.

### Rantai Alur Kode
1. **Polling Dashboard**: Komponen `src/app/(app)/page.js:102` menjalankan `setInterval` setiap 1000 ms yang memanggil `fetch("/api/status")`.
2. **Backend Agregator**: Handler `src/app/api/status/route.js:17` memanggil fungsi `readPlcSnapshot()` dari `src/lib/plc.js:125`.
3. **Komunikasi IoT Gateway**:
   - `readPlcSnapshot` mengirim HTTP GET ke endpoint KEPServerEX `/iotgateway/read` (`src/lib/plc.js:145`).
   - Menerima array tag pembacaan PLC Siemens S7-200.
   - Melakukan penskalaan nilai: suhu dibagi 10 (`src/lib/plc.js:189-197`), tekanan kPa diambil langsung (`src/lib/plc.js:198`), serta memetakan nilai integer register `PROCCES_TEXT` (VW98) ke objek fase proses (`src/lib/plc.js:213-233`).
4. **Pengambilan Status Batch**: Handler `src/app/api/status/route.js:23` menjalankan query `SELECT ... FROM batch_records WHERE status = 'running'` untuk menyematkan metadata batch aktif.
5. **Rendering Visual**:
   - Komponen internal `Gauge` pada `src/app/(app)/page.js:50-65` merender kartu indikator suhu dan tekanan (`src/app/(app)/page.js:471-488`).
   - Komponen `src/components/AtvDiagram.js` menerima properti sensor dan merender gambar bejana SVG beserta indikator katup aktif berwarna hijau/merah (`src/components/AtvDiagram.js:120-280`).

### Bukti Kode
- `src/app/(app)/page.js:102-120`
- `src/app/api/status/route.js:17-60`
- `src/lib/plc.js:125-240`
- `src/components/AtvDiagram.js:120-280`

---

## 4. Fitur Memulai Batch Sterilisasi (Start Batch Sequence)

### Deskripsi Faktual
Operator membuka modal START, memasukkan Batch No, Loading No, memilih Nama Produk, Spesifikasi Kemasan, dan Formula Resep. Sistem mengunci eksekusi START agar tidak bisa ditekan ganda, memvalidasi resep, memeriksa ketiadaan batch aktif lain, memeriksa interlock fisik PLC (kedua pintu tertutup dan segel aktif), menulis 7 setpoint resep ke register PLC, melakukan verifikasi baca-balik setpoint hingga 4000 ms, mencatat audit setpoint terverifikasi, mengirim pulsa START (M1.4), menunggu konfirmasi PLC masuk fase proses (kode 2/3/4) maksimal 10 detik, dan membuat record baru di tabel `batch_records`.

### Rantai Alur Kode
1. **Dialog Input**: Tombol "START BATCH" di `src/app/(app)/page.js:380` membuka modal `src/components/StartDialog.js`.
2. **Kirim START**: Operator menekan tombol "MULAI PROSES", memicu `handleStartSubmit` yang mengirim request `POST /api/batch/start` (`src/components/StartDialog.js:180`).
3. **Advisory Lock Server**: Handler `src/app/api/batch/start/route.js:105` memanggil `acquireStartLock()` menggunakan kunci advisory `START_LOCK_KEY` (`847291034`) pada PostgreSQL (`src/app/api/batch/start/route.js:34`).
4. **Validasi Parameter**:
   - Memvalidasi Batch No melalui `validateBatchNo` (`src/lib/batchNo.js:16`).
   - Memeriksa keunikan Batch No pada tabel `batch_records` (`src/app/api/batch/start/route.js:218`).
   - Memvalidasi rentang fisik resep melalui `validateRecipe` (`src/lib/recipeValidation.js:52`).
   - Membangun snapshot formula resep melalui `buildRecipeSnapshot` (`src/lib/recipeSnapshot.js:18`).
5. **Guard Interlock Mesin**:
   - Membaca snapshot PLC via `readPlcSnapshot` (`src/app/api/batch/start/route.js:245`).
   - Menolak jika rawPhase !== 1 (Idle siap) (`src/app/api/batch/start/route.js:290`).
   - Menolak jika pintu terbuka (`opnFrnt` / `opnRear`), pintu belum rapat tertutup (`!clsFrnt` / `!clsRear`), atau door seal belum aktif (`!door.seal`) (`src/app/api/batch/start/route.js:309-335`).
   - Menolak jika `ctrlSel === true` (mesin dalam mode F0 manual) (`src/app/api/batch/start/route.js:357`).
6. **Penulisan Setpoint ke PLC**:
   - Menyusun 7 pasangan tag: `CTRL_TEMP`, `TEMP_SPACE`, `STER_SET`, `STER_SET_TIME`, `ALRM_PRES`, `COOL1_TEMP`, `COOL2_TEMP` (`src/app/api/batch/start/route.js:367`).
   - Mengirim request ke KEPServerEX via `writePlcTags` (`src/lib/plcWrite.js:16`).
7. **Verifikasi Pasca-Tulis**:
   - Melakukan polling pembacaan ulang setpoint ke PLC hingga 4000 ms (`src/app/api/batch/start/route.js:399-453`).
   - Jika terjadi selisih nilai, membatalkan START dan mencatat audit `start_batch_rejected` (`src/app/api/batch/start/route.js:468`).
8. **Audit Pre-Start (Fail-Closed)**:
   - Mencatat aksi `plc_setpoints_written` ke tabel `audit_log` via `insertAudit` (`src/app/api/batch/start/route.js:508`). Jika pencatatan audit gagal, proses START dibatalkan.
9. **Kirim Pulsa START**:
   - Mengirim pulsa tag START (M1.4): menulis true, jeda 1000 ms, menulis false melalui `pulsePlcTag("START")` (`src/lib/plcWrite.js:58`).
10. **Polling Fase PLC**:
    - Memanggil `pollUntilPhase([2, 3, 4], 10000, 500)` (`src/app/api/batch/start/route.js:547`) menunggu hingga register `PROCCES_TEXT` berubah menjadi kode 2 (Filling), 3 (Heating), atau 4 (Steril).
11. **Pencatatan Batch Record**:
    - Menjalankan `INSERT INTO batch_records` dengan status `'running'` dan menyimpan `recipe_snapshot` format JSON (`src/app/api/batch/start/route.js:593`).
    - Mencatat aksi `start_batch` ke tabel `audit_log` (`src/app/api/batch/start/route.js:656`).

### Bukti Kode
- `src/components/StartDialog.js:180-220`
- `src/app/api/batch/start/route.js:96-675`
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
Pengguna dapat mencari data batch berdasarkan nomor batch, nama operator, atau produk, memfilter status batch, menyaring rentang tanggal WIB, membuka detail data laporan, serta mengekspor seluruh catatan batch ke dalam berkas spreadsheet Microsoft Excel (`.xlsx`).

### Rantai Alur Kode
1. **Halaman Daftar**: `src/app/(app)/data-report/page.js:40` memanggil `GET /api/batch-records/route.js` dengan parameter query URL.
2. **Detail Batch**: Mengklik salah satu batch membuka `src/app/(app)/data-report/[batchNo]/page.js:35` yang mengambil data detail dan seluruh titik rekaman sensor dari `GET /api/batch-records/[batchNo]/route.js`.
3. **Ekspor Spreadsheet**:
   - Tombol "Export Excel" pada `src/app/(app)/data-report/page.js:140` mengarahkan browser ke `/api/batch-records/export?format=xlsx`.
   - Handler `src/app/api/batch-records/export/route.js:54` memvalidasi rentang baris (maksimal 50.000), mengambil data dari `batch_records`, mencatat audit `export_batch_records`, dan membangun worksheet 25 kolom melalui `exceljs` (`src/app/api/batch-records/export/route.js:150-216`).
   - Mengembalikan response binary dengan header `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### Bukti Kode
- `src/app/(app)/data-report/page.js:35-150`
- `src/app/api/batch-records/route.js:4-90`
- `src/app/api/batch-records/export/route.js:54-228`
- `src/app/api/batch-records/[batchNo]/route.js:4-118`

---

## 14. Fitur Audit Trail & Ekspor Log Aktivitas

### Deskripsi Faktual
Menyediakan pelacakan kepatuhan terhadap seluruh perubahan sistem SCADA: mencatat aktor, waktu kejadian WIB, tipe aksi, entitas yang diubah, serta payload nilai lama dan nilai baru dalam format JSON. Admin dapat memfilter jejak audit dan mengekspornya ke berkas Excel XLSX.

### Rantai Alur Kode
1. **Halaman UI**: `src/app/(app)/audit-log/page.js:80` memanggil `GET /api/audit-log/route.js` dan `GET /api/audit-log/filters/route.js`.
2. **Query Database**: Handler `src/app/api/audit-log/route.js:52` menjalankan query SQL dinamis pada tabel `audit_log` dengan pembatasan hak akses via `requireAdmin`.
3. **Ekspor Excel**: Tombol "Export Excel" memanggil `GET /api/audit-log/export?format=xlsx` (`src/app/api/audit-log/export/route.js:52`). Handler menghasilkan file spreadsheet Excel 11 kolom melalui pustaka `exceljs` dan mencatat aktivitas ekspor tersebut kembali ke tabel `audit_log`.

### Bukti Kode
- `src/app/(app)/audit-log/page.js:75-160`
- `src/app/api/audit-log/route.js:6-85`
- `src/app/api/audit-log/export/route.js:52-175`

---

## 15. Fitur Visualisasi Trend & Grafik Dinamis Recharts

### Deskripsi Faktual
Menampilkan grafik multi-sensor interaktif suhu (9 sensor) dan tekanan (kPa) untuk batch sterilisasi yang dipilih pengguna dari dropdown.

### Rantai Alur Kode
1. **Inisialisasi Halaman**: `src/app/(app)/trend/page.js:88` memanggil paralel `GET /api/status` dan `GET /api/batch-records?limit=100`. Jika ada batch `running`, batch tersebut otomatis terpilih; jika tidak, batch terbaru di list yang terpilih.
2. **Pengambilan Data Trend**: Perubahan pilihan batch memicu fetch ke `GET /api/batch-records/[batchNo]` (`src/app/(app)/trend/page.js:134`).
3. **Rendering Grafik**: Komponen merender `ComposedChart` Recharts dengan sumbu Y kiri domain 0-150°C dan sumbu Y kanan domain 0-320 kPa (`src/app/(app)/trend/page.js:246-311`).

### Bukti Kode
- `src/app/(app)/trend/page.js:88-155`
- `src/app/(app)/trend/page.js:246-312`

---

## 16. Fitur Pencetakan Dokumen Laporan Produksi (Print Layouts)

### Deskripsi Faktual
Menyediakan tata letak dokumen yang diformat khusus untuk dicetak ke printer kertas atau disimpan sebagai berkas PDF (A4 Portrait dan A4 Landscape) dengan penomoran halaman otomatis.

### Rantai Alur Kode
1. **Cetak Laporan Gabungan Data Report**:
   - Rute: `src/app/print/data-report/[batchNo]/page.js`.
   - Mengambil data dari `GET /api/batch-records/[batchNo]` dan `GET /api/alarms/by-batch/[batchNo]` (`src/app/print/data-report/[batchNo]/page.js:130`).
   - Merender 3 seksi: Data Record tabel trend (A4 portrait), Kurva grafik Recharts lebar 680px (A4 portrait), dan Log Alarm batch (A4 landscape) dengan penomoran halaman yang diatur via CSS named pages.
2. **Cetak Kurva Penuh**:
   - Rute: `src/app/print/data-report/[batchNo]/curve/page.js`.
   - Merender kurva suhu dan tekanan berorientasi A4 landscape dengan fixed width 940px tanpa animasi grafik (`src/app/print/data-report/[batchNo]/curve/page.js:250`).
3. **Cetak Log Alarm**:
   - Rute: `src/app/print/alarm/page.js`.
   - Mengambil seluruh baris filter dari `GET /api/alarms/print-data` dan merender tabel landscape A4 (`src/app/print/alarm/page.js:131`).
4. **Cetak Log Audit**:
   - Rute: `src/app/print/audit-log/page.js`.
   - Mengambil data dari `GET /api/audit-log/export?format=json` dan merender tabel landscape A4 (`src/app/print/audit-log/page.js:135`).
5. **Cetak Daftar Batch**:
   - Rute: `src/app/print/batch-records/page.js`.
   - Mengambil data dari `GET /api/batch-records/export?format=json` dan merender tabel 23 kolom landscape A4 (`src/app/print/batch-records/page.js:53`).

### Bukti Kode
- `src/app/print/data-report/[batchNo]/page.js:116-360`
- `src/app/print/data-report/[batchNo]/curve/page.js:105-310`
- `src/app/print/alarm/page.js:59-235`
- `src/app/print/audit-log/page.js:58-235`
- `src/app/print/batch-records/page.js:24-170`

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
