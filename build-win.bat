@echo off
setlocal

echo ==========================================
echo  IT Dashboard - Windows Build
echo ==========================================
echo.

:: Set Node 18 path
set "NODE18=C:\Users\admin\AppData\Roaming\nvm\v18.13.0"
set "PATH=%NODE18%;%PATH%"

:: Verify Node version
echo Node version:
node --version
echo.

:: Install dependencies
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo Building Windows installer...
call npm run build:win
if errorlevel 1 (
    echo.
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  Build complete!
echo  Output: dist\IT Dashboard Setup *.exe
echo ==========================================
echo.

:: Open the dist folder
explorer dist

pause
