@echo off
REM IntelliSource — one-command launcher for the KPMG server (Windows).
REM Double-click this, or run from a terminal:
REM   start_kpmg.bat           set up + launch everything
REM   start_kpmg.bat stop      stop backend + frontend
REM   start_kpmg.bat logs      show recent backend + frontend logs
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 init_kpmg.py %*
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        python init_kpmg.py %*
    ) else (
        echo No Python found on PATH. Install Python 3.10+ and re-run.
        exit /b 1
    )
)

if %errorlevel% neq 0 (
    echo.
    echo init_kpmg.py failed — see the output above.
    pause
)
