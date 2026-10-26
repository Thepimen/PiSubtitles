"""
PiSubtitles Studio - Aplicación de Escritorio Profesional para Generación de Subtítulos con IA.
Punto de entrada principal.
"""
import os
import sys
import json
import threading
from pathlib import Path

# Asegurar codificación UTF-8 universal en Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Suprimir advertencia de symlinks de HuggingFace en Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

import logging
logging.getLogger("pywebview").setLevel(logging.ERROR)

import webview
from app.server.api_server import start_server
from app.core.audio_utils import get_file_info
from app.core.hardware import get_hardware_info
from app.core.transcriber import TranscriberWorker
from app.core.exporter import save_subtitles_to_file


class DesktopApi:
    """
    Puente de comunicación entre la interfaz HTML5/JS y el backend Python.
    Expuesto como `window.pywebview.api`.
    """

    def __init__(self):
        self.window = None
        self.current_worker = None

    def set_window(self, window):
        self.window = window

    def get_system_info(self) -> dict:
        """Retorna información sobre GPU/CUDA y CPU del sistema."""
        return get_hardware_info()

    def choose_file(self) -> dict:
        """Abre el diálogo nativo del explorador de archivos de Windows."""
        if not self.window:
            return {"success": False, "error": "Ventana no inicializada"}

        file_types = (
            "Archivos Multimedia (*.mp3;*.wav;*.m4a;*.mp4;*.mkv;*.mov;*.flac;*.webm;*.aac;*.ogg)",
            "Todos los archivos (*.*)"
        )
        result = self.window.create_file_dialog(
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

        # Cancelar cualquier worker previo
        if self.current_worker and self.current_worker.is_running:
            self.current_worker.cancel()

        def on_progress(pct, cur, dur, msg):
            if self.window:
                data_json = json.dumps({"percent": pct, "currentTime": cur, "totalTime": dur, "message": msg}, ensure_ascii=False)
                self.window.evaluate_js(f"window.__onProgress({data_json});")

        def on_segment(sub):
            if self.window:
                data_json = json.dumps(sub, ensure_ascii=False)
                self.window.evaluate_js(f"window.__onSegment({data_json});")

        def on_complete(subs, lang):
            if self.window:
                data_json = json.dumps({"subtitles": subs, "language": lang}, ensure_ascii=False)
                self.window.evaluate_js(f"window.__onComplete({data_json});")

        def on_error(err_str):
            if self.window:
                data_json = json.dumps({"error": err_str}, ensure_ascii=False)
                self.window.evaluate_js(f"window.__onError({data_json});")

        worker = TranscriberWorker(
            file_path=file_path,
            model_size=config.get("model_size", "small"),
            language=config.get("language", None),
            segmentation_mode=config.get("segmentation_mode", "words"),
            max_words_per_line=config.get("max_words_per_line", 4),
            vad_filter=config.get("vad_filter", True),
            on_progress=on_progress,
            on_segment=on_segment,
            on_complete=on_complete,
            on_error=on_error
        )
        self.current_worker = worker
        worker.start()
        return {"success": True}

    def cancel_transcription(self) -> dict:
        """Detiene la transcripción en curso."""
        if self.current_worker and self.current_worker.is_running:
            self.current_worker.cancel()
            return {"success": True}
        return {"success": False, "message": "No hay transcripción activa"}

    def export_file(self, format_type: str, subtitles: list, default_name: str) -> dict:
        """Abre el cuadro de diálogo para guardar el archivo exportado."""
        if not self.window:
            return {"success": False, "error": "Ventana no disponible"}

        format_type = format_type.lower()
        file_types = (f"Subtítulos (*.{format_type})", "Todos los archivos (*.*)")

        result = self.window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=default_name,
            file_types=file_types
        )

        if result:
            dest_path = result if isinstance(result, str) else result[0]
            # Asegurar extensión
            if not dest_path.lower().endswith(f".{format_type}"):
                dest_path += f".{format_type}"
            try:
                saved = save_subtitles_to_file(subtitles, dest_path, format_type)
                return {"success": True, "path": saved}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "cancelled": True}

    def save_quick_next_to_source(self, format_type: str, subtitles: list, source_path: str) -> dict:
        """Guarda los subtítulos directamente en la misma carpeta que el archivo original."""
        try:
            source = Path(source_path)
            target = source.parent / f"{source.stem}.{format_type.lower()}"
            saved = save_subtitles_to_file(subtitles, str(target), format_type)
            return {"success": True, "path": saved}
        except Exception as e:
            return {"success": False, "error": str(e)}


def main():
    """Arranque del servidor local y la ventana de escritorio."""
    print("=" * 65)
    print("  🚀 PiSubtitles Studio - AI Subtitle Studio for Creators")
    print("=" * 65)

    # 1. Iniciar servidor HTTP local
    server, base_url = start_server()
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print(f"[OK] Servidor local listo en: {base_url}")

    # 2. Configurar API y ventana de escritorio
    api = DesktopApi()
    window = webview.create_window(
        title="PiSubtitles Studio • Subtítulos con IA",
        url=f"{base_url}/",
        js_api=api,
        width=1280,
        height=860,
        min_size=(960, 640),
        background_color="#07090e"
    )
    api.set_window(window)

    print("[OK] Abriendo ventana de escritorio...")
    try:
        webview.start(debug=False)
    finally:
        print("[*] Cerrando PiSubtitles Studio...")
        server.shutdown()


if __name__ == "__main__":
    main()
