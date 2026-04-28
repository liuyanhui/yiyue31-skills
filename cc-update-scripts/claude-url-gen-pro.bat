@echo off
:: Claude Code Download URL Generator (Pro Version)
:: Purpose: Generate Claude Code download URLs with enhanced observability and retry logic
:: Usage: claude-url-gen-pro.bat

setlocal EnableDelayedExpansion
:: Enable delayed expansion for variable expansion within loops

echo ==================================================
echo   Claude Code URL Generator (Pro Observability)
echo ==================================================
echo.

:: ============================================================
:: STEP 1: Environment Check
:: Verify PowerShell and optional curl availability
:: ============================================================
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
:: Optional: Check for curl (currently informational only, not used in script)
where curl >nul 2>&1
if errorlevel 1 (
    echo [WARN] curl not found (fallback to PowerShell only)
) else (
    echo [OK] curl available
)

echo.

:: ============================================================
:: STEP 2: Fetch Latest Version (with Retry Logic)
:: Query Claude CDN for the latest release version
:: Retries up to 3 times with 1-second delay between attempts
:: ============================================================
:: -----------------------------
:: 2. Fetch version (with retry)
:: -----------------------------
echo [2/8] Fetching latest version...

set VERSION=
:: Fallback version if network fails (update manually as needed)
set FALLBACK_VERSION=0.8.1

for /L %%i in (1,1,3) do (
    echo Attempt %%i / 3 ...

    for /f "delims=" %%v in ('
        powershell -NoProfile -Command ^
        "try { (Invoke-RestMethod 'https://downloads.claude.ai/claude-code-releases/latest') } catch { }"
    ') do set VERSION=%%v

    if not "!VERSION!"=="" goto version_ok

    :: Cross-platform compatible delay (works in Git Bash too)
    powershell -Command "Start-Sleep -Seconds 1"
)

:: All retries failed - use fallback version
echo [WARN] Network fetch failed after 3 attempts
echo [INFO] Using fallback version: !FALLBACK_VERSION!
echo [INFO] Check connectivity to: https://downloads.claude.ai
echo.
set VERSION=!FALLBACK_VERSION!

:version_ok
if !VERSION!==!FALLBACK_VERSION! (
    echo [OK] Using version: !VERSION! (fallback)
) else (
    echo [OK] Version detected: !VERSION! (live)
)
echo.

:: ============================================================
:: STEP 3: Platform Detection
:: Currently hardcoded to win32-x64 (Windows x64 only release)
:: ============================================================
:: -----------------------------
:: 3. Platform detection
:: -----------------------------
echo [3/8] Detecting platform...

set PLATFORM=win32-x64
echo [INFO] Platform: !PLATFORM!
echo.

:: ============================================================
:: STEP 4: Base URL Construction
:: ============================================================
:: -----------------------------
:: 4. Base URL
:: -----------------------------
set BASE=https://downloads.claude.ai/claude-code-releases

echo [4/8] Base CDN:
echo !BASE!
echo.

:: ============================================================
:: STEP 5: Build Download URLs
:: Generate both versioned and 'latest' URLs for redundancy
:: ============================================================
:: -----------------------------
:: 5. Build URLs
:: -----------------------------
echo [5/8] Generating download URLs...

:: Primary URL: Explicit version (most reliable)
:: Format: {BASE}/{VERSION}/{PLATFORM}/claude.exe
set URL_PRIMARY=!BASE!/!VERSION!/!PLATFORM!/claude.exe
:: Alternate URL: Uses 'latest' alias (may redirect to current version)
set URL_ALT1=!BASE!/latest/!PLATFORM!/claude.exe

echo [OK] Primary URL:
echo !URL_PRIMARY!
echo.

echo [INFO] Alternate (fallback-style) URL:
echo !URL_ALT1!
echo.

:: ============================================================
:: STEP 6: Connectivity Probe (Optional)
:: Test if primary URL is reachable via HEAD request
:: Note: May fail even if URL works (firewall, corporate policy, etc.)
:: ============================================================
:: -----------------------------
:: 6. Connectivity hint (optional probe)
:: -----------------------------
echo [6/8] Quick connectivity probe...

powershell -Command ^
"try { $r = Invoke-WebRequest -Uri '!URL_PRIMARY!' -Method Head -TimeoutSec 5; Write-Host '[INFO] Primary reachable' } catch { Write-Host '[WARN] Primary not reachable (may still work in browser)' }"

echo.

:: ============================================================
:: STEP 7: Summary
:: Display all key variables for verification
:: ============================================================
:: -----------------------------
:: 7. Summary
:: -----------------------------
echo [7/8] Summary
echo ----------------------------------------
echo VERSION  = !VERSION!
echo PLATFORM = !PLATFORM!
echo ----------------------------------------
echo.

:: ============================================================
:: STEP 8: Final Output
:: Display URLs in a copy-friendly format
:: ============================================================
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

:: Pause to allow user to read and copy the URLs
pause