@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PiSubtitles Studio - Instalador Automatizado

echo =====================================================================
echo    PiSubtitles Studio - Configuracion de Entorno y Dependencias
echo =====================================================================
echo.

set "PY_CMD="
if exist "%LocalAppData%\Programs\Python\Python313\python.exe" set "PY_CMD=%LocalAppData%\Programs\Python\Python313\python.exe"
if not defined PY_CMD if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY_CMD=%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PY_CMD if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY_CMD=%LocalAppData%\Programs\Python\Python311\python.exe"
if defined PY_CMD goto :found_python

where python >nul 2>nul
if errorlevel 1 goto :no_python
set "PY_CMD=python"

:found_python
echo [INFO] Usando interprete: %PY_CMD%
"%PY_CMD%" --version

if exist ".venv\Scripts\python.exe" goto :venv_ready

echo [INFO] Creando entorno virtual aislado en .venv ...
"%PY_CMD%" -m venv --system-site-packages .venv
if exist ".venv\Scripts\python.exe" goto :venv_ready

echo [AVISO] Reintentando creacion rapida de entorno virtual...
"%PY_CMD%" -m venv --without-pip --system-site-packages .venv
if exist ".venv\Scripts\python.exe" goto :venv_ready

echo [ERROR] No se pudo crear el entorno virtual.
if "%~1"=="--nopause" exit /b 1
pause
exit /b 1

:venv_ready
echo [OK] Entorno virtual .venv listo.
echo [INFO] Verificando dependencias desde requirements.txt...
".venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet 2>nul
if errorlevel 1 "%PY_CMD%" -m pip install -r requirements.txt --quiet

if exist "build_exe.bat" call build_exe.bat --nopause

echo.
echo =====================================================================
echo    [OK] Instalacion completada con exito!
echo    Haz doble clic en PiSubtitles.exe para abrir la aplicacion.
echo =====================================================================
if "%~1"=="--nopause" exit /b 0
pause
exit /b 0

:no_python
echo [ERROR] No se encontro Python en el sistema.
echo Por favor instala Python 3.10 o superior desde https://www.python.org/
if "%~1"=="--nopause" exit /b 1
pause
exit /b 1
