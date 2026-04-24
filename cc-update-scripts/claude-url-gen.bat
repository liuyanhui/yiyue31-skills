@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo   Claude Code Download URL Generator
echo   (Observable Debug Mode)
echo ==================================================
echo.

:: Step 1 - Check PowerShell availability
echo [1/6] Checking PowerShell...
where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell not found in PATH
    exit /b 1
)
echo [OK] PowerShell available
echo.

:: Step 2 - Fetch latest version
echo [2/6] Fetching latest version from CDN...
set VERSION=

for /f "delims=" %%i in ('
    powershell -NoProfile -Command ^
    "try { (Invoke-RestMethod 'https://downloads.claude.ai/claude-code-releases/latest') } catch { Write-Error $_; exit 1 }"
') do set VERSION=%%i

if "!VERSION!"=="" (
    echo [ERROR] Failed to fetch version
    echo Check network / proxy / DNS
    exit /b 1
)

echo [OK] Latest version: !VERSION!
echo.

:: Step 3 - Detect platform
echo [3/6] Detecting platform...
set PLATFORM=win32-x64
echo [INFO] Platform: !PLATFORM!
echo.

:: Step 4 - Build base URL
echo [4/6] Building base URL...
set BASE=https://downloads.claude.ai/claude-code-releases
echo [INFO] Base URL: !BASE!
echo.

:: Step 5 - Construct final URL
echo [5/6] Constructing download URL...
set DOWNLOAD_URL=!BASE!/!VERSION!/!PLATFORM!/claude.exe

echo [OK] Download URL generated:
echo --------------------------------------------------
echo !DOWNLOAD_URL!
echo --------------------------------------------------
echo.

:: Step 6 - Additional debug info
echo [6/6] Debug summary
echo ----------------------------------------------
echo VERSION   = !VERSION!
echo PLATFORM  = !PLATFORM!
echo STATUS    = URL GENERATED SUCCESSFULLY
echo ----------------------------------------------
echo.

echo ==================================================
echo FINAL RESULT (COPY THIS URL INTO BROWSER):
echo ==================================================
echo !DOWNLOAD_URL!
echo ==================================================
echo.

pause