"""
Servidor HTTP local para servir la interfaz web y streaming de audio con soporte de HTTP Range.
Permite búsqueda/reproducción fluida en el navegador sin bloquear el hilo principal.
"""
import os
import re
import json
import socket
import mimetypes
import tempfile
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Tuple

from app.core.audio_utils import get_file_info, get_playable_audio_path
from app.core.hardware import get_hardware_info

UI_ROOT = Path(__file__).resolve().parent.parent / "ui"

MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".webm": "video/webm"
}


class SubtitlesHTTPHandler(BaseHTTPRequestHandler):
    """Manejador de peticiones para servir assets estáticos y streaming de audio."""

    def log_message(self, format, *args):
        # Silenciar logs innecesarios de peticiones para mantener limpia la consola
        pass

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Ruta API: Información de hardware y estado
        if path == "/api/status":
            hw = get_hardware_info()
            self.send_json({"status": "ok", "hardware": hw})
            return

        # Ruta API: Streaming multimedia con soporte HTTP Range (206 Partial Content)
        if path == "/api/media":
            file_param = query.get("file", [""])[0]
            if not file_param:
                self.send_error(400, "Parámetro 'file' faltante")
                return

            real_path = os.path.abspath(file_param)
            if not os.path.isfile(real_path):
                self.send_error(404, "Archivo de audio no encontrado")
                return

            # Obtener versión reproducible si es necesario
            playable_path = get_playable_audio_path(real_path)
            self._serve_media_with_range(playable_path)
            return

        # Servir archivos estáticos de la interfaz (app/ui/)
        rel_path = path.lstrip("/")
        if not rel_path or rel_path == "/":
            rel_path = "index.html"

        target_file = (UI_ROOT / rel_path).resolve()

        # Seguridad contra directory traversal
        if not str(target_file).startswith(str(UI_ROOT)):
            self.send_error(403, "Acceso denegado")
            return

        if not target_file.is_file():
            self.send_error(404, "Página no encontrada")
            return

        ext = target_file.suffix.lower()
        content_type = MIME_MAP.get(ext, "application/octet-stream")

        try:
            with open(target_file, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error interno: {str(e)}")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Subida directa de archivo arrastrado (para navegadores que ocultan la ruta local)
        if path == "/api/upload":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length <= 0:
                    self.send_json({"success": False, "error": "Cuerpo vacío"}, status=400)
                    return

                filename = query.get("name", ["audio_upload.mp3"])[0]
                temp_dir = Path(tempfile.gettempdir()) / "pisubtitles_uploads"
                temp_dir.mkdir(parents=True, exist_ok=True)
                dest = temp_dir / filename

                with open(dest, "wb") as f:
                    remaining = content_length
                    while remaining > 0:
                        chunk_size = min(65536, remaining)
                        chunk = self.rfile.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        remaining -= len(chunk)

                info = get_file_info(str(dest))
                self.send_json({"success": True, "file_info": info})
            except Exception as e:
                self.send_json({"success": False, "error": str(e)}, status=500)
            return

        self.send_error(404, "Endpoint no encontrado")

    def _serve_media_with_range(self, file_path: str):
        """Maneja streaming con Range: bytes=X-Y para reproducción fluida."""
        ext = Path(file_path).suffix.lower()
        content_type = MIME_MAP.get(ext, "audio/mpeg")
        file_size = os.path.getsize(file_path)

        range_header = self.headers.get("Range", None)

        if not range_header:
            # Respuesta estándar 200 OK completa
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            with open(file_path, "rb") as f:
                while chunk := f.read(65536):
                    try:
                        self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError):
                        break
            return

        # Petición de rango 206 Partial Content
        range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not range_match:
            self.send_error(416, "Requested Range Not Satisfiable")
            return

        start_str, end_str = range_match.groups()
        start = int(start_str)
        end = int(end_str) if end_str else file_size - 1

        if start >= file_size or start > end:
            self.send_error(416, "Requested Range Not Satisfiable")
            return

        end = min(end, file_size - 1)
        content_length = end - start + 1

        self.send_response(206)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk_size = min(65536, remaining)
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                remaining -= len(chunk)


def find_free_port() -> int:
    """Encuentra un puerto local libre de colisiones en 127.0.0.1."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(port: int = None) -> Tuple[ThreadingHTTPServer, str]:
    """Inicia el servidor local en segundo plano y devuelve la instancia y la URL base."""
    target_port = port or find_free_port()
    server = ThreadingHTTPServer(("127.0.0.1", target_port), SubtitlesHTTPHandler)
    base_url = f"http://127.0.0.1:{target_port}"
    return server, base_url
