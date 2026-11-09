@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

rem Node: PATH'te varsa onu, yoksa DSH ile gelen çalışma zamanını kullan
where node >nul 2>nul
if errorlevel 1 (
  set "NODE=%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
  if not exist "%NODE%" (
    echo.
    echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden LTS kurun.
    echo.
    pause
    exit /b 1
  )
) else (
  set "NODE=node"
)

echo DORA AI Ajan Paketi baslatiliyor...
echo   Uygulama  : http://127.0.0.1:%PORT%/app/
echo   Dashboard : http://127.0.0.1:%PORT%/dashboard/
echo.
echo Kapatmak icin bu pencerede Ctrl+C, sonra "Durdurulsun mu?" sorusuna Y.
echo.

rem Tarayiciyi 2 saniye sonra ac (sunucu ayaga kalksin)
start "" /min cmd /c "timeout /t 2 >nul & start "" http://127.0.0.1:%PORT%/app/"

"%NODE%" onboarding\cli\tools\server.mjs --port %PORT% --host 127.0.0.1
