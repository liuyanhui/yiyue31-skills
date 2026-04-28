@echo off
:: Claude Code Download URL Generator
:: Purpose: Generate the direct download URL for the latest Claude Code Windows executable
:: Usage: claude-url-gen.bat [-v|--verbose] [-h|--help]

setlocal enabledelayedexpansion
:: Enable delayed expansion for variable expansion within loops and conditional blocks

:: Check for help
if "%1"=="-h" goto :HELP
if "%1"=="--help" goto :HELP
if "%1"=="/?" goto :HELP

:: Check for verbose mode - enables detailed debug output
set VERBOSE=0
if "%1"=="-v" set VERBOSE=1
if "%1"=="--verbose" set VERBOSE=1

if !VERBOSE!==1 (
    echo [VERBOSE] Debug mode enabled
    echo.
)

echo ==================================================
echo   Claude Code Download URL Generator
echo   (Observable Debug Mode)
echo ==================================================
echo.
goto :MAIN

:HELP
echo Usage: claude-url-gen.bat [-v^|--verbose] [-h^|--help]
echo.
echo Options:
echo   -v, --verbose    Show detailed debug output
echo   -h, --help       Show this help message
echo.
echo Example:
echo   claude-url-gen.bat      - Run in normal mode
echo   claude-url-gen.bat -v   - Run in verbose mode
echo.
exit /b 0

:MAIN
:: ============================================================
:: MAIN EXECUTION FLOW
:: ============================================================

:: Step 1 - Check PowerShell availability
echo [1/6] Checking PowerShell...
where powershell >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell not found in PATH
    exit /b 1
)
echo [OK] PowerShell available
echo.

:: Step 2 - Fetch latest version from Claude CDN
:: Uses PowerShell's Invoke-RestMethod to query the version API
:: The API returns just the version string (e.g., "0.6.2")
echo [2/6] Fetching latest version from CDN...
set VERSION=
set ERROR_MSG=

:: Create temp file for PowerShell output
:: Needed because batch files can't directly capture PowerShell output
set TEMP_FILE=%TEMP%\claude_url_gen_%RANDOM%.tmp

if !VERBOSE!==1 (
    echo [VERBOSE] Executing PowerShell request...
    :: Verbose mode includes DNS resolution test and detailed error traces
    powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Write-Host '[VERBOSE] Resolving DNS for downloads.claude.ai...'; $null = [System.Net.Dns]::GetHostAddresses('downloads.claude.ai'); Write-Host '[VERBOSE] DNS resolution OK'; Write-Host '[VERBOSE] Requesting: https://downloads.claude.ai/claude-code-releases/latest'; $r = Invoke-RestMethod -Uri 'https://downloads.claude.ai/claude-code-releases/latest' -TimeoutSec 30 -Verbose; Write-Output ('VERSION:' + $r) } catch { Write-Output ('ERROR:' + $_.Exception.Message); Write-Host '[VERBOSE] Full Error:' $_.ScriptStackTrace; exit 1 }" > "!TEMP_FILE!" 2>&1
    type "!TEMP_FILE!"
) else (
    :: Normal mode - simple request with error handling only
    powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { $r = Invoke-RestMethod -Uri 'https://downloads.claude.ai/claude-code-releases/latest' -TimeoutSec 30; Write-Output ('VERSION:' + $r) } catch { Write-Output ('ERROR:' + $_.Exception.Message); exit 1 }" > "!TEMP_FILE!" 2>&1
)

:: Parse the output from temp file
:: Look for "VERSION:x.y.z" or "ERROR:message" prefixes
for /f "usebackq delims=" %%i in ("!TEMP_FILE!") do (
    echo %%i | findstr /B "ERROR:" >nul
    if errorlevel 1 (
        echo %%i | findstr /B "VERSION:" >nul
        if errorlevel 1 (
            REM Not VERSION or ERROR line, skip (verbose output goes to console only)
        ) else (
            set VERSION=%%i
            set VERSION=!VERSION:VERSION:=!
        )
    ) else (
        set ERROR_MSG=%%i
        set ERROR_MSG=!ERROR_MSG:ERROR:=!
    )
)

:: Clean up temp file
:: Suppress errors if file doesn't exist or is locked
del "!TEMP_FILE!" >nul 2>&1

if not "!VERSION!"=="" (
    echo [OK] Latest version: !VERSION!
    echo.
) else (
    :: Error occurred - display error details and debugging tips
    echo [ERROR] Failed to fetch version
    if not "!ERROR_MSG!"=="" (
        echo [ERROR DETAILS] !ERROR_MSG!
    )
    echo.
    echo [DEBUG TIPS]
    echo - Test in browser: https://downloads.claude.ai/claude-code-releases/latest
    echo - Test in PowerShell: Invoke-RestMethod 'https://downloads.claude.ai/claude-code-releases/latest'
    echo - Check proxy: netsh winhttp show proxy
    exit /b 1
)

:: Step 3 - Detect platform
:: Currently hardcoded to win32-x64 as Claude Code only releases for Windows x64
:: Future: Could add auto-detection via 'wmic os get osarchitecture'
echo [3/6] Detecting platform...
set PLATFORM=win32-x64
echo [INFO] Platform: !PLATFORM!
echo.

:: Step 4 - Build base URL
:: Construct the base CDN URL where releases are hosted
echo [4/6] Building base URL...
set BASE=https://downloads.claude.ai/claude-code-releases
echo [INFO] Base URL: !BASE!
echo.

:: Step 5 - Construct final URL
:: URL format: {BASE}/{VERSION}/{PLATFORM}/claude.exe
:: Example: https://downloads.claude.ai/claude-code-releases/0.6.2/win32-x64/claude.exe
echo [5/6] Constructing download URL...
set DOWNLOAD_URL=!BASE!/!VERSION!/!PLATFORM!/claude.exe

echo [OK] Download URL generated:
echo --------------------------------------------------
echo !DOWNLOAD_URL!
echo --------------------------------------------------
echo.

:: Step 6 - Display debug summary
:: Shows all variables used in URL construction for verification
echo [6/6] Debug summary
echo ----------------------------------------------
echo VERSION   = !VERSION!
echo PLATFORM  = !PLATFORM!
echo STATUS    = URL GENERATED SUCCESSFULLY
echo ----------------------------------------------
echo.

echo ==================================================
echo FINAL RESULT (COPY THIS URL INTO BROWSER):
echo This URL can be used to download Claude Code directly
echo ==================================================
echo !DOWNLOAD_URL!
echo ==================================================
echo.

:: Pause so user can read the output and copy the URL
pause
