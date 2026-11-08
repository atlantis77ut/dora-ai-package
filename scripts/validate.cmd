@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

echo === 1/4  DORA eslemesi ve referans butunlugu ===
node docs\tools\render-mapping.mjs --check
if errorlevel 1 goto :fail

echo.
echo === 2/4  Dashboard sagligi ^(sarkan referans kontrolu^) ===
node docs\tools\build-dashboard.mjs
if errorlevel 1 goto :fail

echo.
echo === 3/4  Faz tanimi ===
cd onboarding\cli
node bin\dora-onboard.mjs phases
if errorlevel 1 goto :fail

echo.
echo === 4/4  Uctan uca demo ^(6 faz^) ===
node tools\demo.mjs
if errorlevel 1 goto :fail

echo.
echo TUM KONTROLLER GECTI
pause
exit /b 0

:fail
echo.
echo KONTROL BASARISIZ - yukaridaki ciktiyi inceleyin.
pause
exit /b 1
