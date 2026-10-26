@echo off
chcp 65001 >nul
title PiSubtitles Studio
cd /d "%~dp0"

:: Verificar si el entorno virtual existe; de lo contrario, ejecutar instalador
if not exist ".venv\Scripts\python.exe" (
    echo [INFO] No se encontró el entorno virtual. Ejecutando instalación inicial...
    call setup.bat
    if not exist ".venv\Scripts\python.exe" (
        echo [ERROR] No se pudo preparar el entorno. Abortando.
        pause
        exit /b 1
    )
)

:: Arrancar la aplicación
echo [INFO] Iniciando PiSubtitles Studio...
start "" ".venv\Scripts\pythonw.exe" main.py
if %errorlevel% neq 0 (
    :: Fallback a python con consola si pythonw fallase
    call .venv\Scripts\python.exe main.py
)
exit /b 0
