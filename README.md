<div align="center">

# ⚡ PiSubtitles Studio

### *El Estudio de Subtitulado Automático con IA diseñado para Creadores de Contenido.*

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Faster-Whisper](https://img.shields.io/badge/Motor-Faster--Whisper-6366F1?style=for-the-badge&logo=openai&logoColor=white)](https://github.com/SYSTRAN/faster-whisper)
[![License: MIT](https://img.shields.io/badge/Licencia-MIT-10B981?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Plataforma-Windows%20%7C%20macOS%20%7C%20Linux-06B6D4?style=for-the-badge)](https://github.com)
[![UI: Glassmorphism](https://img.shields.io/badge/UI-Obsidian%20Glass-8B5CF6?style=for-the-badge)](https://github.com)

<br/>

<p align="center">
  Genera, edita y exporta subtítulos de alta precisión en segundos a partir de cualquier vídeo o audio.<br/>
  Optimizado para <b>Shorts, Reels, TikTok y YouTube</b> con segmentación dinámica por palabras y reproducción sincronizada.
</p>

</div>

---

## 📸 Vista Previa de la Interfaz

```
+-----------------------------------------------------------------------------------------------+
|  [⚡] PiSubtitles STUDIO                   [ 🚀 GPU NVIDIA CUDA (float16) / ⚡ CPU int8 ]     |
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
|  [ ARRASTRA TU VÍDEO O AUDIO AQUÍ ]                 [ AJUSTES DE IA ]                         |
|  Soporta MP4, MP3, WAV, MKV, MOV, WEBM...           Idioma: 🇪🇸 Español (o Auto-detect)        |
|  [ 📂 Explorar Archivo ]  [ ⚡ Probar Muestra ]     Modelo: Small (~244M, Recomendado)        |
|                                                     Segmentación: [ Shorts/Reels ] [ Frases ] |
|                                                     Palabras por línea: [ 4 palabras ]        |
|                                                     [ ▶ GENERAR SUBTÍTULOS ]                  |
|                                                                                               |
+-----------------------------------------------------------------------------------------------+
|  ▶ [00:14 / 01:00]  ══════════════●═════════════════════════════════  [1.0x]   [+ Añadir fila]|
+-----------------------------------------------------------------------------------------------+
|  #1  [ 00:00:00,000 ➔ 00:00:00,600 ]  Seguir que el perro                 [▶ Play] [🗑 Borrar]|
|  #2  [ 00:00:00,600 ➔ 00:00:01,340 ]  nos ha dado algunos                 [▶ Play] [🗑 Borrar]|
|  #3  [ 00:00:01,340 ➔ 00:00:02,160 ]  de los momentos más                 [▶ Play] [🗑 Borrar]|
+-----------------------------------------------------------------------------------------------+
|  [ 📥 Descargar .SRT ]   [ .VTT ]   [ .TXT ]   [ 📋 Copiar Texto ]                            |
+-----------------------------------------------------------------------------------------------+
```

---

## ✨ Características Principales

- **⚡ Motor Faster-Whisper Ultrarrápido**: Hasta 4 veces más rápido que Whisper estándar, con menor consumo de memoria VRAM/RAM y cuantización `int8` optimizada.
- **🎨 Estética Visual Premium (Obsidian Glassmorphism)**: Interfaz refinada en tonos obsidiana y grafito (`#07090e`), con acentos neón violeta e índigo, desenfoque de fondo (*backdrop-filter: blur*), tipografía moderna y microanimaciones suaves.
- **🎯 Modo Creadores (Shorts / Reels / TikTok)**: Segmenta el texto en bloques cortos (por ejemplo, 3, 4 o 5 palabras por subtítulo) con marcas de tiempo exactas por palabra, perfecto para subtítulos dinámicos de alto impacto visual.
- **🎧 Reproductor y Editor Sincronizado**:
  - Reproduce tu audio o vídeo directamente en la app.
  - La fila del subtítulo activo se ilumina en tiempo real al compás de la voz.
  - Haz clic en el botón de reproducción de cualquier subtítulo para escuchar ese fragmento específico.
  - Edita el texto, corrige cualquier palabra o ajusta las marcas de tiempo al instante.
- **🗂️ Soporte Universal de Formatos**: Admite MP4, MKV, MOV, AVI, WEBM, FLV, MP3, WAV, M4A, AAC, FLAC, OGG y más.
- **📥 Múltiples Formatos de Exportación**:
  - `.SRT` (SubRip Subtitles, estándar para editores como Premiere Pro, DaVinci Resolve, CapCut y Final Cut).
  - `.VTT` (WebVTT, para reproductores web y plataformas online).
  - `.TXT` (Transcripción en texto limpio).
  - Copia rápida al portapapeles con 1 clic.
- **🛡️ Cero Congelamiento de Interfaz**: El proceso de transcripción se ejecuta en un hilo de trabajo (`threading.Thread`) secundario con barra de progreso fluida y visor en vivo de las frases que se van reconociendo.
- **🔔 Notificaciones Flotantes (Toasts)**: Avisos informativos y manejo amigable de errores sin cierres inesperados.

---

## 🚀 Inicio Rápido (Windows)

PiSubtitles Studio incluye scripts automáticos para que no tengas que configurar nada manualmente:

1. **Clona el repositorio** o descarga el código:
   ```bash
   git clone https://github.com/tu-usuario/PiSubtitles.git
   cd PiSubtitles
   ```

2. **Instalación en 1 clic**:
   Doble clic en `setup.bat`. Creará el entorno virtual `.venv` e instalará las dependencias fijadas automáticamente.

3. **Ejecutar la aplicación**:
   Doble clic en `start.bat`. ¡La aplicación se abrirá inmediatamente!

---

## 💻 Instalación Manual (Windows, macOS, Linux)

Si prefieres usar la consola o estás en macOS / Linux:

```bash
# 1. Crear entorno virtual
python -m venv .venv

# 2. Activar entorno virtual
# En Windows:
.venv\Scripts\activate
# En macOS / Linux:
source .venv/bin/activate

# 3. Actualizar pip e instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# 4. Lanzar la aplicación
python main.py
```

---

## ⚙️ Arquitectura del Proyecto

El código está organizado siguiendo las mejores prácticas de modularidad, separación de responsabilidades y tipado en Python:

```
PiSubtitles/
├── app/
│   ├── core/
│   │   ├── hardware.py          # Detección de aceleración GPU (CUDA) y fallback a CPU int8
│   │   ├── audio_utils.py       # Duración, formatos, parsing y vistas previas de audio
│   │   ├── transcriber.py       # Worker en segundo plano, segmentación por palabras y eventos
│   │   └── exporter.py          # Generador de archivos .SRT, .VTT y .TXT en UTF-8 seguro
│   ├── server/
│   │   └── api_server.py        # Servidor HTTP local con soporte de HTTP Range (206) para streaming
│   └── ui/
│       ├── index.html           # Estructura semántica moderna de la interfaz
│       ├── css/
│       │   └── style.css        # Paleta Obsidian, Glassmorphism, animaciones y diseño responsivo
│       └── js/
│           └── app.js           # Lógica interactiva, Drag & Drop, sincronización de audio y edición
├── sample/
│   └── audioHoraAventuras.mp3   # Audio de muestra listo para pruebas instantáneas
├── main.py                      # Punto de entrada de la aplicación y puente DesktopApi
├── requirements.txt             # Dependencias fijadas y verificadas sin conflictos
├── setup.bat                    # Script de instalación automática para Windows
├── start.bat                    # Lanzador rápido de 1 clic para Windows
├── .gitignore                   # Exclusión exhaustiva para Python, cachés y OS
├── LICENSE                      # Licencia MIT
└── README.md                    # Documentación profesional del proyecto
```

---

## 🔧 Solución de Problemas Frecuentes

### 1. ¿Cómo se evita el bug conocido de PyAV?
Versiones recientes de PyAV (`av >= 19`) introdujeron cambios incompatibles con algunos decodificadores de audio en Windows. PiSubtitles Studio fija estrictamente `av>=11.0.0,<19.0.0` en `requirements.txt` y dispone de fallback a `imageio-ffmpeg` para garantizar que la decodificación de audio nunca falle.

### 2. Aceleración por Hardware (GPU NVIDIA vs. CPU)
- Si dispones de una tarjeta gráfica NVIDIA con los drivers CUDA instalados, la aplicación utilizará automáticamente la GPU en precisión `float16`.
- Si las bibliotecas de CUDA (`cublas64_12.dll`) no están instaladas o estás en un equipo sin tarjeta gráfica dedicada, la aplicación pasará automáticamente y sin errores a **CPU multi-hilo con cuantización int8**, ofreciendo un rendimiento extraordinario en cualquier ordenador.

### 3. Codificación de Caracteres en Windows (`cp1252` vs `UTF-8`)
Todos los archivos exportados (`.srt`, `.vtt`, `.txt`) y las transmisiones de datos internas fuerzan codificación **UTF-8 estricta**, evitando errores de caracteres especiales (tildes, eñes, emojis o caracteres asiáticos).

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si deseas añadir nuevas características, mejorar los estilos visuales o reportar un error:

1. Haz un Fork del proyecto.
2. Crea una rama para tu característica: `git checkout -b feature/nueva-mejora`.
3. Realiza tus cambios y haz commit: `git commit -m 'Añade nueva funcionalidad'`.
4. Envía tu rama: `git push origin feature/nueva-mejora`.
5. Abre un Pull Request.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
