@echo off
title Initializing Clinic Database...
color 0B

echo ===================================================
echo     CLINIC DATABASE INITIALIZATION ^& SEEDING
echo ===================================================
echo.

cd /d "%~dp0"

if not exist ".env.local" (
    echo [ERROR] .env.local file not found!
    echo Please create .env.local with your Supabase database keys first.
    pause
    exit /b 1
)

echo [1/2] Applying database migrations to Supabase...
call npm run db:migrate:run

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Automatic migration failed. If you already ran SQL in Supabase SQL editor, this is normal.
) else (
    echo [OK] Database schema applied successfully!
)

echo.
echo [2/2] Seeding initial test doctor and clinic chamber...
call npm run db:seed

echo.
echo ===================================================
echo   DATABASE READY! You can now run start-clinic.bat
echo ===================================================
echo.
pause
