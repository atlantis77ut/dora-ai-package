@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden kurun ^(LTS yeterli^).
  echo.
  pause
  exit /b 1
)

echo Dashboard uretiliyor...
node docs\tools\build-dashboard.mjs
if errorlevel 1 (
  echo.
  echo [HATA] Dashboard uretilemedi - yukaridaki mesaji inceleyin.
  pause
  exit /b 1
)

echo Tarayicida aciliyor: dashboard\index.html
start "" "%~dp0..\dashboard\index.html"
exit /b 0
