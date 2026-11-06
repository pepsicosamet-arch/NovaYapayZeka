@echo off
chcp 65001 >nul
title NOVA Yapay Zeka - Android APK ve Google Play paketi olusturucu
cd /d "%~dp0android"
echo.
echo   =============================================
echo     NOVA Yapay Zeka - Telefon icin APK
echo   =============================================
echo.

rem --- Java: Android Studio'nun kendi Java'si ---
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
if not defined JAVA_HOME (
  echo [!] Android Studio bulunamadi.
  echo     Acilan sayfadan Android Studio'yu kurun, bir kez acip kurulum sihirbazini bitirin,
  echo     sonra bu dosyayi tekrar calistirin.
  start https://developer.android.com/studio
  pause
  exit /b 1
)

rem --- Android SDK ---
set "SDK=%LOCALAPPDATA%\Android\Sdk"
if defined ANDROID_HOME set "SDK=%ANDROID_HOME%"
if not exist "%SDK%" (
  echo [!] Android SDK bulunamadi: %SDK%
  echo     Android Studio'yu bir kez acip kurulum sihirbazini bitirin.
  pause
  exit /b 1
)
> local.properties echo sdk.dir=%SDK:\=\\%

echo Derleniyor... (ilk seferde 5-10 dakika surebilir, internet gerekir)
call gradlew.bat assembleRelease bundleRelease
if errorlevel 1 (
  echo.
  echo [!] Derleme basarisiz. Yukaridaki hatayi kontrol edin.
  pause
  exit /b 1
)
echo.
echo   Tamam!
echo     Telefona kurmak icin APK : android\app\build\outputs\apk\release\
echo     Google Play icin AAB     : android\app\build\outputs\bundle\release\app-release.aab
start "" "%~dp0android\app\build\outputs\apk\release"
start "" "%~dp0android\app\build\outputs\bundle\release"
pause
