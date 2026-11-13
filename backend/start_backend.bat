@echo off
echo.
echo  =====================================================
echo   JARVIS Local AI Assistant — Backend Setup
echo  =====================================================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [*] Creating virtual environment...
    python -m venv venv
)

REM Activate
call venv\Scripts\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip --quiet

REM Install requirements
echo [*] Installing Python packages (this may take a few minutes)...
pip install -r requirements.txt --quiet

echo.
echo [OK] Backend dependencies installed.
echo.
echo [*] Starting JARVIS backend on http://localhost:8000
echo     API docs: http://localhost:8000/docs
echo.
echo     Press CTRL+C to stop.
echo.

python main.py
pause
