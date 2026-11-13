@echo off
echo.
echo  =====================================================
echo   JARVIS Local AI Assistant — Frontend
echo  =====================================================
echo.

REM Check node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"

echo [*] Installing frontend dependencies...
call npm install --silent

echo.
echo [*] Starting JARVIS frontend on http://localhost:5173
echo     Make sure the backend is running first!
echo.
echo     Press CTRL+C to stop.
echo.

call npm run dev
pause
