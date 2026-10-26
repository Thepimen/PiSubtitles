"""
Exportador de subtítulos en formatos .SRT, .VTT y .TXT.
Garantiza codificación UTF-8 estricta para compatibilidad universal (Windows, Mac, Linux).
"""
import os
from pathlib import Path
from app.core.audio_utils import format_timestamp, parse_timestamp


def normalize_subtitles(subtitles: list) -> list:
    """
    Normaliza la lista de subtítulos asegurando que cada elemento tenga
    id, start (float), end (float), y text (str).
    """
    normalized = []
    for idx, item in enumerate(subtitles, start=1):
        if isinstance(item, dict):
            raw_start = item.get("start", 0.0)
            raw_end = item.get("end", 0.0)
            text = str(item.get("text", "")).strip()
        else:
            # Tupla o lista (start, end, text)
            raw_start = item[0] if len(item) > 0 else 0.0
            raw_end = item[1] if len(item) > 1 else 0.0
            text = str(item[2]).strip() if len(item) > 2 else ""

        start_sec = raw_start if isinstance(raw_start, (int, float)) else parse_timestamp(str(raw_start))
        end_sec = raw_end if isinstance(raw_end, (int, float)) else parse_timestamp(str(raw_end))

        # Evitar duración negativa o 0
        if end_sec <= start_sec:
            end_sec = start_sec + 0.5

        normalized.append({
            "id": idx,
            "start": round(start_sec, 3),
            "end": round(end_sec, 3),
            "text": text
        })
    return normalized


def generate_srt(subtitles: list) -> str:
    """Genera el contenido de un archivo de subtítulos SubRip (.SRT)."""
    norm = normalize_subtitles(subtitles)
    lines = []
    for sub in norm:
        start_str = format_timestamp(sub["start"], "srt")
        end_str = format_timestamp(sub["end"], "srt")
        lines.append(f"{sub['id']}\n{start_str} --> {end_str}\n{sub['text']}\n")
    return "\n".join(lines).strip() + "\n"


def generate_vtt(subtitles: list) -> str:
    """Genera el contenido de un archivo WebVTT (.VTT)."""
    norm = normalize_subtitles(subtitles)
    lines = ["WEBVTT\n"]
    for sub in norm:
        start_str = format_timestamp(sub["start"], "vtt")
        end_str = format_timestamp(sub["end"], "vtt")
        lines.append(f"{sub['id']}\n{start_str} --> {end_str}\n{sub['text']}\n")
    return "\n".join(lines).strip() + "\n"


def generate_txt(subtitles: list) -> str:
    """Genera el texto plano de la transcripción completa."""
    norm = normalize_subtitles(subtitles)
    lines = [sub["text"] for sub in norm if sub["text"]]
    return "\n".join(lines).strip() + "\n"


def save_subtitles_to_file(subtitles: list, file_path: str, format_type: str = None) -> str:
    """
    Escribe los subtítulos en un archivo con codificación UTF-8.
    Devuelve la ruta absoluta del archivo guardado.
    """
    dest_path = Path(file_path).resolve()
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if not format_type:
        ext = dest_path.suffix.lower()
        if ext == ".vtt":
            format_type = "vtt"
        elif ext == ".txt":
            format_type = "txt"
        else:
            format_type = "srt"

    format_type = format_type.lower()
    if format_type == "vtt":
        content = generate_vtt(subtitles)
    elif format_type == "txt":
        content = generate_txt(subtitles)
    else:
        content = generate_srt(subtitles)

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(content)

    return str(dest_path)
