@echo off
REM Word Counter Script for Windows
REM Usage: count-words.bat <file-path>

setlocal

set SCRIPT_DIR=%~dp0
set NODE_CMD=%SCRIPT_DIR%word-counter.js

REM Check if Node.js is available
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js to use this script
    exit /b 1
)

REM Check if word-counter.js exists
if not exist "%NODE_CMD%" (
    echo Error: word-counter.js not found in %SCRIPT_DIR%
    exit /b 1
)

REM Check if file argument is provided
if "%~1"=="" (
    echo Usage: %~nx0 ^<file-path^>
    echo.
    echo Examples:
    echo   %~nx0 ..\SKILL.md
    echo   %~nx0 ..\templates\standard.md
    echo   %~nx0 C:\path\to\document.txt
    exit /b 1
)

set FILE_PATH=%~1

REM Check if file exists
if not exist "%FILE_PATH%" (
    echo Error: File not found: %FILE_PATH%
    exit /b 1
)

REM Run word counter
node "%NODE_CMD%" "%FILE_PATH%"

endlocal
