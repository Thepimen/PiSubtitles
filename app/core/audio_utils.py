"""
Utilidades para procesamiento de audio y vídeo, validación de formatos,
cálculo de duraciones, marcas de tiempo y preparación de vistas previas.
"""
import os
import re
import tempfile
import subprocess
from pathlib import Path

SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".wma", ".opus", ".alac", ".aiff"
}

SUPPORTED_VIDEO_EXTENSIONS = {
    ".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".ts", ".m4v", ".wmv"
}

SUPPORTED_EXTENSIONS = SUPPORTED_AUDIO_EXTENSIONS | SUPPORTED_VIDEO_EXTENSIONS

# Formatos que los navegadores modernos (Chromium / WebView2) reproducen de forma nativa en <audio>
WEB_NATIVE_FORMATS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm", ".mp4"}


def is_supported_file(file_path: str) -> bool:
    """Verifica si el archivo tiene una extensión multimedia compatible."""
    if not file_path:
        return False
    ext = Path(file_path).suffix.lower()
    return ext in SUPPORTED_EXTENSIONS


def format_file_size(size_bytes: int) -> str:
    """Convierte bytes a formato legible (KB, MB, GB)."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def format_timestamp(seconds: float, format_type: str = "srt") -> str:
    """
    Formatea segundos a formato de subtítulos:
    - srt: 00:00:00,000
    - vtt: 00:00:00.000
    - display: 00:00 (o 00:00:00 si pasa de 1h)
    """
    if seconds is None or seconds < 0:
        seconds = 0.0

    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms >= 1000:
        ms = 999

    if format_type == "srt":
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"
    elif format_type == "vtt":
        return f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"
    elif format_type == "display":
        if hrs > 0:
            return f"{hrs:02d}:{mins:02d}:{secs:02d}"
        return f"{mins:02d}:{secs:02d}"
    else:
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"


def parse_timestamp(time_str: str) -> float:
    """
    Convierte una cadena de tiempo a segundos en punto flotante.
    Soporta:
    - 00:01:23,456 (SRT)
    - 00:01:23.456 (VTT)
    - 01:23,456 o 01:23.456
    - 12.34
    """
    if not time_str:
        return 0.0

    time_str = str(time_str).strip().replace(",", ".")

    parts = time_str.split(":")
    try:
        if len(parts) == 3:
            # hh:mm:ss.sss
            h = float(parts[0])
            m = float(parts[1])
            s = float(parts[2])
            return h * 3600 + m * 60 + s
        elif len(parts) == 2:
            # mm:ss.sss
            m = float(parts[0])
            s = float(parts[1])
            return m * 60 + s
        elif len(parts) == 1:
            return float(parts[0])
    except ValueError:
        pass
    return 0.0


def get_audio_duration(file_path: str) -> float:
    """
    Obtiene la duración total de un archivo de audio o vídeo en segundos.
    Usa PyAV primero; si falla, recurre a imageio_ffmpeg.
    """
    if not os.path.isfile(file_path):
        return 0.0

    # Método 1: PyAV
    try:
        import av
        container = av.open(file_path)
        if container.duration:
            duration = float(container.duration) / av.time_base
            container.close()
            if duration > 0:
                return duration
        # Si la duración del contenedor no estaba, revisar streams de audio
        for stream in container.streams.audio:
            if stream.duration and stream.time_base:
                duration = float(stream.duration * stream.time_base)
                container.close()
                if duration > 0:
                    return duration
        container.close()
    except Exception:
        pass

    # Método 2: imageio_ffmpeg probe
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [ffmpeg_exe, "-i", file_path]
        proc = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, encoding="utf-8", errors="ignore")
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", proc.stderr)
        if match:
            h, m, s = match.groups()
            return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception:
        pass

    return 0.0


def get_file_info(file_path: str) -> dict:
    """
    Recopila información descriptiva y metadatos de un archivo multimedia.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"El archivo no existe: {file_path}")

    path_obj = Path(file_path)
    size_bytes = os.path.getsize(file_path)
    duration = get_audio_duration(file_path)
    ext = path_obj.suffix.lower()

    return {
        "path": os.path.abspath(file_path),
        "name": path_obj.name,
        "stem": path_obj.stem,
        "extension": ext,
        "size_bytes": size_bytes,
        "size_formatted": format_file_size(size_bytes),
        "duration": duration,
        "duration_formatted": format_timestamp(duration, "display"),
        "is_video": ext in SUPPORTED_VIDEO_EXTENSIONS,
        "is_web_native": ext in WEB_NATIVE_FORMATS
    }


def get_playable_audio_path(file_path: str) -> str:
    """
    Si el archivo es directamente reproducible en el navegador (mp3, wav, ogg, m4a, mp4, webm),
    devuelve la ruta original.
    Si es un formato no soportado (mkv, avi, flac, etc.), extrae un audio temporal mp3
    para permitir la reproducción sincronizada en el editor.
    """
    ext = Path(file_path).suffix.lower()
    if ext in WEB_NATIVE_FORMATS:
        return file_path

    # Extraer a caché temporal
    temp_dir = os.path.join(tempfile.gettempdir(), "pisubtitles_cache")
    os.makedirs(temp_dir, exist_ok=True)
    cache_name = f"{Path(file_path).stem}_preview.mp3"
    preview_path = os.path.join(temp_dir, cache_name)

    # Si ya existe y es más reciente que el archivo original, reutilizar
    if os.path.exists(preview_path) and os.path.getmtime(preview_path) >= os.path.getmtime(file_path):
        return preview_path

    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        cmd = [
            ffmpeg_exe, "-y", "-i", file_path,
            "-vn", "-acodec", "libmp3lame", "-ab", "128k", "-ar", "44100",
            preview_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return preview_path
    except Exception:
        # Si falla la extracción, devolver original y el navegador intentará cargarlo
        return file_path
