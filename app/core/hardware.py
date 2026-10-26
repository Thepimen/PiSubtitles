"""
Detección de hardware y aceleración para Faster-Whisper.
Gestiona la selección automática entre GPU (CUDA) y CPU (int8),
verificando la presencia real de bibliotecas CUDA runtime en Windows.
"""
import os
import sys
import ctypes

def is_cuda_runtime_available() -> bool:
    """
    Verifica si las bibliotecas dinámicas de CUDA (cuBLAS) están realmente
    disponibles en el sistema para evitar caídas por cublas64_12.dll faltante.
    """
    if sys.platform == "win32":
        # En Windows ctranslate2 busca cublas64_12.dll o cublas64_11.dll
        for dll_name in ("cublas64_12.dll", "cublas64_11.dll"):
            try:
                ctypes.CDLL(dll_name)
                return True
            except Exception:
                continue
        return False
    return True


def get_hardware_info() -> dict:
    """
    Detecta las capacidades de cómputo del sistema para ctranslate2 / faster-whisper.
    Retorna un diccionario con device, compute_type, device_name, is_gpu y detalles.
    """
    device = "cpu"
    compute_type = "int8"
    is_gpu = False
    details = ""
    cpu_count = os.cpu_count() or 4

    try:
        import ctranslate2
        cuda_count = getattr(ctranslate2, "get_cuda_device_count", lambda: 0)()
        cuda_types = ctranslate2.get_supported_compute_types("cuda")

        if cuda_count > 0 and cuda_types and is_cuda_runtime_available():
            device = "cuda"
            is_gpu = True
            if "float16" in cuda_types:
                compute_type = "float16"
            elif "int8_float16" in cuda_types:
                compute_type = "int8_float16"
            else:
                compute_type = list(cuda_types)[0]
            details = f"Aceleración GPU NVIDIA (CUDA {compute_type})"
    except Exception:
        pass

    if not is_gpu:
        details = f"CPU {cpu_count} hilos (Cuantización int8 optimizada)"

    display_name = f"🚀 GPU NVIDIA CUDA ({compute_type})" if is_gpu else f"⚡ CPU {cpu_count} Cores (int8)"

    return {
        "device": device,
        "compute_type": compute_type,
        "is_gpu": is_gpu,
        "device_name": display_name,
        "details": details,
        "cpu_count": cpu_count
    }
