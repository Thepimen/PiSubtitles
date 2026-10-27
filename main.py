"""
PiSubtitles Studio v2.0 - Aplicación de Escritorio Profesional para Generación y Edición de Subtítulos con IA.
Punto de entrada principal.
"""
import os
import io
import sys
import json
import threading
from pathlib import Path

# Asegurar que el directorio raíz y .venv/Lib/site-packages estén siempre en sys.path
APP_ROOT = Path(__file__).resolve().parent
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))
VENV_SITE = APP_ROOT / ".venv" / "Lib" / "site-packages"
if VENV_SITE.is_dir() and str(VENV_SITE) not in sys.path:
    sys.path.insert(0, str(VENV_SITE))

# Garantizar que stdout y stderr existan siempre (incluso bajo pythonw.exe sin consola)
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8", errors="replace")
elif sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8", errors="replace")
elif sys.platform == "win32":
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Suprimir advertencia de symlinks de HuggingFace en Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

import logging
logging.getLogger("pywebview").setLevel(logging.CRITICAL)

import webview
from app.server.api_server import start_server
from app.core.audio_utils import get_file_info
from app.core.hardware import get_hardware_info
from app.core.transcriber import TranscriberWorker
from app.core.exporter import (
    save_subtitles_to_file,
    parse_srt_file,
    burn_subtitles_to_video
)


class DesktopApi:
    """
    Puente de comunicación entre la interfaz HTML5/JS y el backend Python.
    Expuesto como `window.pywebview.api`.
    Nota: Los atributos internos llevan prefijo '_' para evitar que pywebview
    intente serializar objetos nativos .NET/WinForms al puente JS.
    """

    def __init__(self):
        self._window = None
        self._current_worker = None

    def get_system_info(self) -> dict:
        """Retorna información sobre GPU/CUDA y CPU del sistema."""
        return get_hardware_info()

    def choose_file(self) -> dict:
        """Abre el diálogo nativo del explorador de archivos de Windows."""
        if not self._window:
            return {"success": False, "error": "Ventana no inicializada"}

        file_types = (
            "Archivos Multimedia (*.mp3;*.wav;*.m4a;*.mp4;*.mkv;*.mov;*.flac;*.webm;*.aac;*.ogg)",
            "Todos los archivos (*.*)"
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=file_types
        )

        if result and len(result) > 0:
            file_path = result[0]
            try:
                info = get_file_info(file_path)
                return {"success": True, "file_info": info}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "cancelled": True}

    def import_srt(self) -> dict:
        """Permite al usuario importar un archivo .SRT existente para editarlo."""
        if not self._window:
            return {"success": False, "error": "Ventana no inicializada"}

        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Archivos de Subtítulos (*.srt)", "Todos los archivos (*.*)")
        )

        if result and len(result) > 0:
            srt_path = result[0]
            try:
                subs = parse_srt_file(srt_path)
                return {"success": True, "subtitles": subs, "path": srt_path}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "cancelled": True}

    def get_file_details(self, file_path: str) -> dict:
        """Obtiene metadatos del archivo para la interfaz."""
        return get_file_info(file_path)

    def load_sample(self) -> dict:
        """Carga el archivo de muestra incluido en el repositorio para pruebas rápidas."""
        sample_path = Path(__file__).resolve().parent / "sample" / "audioHoraAventuras.mp3"
        if sample_path.is_file():
            return get_file_info(str(sample_path))
        return None

    def start_transcription(self, config: dict) -> dict:
        """Inicia el proceso de transcripción en segundo plano."""
        file_path = config.get("file_path", "")
        if not file_path or not os.path.isfile(file_path):
            return {"success": False, "error": "Archivo no encontrado"}

        if self._current_worker and self._current_worker.is_running:
            self._current_worker.cancel()

        def on_progress(pct, cur, dur, msg):
            if self._window:
                data_json = json.dumps({"percent": pct, "currentTime": cur, "totalTime": dur, "message": msg}, ensure_ascii=False)
                self._window.evaluate_js(f"window.__onProgress({data_json});")

        def on_segment(sub):
            if self._window:
                data_json = json.dumps(sub, ensure_ascii=False)
                self._window.evaluate_js(f"window.__onSegment({data_json});")

        def on_complete(subs, lang):
            if self._window:
                data_json = json.dumps({"subtitles": subs, "language": lang}, ensure_ascii=False)
                self._window.evaluate_js(f"window.__onComplete({data_json});")

        def on_error(err_str):
            if self._window:
                data_json = json.dumps({"error": err_str}, ensure_ascii=False)
                self._window.evaluate_js(f"window.__onError({data_json});")

        worker = TranscriberWorker(
            file_path=file_path,
            model_size=config.get("model_size", "small"),
            language=config.get("language", None),
            task=config.get("task", "transcribe"),
            initial_prompt=config.get("initial_prompt", None),
            segmentation_mode=config.get("segmentation_mode", "words"),
            max_words_per_line=config.get("max_words_per_line", 4),
            vad_filter=config.get("vad_filter", True),
            on_progress=on_progress,
            on_segment=on_segment,
            on_complete=on_complete,
            on_error=on_error
        )
        self._current_worker = worker
        worker.start()
        return {"success": True}

    def cancel_transcription(self) -> dict:
        """Detiene la transcripción en curso."""
        if self._current_worker and self._current_worker.is_running:
            self._current_worker.cancel()
            return {"success": True}
        return {"success": False, "message": "No hay transcripción activa"}

    def export_file(self, format_type: str, subtitles: list, default_name: str, style_options: dict = None) -> dict:
        """Abre el cuadro de diálogo para guardar el archivo exportado (.srt, .vtt, .ass, .txt, .json)."""
        if not self._window:
            return {"success": False, "error": "Ventana no disponible"}

        format_type = format_type.lower()
        file_types = (f"Archivo de Subtítulos (*.{format_type})", "Todos los archivos (*.*)")

        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=file_types
        )

        if result:
            dest_path = result if isinstance(result, str) else result[0]
            if not dest_path.lower().endswith(f".{format_type}"):
                dest_path += f".{format_type}"
            try:
                saved = save_subtitles_to_file(subtitles, dest_path, format_type, style_options=style_options)
                return {"success": True, "path": saved}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "cancelled": True}

    def save_quick_next_to_source(self, format_type: str, subtitles: list, source_path: str, style_options: dict = None) -> dict:
        """Guarda los subtítulos directamente en la misma carpeta que el archivo original (1-Clic / Ctrl+S)."""
        try:
            source = Path(source_path)
            target = source.parent / f"{source.stem}.{format_type.lower()}"
            saved = save_subtitles_to_file(subtitles, str(target), format_type, style_options=style_options)
            return {"success": True, "path": saved}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def burn_video(self, video_path: str, subtitles: list, default_name: str, style_options: dict = None) -> dict:
        """Incrusta (quema) los subtítulos sobre el vídeo original exportando un nuevo .MP4."""
        if not self._window:
            return {"success": False, "error": "Ventana no disponible"}

        result = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=("Vídeo MP4 con Subtítulos (*.mp4)", "Todos los archivos (*.*)")
        )

        if not result:
            return {"success": False, "cancelled": True}

        dest_path = result if isinstance(result, str) else result[0]
        if not dest_path.lower().endswith(".mp4"):
            dest_path += ".mp4"

        try:
            saved = burn_subtitles_to_video(video_path, subtitles, dest_path, style_options=style_options)
            return {"success": True, "path": saved}
        except Exception as e:
            return {"success": False, "error": str(e)}


def main():
    """Arranque del servidor local y la ventana de escritorio."""
    server, base_url = start_server()
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    api = DesktopApi()
    window = webview.create_window(
        title="PiSubtitles Studio v2.0 • Subtítulos con IA para Creadores",
        url=f"{base_url}/",
        js_api=api,
        width=1380,
        height=900,
        min_size=(1060, 700),
        background_color="#07090e"
    )
    api._window = window

    def on_shown():
        try:
            window.restore()
            if sys.platform == "win32":
                import ctypes
                user32 = ctypes.windll.user32
                hwnd = user32.FindWindowW(None, window.title)
                if hwnd:
                    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                    user32.ShowWindow(hwnd, 5)  # SW_SHOW
                    user32.SetForegroundWindow(hwnd)
        except Exception:
            pass

    window.events.shown += on_shown

    try:
        webview.start(debug=False)
    finally:
        server.shutdown()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        import traceback
        err_details = traceback.format_exc()
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.user32.MessageBoxW(
                0,
                f"Error al iniciar PiSubtitles Studio:\n\n{err_details}",
                "PiSubtitles Studio - Error",
                0x10
            )
        raise
