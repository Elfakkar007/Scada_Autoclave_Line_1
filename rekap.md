# 📊 Analisis & Rekapitulasi Proyek Web SCADA Sterilizer

Dokumen ini berisi analisis komprehensif mengenai proyek **SCADA Super Water Sterilizer**, mencakup alur kerja, fungsionalitas, evaluasi keselamatan, estimasi status proyek, serta *breakdown* pemetaan (mapping) alamat *tag* PLC yang digunakan oleh sistem.

---

## 1. Konfigurasi Dasar & Arsitektur
Proyek ini dibangun dengan arsitektur modern yang memisahkan antara antarmuka pengguna, logika server API, dan proses *background* (berjalan di belakang layar).
*   **Teknologi Utama**: Next.js 15 (App Router), React 19, Node.js.
*   **Database**: PostgreSQL (menggunakan library `pg` murni).
*   **Styling**: Tailwind CSS v4 dengan sistem *design token* (variabel `scada-*`).
*   **Konektivitas PLC**: Membaca dan menulis data ke PLC (Siemens S7-200) melalui perantara **KEPServerEX IoT Gateway** (REST API HTTP).
*   **Autentikasi**: *Stateless JWT* menggunakan library `jose` yang disimpan di *HTTP-only Cookies*, dilengkapi dengan validasi *Role-Based Access Control* (Admin vs Operator).
*   **Background Worker**: Menggunakan *custom server* (`server.js`) untuk menjalankan fungsi `trendRecorder.js` secara independen dari siklus hidup UI React. Ini memastikan data *trend* dan perhitungan F0 (nilai sterilisasi) tetap direkam setiap 5 detik meskipun browser ditutup.

## 2. Alur Kerja & Fungsionalitas Website (Apa yang BISA dilakukan)
Sistem ini dirancang sebagai antarmuka HMI (*Human-Machine Interface*) sekaligus Data Logger. Berikut alur kerja utamanya:

1.  **Manajemen Pengguna (Admin)**: Admin mengelola akun operator. Semua aksi sensitif (Login, CRUD, Ekspor) dicatat otomatis ke halaman **Audit Log**.
2.  **Manajemen Resep/Formula (Admin/QA)**: Pembuatan parameter sterilisasi (Suhu Sterilisasi, Waktu, Suhu Pendinginan, dll). Sistem dilengkapi **validasi ketat** (tidak boleh ada nilai 0 pada parameter krusial) sebelum disimpan.
3.  **Persiapan Batch (Prepare)**: Operator memilih formula, mengisi Nomor Batch, Loading, dan Produk, lalu sistem mengirimkan (*write*) setpoint parameter tersebut ke PLC.
4.  **Eksekusi & Monitoring (Dashboard)**: 
    *   Operator menekan tombol START dari web (atau fisik).
    *   Dashboard menampilkan UI P&ID secara *real-time* (animasi pompa, valve, suhu T1-T6, tekanan, fase mesin).
5.  **Perekaman Otomatis (Background)**: Begitu mesin berpindah fase dari *Idle* ke *Heat/Sterilize*, `trendRecorder.js` mulai menghitung timer dan **Nilai F0** (dengan suhu referensi 121.0°C dan z=10), lalu menyimpannya ke database setiap 5 detik.
6.  **Penyelesaian & Pelaporan (Data Report)**: Saat batch selesai, sistem memfinalisasi data (menghitung total waktu, F0 minimum, status *Pass/Fail*). Data ini dapat dicetak (*Print PDF*) atau diekspor ke Excel (dilengkapi kurva Suhu & Tekanan) yang formatnya dibuat persis meniru *printout* mesin SCADA lama.

## 3. Batasan Sistem (Apa yang TIDAK BISA / HARUS dilakukan Manusia)
Demi alasan **K3 (Kesehatan dan Keselamatan Kerja)** dan integritas operasional, web SCADA ini *sengaja* dibatasi. Hal-hal berikut mutlak harus dilakukan oleh manusia/operator fisik:

*   **Loading/Unloading Fisik**: Memasukkan dan mengeluarkan produk dari dalam *chamber* autoclave.
*   **Penguncian Pintu (Door Lock)**: Web dapat melihat status pintu, tetapi manusia harus memastikan pintu ditutup dan dikunci secara mekanis dengan benar. PLC biasanya memiliki *interlock* fisik untuk ini.
*   **Emergency Stop (E-Stop)**: Web menyediakan tombol "Stop Batch", tetapi dalam keadaan darurat sesungguhnya (kebocoran, kebakaran, tekanan berlebih/ledakan), operator **wajib** menekan tombol *Emergency Stop* jamur merah secara fisik di panel mesin yang memutus arus listrik secara *hardwired*.
*   **Kalibrasi Sensor**: Web hanya menampilkan angka dari PLC. Jika T1 menunjukkan 121°C tetapi termometer kalibrator fisik menunjukkan 119°C, manusia harus melakukan kalibrasi instrumen secara fisik.
*   **Verifikasi Visual Produk**: Menilai apakah kemasan produk rusak/bocor pasca-sterilisasi.

## 4. Persentase Penyelesaian Proyek
Berdasarkan kelengkapan kode saat ini, proyek ini berada di kisaran **90% - 95% Selesai (Tahap Pre-Commissioning)**. 

**Status Saat Ini:**
*   ✅ Struktur UI & Routing (100%)
*   ✅ Database Schema & Autentikasi (100%)
*   ✅ Logika PLC Read/Write & Polling (100%)
*   ✅ Background Task & Kalkulasi Integrasi F0 (100%)
*   ✅ Validasi Resep & Audit Trail (100%)
*   ✅ Export Excel & Halaman Cetak (100%)

**Sisa 5% - 10% yang belum (Tugas Commissioning):**
*   Pengujian terintegrasi (*Integration Testing*) langsung dengan PLC fisik di lapangan (memastikan *delay* jaringan KEPServerEX aman dan *scaling* nilai tag akurat).
*   Penyetelan toleransi beban server jika diakses berhari-hari tanpa henti (*stress test memory leak* pada `server.js`).

## 5. Fitur "Must-to-Have" yang Terlewat (Kritikal)
Jika mesin ini digunakan untuk industri farmasi atau makanan bersertifikasi (misal: standar BPOM / FDA 21 CFR Part 11), ada beberapa hal yang wajib ditambahkan:
1.  **Backup Database Otomatis (Cron Job)**: Data batch sangat berharga. Harus ada *script* (misal via `pg_dump`) yang mencadangkan database ke drive eksternal setiap malam. Saat ini belum ada mekanisme *backup* di level aplikasi.
2.  **Tanda Tangan Elektronik (E-Signature)**: Sebelum sebuah batch dianggap sah (*released*), supervisor/QA biasanya harus memasukkan ulang password mereka di halaman Data Report sebagai bentuk "Tanda Tangan" bahwa hasil sterilisasi valid.
3.  **Manajemen Sesi yang Ketat**: *Auto-logout* jika browser dibiarkan *idle* selama 15 menit tanpa aktivitas kursor, untuk mencegah orang tak berwenang menekan tombol di komputer yang ditinggalkan.

## 6. Saran Fitur "Nice-to-Have" (Peningkatan Estetika & UX)
1.  **Notifikasi Eksternal (Telegram/Email)**: Jika terjadi *Alarm* tingkat tinggi (misal: Tekanan *Overpressure* atau Suhu *Drop* saat fase Sterilisasi), bot langsung mengirim pesan ke grup Telegram Maintenance/QA.
2.  **Dark Mode Asli**: Karena layar kontrol SCADA sering dipantau di ruangan bersinar redup (atau shift malam), transisi ke tema gelap (*dark mode*) yang menyeluruh akan sangat mengurangi kelelahan mata operator.
3.  **Dashboard OEE (Overall Equipment Effectiveness)**: Halaman khusus yang menghitung statistik mesin. Misalnya: "Bulan ini mesin menganggur 40 jam, berjalan 120 jam, dan menghasilkan 5 batch *aborted*". Sangat berguna untuk manajemen pabrik.
4.  **Auto-Archiving (Data Purging)**: Saat data tren mencapai jutaan baris (setelah beberapa tahun), tabel `batch_trend` akan melambat. Fitur untuk mengarsipkan data di atas 1 tahun ke file `.csv` otomatis dan menghapusnya dari tabel utama akan menjaga sistem tetap secepat hari pertama.

---

## 7. Breakdown Mapping Tag PLC (Berdasarkan `plc.js`)

Dari total **105 tag address** yang tersedia di mesin (KEPServerEX), aplikasi SCADA Web ini secara spesifik hanya me-mapping dan melakukan *polling* terhadap **51 tag** yang paling esensial untuk kontrol, perekaman tren, dan keamanan. 

Berikut adalah *breakdown* pemetaan ke-51 tag tersebut berdasarkan fungsinya:

### A. Sensor Analog (Total: 13 Tag)
Nilai-nilai ini merupakan input pembacaan sensor fisik. Suhu diskalakan dengan membagi 10 (contoh: 355 → 35.5°C).
*   **Sensor Suhu (9)**: `T1`, `T2`, `T3`, `T4`, `T5`, `T6`, `TH` (High), `TM` (Mid), `TL` (Low)
*   **Sensor Tekanan (2)**: `P1`, `P2` *(Satuan KPa, raw tanpa di-scale)*
*   **Sensor Kualitas Air (2)**: `L` (Conductivity/Konduktivitas), `WATER` (Water Level/Ketinggian Air)

### B. Indikator Proses & Timer (Total: 5 Tag)
*   **Fase Mesin (1)**: `PROCCES_TEXT` *(Berisi integer 0-7 yang menunjukkan state/fase dari ladder logic PLC. 0=Idle, 2=Fill, 3=Heat, 4=Steril, 5=Cool, 7=Drain, 6=End)*
*   **Kalkulasi Internal PLC (1)**: `F0_VAL` *(Nilai akumulasi F0 bawaan PLC)*
*   **Timer Fase (3)**: `HEAT_TIME`, `ster_time`, `COOL_TIME` *(Durasi masing-masing fase dalam hitungan detik)*

### C. Setpoint / Resep Aktif (Total: 7 Tag)
Nilai-nilai ini di-*write* dari web (saat "Prepare Batch") dan di-*read* kembali untuk verifikasi.
*   **Parameter Suhu**: `CTRL_TEMP` (Suhu Sterilisasi), `TEMP_SPACE`, `COOL1_TEMP`, `COOL2_TEMP` (Suhu Pendinginan akhir)
*   **Parameter Waktu**: `STER_SET_TIME` (Durasi sterilisasi)
*   **Alarm/Safety**: `ALRM_PRES` (Batas alarm tekanan)
*   **Setpoint PLC**: `STER_SET` *(Nilai ini biasanya sama dengan CTRL_TEMP)*

### D. Kontrol Eksekusi / State Umum (Total: 4 Tag)
*   **Command**: `START`, `STOP` *(Pemicu untuk menjalankan/menghentikan mesin, di-*write* sebagai pulsa sementara)*
*   **Status/Mode**: `RUN_LAMP` (Indikator mesin berjalan), `CTRL SEL` *(Pemilihan Mode Waktu vs Mode F0 eksternal. Wajib bernilai False agar tidak hang)*

### E. Status Aktuator / Valve (Total: 8 Tag)
*Boolean* indikator apakah valve sedang terbuka/menyala.
*   **Uap/Steam**: `STEAM_1`, `STEAM_2`, `STEAM_EXHS`
*   **Pendingin/Air**: `COOLING_1`, `COOLING_2`, `WTR_FILL`, `WTR_DRAIN`, `WTR_PUMP`

### F. Status Pintu & Seal (Total: 8 Tag)
Penting untuk memastikan keamanan mekanis sebelum uap bertekanan dimasukkan.
*   **Kondisi Pintu**: `OPN_FRNT` (Terbuka Depan), `CLS_FRNT` (Tertutup Depan), `OPN_REAR` (Terbuka Belakang), `CLS_REAR` (Tertutup Belakang)
*   **Seal & Lock**: `DOOR_SEAL`, `DOOR_RELEASE`, `DOOR_LOCK` *(Berfungsi ganda sebagai Bypass Interlock di M6.0)*
*   **Air**: `WATR_INDICATOR`

### G. Alarm & Warning (Total: 6 Tag)
Sinyal peringatan keamanan.
*   **Buzzer**: `BUZZER`, `WARNING_BUZ`
*   **Suhu/Tekanan**: `ALRM_TEMP`, `OVER_TEMP`, `SAFETY_PRESS`
*   **Pintu**: `ALRM_DOR`

> **Catatan:** Sisa ±54 tag lainnya dari PLC tidak di-mapping di web ini karena kemungkinan besar berupa tag kalibrasi level rendah (PID tuning, offset instrumen), tag lampu indikator fisik yang tidak perlu di-render, atau cadangan (*spare*) yang memang tidak terpakai dalam *core routine* SCADA.
