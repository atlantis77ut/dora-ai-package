@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\onboarding\cli"

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  pause
  exit /b 1
)

echo.
echo === Uctan uca demo: 6 ORL fazi ===
echo.
node tools\demo.mjs
set RC=%ERRORLEVEL%
echo.
if %RC%==0 (
  echo Demo tamamlandi: 6/6 faz gecildi.
) else (
  echo Demo durdu ^(cikis kodu %RC%^) - yukaridaki kapi sonucunu inceleyin.
)
echo.
pause
exit /b %RC%
