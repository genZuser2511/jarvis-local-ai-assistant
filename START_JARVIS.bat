@echo off
echo.
echo  =====================================================
echo   JARVIS — Full System Launcher
echo  =====================================================
echo.
echo  This will start:
echo    1. JARVIS Backend  (http://localhost:8000)
echo    2. JARVIS Frontend (http://localhost:5173)
echo.
echo  Prerequisites:
echo    - Python 3.10+ installed
echo    - Node.js 18+ installed
echo    - Ollama running: https://ollama.ai/download
echo    - A model pulled: ollama pull qwen2.5:7b
echo.

set /p CONFIRM="Press ENTER to start JARVIS, or CTRL+C to cancel..."

echo.
echo [1/3] Starting backend...
start "JARVIS Backend" cmd /k "cd /d "%~dp0backend" && call start_backend.bat"

echo [*] Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo [2/3] Starting frontend...
start "JARVIS Frontend" cmd /k "cd /d "%~dp0frontend" && call start_frontend.bat"

echo [*] Waiting 4 seconds for frontend to start...
timeout /t 4 /nobreak >nul

echo [3/3] Opening browser...
start "" "http://localhost:5173"

echo.
echo  JARVIS is running!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:8000
echo  API docs: http://localhost:8000/docs
echo.
echo  Close the terminal windows to stop JARVIS.
echo.
pause
