@echo off
chcp 65001 >nul
title NOVA Yapay Zeka
cd /d "%~dp0"
if not exist node_modules (
  echo Ilk calistirma: paketler indiriliyor...
  call npm install || (pause & exit /b 1)
)
call npm start
