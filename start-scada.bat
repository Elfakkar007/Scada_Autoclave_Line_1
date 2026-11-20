@echo off
:: ============================================================
:: start-scada.bat
:: Launcher produksi SCADA Sterilizer
:: Klik dua kali untuk menjalankan aplikasi.
:: ============================================================

title SCADA Sterilizer

:: --- Pindah ke direktori proyek (sesuaikan jika path berbeda) ---
cd /d "%~dp0"

:: --- Periksa apakah Node.js tersedia ---
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan di PATH.
    echo Pastikan Node.js sudah terinstall dan tambahkan ke PATH sistem.
    pause
    exit /b 1
)

:: --- Jalankan server produksi ---
echo.
echo  =============================================
echo   SCADA Sterilizer - Production Mode
echo  =============================================
echo   Buka browser : http://localhost:3001
echo   Tekan Ctrl+C  untuk menghentikan server.
echo  =============================================
echo.

npm run start

pause
