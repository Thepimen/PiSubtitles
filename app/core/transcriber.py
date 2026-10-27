"""
Motor de transcripción basado en faster-whisper.
Ejecuta la transcripción en un hilo secundario con soporte de cancelación,
agrupación configurable de palabras (ideal para Shorts/Reels/TikTok) y eventos en tiempo real.
"""
import os
import sys
import threading
import traceback
from typing import Callable, Optional, List, Dict, Any

# Suprimir advertencia de symlinks de HuggingFace en Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from faster_whisper import WhisperModel
from app.core.hardware import get_hardware_info
from app.core.audio_utils import get_audio_duration

# Caché global del modelo para no recargar si se mantiene la misma configuración
_CACHED_MODEL: Optional[WhisperModel] = None
_CACHED_MODEL_KEY: Optional[str] = None
_MODEL_LOCK = threading.Lock()


def get_or_load_model(model_size: str = "small", device: str = None, compute_type: str = None) -> WhisperModel:
    """
    Obtiene el modelo en caché o lo carga si cambió el tamaño o dispositivo.
    Incluye fallback automático a CPU int8 si CUDA falla al inicializar.
    """
    global _CACHED_MODEL, _CACHED_MODEL_KEY

    hw = get_hardware_info()
    target_device = device or hw["device"]
    target_compute = compute_type or hw["compute_type"]
    cache_key = f"{model_size}_{target_device}_{target_compute}"

    with _MODEL_LOCK:
        if _CACHED_MODEL is not None and _CACHED_MODEL_KEY == cache_key:
            return _CACHED_MODEL

        try:
            model = WhisperModel(
                model_size,
                device=target_device,
                compute_type=target_compute,
                cpu_threads=hw.get("cpu_count", 4)
            )
            _CACHED_MODEL = model
            _CACHED_MODEL_KEY = cache_key
            return model
        except Exception as e:
            if target_device != "cpu":
                print(f"[Aviso] Fallo al iniciar CUDA ({e}). Pasando automáticamente a CPU (int8)...")
                model = WhisperModel(
                    model_size,
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=hw.get("cpu_count", 4)
                )
                _CACHED_MODEL = model
                _CACHED_MODEL_KEY = f"{model_size}_cpu_int8"
                return model
            raise e


class TranscriberWorker:
    """
    Worker que gestiona la transcripción en segundo plano sin congelar la interfaz.
    """

    def __init__(
        self,
        file_path: str,
        model_size: str = "small",
        language: Optional[str] = None,
        task: str = "transcribe",          # 'transcribe' o 'translate'
        initial_prompt: Optional[str] = None,
        segmentation_mode: str = "words",  # 'words' o 'sentence'
        max_words_per_line: int = 4,
        vad_filter: bool = True,
        on_progress: Optional[Callable[[int, float, float, str], None]] = None,
        on_segment: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_complete: Optional[Callable[[List[Dict[str, Any]], str], None]] = None,
        on_error: Optional[Callable[[str], None]] = None,
    ):
        self.file_path = file_path
        self.model_size = model_size
        self.language = language if language and language != "auto" else None
        self.task = task if task in ("transcribe", "translate") else "transcribe"
        self.initial_prompt = initial_prompt.strip() if initial_prompt and initial_prompt.strip() else None
        self.segmentation_mode = segmentation_mode
        self.max_words_per_line = max(1, min(20, int(max_words_per_line)))
        self.vad_filter = vad_filter

        self.on_progress = on_progress
        self.on_segment = on_segment
        self.on_complete = on_complete
        self.on_error = on_error

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.is_running = False

    def start(self):
        """Inicia el worker en un hilo independiente."""
        self._stop_event.clear()
        self.is_running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def cancel(self):
        """Solicita la cancelación de la transcripción."""
        self._stop_event.set()
        self.is_running = False

    def _run(self):
        subtitles: List[Dict[str, Any]] = []
        subtitle_id = 1

        try:
            if not os.path.isfile(self.file_path):
                raise FileNotFoundError(f"No se encontró el archivo: {self.file_path}")

            # Calcular duración inicial del audio
            total_duration = get_audio_duration(self.file_path)

            if self.on_progress:
                self.on_progress(2, 0.0, total_duration, f"Iniciando modelo Whisper ({self.model_size})...")

            if self._stop_event.is_set():
                return

            # Cargar modelo
            model = get_or_load_model(self.model_size)

            if self._stop_event.is_set():
                return

            if self.on_progress:
                self.on_progress(5, 0.0, total_duration, "Analizando pistas de audio...")

            # Iniciar transcripción con faster-whisper
            # Solicitamos marcas de tiempo por palabra si se usa el modo 'words'
            need_words = (self.segmentation_mode == "words")
            try:
                segments_gen, info = model.transcribe(
                    self.file_path,
                    language=self.language,
                    task=self.task,
                    initial_prompt=self.initial_prompt,
                    word_timestamps=need_words,
                    vad_filter=self.vad_filter,
                    beam_size=5
                )
            except Exception as e:
                # Si falla por CUDA/cuBLAS, recargar en CPU int8
                if "cublas" in str(e).lower() or "cuda" in str(e).lower():
                    print(f"[Aviso] Error en ejecución CUDA ({e}). Pasando a CPU...")
                    model = get_or_load_model(self.model_size, device="cpu", compute_type="int8")
                    segments_gen, info = model.transcribe(
                        self.file_path,
                        language=self.language,
                        task=self.task,
                        initial_prompt=self.initial_prompt,
                        word_timestamps=need_words,
                        vad_filter=self.vad_filter,
                        beam_size=5
                    )
                else:
                    raise e

            detected_language = info.language if info and hasattr(info, "language") else (self.language or "es")
            audio_dur = info.duration if info and hasattr(info, "duration") and info.duration > 0 else total_duration
            if audio_dur <= 0:
                audio_dur = 1.0

            words_buffer = []

            for segment in segments_gen:
                if self._stop_event.is_set():
                    break

                # Notificar progreso basado en el segundo alcanzado
                current_time = segment.end
                pct = min(98, max(5, int((current_time / audio_dur) * 100)))

                if need_words and segment.words:
                    for word_obj in segment.words:
                        if self._stop_event.is_set():
                            break
                        words_buffer.append(word_obj)
                        if len(words_buffer) >= self.max_words_per_line:
                            w_start = words_buffer[0].start
                            w_end = words_buffer[-1].end
                            if w_end <= w_start:
                                w_end = w_start + 0.35
                            w_text = " ".join([w.word.strip() for w in words_buffer if w.word.strip()]).strip()
                            if w_text:
                                sub_item = {
                                    "id": subtitle_id,
                                    "start": float(round(w_start, 3)),
                                    "end": float(round(w_end, 3)),
                                    "text": w_text
                                }
                                subtitles.append(sub_item)
                                subtitle_id += 1
                                if self.on_segment:
                                    self.on_segment(sub_item)
                            words_buffer = []
                else:
                    # Modo frase completa natural
                    seg_text = segment.text.strip()
                    if seg_text:
                        sub_item = {
                            "id": subtitle_id,
                            "start": float(round(segment.start, 3)),
                            "end": float(round(segment.end, 3)),
                            "text": seg_text
                        }
                        subtitles.append(sub_item)
                        subtitle_id += 1
                        if self.on_segment:
                            self.on_segment(sub_item)

                if self.on_progress:
                    snippet = segment.text.strip()[:40]
                    msg = f"Transcribiendo ({pct}%): \"{snippet}...\"" if snippet else f"Transcribiendo ({pct}%)..."
                    self.on_progress(int(pct), float(current_time), float(audio_dur), msg)

            # Vaciar remanente de palabras si quedaron en el buffer
            if words_buffer and not self._stop_event.is_set():
                w_start = words_buffer[0].start
                w_end = words_buffer[-1].end
                if w_end <= w_start:
                    w_end = w_start + 0.35
                w_text = " ".join([w.word.strip() for w in words_buffer if w.word.strip()]).strip()
                if w_text:
                    sub_item = {
                        "id": subtitle_id,
                        "start": float(round(w_start, 3)),
                        "end": float(round(w_end, 3)),
                        "text": w_text
                    }
                    subtitles.append(sub_item)
                    if self.on_segment:
                        self.on_segment(sub_item)
                words_buffer = []

            if self._stop_event.is_set():
                if self.on_progress:
                    self.on_progress(0, 0.0, float(audio_dur), "Transcripción cancelada por el usuario.")
                return

            if self.on_progress:
                self.on_progress(100, float(audio_dur), float(audio_dur), "¡Transcripción completada con éxito!")

            if self.on_complete:
                self.on_complete(subtitles, detected_language)

        except Exception as e:
            traceback.print_exc()
            err_msg = str(e)
            if "out of memory" in err_msg.lower():
                friendly = "Memoria GPU/RAM insuficiente para este modelo. Prueba seleccionando un modelo más ligero (Tiny o Base)."
            elif "av" in err_msg.lower() or "codec" in err_msg.lower():
                friendly = f"Error al decodificar audio: el archivo puede estar dañado o usar un códec no soportado ({err_msg})."
            else:
                friendly = f"Ocurrió un error durante la transcripción: {err_msg}"

            if self.on_error:
                self.on_error(friendly)
        finally:
            self.is_running = False
