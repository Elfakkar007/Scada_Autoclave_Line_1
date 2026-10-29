# Peta Relasi & Hubungan Antar File (Dependency Map)

Dokumen ini memetakan seluruh hubungan impor internal dan ketergantungan antar berkas pada proyek `scada-sterilizer` yang diverifikasi secara aktual melalui analisis statis kode sumber.

---

## 1. Diagram Relasi Route → Komponen → Lib / API

Diagram Mermaid berikut memetakan hubungan hierarki dari rute antarmuka pengguna ke komponen pembangun dan modul pustaka / endpoint API yang digunakan:

```mermaid
flowchart TD
    subgraph Routes["Rute Halaman & Layar Antarmuka"]
        R_Root["src/app/layout.js"]
        R_Login["src/app/login/page.js"]
        R_App["src/app/(app)/layout.js"]
        R_Dash["src/app/(app)/page.js"]
        R_Alarm["src/app/(app)/alarm/page.js"]
        R_Audit["src/app/(app)/audit-log/page.js"]
        R_Report["src/app/(app)/data-report/page.js"]
        R_ReportDetail["src/app/(app)/data-report/[batchNo]/page.js"]
        R_Formula["src/app/(app)/formula/page.js"]
        R_Products["src/app/(app)/products/page.js"]
        R_Roles["src/app/(app)/roles/page.js"]
        R_Trend["src/app/(app)/trend/page.js"]
        R_Users["src/app/(app)/users/page.js"]
        R_MachParams["src/app/(app)/machine-params/page.js"]
        R_Calib["src/app/(app)/calibration/page.js"]
        R_Clock["src/app/(app)/plc-clock/page.js"]
        R_Manual["src/app/(app)/manual/page.js"]
    end

    subgraph Components["Komponen Antarmuka Pengguna (src/components)"]
        C_Navbar["Navbar.js"]
        C_AlarmCenter["AlarmCenter.js"]
        C_ScreenLock["ScreenLock.js"]
        C_AtvDiagram["AtvDiagram.js"]
        C_StartDialog["StartDialog.js"]
        C_DeletedBadge["DeletedUserBadge.js"]
        C_PermGate["PermissionGate.js"]
        C_SearchCombobox["SearchableCombobox.js"]
        C_SignOff["SignOffBlock.js"]
        C_PlcDialog["PlcDialog.js"]
        C_PlcParamEditor["PlcParamEditor.js"]
    end

    subgraph API["Backend API Handlers (src/app/api)"]
        API_Status["status/route.js"]
        API_AuthLogin["auth/login/route.js"]
        API_AuthLogout["auth/logout/route.js"]
        API_AuthMe["auth/me/route.js"]
        API_AuthUnlock["auth/unlock/route.js"]
        API_BatchStart["batch/start/route.js"]
        API_BatchStop["batch/stop/route.js"]
        API_BatchRecords["batch-records/route.js"]
        API_BatchDetail["batch-records/[batchNo]/route.js"]
        API_AlarmsActive["alarms/active/route.js"]
        API_Formulas["formulas/route.js"]
        API_PlcReset["plc/reset/route.js"]
        API_PlcParams["plc-params/route.js"]
        API_PlcClock["plc-clock/route.js"]
        API_PlcManual["plc-manual/route.js"]
        API_Roles["roles/route.js"]
        API_RolesId["roles/[id]/route.js"]
        API_RolesOptions["roles/options/route.js"]
        API_Users["users/route.js"]
        API_UsersDelete["users/[username]/delete/route.js"]
    end

    subgraph Libs["Pustaka Logika Bisnis & Integrasi (src/lib)"]
        L_Db["db.js (PostgreSQL)"]
        L_Plc["plc.js (KEPServerEX)"]
        L_PlcWrite["plcWrite.js"]
        L_PlcAccess["plcAccess.js"]
        L_PlcClock["plcClock.js"]
        L_PlcManualCat["plcManualCatalog.js"]
        L_PlcParamCat["plcParamCatalog.js"]
        L_Auth["auth.js (JWT jose & guards)"]
        L_Audit["auditLog.js"]
        L_Finalize["batchFinalize.js"]
        L_F0["f0.js"]
        L_RecipeVal["recipeValidation.js"]
        L_RecipeGuard["recipeGuard.js"]
        L_AlarmMon["alarmMonitor.js"]
        L_TrendRec["trendRecorder.js"]
        L_PermCat["permissionCatalog.js"]
        L_RoleAdmin["roleAdmin.js"]
        L_RoleQueries["roleQueries.js"]
        L_UserQueries["userQueries.js"]
        L_OpLabel["operatorLabel.js"]
    end

    %% Relasi Rute ke Layout & Komponen
    R_Root --> R_App
    R_App --> C_Navbar
    R_App --> C_AlarmCenter
    R_App --> C_ScreenLock
    R_Dash --> C_AtvDiagram
    R_Dash --> C_StartDialog
    R_Dash --> C_DeletedBadge
    R_Alarm --> C_DeletedBadge
    R_Alarm --> C_PermGate
    R_Report --> C_DeletedBadge
    R_Report --> C_PermGate
    R_ReportDetail --> C_DeletedBadge
    R_ReportDetail --> C_PermGate
    R_Formula --> C_PermGate
    R_Products --> C_PermGate
    R_Trend --> C_DeletedBadge
    R_Trend --> C_PermGate
    R_Roles --> L_PermCat
    R_MachParams --> C_PermGate
    R_MachParams --> C_PlcParamEditor
    R_Calib --> C_PermGate
    R_Calib --> C_PlcParamEditor
    R_Clock --> C_PermGate
    R_Clock --> C_PlcDialog
    R_Clock --> L_PlcClock
    R_Clock --> L_PermCat
    R_Manual --> C_PermGate
    R_Manual --> C_PlcDialog
    R_Manual --> L_PlcManualCat
    R_Manual --> L_PermCat
    C_StartDialog --> C_SearchCombobox
    C_PlcParamEditor --> C_PlcDialog
    C_PlcParamEditor --> L_PlcParamCat
    C_PlcParamEditor --> L_PermCat
    C_Navbar --> L_PermCat
    C_PermGate --> L_PermCat

    %% Komponen / Halaman memanggil API
    R_Login -.-> API_AuthLogin
    C_Navbar -.-> API_AuthLogout
    R_App -.-> API_AuthMe
    C_ScreenLock -.-> API_AuthUnlock
    C_AlarmCenter -.-> API_AlarmsActive
    R_Dash -.-> API_Status
    C_StartDialog -.-> API_BatchStart
    R_Dash -.-> API_BatchStop
    R_Dash -.-> API_PlcReset
    R_Report -.-> API_BatchRecords
    R_ReportDetail -.-> API_BatchDetail
    R_Trend -.-> API_BatchDetail
    R_Formula -.-> API_Formulas
    R_Roles -.-> API_Roles
    R_Roles -.-> API_RolesId
    R_Users -.-> API_RolesOptions
    R_Users -.-> API_Users
    R_Users -.-> API_UsersDelete
    C_PlcParamEditor -.-> API_PlcParams
    R_Clock -.-> API_PlcClock
    R_Manual -.-> API_PlcManual

    %% API ke Pustaka Libs
    API_Status --> L_Plc
    API_Status --> L_Db
    API_AuthLogin --> L_Auth
    API_AuthLogin --> L_Audit
    API_AuthLogin --> L_Db
    API_AuthMe --> L_Auth
    API_AuthMe --> L_Db
    API_BatchStart --> L_Plc
    API_BatchStart --> L_PlcWrite
    API_BatchStart --> L_RecipeVal
    API_BatchStart --> L_RecipeGuard
    API_BatchStart --> L_Audit
    API_BatchStart --> L_Db
    API_BatchStop --> L_PlcWrite
    API_BatchStop --> L_Finalize
    API_BatchStop --> L_Audit
    API_Finalize --> L_F0
    API_Finalize --> L_Db
    API_Roles --> L_RoleQueries
    API_Roles --> L_RoleAdmin
    API_Roles --> L_PermCat
    API_Roles --> L_Db
    API_RolesId --> L_RoleQueries
    API_RolesId --> L_RoleAdmin
    API_RolesId --> L_PermCat
    API_RolesId --> L_Db
    API_RolesOptions --> L_Auth
    API_RolesOptions --> L_RoleAdmin
    API_RolesOptions --> L_Db
    API_Users --> L_UserQueries
    API_Users --> L_RoleAdmin
    API_Users --> L_Db
    API_UsersDelete --> L_UserQueries
    API_UsersDelete --> L_RoleAdmin
    API_UsersDelete --> L_Db
    API_PlcParams --> L_PlcAccess
    API_PlcParams --> L_PlcParamCat
    API_PlcParams --> L_Auth
    API_PlcParams --> L_Audit
    API_PlcParams --> L_Db
    API_PlcClock --> L_PlcAccess
    API_PlcClock --> L_PlcClock
    API_PlcClock --> L_PlcParamCat
    API_PlcClock --> L_PlcWrite
    API_PlcClock --> L_Auth
    API_PlcClock --> L_Audit
    API_PlcClock --> L_Db
    API_PlcManual --> L_PlcAccess
    API_PlcManual --> L_PlcManualCat
    API_PlcManual --> L_Auth
    API_PlcManual --> L_Audit
    API_PlcManual --> L_Db
    L_PlcAccess --> L_PlcWrite
    L_PlcAccess --> L_RecipeGuard
    L_PlcAccess --> L_PlcParamCat
    L_PlcAccess --> L_Db
    L_Auth --> L_PermCat
    L_Auth --> L_Db
```

---

## 2. Diagram Alur Data Utama (Main Data Flow)

Diagram berikut memetakan alur pertukaran data antara operator web, antarmuka browser, server Next.js, database PostgreSQL, dan mesin PLC fisik Siemens S7-200 via KEPServerEX:

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operator Pabrik
    participant Browser as Antarmuka Web (Next.js)
    participant Server as HTTP Server (server.js)
    participant Worker as Background Workers
    participant DB as PostgreSQL Database
    participant Gateway as KEPServerEX IoT Gateway
    participant PLC as Siemens S7-200 PLC

    Note over Worker,DB: 1. Perekaman Trend & Alarm Latar Belakang
    loop Setiap 5 detik (trendRecorder.js)
        Worker->>Gateway: GET /iotgateway/read
        Gateway->>PLC: Baca Register Analog (VW) & Bit (M/Q/I)
        PLC-->>Gateway: Raw Memory Values
        Gateway-->>Worker: JSON Tag Values
        Worker->>DB: INSERT INTO batch_trend (Suhu, Tekanan, Fase)
    end

    loop Setiap 1 detik (alarmMonitor.js)
        Worker->>Gateway: GET /iotgateway/read (Bit Fault M8.0, M8.1, M8.2, M10.2, M10.3)
        Gateway-->>Worker: Alarm Status
        Worker->>DB: UPDATE monitor_heartbeat & INSERT alarm_log (Bila ada transisi)
    end

    Note over Operator,PLC: 2. Alur Memulai Batch (START Process)
    Operator->>Browser: Klik START, Isi Batch No & Pilih Resep
    Browser->>Server: POST /api/batch/start
    Server->>DB: SELECT pg_try_advisory_lock(START_LOCK_KEY)
    Server->>DB: Cek Unik Batch No & Validasi Resep
    Server->>Gateway: GET /iotgateway/read (Cek Interlock Pintu & Seal)
    Gateway-->>Server: Interlock OK (Pintu Rapat, Seal Mengembang)
    Server->>Gateway: POST /iotgateway/write (7 Tag Setpoint Resep)
    Gateway->>PLC: Tulis Setpoint ke Register VW
    Server->>Gateway: GET /iotgateway/read (Verifikasi Ulang Setpoint)
    Gateway-->>Server: Setpoint Terverifikasi Cocok
    Server->>DB: INSERT INTO audit_log (plc_setpoints_written)
    Server->>Gateway: POST /iotgateway/write (START Pulsa M1.4 ON->OFF)
    Gateway->>PLC: Pulsa Bit Start M1.4
    loop Polling Fase (Max 10 dtk)
        Server->>Gateway: GET /iotgateway/read
        Gateway-->>Server: PROCCES_TEXT = 2 / 3 / 4 (Mulai Proses)
    end
    Server->>DB: INSERT INTO batch_records (status: 'running', snapshot: json)
    Server->>DB: INSERT INTO audit_log (start_batch)
    Server-->>Browser: HTTP 201 Created (Batch Berhasil Dimulai)
    Browser-->>Operator: Tampilkan Status Running & Animasi Autoclave

    Note over Operator,PLC: 3. Alur Menghentikan Batch (STOP Process)
    Operator->>Browser: Klik STOP BATCH & Konfirmasi
    Browser->>Server: POST /api/batch/stop
    Server->>Gateway: POST /iotgateway/write (STOP Pulsa M1.5 ON->OFF)
    Gateway->>PLC: Pulsa Bit Stop M1.5
    Server->>DB: SELECT * FROM batch_trend WHERE batch_id = $id
    DB-->>Server: Deret Data Trend
    Server->>Server: Hitung Durasi Fase & Integrasi F0 (f0.js)
    Server->>DB: UPDATE batch_records (status: finished/aborted, f0_min, durasi)
    Server->>DB: INSERT INTO audit_log (stop_batch)
    Server-->>Browser: HTTP 200 OK (Batch Selesai, Tampilkan Nilai F0)
    Browser-->>Operator: Dialog Ringkasan Hasil Sterilisasi & F0 Selesai
```

---

## 3. Tabel Hubungan Impor Antar File

Tabel berikut memuat daftar seluruh berkas kode sumber beserta file yang di-import langsung (import / require) dan file yang meng-import-nya (imported by), diverifikasi secara aktual tanpa estimasi:

| Berkas | Meng-import (Internal) | Dipakai Oleh (Imported By) |
| :--- | :--- | :--- |
| `.env.local` | — | — |
| `.gitignore` | — | — |
| `README.md` | — | — |
| `context/ROADMAP (12).md` | — | — |
| `context/SiemensS7-200.csv` | — | — |
| `context/export_atv.awl` | — | — |
| `eslint.config.mjs` | — | — |
| `jsconfig.json` | — | — |
| `next.config.mjs` | — | — |
| `package-lock.json` | — | — |
| `package.json` | — | — |
| `postcss.config.mjs` | — | — |
| `public/satoria-logo.png` | — | — |
| `fase1/tests/matrix.mjs` | — | — |
| `migrations/005_drop_legacy_role.sql` | — | — |
| `migrations/005_drop_legacy_role_rollback.sql` | — | — |
| `migrations/006_add_bottle_count.sql` | — | — |
| `migrations/006_add_bottle_count_rollback.sql` | — | — |
| `migrations/backup_271026.sql` | — | — |
| `public/satoria-logo.png` | — | — |
| `public/sounds/alarm.wav` | — | — |
| `scripts/hash-password.js` | — | — |
| `server.js` | `src/lib/trendRecorder.js`<br>`src/lib/alarmMonitor.js` | — |
| `src/app/(app)/alarm/page.js` | `src/lib/alarmEventLabels.js`<br>`src/components/DeletedUserBadge.js`<br>`src/components/PermissionGate.js` | — |
| `src/app/(app)/audit-log/page.js` | `src/components/DeletedUserBadge.js` | — |
| `src/app/(app)/calibration/page.js` | `src/components/PermissionGate.js`<br>`src/components/PlcParamEditor.js` | — |
| `src/app/(app)/data-report/[batchNo]/page.js` | `src/components/DeletedUserBadge.js`<br>`src/components/PermissionGate.js` | — |
| `src/app/(app)/data-report/page.js` | `src/components/DeletedUserBadge.js`<br>`src/components/PermissionGate.js` | — |
| `src/app/(app)/formula/page.js` | `src/components/PermissionGate.js` | — |
| `src/app/(app)/layout.js` | `src/app/globals.css`<br>`src/components/Navbar.js`<br>`src/components/AlarmCenter.js`<br>`src/components/ScreenLock.js` | — |
| `src/app/(app)/machine-params/page.js` | `src/components/PermissionGate.js`<br>`src/components/PlcParamEditor.js` | — |
| `src/app/(app)/manual/page.js` | `src/lib/permissionCatalog.js`<br>`src/lib/plcManualCatalog.js`<br>`src/components/PermissionGate.js`<br>`src/components/PlcDialog.js` | — |
| `src/app/(app)/page.js` | `src/components/DeletedUserBadge.js`<br>`src/lib/plcCommandAlert.js`<br>`src/components/AtvDiagram.js`<br>`src/lib/atvProcess.js`<br>`src/components/StartDialog.js` | — |
| `src/app/(app)/plc-clock/page.js` | `src/lib/permissionCatalog.js`<br>`src/lib/plcClock.js`<br>`src/components/PermissionGate.js`<br>`src/components/PlcDialog.js` | — |
| `src/app/(app)/products/page.js` | `src/components/PermissionGate.js` | — |
| `src/app/(app)/roles/page.js` | `src/lib/permissionCatalog.js` | — |
| `src/app/(app)/trend/page.js` | `src/components/DeletedUserBadge.js`<br>`src/components/PermissionGate.js` | — |
| `src/app/(app)/users/page.js` | — | — |
| `src/app/api/alarms/active/route.js` | `src/lib/db.js`<br>`src/lib/alarmCatalog.js` | — |
| `src/app/api/alarms/by-batch/[batchNo]/route.js` | `src/lib/db.js` | — |
| `src/app/api/alarms/event-types/route.js` | `src/lib/db.js` | — |
| `src/app/api/alarms/print-data/route.js` | `src/lib/db.js`<br>`src/lib/alarmQuery.js` | — |
| `src/app/api/alarms/route.js` | `src/lib/db.js`<br>`src/lib/alarmQuery.js` | — |
| `src/app/api/audit-log/export/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/dateRange.js` | — |
| `src/app/api/audit-log/filters/route.js` | `src/lib/db.js`<br>`src/lib/auth.js` | — |
| `src/app/api/audit-log/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/dateRange.js` | — |
| `src/app/api/auth/login/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js` | — |
| `src/app/api/auth/logout/route.js` | `src/lib/auth.js`<br>`src/lib/auditLog.js` | — |
| `src/app/api/auth/me/route.js` | `src/lib/auth.js`<br>`src/lib/db.js` | — |
| `src/app/api/auth/unlock/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js` | — |
| `src/app/api/auth/users/route.js` | `src/lib/db.js` | — |
| `src/app/api/batch-records/[batchNo]/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/recipeSnapshot.js` | — |
| `src/app/api/batch-records/export/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/dateRange.js` | — |
| `src/app/api/batch-records/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/dateRange.js` | — |
| `src/app/api/batch/start/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/plc.js`<br>`src/lib/plcWrite.js`<br>`src/lib/recipeValidation.js`<br>`src/lib/batchNo.js`<br>`src/lib/recipeSnapshot.js`<br>`src/lib/recipeGuard.js` | — |
| `src/app/api/batch/stop/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/plc.js`<br>`src/lib/plcWrite.js`<br>`src/lib/batchFinalize.js`<br>`src/lib/auditLog.js` | — |
| `src/app/api/formulas/[formulaNo]/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/recipeValidation.js`<br>`src/lib/recipeGuard.js` | — |
| `src/app/api/formulas/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/recipeValidation.js` | — |
| `src/app/api/plc-clock/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/plcWrite.js`<br>`src/lib/plcParamCatalog.js`<br>`src/lib/plcAccess.js`<br>`src/lib/plcClock.js` | — |
| `src/app/api/plc-manual/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/plcManualCatalog.js`<br>`src/lib/plcAccess.js` | — |
| `src/app/api/plc-params/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/plcParamCatalog.js`<br>`src/lib/plcAccess.js` | — |
| `src/app/api/plc/reset/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/plc.js`<br>`src/lib/plcWrite.js`<br>`src/lib/auditLog.js` | — |
| `src/app/api/product-specs/[id]/route.js` | `src/lib/db.js`<br>`src/lib/auth.js` | — |
| `src/app/api/product-specs/route.js` | `src/lib/db.js`<br>`src/lib/auth.js` | — |
| `src/app/api/products/[id]/route.js` | `src/lib/db.js`<br>`src/lib/auth.js` | — |
| `src/app/api/products/route.js` | `src/lib/db.js`<br>`src/lib/auth.js` | — |
| `src/app/api/roles/options/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/roleAdmin.js` | — |
| `src/app/api/roles/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/permissionCatalog.js`<br>`src/lib/roleAdmin.js`<br>`src/lib/roleQueries.js` | — |
| `src/app/api/roles/[id]/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/permissionCatalog.js`<br>`src/lib/roleAdmin.js`<br>`src/lib/roleQueries.js` | — |
| `src/app/api/status/route.js` | `src/lib/plc.js`<br>`src/lib/db.js` | — |
| `src/app/api/users/[username]/delete/route.js` | `src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/roleAdmin.js`<br>`src/lib/userQueries.js` | — |
| `src/app/api/users/[username]/reset-password/route.js` | `src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/roleAdmin.js` | — |
| `src/app/api/users/[username]/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/roleAdmin.js`<br>`src/lib/userQueries.js` | — |
| `src/app/api/users/route.js` | `src/lib/db.js`<br>`src/lib/auth.js`<br>`src/lib/auditLog.js`<br>`src/lib/roleAdmin.js`<br>`src/lib/userQueries.js` | — |
| `src/app/globals.css` | — | `src/app/(app)/layout.js`<br>`src/app/layout.js` |
| `src/app/layout.js` | `src/app/globals.css` | — |
| `src/app/login/page.js` | — | — |
| `src/app/print/alarm/page.js` | `src/lib/alarmEventLabels.js`<br>`src/components/PermissionGate.js`<br>`src/components/SignOffBlock.js` | — |
| `src/app/print/audit-log/page.js` | — | — |
| `src/app/print/batch-records/page.js` | `src/components/PermissionGate.js` | — |
| `src/app/print/data-report/[batchNo]/curve/page.js` | `src/lib/operatorLabel.js`<br>`src/components/SignOffBlock.js` | — |
| `src/app/print/data-report/[batchNo]/page.js` | `src/lib/alarmEventLabels.js`<br>`src/lib/operatorLabel.js`<br>`src/components/PermissionGate.js`<br>`src/components/SignOffBlock.js` | — |
| `src/components/AlarmCenter.js` | `src/lib/alarmView.js` | `src/app/(app)/layout.js` |
| `src/components/AtvDiagram.js` | `src/lib/atvProcess.js` | `src/app/(app)/page.js` |
| `src/components/DeletedUserBadge.js` | — | `src/app/(app)/alarm/page.js`<br>`src/app/(app)/audit-log/page.js`<br>`src/app/(app)/data-report/[batchNo]/page.js`<br>`src/app/(app)/data-report/page.js`<br>`src/app/(app)/page.js`<br>`src/app/(app)/trend/page.js` |
| `src/components/Navbar.js` | `src/lib/permissionCatalog.js` | `src/app/(app)/layout.js` |
| `src/components/PermissionGate.js` | `src/lib/permissionCatalog.js` | `src/app/(app)/alarm/page.js`<br>`src/app/(app)/calibration/page.js`<br>`src/app/(app)/data-report/[batchNo]/page.js`<br>`src/app/(app)/data-report/page.js`<br>`src/app/(app)/formula/page.js`<br>`src/app/(app)/machine-params/page.js`<br>`src/app/(app)/manual/page.js`<br>`src/app/(app)/plc-clock/page.js`<br>`src/app/(app)/products/page.js`<br>`src/app/(app)/trend/page.js`<br>`src/app/print/alarm/page.js`<br>`src/app/print/batch-records/page.js`<br>`src/app/print/data-report/[batchNo]/page.js` |
| `src/components/PlcDialog.js` | — | `src/components/PlcParamEditor.js`<br>`src/app/(app)/plc-clock/page.js`<br>`src/app/(app)/manual/page.js` |
| `src/components/PlcParamEditor.js` | `src/lib/permissionCatalog.js`<br>`src/lib/plcParamCatalog.js`<br>`src/components/PlcDialog.js` | `src/app/(app)/machine-params/page.js`<br>`src/app/(app)/calibration/page.js` |
| `src/components/ScreenLock.js` | — | `src/app/(app)/layout.js` |
| `src/components/SearchableCombobox.js` | — | `src/components/StartDialog.js` |
| `src/components/SignOffBlock.js` | — | `src/app/print/alarm/page.js`<br>`src/app/print/data-report/[batchNo]/page.js`<br>`src/app/print/data-report/[batchNo]/curve/page.js` |
| `src/components/StartDialog.js` | `src/lib/batchNo.js`<br>`src/lib/plcCommandAlert.js`<br>`src/components/SearchableCombobox.js` | `src/app/(app)/page.js` |
| `src/lib/__fixtures__/printout_2026-10-03.js` | — | `src/lib/f0.test.mjs` |
| `src/lib/alarmCatalog.js` | — | `src/app/api/alarms/active/route.js`<br>`src/lib/alarmMonitor.js` |
| `src/lib/alarmEpisodes.js` | — | `src/lib/alarmEpisodes.test.mjs`<br>`src/lib/alarmMonitor.js` |
| `src/lib/alarmEpisodes.test.mjs` | `src/lib/alarmEpisodes.js` | — |
| `src/lib/alarmEventLabels.js` | — | `src/app/(app)/alarm/page.js`<br>`src/app/print/alarm/page.js`<br>`src/app/print/data-report/[batchNo]/page.js` |
| `src/lib/alarmMonitor.js` | `src/lib/db.js`<br>`src/lib/plc.js`<br>`src/lib/alarmCatalog.js`<br>`src/lib/alarmEpisodes.js`<br>`src/lib/recipeGuard.js`<br>`src/lib/recipeSnapshot.js` | `server.js` |
| `src/lib/alarmQuery.js` | `src/lib/dateRange.js` | `src/app/api/alarms/print-data/route.js`<br>`src/app/api/alarms/route.js` |
| `src/lib/alarmView.js` | — | `src/components/AlarmCenter.js`<br>`src/lib/alarmView.test.mjs` |
| `src/lib/alarmView.test.mjs` | `src/lib/alarmView.js` | — |
| `src/lib/atvProcess.js` | — | `src/app/(app)/page.js`<br>`src/components/AtvDiagram.js` |
| `src/lib/auditLog.js` | `src/lib/db.js` | `src/app/api/auth/login/route.js`<br>`src/app/api/auth/logout/route.js`<br>`src/app/api/auth/unlock/route.js`<br>`src/app/api/batch/stop/route.js`<br>`src/app/api/plc-clock/route.js`<br>`src/app/api/plc-manual/route.js`<br>`src/app/api/plc-params/route.js`<br>`src/app/api/plc/reset/route.js`<br>`src/app/api/roles/route.js`<br>`src/app/api/roles/[id]/route.js`<br>`src/app/api/users/route.js`<br>`src/app/api/users/[username]/delete/route.js`<br>`src/app/api/users/[username]/reset-password/route.js`<br>`src/app/api/users/[username]/route.js` |
| `src/lib/auth.js` | `src/lib/db.js`<br>`src/lib/permissionCatalog.js` | `src/app/api/audit-log/export/route.js`<br>`src/app/api/audit-log/filters/route.js`<br>`src/app/api/audit-log/route.js`<br>`src/app/api/auth/login/route.js`<br>`src/app/api/auth/logout/route.js`<br>`src/app/api/auth/me/route.js`<br>`src/app/api/auth/unlock/route.js`<br>`src/app/api/batch/start/route.js`<br>`src/app/api/batch/stop/route.js`<br>`src/app/api/batch-records/export/route.js`<br>`src/app/api/batch-records/route.js`<br>`src/app/api/batch-records/[batchNo]/route.js`<br>`src/app/api/formulas/route.js`<br>`src/app/api/formulas/[formulaNo]/route.js`<br>`src/app/api/plc-clock/route.js`<br>`src/app/api/plc-manual/route.js`<br>`src/app/api/plc-params/route.js`<br>`src/app/api/plc/reset/route.js`<br>`src/app/api/product-specs/route.js`<br>`src/app/api/product-specs/[id]/route.js`<br>`src/app/api/products/route.js`<br>`src/app/api/products/[id]/route.js`<br>`src/app/api/roles/options/route.js`<br>`src/app/api/roles/route.js`<br>`src/app/api/roles/[id]/route.js`<br>`src/app/api/users/route.js`<br>`src/app/api/users/[username]/delete/route.js`<br>`src/app/api/users/[username]/reset-password/route.js`<br>`src/app/api/users/[username]/route.js` |
| `src/lib/batchFinalize.js` | `src/lib/batchFinalize.js`<br>`src/lib/db.js`<br>`src/lib/f0.js` | `src/app/api/batch/stop/route.js`<br>`src/lib/batchFinalize.js`<br>`src/lib/trendRecorder.js` |
| `src/lib/batchNo.js` | — | `src/app/api/batch/start/route.js`<br>`src/components/StartDialog.js` |
| `src/lib/dateRange.js` | — | `src/app/api/audit-log/export/route.js`<br>`src/app/api/audit-log/route.js`<br>`src/app/api/batch-records/export/route.js`<br>`src/app/api/batch-records/route.js`<br>`src/lib/alarmQuery.js` |
| `src/lib/db.js` | — | `src/app/api/alarms/active/route.js`<br>`src/app/api/alarms/by-batch/[batchNo]/route.js`<br>`src/app/api/alarms/event-types/route.js`<br>`src/app/api/alarms/print-data/route.js`<br>`src/app/api/alarms/route.js`<br>`src/app/api/audit-log/export/route.js`<br>`src/app/api/audit-log/filters/route.js`<br>`src/app/api/audit-log/route.js`<br>`src/app/api/auth/login/route.js`<br>`src/app/api/auth/me/route.js`<br>`src/app/api/auth/unlock/route.js`<br>`src/app/api/auth/users/route.js`<br>`src/app/api/batch/start/route.js`<br>`src/app/api/batch/stop/route.js`<br>`src/app/api/batch-records/export/route.js`<br>`src/app/api/batch-records/route.js`<br>`src/app/api/batch-records/[batchNo]/route.js`<br>`src/app/api/formulas/route.js`<br>`src/app/api/formulas/[formulaNo]/route.js`<br>`src/app/api/plc-clock/route.js`<br>`src/app/api/plc-manual/route.js`<br>`src/app/api/plc-params/route.js`<br>`src/app/api/plc/reset/route.js`<br>`src/app/api/product-specs/route.js`<br>`src/app/api/product-specs/[id]/route.js`<br>`src/app/api/products/route.js`<br>`src/app/api/products/[id]/route.js`<br>`src/app/api/roles/options/route.js`<br>`src/app/api/roles/route.js`<br>`src/app/api/roles/[id]/route.js`<br>`src/app/api/status/route.js`<br>`src/app/api/users/route.js`<br>`src/app/api/users/[username]/route.js`<br>`src/lib/alarmMonitor.js`<br>`src/lib/auditLog.js`<br>`src/lib/auth.js`<br>`src/lib/batchFinalize.js`<br>`src/lib/plcAccess.js`<br>`src/lib/roleAdmin.js`<br>`src/lib/trendRecorder.js` |
| `src/lib/f0.js` | — | `src/lib/batchFinalize.js`<br>`src/lib/f0.test.mjs` |
| `src/lib/f0.test.mjs` | `src/lib/f0.js`<br>`src/lib/__fixtures__/printout_2026-10-03.js` | — |
| `src/lib/operatorLabel.js` | — | `src/app/print/data-report/[batchNo]/curve/page.js`<br>`src/app/print/data-report/[batchNo]/page.js` |
| `src/lib/permissionCatalog.js` | — | `src/app/(app)/manual/page.js`<br>`src/app/(app)/plc-clock/page.js`<br>`src/app/(app)/roles/page.js`<br>`src/app/api/roles/route.js`<br>`src/app/api/roles/[id]/route.js`<br>`src/components/Navbar.js`<br>`src/components/PermissionGate.js`<br>`src/components/PlcParamEditor.js`<br>`src/lib/auth.js`<br>`src/lib/roleQueries.js` |
| `src/lib/plc.js` | — | `src/app/api/batch/start/route.js`<br>`src/app/api/batch/stop/route.js`<br>`src/app/api/plc/reset/route.js`<br>`src/app/api/status/route.js`<br>`src/lib/alarmMonitor.js`<br>`src/lib/trendRecorder.js` |
| `src/lib/plcAccess.js` | `src/lib/db.js`<br>`src/lib/plcWrite.js`<br>`src/lib/recipeGuard.js`<br>`src/lib/plcParamCatalog.js` | `src/app/api/plc-clock/route.js`<br>`src/app/api/plc-manual/route.js`<br>`src/app/api/plc-params/route.js` |
| `src/lib/plcClock.js` | — | `src/app/(app)/plc-clock/page.js`<br>`src/app/api/plc-clock/route.js` |
| `src/lib/plcCommandAlert.js` | — | `src/app/(app)/page.js`<br>`src/components/StartDialog.js`<br>`src/lib/plcCommandAlert.test.mjs` |
| `src/lib/plcCommandAlert.test.mjs` | `src/lib/plcCommandAlert.js` | — |
| `src/lib/plcManualCatalog.js` | — | `src/app/(app)/manual/page.js`<br>`src/app/api/plc-manual/route.js` |
| `src/lib/plcParamCatalog.js` | — | `src/app/api/plc-clock/route.js`<br>`src/app/api/plc-params/route.js`<br>`src/components/PlcParamEditor.js`<br>`src/lib/plcAccess.js` |
| `src/lib/plcWrite.js` | — | `src/app/api/batch/start/route.js`<br>`src/app/api/batch/stop/route.js`<br>`src/app/api/plc-clock/route.js`<br>`src/app/api/plc/reset/route.js`<br>`src/lib/plcAccess.js` |
| `src/lib/recipeGuard.js` | — | `src/app/api/batch/start/route.js`<br>`src/app/api/formulas/[formulaNo]/route.js`<br>`src/lib/alarmMonitor.js`<br>`src/lib/plcAccess.js` |
| `src/lib/recipeSnapshot.js` | — | `src/app/api/batch/start/route.js`<br>`src/app/api/batch-records/[batchNo]/route.js`<br>`src/lib/alarmMonitor.js` |
| `src/lib/recipeValidation.js` | — | `src/app/api/batch/start/route.js`<br>`src/app/api/formulas/route.js`<br>`src/app/api/formulas/[formulaNo]/route.js` |
| `src/lib/roleAdmin.js` | `src/lib/db.js` | `src/app/api/roles/options/route.js`<br>`src/app/api/roles/route.js`<br>`src/app/api/roles/[id]/route.js`<br>`src/app/api/users/[username]/delete/route.js`<br>`src/app/api/users/[username]/reset-password/route.js`<br>`src/app/api/users/[username]/route.js`<br>`src/app/api/users/route.js`<br>`src/lib/roleQueries.js` |
| `src/lib/roleQueries.js` | `src/lib/permissionCatalog.js`<br>`src/lib/roleAdmin.js` | `src/app/api/roles/route.js`<br>`src/app/api/roles/[id]/route.js` |
| `src/lib/trendRecorder.js` | `src/lib/db.js`<br>`src/lib/plc.js`<br>`src/lib/batchFinalize.js` | `server.js` |
| `src/lib/userQueries.js` | — | `src/app/api/users/[username]/delete/route.js`<br>`src/app/api/users/[username]/route.js`<br>`src/app/api/users/route.js` |
| `src/proxy.js` | — | — |

---

## Change Log

- [2026-10-29] ADDED: Menambahkan pemetaan dependensi untuk 17 berkas baru: migrasi `006_add_bottle_count.sql` & rollback, rute HMI `calibration/`, `machine-params/`, `manual/`, `plc-clock/`, endpoint API `plc-clock/`, `plc-manual/`, `plc-params/`, komponen `SearchableCombobox.js`, `SignOffBlock.js`, `PlcDialog.js`, `PlcParamEditor.js`, serta pustaka `plcAccess.js`, `plcClock.js`, `plcManualCatalog.js`, dan `plcParamCatalog.js`.
- [2026-10-29] MODIFIED: Memperbarui relasi impor internal untuk komponen yang diperbarui: `StartDialog.js` (meng-import `SearchableCombobox`), lembar cetak `print/alarm`, `print/data-report/[batchNo]`, dan `print/curve` (meng-import `SignOffBlock`), serta perluasan pemakaian `PermissionGate`, `permissionCatalog`, `recipeGuard`, `plcWrite`, `auditLog`, `auth`, dan `db`.
- [2026-10-28] ADDED: Menambahkan pemetaan node dan hubungan impor internal untuk 16 berkas baru Fase 1: `fase1/tests/matrix.mjs`, migrasi SQL `005_drop_legacy_role.sql`, `005_drop_legacy_role_rollback.sql`, dump `backup_271026.sql`, rute `roles/page.js`, API handler `roles/route.js`, `roles/[id]/route.js`, `roles/options/route.js`, `users/[username]/delete/route.js`, komponen `DeletedUserBadge.js`, `PermissionGate.js`, serta pustaka `permissionCatalog.js`, `roleAdmin.js`, `roleQueries.js`, `userQueries.js`, dan `operatorLabel.js`.
- [2026-10-28] MODIFIED: Memperbarui daftar dependensi impor aktual pada komponen UI dan API handler yang kini meng-import `PermissionGate`, `DeletedUserBadge`, `permissionCatalog`, dan `roleAdmin`. Menghapus relasi guard `requireAdmin` dari `src/lib/auth.js`.