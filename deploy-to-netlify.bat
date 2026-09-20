@echo off
title Deploying Clinic Queue to Netlify...
color 0B

echo ===================================================
echo     1-CLICK DEPLOY TO NETLIFY (NO GIT NEEDED)
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

echo.
echo [2/3] Building the production bundle...
call npm run build

if %errorlevel% neq 0 (
    echo [ERROR] Build failed. Please check errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Deploying directly to Netlify...
echo.
echo NOTE: If this is your first time, Netlify will ask you to log in in your browser.
echo Select: "Create & configure a new site" and hit Enter!
echo.

call npx netlify deploy --prod --dir=.next

echo.
echo ===================================================
echo   DEPLOYMENT COMPLETE!
echo   Check the URL printed above for your live app.
echo ===================================================
echo.
pause
