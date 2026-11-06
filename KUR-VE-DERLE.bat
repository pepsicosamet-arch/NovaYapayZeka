@echo off
chcp 65001 >nul
title NOVA Yapay Zeka - Kurulum dosyasi olusturucu

rem --- Yonetici izni (electron-builder imza araci icin gerekli) ---
net session >nul 2>&1
if errorlevel 1 (
  echo Yonetici izni isteniyor... Acilan pencerede "Evet" deyin.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"
echo.
echo   =============================================
echo     NOVA Yapay Zeka - Setup.exe olusturuluyor
echo   =============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js bulunamadi. Acilan sayfadan LTS surumunu kurup bu dosyayi tekrar calistirin.
  start https://nodejs.org/tr
  pause
  exit /b 1
)

rem --- Yarim kalmis imza araci onbellegini temizle ---
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
  echo Eski onbellek temizleniyor...
  rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
)

echo [1/2] Paketler indiriliyor (ilk seferde birkac dakika surer)...
call npm install
if errorlevel 1 goto hata
echo.
echo [2/2] Kurulum dosyasi derleniyor...
call npm run dist
if errorlevel 1 goto hata
echo.
echo   Tamam! dist klasorunde:
echo     - NOVA-Yapay-Zeka-Setup-1.1.0.exe      (kurulum sihirbazi)
echo     - NOVA-Yapay-Zeka-Tasinabilir-1.1.0.exe (kurulumsuz calisir)
start "" "%~dp0dist"
pause
exit /b 0

:hata
echo.
echo [!] Bir hata olustu. Yukaridaki mesaji kontrol edin.
echo     Ipucu: Ayarlar ^> Gizlilik ve guvenlik ^> Gelistiriciler icin ^> "Gelistirici Modu"nu acip tekrar deneyin.
pause
exit /b 1
