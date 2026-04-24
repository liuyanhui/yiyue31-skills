@echo off
setlocal EnableDelayedExpansion

echo ==================================================
echo   Claude Code URL Generator (Pro Observability)
echo ==================================================
echo.

:: -----------------------------
:: 1. Check tools
:: -----------------------------
echo [1/8] Checking environment...

where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell not found
    exit /b 1
)

echo [OK] PowerShell detected

where curl >nul 2>&1
if errorlevel 1 (
    echo [WARN] curl not found (fallback to PowerShell only)
) else (
    echo [OK] curl available
)

echo.

:: -----------------------------
:: 2. Fetch version (with retry)
:: -----------------------------
echo [2/8] Fetching latest version...

set VERSION=

for /L %%i in (1,1,3) do (
    echo Attempt %%i / 3 ...

    for /f "delims=" %%v in ('
        powershell -NoProfile -Command ^
        "try { (Invoke-RestMethod 'https://downloads.claude.ai/claude-code-releases/latest') } catch { }"
    ') do set VERSION=%%v

    if not "!VERSION!"=="" goto version_ok

    timeout /t 2 >nul
)

echo [ERROR] Failed to fetch version after retries
echo Check network / proxy / DNS
exit /b 1

:version_ok
echo [OK] Version detected: !VERSION!
echo.

:: -----------------------------
:: 3. Platform detection
:: -----------------------------
echo [3/8] Detecting platform...

set PLATFORM=win32-x64
echo [INFO] Platform: !PLATFORM!
echo.

:: -----------------------------
:: 4. Base URL
:: -----------------------------
set BASE=https://downloads.claude.ai/claude-code-releases

echo [4/8] Base CDN:
echo !BASE!
echo.

:: -----------------------------
:: 5. Build URLs
:: -----------------------------
echo [5/8] Generating download URLs...

set URL_PRIMARY=!BASE!/!VERSION!/!PLATFORM!/claude.exe
set URL_ALT1=!BASE!/latest/!PLATFORM!/claude.exe

echo [OK] Primary URL:
echo !URL_PRIMARY!
echo.

echo [INFO] Alternate (fallback-style) URL:
echo !URL_ALT1!
echo.

:: -----------------------------
:: 6. Connectivity hint (optional probe)
:: -----------------------------
echo [6/8] Quick connectivity probe...

powershell -Command ^
"try { $r = Invoke-WebRequest -Uri '!URL_PRIMARY!' -Method Head -TimeoutSec 5; Write-Host '[INFO] Primary reachable' } catch { Write-Host '[WARN] Primary not reachable (may still work in browser)' }"

echo.

:: -----------------------------
:: 7. Summary
:: -----------------------------
echo [7/8] Summary
echo ----------------------------------------
echo VERSION  = !VERSION!
echo PLATFORM = !PLATFORM!
echo ----------------------------------------
echo.

:: -----------------------------
:: 8. FINAL OUTPUT
:: -----------------------------
echo ==================================================
echo COPY THIS URL (OPEN IN BROWSER):
echo ==================================================
echo !URL_PRIMARY!
echo ==================================================
echo.

echo Backup URL (if needed):
echo !URL_ALT1!
echo ==================================================
echo.

pause