@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PiSubtitles Studio

if exist "PiSubtitles.exe" (
    start "" "PiSubtitles.exe"
    exit /b 0
)

if not exist ".venv\Scripts\python.exe" (
    echo [INFO] Preparando entorno por primera vez...
    call setup.bat --nopause
)

if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" main.py
    exit /b 0
)

if exist "%LocalAppData%\Programs\Python\Python313\pythonw.exe" (
    start "" "%LocalAppData%\Programs\Python\Python313\pythonw.exe" main.py
    exit /b 0
)

start "" pythonw main.py
exit /b 0
