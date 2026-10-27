@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title PiSubtitles Studio - Compilador de Ejecutable Nativo (.EXE)

echo =====================================================================
echo    PiSubtitles Studio - Generador de Ejecutable PiSubtitles.exe
echo =====================================================================
echo.

set "CSC_PATH=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC_PATH%" set "CSC_PATH=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC_PATH%" (
    echo [ERROR] No se encontro el compilador nativo de Windows .NET Framework.
    pause
    exit /b 1
)

echo [INFO] Compilando PiSubtitles.exe con icono personalizado...
"%CSC_PATH%" /nologo /target:winexe /out:PiSubtitles.exe /win32icon:assets\icon.ico /r:System.Windows.Forms.dll assets\Launcher.cs
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion de PiSubtitles.exe
    pause
    exit /b 1
)

echo [OK] PiSubtitles.exe generado exitosamente en la raiz del proyecto!
if "%~1"=="--nopause" exit /b 0
pause
