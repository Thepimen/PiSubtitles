@echo off
chcp 65001 >nul
title PiSubtitles Studio - Instalador Automatizado
echo =====================================================================
echo    PiSubtitles Studio - Instalación de Entorno y Dependencias
echo =====================================================================
echo.

:: Verificar si Python está instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Python en el sistema.
    echo Por favor, instala Python 3.10 o superior desde https://www.python.org/
    echo y asegurate de marcar la casilla "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

:: Mostrar versión de Python
for /f "tokens=*" %%i in ('python --version') do echo [INFO] Detectado: %%i

:: Crear entorno virtual .venv si no existe
if not exist ".venv" (
    echo [INFO] Creando entorno virtual aislado (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
    echo [OK] Entorno virtual creado exitosamente.
) else (
    echo [INFO] Entorno virtual existente detectado.
)

:: Actualizar pip dentro del entorno
echo [INFO] Actualizando gestor de paquetes pip...
call .venv\Scripts\python.exe -m pip install --upgrade pip --quiet

:: Instalar dependencias
echo [INFO] Instalando dependencias desde requirements.txt (Faster-Whisper, PyWebView, etc.)...
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias. Revisa tu conexión a internet o logs.
    pause
    exit /b 1
)

echo.
echo =====================================================================
echo    ¡Instalación completada con éxito!
echo    Ya puedes iniciar la aplicación ejecutando: start.bat
echo =====================================================================
echo.
pause
