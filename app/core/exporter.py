"""
Exportador e importador avanzado de subtítulos en formatos .SRT, .VTT, .ASS, .TXT y .JSON.
Incluye quemado de subtítulos en vídeo (hardcode MP4) vía FFmpeg con plantillas de estilo viral.
Garantiza codificación UTF-8 estricta para compatibilidad universal.
"""
import os
import re
import json
import shutil
import tempfile
import subprocess
from pathlib import Path
from app.core.audio_utils import format_timestamp, parse_timestamp


# Presets visuales para exportación .ASS (colores en formato ASS &HAABBGGRR)
ASS_STYLE_PRESETS = {
    "hormozi": {
        "fontname": "Arial Black",
        "primary_color": "&H0015CCFA",   # Amarillo dorado vibrante (#FACC15)
        "secondary_color": "&H005EC522", # Verde neón
        "outline_color": "&H00000000",   # Contorno negro puro
        "back_color": "&H80000000",      # Sombra profunda
        "bold": -1,
        "border_style": 1,
        "outline": 4.5,
        "shadow": 3.0
    },
    "mrbeast": {
        "fontname": "Impact",
        "primary_color": "&H00FFFFFF",   # Blanco puro
        "secondary_color": "&H00D4B606", # Cian
        "outline_color": "&H00000000",   # Contorno negro muy grueso
        "back_color": "&H90000000",
        "bold": -1,
        "border_style": 1,
        "outline": 5.0,
        "shadow": 2.5
    },
    "cyberpunk": {
        "fontname": "Segoe UI",
        "primary_color": "&H00EEEE22",   # Cian neón brillante (#22D3EE)
        "secondary_color": "&H00F65C8B", # Violeta (#8B5CF6)
        "outline_color": "&H002E101A",   # Contorno índigo oscuro
        "back_color": "&H80F16663",
        "bold": -1,
        "border_style": 1,
        "outline": 3.8,
        "shadow": 3.5
    },
    "cinema": {
        "fontname": "Arial",
        "primary_color": "&H00F8FAFC",   # Blanco suave
        "secondary_color": "&H00FFFFFF",
        "outline_color": "&H40000000",
        "back_color": "&HA0000000",      # Caja oscura semitransparente
        "bold": 0,
        "border_style": 3,               # Caja opaca/semitransparente
        "outline": 2.0,
        "shadow": 0.0
    }
}


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
            raw_start = item[0] if len(item) > 0 else 0.0
            raw_end = item[1] if len(item) > 1 else 0.0
            text = str(item[2]).strip() if len(item) > 2 else ""

        start_sec = float(raw_start) if isinstance(raw_start, (int, float)) else parse_timestamp(str(raw_start))
        end_sec = float(raw_end) if isinstance(raw_end, (int, float)) else parse_timestamp(str(raw_end))

        if end_sec <= start_sec:
            end_sec = start_sec + 0.5

        duration = round(end_sec - start_sec, 3)
        cps = round(len(text) / max(0.2, duration), 1)

        normalized.append({
            "id": idx,
            "start": round(start_sec, 3),
            "end": round(end_sec, 3),
            "duration": duration,
            "cps": cps,
            "text": text
        })
    return normalized


def format_ass_timestamp(seconds: float) -> str:
    """Formatea segundos al estándar SubStation Alpha: H:MM:SS.cc (centésimas)."""
    if seconds is None or seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"


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


def generate_json(subtitles: list) -> str:
    """Genera un archivo JSON estructurado con métricas de duración y CPS."""
    norm = normalize_subtitles(subtitles)
    payload = {
        "generator": "PiSubtitles Studio v2.0",
        "count": len(norm),
        "subtitles": norm
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def generate_ass(
    subtitles: list,
    style_preset: str = "hormozi",
    aspect_ratio: str = "9:16",
    font_size: int = 64,
    position: str = "bottom"
) -> str:
    """
    Genera un archivo Advanced SubStation Alpha (.ASS) con estilos visuales listos para
    DaVinci Resolve, CapCut, Premiere o quemado directo con FFmpeg.
    """
    norm = normalize_subtitles(subtitles)
    preset = ASS_STYLE_PRESETS.get(style_preset, ASS_STYLE_PRESETS["hormozi"])

    if aspect_ratio == "9:16":
        res_x, res_y = 1080, 1920
        margin_v = 260 if position == "bottom" else (120 if position == "top" else 60)
    else:
        res_x, res_y = 1920, 1080
        margin_v = 85 if position == "bottom" else (70 if position == "top" else 40)

    # Alineación ASS: 2 = Inferior centro, 5 = Centro pantalla, 8 = Superior centro
    alignment = 2
    if position == "center":
        alignment = 5
    elif position == "top":
        alignment = 8

    header = f"""[Script Info]
; Script generated by PiSubtitles Studio v2.0
Title: PiSubtitles Studio Export
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {res_x}
PlayResY: {res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{preset['fontname']},{font_size},{preset['primary_color']},{preset['secondary_color']},{preset['outline_color']},{preset['back_color']},{preset['bold']},0,0,0,100,100,0,0,{preset['border_style']},{preset['outline']},{preset['shadow']},{alignment},60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for sub in norm:
        s_time = format_ass_timestamp(sub["start"])
        e_time = format_ass_timestamp(sub["end"])
        clean_text = sub["text"].replace("\n", "\\N")
        events.append(f"Dialogue: 0,{s_time},{e_time},Default,,0,0,0,,{clean_text}")

    return header + "\n".join(events) + "\n"


def parse_srt_file(file_path: str) -> list:
    """Importa y parsea un archivo .SRT existente devolviendo la lista de subtítulos."""
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
        content = f.read()

    blocks = re.split(r"\n\s*\n", content.strip())
    subtitles = []
    idx = 1

    for block in blocks:
        lines = [line.strip() for line in block.strip().splitlines() if line.strip()]
        if len(lines) < 2:
            continue

        # Buscar la línea con '-->'
        time_line_idx = -1
        for i, line in enumerate(lines):
            if "-->" in line:
                time_line_idx = i
                break

        if time_line_idx == -1:
            continue

        time_parts = lines[time_line_idx].split("-->")
        start_sec = parse_timestamp(time_parts[0].strip())
        end_sec = parse_timestamp(time_parts[1].strip().split(" ")[0])
        text = " ".join(lines[time_line_idx + 1:]).strip()

        if text:
            subtitles.append({
                "id": idx,
                "start": round(start_sec, 3),
                "end": round(end_sec, 3),
                "text": text
            })
            idx += 1

    return subtitles


def save_subtitles_to_file(
    subtitles: list,
    file_path: str,
    format_type: str = None,
    style_options: dict = None
) -> str:
    """
    Escribe los subtítulos en un archivo con codificación UTF-8.
    Devuelve la ruta absoluta del archivo guardado.
    """
    dest_path = Path(file_path).resolve()
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    style_options = style_options or {}

    if not format_type:
        ext = dest_path.suffix.lower().lstrip(".")
        format_type = ext if ext in ("srt", "vtt", "txt", "ass", "json") else "srt"

    format_type = format_type.lower()
    if format_type == "vtt":
        content = generate_vtt(subtitles)
    elif format_type == "txt":
        content = generate_txt(subtitles)
    elif format_type == "json":
        content = generate_json(subtitles)
    elif format_type == "ass":
        content = generate_ass(
            subtitles,
            style_preset=style_options.get("preset", "hormozi"),
            aspect_ratio=style_options.get("aspect_ratio", "9:16"),
            font_size=int(style_options.get("font_size", 64)),
            position=style_options.get("position", "bottom")
        )
    else:
        content = generate_srt(subtitles)

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(content)

    return str(dest_path)


def burn_subtitles_to_video(
    video_path: str,
    subtitles: list,
    output_video_path: str,
    style_options: dict = None
) -> str:
    """
    Incrusta (quema) los subtítulos con estilo visual .ASS directamente sobre un vídeo
    utilizando el ejecutable FFmpeg de imageio_ffmpeg.
    """
    import imageio_ffmpeg

    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"No existe el vídeo origen: {video_path}")

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    style_options = style_options or {}

    # Crear archivo .ASS temporal en directorio seguro sin espacios ni caracteres conflictivos
    temp_dir = Path(tempfile.gettempdir()) / "pisubtitles_burn"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_ass = temp_dir / "burn_subs.ass"

    ass_content = generate_ass(
        subtitles,
        style_preset=style_options.get("preset", "hormozi"),
        aspect_ratio=style_options.get("aspect_ratio", "16:9"),
        font_size=int(style_options.get("font_size", 56)),
        position=style_options.get("position", "bottom")
    )
    with open(temp_ass, "w", encoding="utf-8") as f:
        f.write(ass_content)

    # Escapar ruta para el filtro ass de FFmpeg en Windows
    escaped_ass = str(temp_ass).replace("\\", "/").replace(":", "\\:")

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", str(video_path),
        "-vf", f"ass='{escaped_ass}'",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "21",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output_video_path)
    ]

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Error en FFmpeg al quemar subtítulos: {proc.stderr[-300:]}")

    return str(Path(output_video_path).resolve())
