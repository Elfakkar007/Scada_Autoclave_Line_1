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
Operator membuka modal START, memasukkan Batch No, Loading No, memilih Nama Produk (dropdown/ketik manual), Spesifikasi Kemasan (dropdown/ketik manual), Jumlah Botol (amount integer positif), dan Formula Resep. Sistem mengunci eksekusi START dengan advisory lock `START_LOCK_KEY` agar tidak bisa ditekan ganda, memvalidasi resep, memeriksa ketiadaan batch aktif lain, memeriksa interlock fisik PLC (kedua pintu tertutup dan segel aktif), menulis 7 setpoint resep ke register PLC, melakukan verifikasi baca-balik setpoint hingga 4000 ms, mencatat audit setpoint terverifikasi, mengirim pulsa START (M1.4), menunggu konfirmasi PLC masuk fase proses (kode 2/3/4) maksimal 10 detik, dan membuat record baru di tabel `batch_records` (termasuk kolom `bottle_count`).

### Rantai Alur Kode
1. **Dialog Input**: Tombol "START BATCH" di `src/app/(app)/page.js:380` membuka modal `src/components/StartDialog.js`. Modal menyediakan form 2 kolom responsif, combobox pencarian `SearchableCombobox` untuk Nama Produk dan Spesifikasi Kemasan, serta validasi bilangan bulat positif untuk Jumlah Botol (`bottleCount`).
2. **Kirim START**: Operator menekan tombol "MULAI PROSES", memicu `handleStartSubmit` yang mengirim request `POST /api/batch/start` (`src/components/StartDialog.js:180`).
3. **Advisory Lock Server**: Handler `src/app/api/batch/start/route.js:105` memanggil `acquireStartLock()` menggunakan kunci advisory `START_LOCK_KEY` (`7401001` dari `src/lib/recipeGuard.js:10`) pada PostgreSQL (`src/app/api/batch/start/route.js:35`).
4. **Validasi Parameter**:
   - Memvalidasi Batch No melalui `validateBatchNo` (`src/lib/batchNo.js:16`).
   - Memeriksa keunikan Batch No pada tabel `batch_records` (`src/app/api/batch/start/route.js:218`).
   - Membaca dan memvalidasi `bottleCount` (atau `amount`) dari body (`src/app/api/batch/start/route.js:134-141`).
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
    - Menjalankan `INSERT INTO batch_records` dengan kolom `bottle_count`, status `'running'`, dan snapshot resep JSON (`src/app/api/batch/start/route.js:606`).
    - Menyediakan fallback bila kolom `bottle_count` belum ada di database (`colErr.code === "42703"`, `src/app/api/batch/start/route.js:630`).
    - Mencatat aksi `start_batch` ke tabel `audit_log` (`src/app/api/batch/start/route.js:685`).

### Bukti Kode
- `src/components/StartDialog.js:1-420`
- `src/components/SearchableCombobox.js:1-204`
- `src/app/api/batch/start/route.js:1-743`
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
Menyediakan tata letak dokumen yang diformat khusus untuk dicetak ke printer kertas atau disimpan sebagai berkas PDF (A4 Portrait dan A4 Landscape) dengan penomoran halaman otomatis, informasi Jumlah Botol (Amount), serta blok tanda tangan pengesahan fisik (`SignOffBlock` - Operated by & Checked by) sesuai standar industri farmasi.

### Rantai Alur Kode
1. **Cetak Laporan Gabungan Data Report**:
   - Rute: `src/app/print/data-report/[batchNo]/page.js`.
   - Mengambil data dari `GET /api/batch-records/[batchNo]` dan `GET /api/alarms/by-batch/[batchNo]` (`src/app/print/data-report/[batchNo]/page.js:130`). Header menampilkan `Amount :` (`batch.bottleCount`).
   - Merender 3 seksi: Data Record tabel trend (A4 portrait), Kurva grafik Recharts lebar 680px (A4 portrait), dan Log Alarm batch (A4 landscape) dengan penomoran halaman yang diatur via CSS named pages. Menyematkan `<SignOffBlock />` di setiap akhir seksi.
2. **Cetak Kurva Penuh**:
   - Rute: `src/app/print/data-report/[batchNo]/curve/page.js`.
   - Merender kurva suhu dan tekanan berorientasi A4 landscape dengan fixed width 940px tanpa animasi grafik (`src/app/print/data-report/[batchNo]/curve/page.js:250`), header `Amount :`, dan blok `<SignOffBlock />`.
3. **Cetak Log Alarm**:
   - Rute: `src/app/print/alarm/page.js`.
   - Mengambil seluruh baris filter dari `GET /api/alarms/print-data` dan merender tabel landscape A4 (`src/app/print/alarm/page.js:131`), diakhiri blok `<SignOffBlock />` dengan styling `.keep-together`.
4. **Cetak Log Audit**:
   - Rute: `src/app/print/audit-log/page.js`.
   - Mengambil data dari `GET /api/audit-log/export?format=json` dan merender tabel landscape A4 (`src/app/print/audit-log/page.js:135`).
5. **Cetak Daftar Batch**:
   - Rute: `src/app/print/batch-records/page.js`.
   - Mengambil data dari `GET /api/batch-records/export?format=json` dan merender tabel 23 kolom landscape A4 (`src/app/print/batch-records/page.js:53`).

### Bukti Kode
- `src/components/SignOffBlock.js:1-43`
- `src/app/print/data-report/[batchNo]/page.js:1-668`
- `src/app/print/data-report/[batchNo]/curve/page.js:1-320`
- `src/app/print/alarm/page.js:1-248`
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
4. **Penghapusan Kolom Legacy `users.role` (Migrasi 005)**:
   - Berkas: `migrations/005_drop_legacy_role.sql`, `src/lib/auth.js`, `src/app/api/auth/login/route.js`, `src/app/api/users/route.js`, `scripts/hash-password.js`.
   - Bukti: Kolom teks `users.role`, trigger `trg_users_sync_legacy_role`, fungsi trigger terkait, dan constraint `users_role_check` telah dihapus sepenuhnya dari skema database dan kode. Otorisasi dialihkan penuh ke `users.role_id` mengarah ke tabel `roles` dan perizinan via `role_permissions`.
5. **Penghapusan Payload Body Mati pada Permintaan STOP**:
   - Berkas: `src/app/(app)/page.js:326-330` dan `src/app/api/batch/stop/route.js:9`.
   - Bukti: Pemanggilan fetch `/api/batch/stop` di Dashboard sebelumnya mengirim payload `body: JSON.stringify({ actor: ... })` beserta header `Content-Type: application/json`. Karena handler server mengambil aktor langsung dari sesi JWT terverifikasi, payload body dan header tersebut telah dihapus.
6. **Penghapusan Harness Uji Usang `fase1_integration.mjs`**:
   - Berkas: `fase1/tests/fase1_integration.mjs`.
   - Bukti: Harness integrasi lama yang masih mengasumsikan adanya kolom `users.role` telah dihapus dari repositori. Pengujian matriks perizinan kini menggunakan `fase1/tests/matrix.mjs`.
7. **Bypass Pengujian Status Kesiapan Mesin pada Dashboard**:
   - Berkas: `src/app/(app)/page.js:460`.
   - Bukti: Variabel evaluasi kesiapan mesin `startAllowed` di-hardcode menjadi `const startAllowed = true;`, sementara baris logika asli `!noData && data.plcOk === true && phaseRaw === 1 && !data.running` dinonaktifkan dalam komentar. Pengecekan server-side di `/api/batch/start` tetap memvalidasi interlock dan fase mesin secara fail-closed, namun penguncian tombol pada antarmuka web ter-bypass saat pengujian.

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
Menyediakan antarmuka HMI-web untuk memantau dan mengubah parameter mesin sterilisasi autoclave yang tersimpan pada register PLC Siemens S7-200. Parameter dikelompokkan dalam 3 tab: Parameter Setting 1 (Ster. Temp, Control Temp, Temp. Space, Ster. Time, Alarm Press., Cool. Temp 1 & 2), Parameter Setting 2 (Safety Press., Regu. Press, Over. Temp, Drain Time, Exhau. Temp, Select Press), dan Pressure Coefficient (a1, b1, a2, b2, Heat/Ster/Cool Coeff). Seluruh operasi penulisan dilindungi oleh PostgreSQL advisory lock `PLC_WRITE_LOCK_KEY` (847291035) dan `START_LOCK_KEY`, validasi batas nilai fisik, cross-check logika antar-field, isian alasan wajib untuk audit trail, serta verifikasi baca-balik dari PLC hingga 4,5 detik. Parameter keselamatan kritis (`SAFETY_PRESS`, `ALRM_PRES`, `SEL_PRESU`) mewajibkan izin khusus `action.write_safety_params`.

### Rantai Alur Kode
1. **Halaman UI**: Pengguna mengakses `/machine-params` (`src/app/(app)/machine-params/page.js`) yang dibungkus `PermissionGate resource="machine_params" minLevel="view"`. Komponen `PlcParamEditor` memuat tab `["param1", "param2", "coef"]`.
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
- `src/components/PlcParamEditor.js:1-401`
- `src/components/PlcDialog.js:1-20`
- `src/lib/plcParamCatalog.js:1-230`
- `src/lib/plcAccess.js:1-185`
- `src/app/api/plc-params/route.js:1-223`

---

## 21. Fitur Kalibrasi Offset Sensor PLC (Sensor Calibration)

### Deskripsi Faktual
Menyediakan antarmuka HMI-web untuk melihat dan mengkalibrasi nilai offset bertanda pada sensor autoclave yang terhubung ke PLC: 9 sensor suhu (TH, T1, T2, T3, T4, T5, T6, TM, TL pada tag `CAL_TH` s.d. `CAL_TL`), 2 sensor tekanan bejana (P1 pada `CAL_P1` dan P2 pada `CAL_P2`), serta konduktivitas air (L pada `CAL_L`). Mengubah offset kalibrasi dilindungi guard ganda: pengguna wajib memiliki hak akses `calibration >= edit` dan izin aksi kritis `action.write_calibration = edit`. Penulisan tunduk pada serialisasi penguncian mesin, pemeriksaan fase idle, pencatatan jejak audit lengkap dengan alasan, serta verifikasi baca-balik real-time.

### Rantai Alur Kode
1. **Halaman UI**: Pengguna mengakses `/calibration` (`src/app/(app)/calibration/page.js`) yang dibungkus `PermissionGate resource="calibration" minLevel="view"`. Komponen `PlcParamEditor` memuat grup `["calibration"]`.
2. **Pembacaan Offset**: Handler `GET /api/plc-params?group=calibration` membaca tag `CAL_*` melalui `readPlcRaw` dan menampilkan nilai offset bertanda (misal `+0.5 °C` atau `-2 kPa`).
3. **Pemberian Nilai Baru**: Pengguna memasukkan offset baru pada input desimal. Rentang offset suhu dibatasi -10 s.d. +10 °C, tekanan -50 s.d. +50 kPa, dan konduktivitas -500 s.d. +500 unit raw (`src/lib/plcParamCatalog.js:112-119`).
4. **Validasi Hak Aksi Kritis**: Permintaan `PUT /api/plc-params` memeriksa izin `action.write_calibration >= edit` (`src/app/api/plc-params/route.js:69`). Jika ditolak, mengembalikan status 403 Forbidden.
5. **Penulisan Terkunci & Audit**: Handler memperoleh kunci advisory `withPlcLocks`, memastikan fase idle `[0, 1, 6]`, mencatat jejak audit `plc_calibration_write_attempt`, menulis ke KEPServerEX, dan memverifikasi baca-balik tag `CAL_*`.
6. **Audit Sukses**: Mencatat jejak audit `plc_calibration_write_success` dengan rincian nilai lama dan nilai baru ke tabel `audit_log`.

### Bukti Kode
- `src/app/(app)/calibration/page.js:1-16`
- `src/lib/plcParamCatalog.js:111-120`
- `src/lib/plcAccess.js:89-185`
- `src/app/api/plc-params/route.js:57-223`

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
Menyediakan antarmuka pengoperasian manual aktuator mesin sterilisasi (10 item: katup steam 1 & 2, katup cooling 1 & 2, udara chamber, buang air drain, buang steam exhaust, pengisian air murni, pompa sirkulasi air, dan buzzer) yang dipetakan langsung ke subrutin PLC SBR9. Antarmuka menampilkan indikator lampu status perintah web vs status output relay fisik aktual secara real-time setiap 1,5 detik. Fitur ini dirancang dengan prinsip keselamatan industri farmasi:
- **Masuk Mode Manual**: Hanya dapat diaktifkan saat mesin idle (kode fase 0 atau 1) dan memastikan seluruh 10 perintah mati terlebih dahulu.
- **Keluar Mode Manual**: Dirancang sebagai tindakan darurat (emergency/safety action) yang SELALU diizinkan tanpa penguncian advisory lock dan tanpa syarat fase mesin. Prosedur keluar mematikan seluruh bit perintah katup terlebih dahulu, baru kemudian menurunkan bit `MANUAL_OPER` (M5.0) sehingga PLC mereset seluruh output proses.
- **Pagar Interlock Katup**: Katup steam hanya dapat dibuka jika kedua pintu bejana tertutup rapat dan seal pintu aktif (`clsFrnt && clsRear && seal`). Katup steam dan katup cooling dilarang aktif secara bersamaan (mutually exclusive).

### Rantai Alur Kode
1. **Halaman UI**: Antarmuka diakses di `/manual` (`src/app/(app)/manual/page.js`) dengan proteksi `PermissionGate resource="manual_control" minLevel="view"`. Melakukan polling ke `GET /api/plc-manual` setiap 1500 ms.
2. **Pemantauan Status Aktuator**: Handler `src/app/api/plc-manual/route.js:47` membaca seluruh tag perintah manual (`MAN_*`), tag output fisik aktual (`STEAM_1`, `COOLING_1`, `WTR_PUMP`, dll.), status pintu, dan level air via `readManualState` (`src/app/api/plc-manual/route.js:24`).
3. **Mulai Mode Manual**:
   - Operator dengan izin `manual_control >= edit` menekan "Mulai Mode Manual", mengisi alasan pada dialog modal, dan mengirim `POST /api/plc-manual` dengan `{ action: "enter", reason }` (`src/app/api/plc-manual/route.js:127`).
   - Handler memperoleh advisory lock `withPlcLocks`, memeriksa mesin idle (`checkMachineIdle([0, 1])`), mematikan seluruh perintah `MAN_*`, menulis `MANUAL_OPER = true` (M5.0), dan mencatat jejak audit `plc_manual_command`.
4. **Pemberian Perintah Aktuator**:
   - Operator menekan tombol "Nyalakan" / "Matikan" pada kartu aktuator.
   - Mengirim `POST /api/plc-manual` dengan `{ action: "set", key, value }`.
   - Jika `value === false` (mematikan), permintaan langsung dieksekusi via `writeAndVerify` tanpa syarat interlock.
   - Jika `value === true` (menyalakan), handler memeriksa `checkMachineIdle([0, 1])`, memvalidasi pagar interlock keselamatan `checkManualCommand` (`src/lib/plcManualCatalog.js:48`), menulis bit perintah ke PLC, dan mencatat jejak audit.
5. **Keluar Mode Manual (Fail-Safe Exit)**:
   - Operator menekan "Keluar Mode Manual". Mengirim `{ action: "exit" }` (`src/app/api/plc-manual/route.js:90`).
   - Eksekusi berjalan tanpa penguncian lock agar tidak terhalang. Handler mematikan seluruh perintah `MAN_*` ke `false`, memverifikasi katup menutup, lalu menurunkan `MANUAL_OPER` ke `false` (tepi turun M5.0 memicu ladder PLC mereset seluruh output proses), dan mencatat jejak audit.

### Bukti Kode
- `src/app/(app)/manual/page.js:1-264`
- `src/lib/plcManualCatalog.js:1-66`
- `src/app/api/plc-manual/route.js:1-217`
- `src/lib/plcAccess.js:1-185`

---

## 24. Fitur Pencatatan Jumlah Botol (Bottle Count / Amount Tracking)

### Deskripsi Faktual
Menambahkan pelacakan data jumlah botol (amount) produk dalam siklus sterilisasi autoclave. Data ini diisi secara manual oleh operator saat persiapan batch pada modal START, divalidasi sebagai bilangan bulat positif, dan disimpan ke kolom database `batch_records.bottle_count` melalui migrasi 006. Data jumlah botol disajikan secara komprehensif pada ringkasan modal START, kartu informasi produk detail batch, baris header laporan cetak proses dan kurva, serta diekspor ke berkas Excel spreadsheet XLSX dan format JSON.

### Rantai Alur Kode
1. **Input Modal START**: Komponen `src/components/StartDialog.js:127` memvalidasi input `bottleCount`. Nilai wajib diisi dan harus berupa integer > 0.
2. **Pengiriman & Penyimpanan Server**:
   - Handler `src/app/api/batch/start/route.js:134` mengekstrak `bottleCount` (atau alias `amount`), membersihkan karakter non-digit, dan memparsing menjadi integer.
   - Menyisipkan nilai ke kolom `bottle_count` pada query `INSERT INTO batch_records` (`src/app/api/batch/start/route.js:610`).
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

## Change Log

- [2026-10-29] ADDED: Menambahkan dokumentasi Fitur 20 (Pengaturan Parameter Mesin PLC), Fitur 21 (Kalibrasi Offset Sensor PLC), Fitur 22 (Pemantauan & Sinkronisasi Jam RTC PLC), Fitur 23 (Kontrol Manual Aktuator PLC), Fitur 24 (Pencatatan Jumlah Botol / Bottle Count Tracking), dan Fitur 25 (Blok Pengesahan Tanda Tangan Cetak / SignOffBlock). Menambahkan butir 7 pada Seksi 17 mengenai bypass pengujian `startAllowed = true` di Dashboard.
- [2026-10-29] MODIFIED: Memperbarui alur Fitur 4 (Start Batch Sequence) dengan nilai kunci advisory `START_LOCK_KEY` yang benar (`7401001`), pencatatan `bottle_count`, integrasi `SearchableCombobox`, dan penataan form 2 kolom. Memperbarui Fitur 13 (Data Report & Ekspor), Fitur 16 (Print Layouts), dan Fitur 18 (RBAC) sejalan dengan implementasi nyata antarmuka HMI dan pencatatan jumlah botol.
- [2026-10-28] ADDED: Menambahkan dokumentasi Fitur 18 (Manajemen Peran & Matriks Otorisasi Granular / RBAC) dan Fitur 19 (Hapus-Lunak Akun Pengguna & Penguncian Username). Menambahkan butir 4-6 pada Seksi 17 mengenai pembersihan kolom `users.role`, pembersihan payload `actor` mati pada permintaan STOP, dan penghapusan file uji usang `fase1_integration.mjs`.
- [2026-10-28] MODIFIED: Memperbarui alur verifikasi login pada Fitur 1 untuk membaca `role_id` join `roles` dan menolak akun terhapus-lunak, serta memperbarui guard `requireAdmin` menjadi `requirePermission` pada Fitur 14 (Audit Trail) dan fitur terkait lainnya.
