@echo off
title Starting Clinic Queue System...
color 0A

echo ===================================================
echo     SMART CLINIC QUEUE SYSTEM - 1-CLICK LAUNCH
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Check if node_modules exists, install if missing
if not exist "node_modules\" (
    echo [INFO] Installing required libraries (one-time setup)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install packages. Please ensure Node.js is installed.
        pause
        exit /b %errorlevel%
    )
)

:: 2. Check if .env.local exists, copy example if missing
if not exist ".env.local" (
    echo [INFO] Creating .env.local from example template...
    copy ".env.local.example" ".env.local" >nul
    echo [IMPORTANT] Created .env.local. Please make sure your Supabase database keys are set!
)

echo [INFO] Launching Clinic Queue web server...
echo.
echo ===================================================
echo   System will open in your browser automatically!
echo   Keep this window open while using the clinic app.
echo   To stop the server, just close this window.
echo ===================================================
echo.

:: 3. Open browser after 3 seconds in the background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: 4. Start Next.js development server
call npm run dev
pause
