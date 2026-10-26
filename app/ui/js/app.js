/**
 * PiSubtitles Studio - Controlador Principal de Interfaz
 * Gestiona el reproductor sincronizado, edición en vivo de subtítulos,
 * eventos de arrastrar y soltar, llamadas a la API de Python y notificaciones.
 */

// Estado global de la aplicación
const state = {
  currentFile: null,        // { path, name, size_formatted, duration, duration_formatted, extension }
  subtitles: [],            // Array de { id, start, end, text }
  isTranscribing: false,
  activeSubId: null,
  segmentationMode: 'words', // 'words' o 'sentence'
  maxWords: 4,
  playbackSpeedIndex: 0,
  speeds: [1.0, 1.25, 1.5, 2.0]
};

// Elementos DOM principales
const dom = {
  hwChip: document.getElementById('hwChip'),
  hwLabel: document.getElementById('hwLabel'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  dropIdleContent: document.getElementById('dropIdleContent'),
  dropActiveFile: document.getElementById('dropActiveFile'),
  fileNameText: document.getElementById('fileNameText'),
  fileSizeText: document.getElementById('fileSizeText'),
  fileDurationText: document.getElementById('fileDurationText'),
  fileExtBadge: document.getElementById('fileExtBadge'),
  btnBrowse: document.getElementById('btnBrowse'),
  btnLoadSample: document.getElementById('btnLoadSample'),
  btnChangeFile: document.getElementById('btnChangeFile'),
  btnRemoveFile: document.getElementById('btnRemoveFile'),
  selectLanguage: document.getElementById('selectLanguage'),
  selectModel: document.getElementById('selectModel'),
  tabModeWords: document.getElementById('tabModeWords'),
  tabModeSentence: document.getElementById('tabModeSentence'),
  wordsControlBox: document.getElementById('wordsControlBox'),
  wordsSlider: document.getElementById('wordsSlider'),
  sliderValBadge: document.getElementById('sliderValBadge'),
  btnStartTranscribe: document.getElementById('btnStartTranscribe'),
  btnCancelTranscribe: document.getElementById('btnCancelTranscribe'),
  progressSection: document.getElementById('progressSection'),
  progressStatusText: document.getElementById('progressStatusText'),
  progressPercentageText: document.getElementById('progressPercentageText'),
  progressBarFill: document.getElementById('progressBarFill'),
  liveTickerText: document.getElementById('liveTickerText'),
  mainAudioElement: document.getElementById('mainAudioElement'),
  btnPlayerPlay: document.getElementById('btnPlayerPlay'),
  iconPlay: document.getElementById('iconPlay'),
  iconPause: document.getElementById('iconPause'),
  playerCurrentTime: document.getElementById('playerCurrentTime'),
  playerTotalTime: document.getElementById('playerTotalTime'),
  timelineBar: document.getElementById('timelineBar'),
  timelineFill: document.getElementById('timelineFill'),
  timelineThumb: document.getElementById('timelineThumb'),
  btnPlaybackSpeed: document.getElementById('btnPlaybackSpeed'),
  subtitlesList: document.getElementById('subtitlesList'),
  subtitlesEmpty: document.getElementById('subtitlesEmpty'),
  subtitlesCountText: document.getElementById('subtitlesCountText'),
  wordsCountText: document.getElementById('wordsCountText'),
  searchInput: document.getElementById('searchInput'),
  btnAddSubtitleRow: document.getElementById('btnAddSubtitleRow'),
  btnExportSRT: document.getElementById('btnExportSRT'),
  btnExportVTT: document.getElementById('btnExportVTT'),
  btnExportTXT: document.getElementById('btnExportTXT'),
  btnCopyClipboard: document.getElementById('btnCopyClipboard'),
  detectedLangBadge: document.getElementById('detectedLangBadge'),
  toastContainer: document.getElementById('toastContainer')
};

// ==========================================================================
// Inicialización y Detección de Hardware
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initHardwareStatus();
  setupEventListeners();
});

// Cuando pywebview está listo en window
window.addEventListener('pywebviewready', () => {
  initHardwareStatus();
});

async function initHardwareStatus() {
  try {
    if (window.pywebview?.api?.get_system_info) {
      const hw = await window.pywebview.api.get_system_info();
      updateHardwareBadge(hw);
    } else {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        updateHardwareBadge(data.hardware);
      }
    }
  } catch (err) {
    dom.hwLabel.textContent = '⚡ CPU int8 Acelerado';
  }
}

function updateHardwareBadge(hw) {
  if (!hw) return;
  dom.hwLabel.textContent = hw.device_name || (hw.is_gpu ? '🚀 GPU CUDA' : '⚡ CPU int8');
  dom.hwChip.title = hw.details || 'Aceleración Whisper lista';
  const dot = dom.hwChip.querySelector('.status-dot');
  if (dot && hw.is_gpu) {
    dot.style.backgroundColor = '#06b6d4';
    dot.style.boxShadow = '0 0 10px #06b6d4';
  }
}

// ==========================================================================
// Configuración de Eventos de Interfaz
// ==========================================================================
function setupEventListeners() {
  // Drag and Drop
  setupDragAndDrop();

  // Selección de archivo
  dom.btnBrowse.addEventListener('click', onBrowseFile);
  dom.btnChangeFile.addEventListener('click', onBrowseFile);
  dom.btnRemoveFile.addEventListener('click', clearLoadedFile);
  dom.btnLoadSample.addEventListener('click', loadSampleAudio);

  // Modo de segmentación
  dom.tabModeWords.addEventListener('click', () => setSegmentationMode('words'));
  dom.tabModeSentence.addEventListener('click', () => setSegmentationMode('sentence'));

  // Slider de palabras
  dom.wordsSlider.addEventListener('input', (e) => {
    setWordsPerLine(parseInt(e.target.value, 10));
  });

  // Chips predefinidos de palabras
  document.querySelectorAll('.preset-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setWordsPerLine(parseInt(btn.dataset.val, 10));
    });
  });

  // Botón iniciar / cancelar transcripción
  dom.btnStartTranscribe.addEventListener('click', startTranscription);
  dom.btnCancelTranscribe.addEventListener('click', cancelTranscription);

  // Reproductor de audio
  setupAudioPlayer();

  // Búsqueda en subtítulos
  dom.searchInput.addEventListener('input', (e) => {
    filterSubtitles(e.target.value.toLowerCase());
  });

  // Añadir fila
  dom.btnAddSubtitleRow.addEventListener('click', addNewSubtitleRow);

  // Exportaciones
  dom.btnExportSRT.addEventListener('click', () => exportSubtitles('srt'));
  dom.btnExportVTT.addEventListener('click', () => exportSubtitles('vtt'));
  dom.btnExportTXT.addEventListener('click', () => exportSubtitles('txt'));
  dom.btnCopyClipboard.addEventListener('click', copySubtitlesToClipboard);

  // Teclado: Espacio para reproducir/pausar audio
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      toggleAudioPlay();
    }
  });
}

// ==========================================================================
// Drag & Drop
// ==========================================================================
function setupDragAndDrop() {
  const zone = dom.dropZone;

  ['dragenter', 'dragover'].forEach(name => {
    window.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    window.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
    });
  });

  zone.addEventListener('drop', async (e) => {
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Si el entorno WebView expone file.path directamente
    if (file.path) {
      loadFileFromPath(file.path);
    } else {
      // Subir archivo al servidor local de fondo
      await uploadFileToServer(file);
    }
  });
}

async function onBrowseFile() {
  try {
    if (window.pywebview?.api?.choose_file) {
      const res = await window.pywebview.api.choose_file();
      if (res && res.success && res.file_info) {
        applyLoadedFile(res.file_info);
      }
    } else {
      dom.fileInput.click();
    }
  } catch (err) {
    showToast('Error al seleccionar', err.message, 'error');
  }
}

dom.fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    await uploadFileToServer(files[0]);
  }
});

async function uploadFileToServer(file) {
  showToast('Cargando archivo', `Procesando ${file.name}...`, 'info', 2000);
  try {
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      body: file
    });
    const data = await res.json();
    if (data.success && data.file_info) {
      applyLoadedFile(data.file_info);
    } else {
      showToast('Error al cargar', data.error || 'Formato no compatible', 'error');
    }
  } catch (err) {
    showToast('Error de subida', err.message, 'error');
  }
}

async function loadFileFromPath(path) {
  try {
    if (window.pywebview?.api?.get_file_details) {
      const info = await window.pywebview.api.get_file_details(path);
      applyLoadedFile(info);
    }
  } catch (err) {
    showToast('Error al leer archivo', err.message, 'error');
  }
}

async function loadSampleAudio() {
  try {
    if (window.pywebview?.api?.load_sample) {
      const info = await window.pywebview.api.load_sample();
      if (info) {
        applyLoadedFile(info);
        showToast('Muestra cargada', 'Audio de prueba listo para transcribir', 'success');
      }
    }
  } catch (err) {
    showToast('Aviso', 'Carga manualmente un archivo MP3 o vídeo.', 'warning');
  }
}

function applyLoadedFile(info) {
  state.currentFile = info;
  dom.fileNameText.textContent = info.name;
  dom.fileSizeText.textContent = info.size_formatted;
  dom.fileDurationText.textContent = info.duration_formatted || '00:00';
  dom.fileExtBadge.textContent = (info.extension || 'MP3').replace('.', '').toUpperCase();

  dom.dropIdleContent.style.display = 'none';
  dom.dropActiveFile.style.display = 'block';
  dom.btnStartTranscribe.disabled = false;

  // Configurar reproductor de audio con streaming local
  const mediaUrl = `/api/media?file=${encodeURIComponent(info.path)}`;
  dom.mainAudioElement.src = mediaUrl;
  dom.playerTotalTime.textContent = info.duration_formatted || '00:00';

  showToast('Archivo listo', `${info.name} cargado correctamente`, 'success', 3000);
}

function clearLoadedFile() {
  state.currentFile = null;
  dom.dropIdleContent.style.display = 'flex';
  dom.dropActiveFile.style.display = 'none';
  dom.btnStartTranscribe.disabled = true;
  dom.mainAudioElement.pause();
  dom.mainAudioElement.src = '';
  dom.playerCurrentTime.textContent = '00:00';
  dom.playerTotalTime.textContent = '00:00';
  dom.timelineFill.style.width = '0%';
}

// ==========================================================================
// Configuración de Modos de Segmentación
// ==========================================================================
function setSegmentationMode(mode) {
  state.segmentationMode = mode;
  if (mode === 'words') {
    dom.tabModeWords.classList.add('active');
    dom.tabModeSentence.classList.remove('active');
    dom.wordsControlBox.style.display = 'block';
  } else {
    dom.tabModeSentence.classList.add('active');
    dom.tabModeWords.classList.remove('active');
    dom.wordsControlBox.style.display = 'none';
  }
}

function setWordsPerLine(count) {
  state.maxWords = count;
  dom.wordsSlider.value = count;
  dom.sliderValBadge.textContent = `${count} palabras`;

  document.querySelectorAll('.preset-chips .chip-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.val, 10) === count);
  });
}

// ==========================================================================
// Transcripción con Faster-Whisper
// ==========================================================================
async function startTranscription() {
  if (!state.currentFile) {
    showToast('Sin archivo', 'Selecciona o arrastra un audio o vídeo primero.', 'warning');
    return;
  }

  state.isTranscribing = true;
  state.subtitles = [];
  renderSubtitlesTable();

  // Actualizar UI
  dom.btnStartTranscribe.style.display = 'none';
  dom.btnCancelTranscribe.style.display = 'inline-flex';
  dom.progressSection.style.display = 'block';
  dom.progressBarFill.style.width = '3%';
  dom.progressPercentageText.textContent = '3%';
  dom.progressStatusText.textContent = 'Iniciando modelo Whisper...';
  dom.liveTickerText.textContent = 'Cargando red neuronal...';

  const config = {
    file_path: state.currentFile.path,
    model_size: dom.selectModel.value,
    language: dom.selectLanguage.value,
    segmentation_mode: state.segmentationMode,
    max_words_per_line: state.maxWords,
    vad_filter: true
  };

  try {
    if (window.pywebview?.api?.start_transcription) {
      await window.pywebview.api.start_transcription(config);
    } else {
      showToast('Error', 'API de Python no disponible', 'error');
      finishTranscriptionState();
    }
  } catch (err) {
    showToast('Error al iniciar', err.message, 'error');
    finishTranscriptionState();
  }
}

async function cancelTranscription() {
  try {
    if (window.pywebview?.api?.cancel_transcription) {
      await window.pywebview.api.cancel_transcription();
      showToast('Cancelado', 'Transcripción interrumpida por el usuario.', 'warning');
    }
  } catch (err) {
    console.error(err);
  }
  finishTranscriptionState();
}

function finishTranscriptionState() {
  state.isTranscribing = false;
  dom.btnStartTranscribe.style.display = 'inline-flex';
  dom.btnCancelTranscribe.style.display = 'none';
  setTimeout(() => {
    dom.progressSection.style.display = 'none';
  }, 1200);
}

// Callbacks globales invocados por Python via evaluate_js
window.__onProgress = function(data) {
  if (!state.isTranscribing) return;
  const pct = Math.max(0, Math.min(100, data.percent || 0));
  dom.progressBarFill.style.width = `${pct}%`;
  dom.progressPercentageText.textContent = `${pct}%`;
  if (data.message) {
    dom.progressStatusText.textContent = data.message;
    dom.liveTickerText.textContent = data.message;
  }
};

window.__onSegment = function(sub) {
  state.subtitles.push(sub);
  appendSubtitleRow(sub);
  updateSubtitlesStats();

  // Scroll suave al último elemento durante la transcripción
  dom.subtitlesList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.__onComplete = function(data) {
  finishTranscriptionState();
  if (data.subtitles && Array.isArray(data.subtitles)) {
    state.subtitles = data.subtitles;
    renderSubtitlesTable();
  }
  if (data.language) {
    dom.detectedLangBadge.textContent = data.language.toUpperCase();
  }
  showToast('¡Listo!', `Transcripción finalizada: ${state.subtitles.length} subtítulos generados.`, 'success', 5000);
};

window.__onError = function(data) {
  finishTranscriptionState();
  showToast('Error de Transcripción', data.error || 'Ocurrió un problema.', 'error', 6000);
};

// ==========================================================================
// Editor de Subtítulos & Renderizado Dinámico
// ==========================================================================
function renderSubtitlesTable() {
  dom.subtitlesList.innerHTML = '';
  if (!state.subtitles || state.subtitles.length === 0) {
    dom.subtitlesEmpty.style.display = 'flex';
    dom.subtitlesList.appendChild(dom.subtitlesEmpty);
    updateSubtitlesStats();
    return;
  }

  dom.subtitlesEmpty.style.display = 'none';
  state.subtitles.forEach((sub, idx) => {
    sub.id = idx + 1;
    appendSubtitleRow(sub);
  });
  updateSubtitlesStats();
}

function appendSubtitleRow(sub) {
  if (dom.subtitlesEmpty && dom.subtitlesEmpty.parentNode === dom.subtitlesList) {
    dom.subtitlesEmpty.style.display = 'none';
  }

  const row = document.createElement('div');
  row.className = 'sub-row';
  row.dataset.id = sub.id;
  row.dataset.start = sub.start;
  row.dataset.end = sub.end;

  row.innerHTML = `
    <span class="sub-idx">#${sub.id}</span>
    <div class="sub-times-wrap">
      <input type="text" class="sub-time-input sub-start" value="${formatTimeSRT(sub.start)}" title="Tiempo inicial">
      <span class="time-arrow">➔</span>
      <input type="text" class="sub-time-input sub-end" value="${formatTimeSRT(sub.end)}" title="Tiempo final">
    </div>
    <div class="sub-text-wrap">
      <input type="text" class="sub-text-input" value="${escapeHtml(sub.text)}" title="Editar texto">
    </div>
    <div class="sub-actions">
      <button type="button" class="btn-icon btn-play-sub" title="Escuchar este subtítulo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>
      <button type="button" class="btn-icon btn-icon-danger btn-del-sub" title="Eliminar fila">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;

  // Eventos de edición de la fila
  const textInput = row.querySelector('.sub-text-input');
  textInput.addEventListener('input', (e) => {
    sub.text = e.target.value;
    updateSubtitlesStats();
  });

  const startInput = row.querySelector('.sub-start');
  startInput.addEventListener('change', (e) => {
    sub.start = parseTimeToSeconds(e.target.value);
    row.dataset.start = sub.start;
  });

  const endInput = row.querySelector('.sub-end');
  endInput.addEventListener('change', (e) => {
    sub.end = parseTimeToSeconds(e.target.value);
    row.dataset.end = sub.end;
  });

  const btnPlay = row.querySelector('.btn-play-sub');
  btnPlay.addEventListener('click', () => {
    playSubtitleSegment(sub.start, sub.end);
  });

  const btnDel = row.querySelector('.btn-del-sub');
  btnDel.addEventListener('click', () => {
    deleteSubtitleRow(sub.id);
  });

  dom.subtitlesList.appendChild(row);
}

function addNewSubtitleRow() {
  const lastSub = state.subtitles[state.subtitles.length - 1];
  const newStart = lastSub ? lastSub.end : 0.0;
  const newEnd = newStart + 2.0;

  const newSub = {
    id: state.subtitles.length + 1,
    start: Math.round(newStart * 100) / 100,
    end: Math.round(newEnd * 100) / 100,
    text: 'Nuevo subtítulo'
  };

  state.subtitles.push(newSub);
  appendSubtitleRow(newSub);
  updateSubtitlesStats();

  const newRow = dom.subtitlesList.lastElementChild;
  newRow?.scrollIntoView({ behavior: 'smooth' });
  newRow?.querySelector('.sub-text-input')?.focus();
}

function deleteSubtitleRow(id) {
  state.subtitles = state.subtitles.filter(s => s.id !== id);
  renderSubtitlesTable();
}

function filterSubtitles(query) {
  const rows = dom.subtitlesList.querySelectorAll('.sub-row');
  rows.forEach(row => {
    const text = row.querySelector('.sub-text-input')?.value.toLowerCase() || '';
    row.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

function updateSubtitlesStats() {
  const count = state.subtitles.length;
  let words = 0;
  state.subtitles.forEach(s => {
    if (s.text) {
      words += s.text.trim().split(/\s+/).filter(Boolean).length;
    }
  });

  dom.subtitlesCountText.textContent = `${count} subtítulo${count === 1 ? '' : 's'}`;
  dom.wordsCountText.textContent = `${words} palabra${words === 1 ? '' : 's'}`;
}

// ==========================================================================
// Reproductor de Audio Sincronizado
// ==========================================================================
function setupAudioPlayer() {
  const audio = dom.mainAudioElement;

  dom.btnPlayerPlay.addEventListener('click', toggleAudioPlay);

  audio.addEventListener('play', () => {
    dom.iconPlay.style.display = 'none';
    dom.iconPause.style.display = 'block';
  });

  audio.addEventListener('pause', () => {
    dom.iconPlay.style.display = 'block';
    dom.iconPause.style.display = 'none';
  });

  audio.addEventListener('timeupdate', () => {
    const cur = audio.currentTime;
    const dur = audio.duration || state.currentFile?.duration || 1;
    dom.playerCurrentTime.textContent = formatTimeDisplay(cur);

    const pct = Math.min(100, (cur / dur) * 100);
    dom.timelineFill.style.width = `${pct}%`;
    dom.timelineThumb.style.left = `${pct}%`;

    highlightActiveSubtitle(cur);
  });

  // Salto al hacer clic en la línea de tiempo
  dom.timelineBar.parentElement.addEventListener('click', (e) => {
    const rect = dom.timelineBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const dur = audio.duration || state.currentFile?.duration || 0;
    audio.currentTime = ratio * dur;
  });

  // Selector de velocidad
  dom.btnPlaybackSpeed.addEventListener('click', () => {
    state.playbackSpeedIndex = (state.playbackSpeedIndex + 1) % state.speeds.length;
    const speed = state.speeds[state.playbackSpeedIndex];
    audio.playbackRate = speed;
    dom.btnPlaybackSpeed.textContent = `${speed.toFixed(1)}x`;
  });
}

function toggleAudioPlay() {
  const audio = dom.mainAudioElement;
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function playSubtitleSegment(startSec, endSec) {
  const audio = dom.mainAudioElement;
  if (!audio.src) return;
  audio.currentTime = startSec;
  audio.play();
}

function highlightActiveSubtitle(time) {
  let matchedId = null;
  for (const sub of state.subtitles) {
    if (time >= sub.start && time <= sub.end) {
      matchedId = sub.id;
      break;
    }
  }

  if (matchedId === state.activeSubId) return;
  state.activeSubId = matchedId;

  document.querySelectorAll('.sub-row').forEach(row => {
    const isCur = parseInt(row.dataset.id, 10) === matchedId;
    row.classList.toggle('active', isCur);
    if (isCur) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

// ==========================================================================
// Exportación (.SRT, .VTT, .TXT y Portapapeles)
// ==========================================================================
async function exportSubtitles(format) {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Sin subtítulos', 'Genera o añade subtítulos antes de exportar.', 'warning');
    return;
  }

  const baseName = state.currentFile?.stem || 'subtitulos';
  const defaultFilename = `${baseName}.${format}`;

  try {
    if (window.pywebview?.api?.export_file) {
      const res = await window.pywebview.api.export_file(format, state.subtitles, defaultFilename);
      if (res && res.success) {
        showToast('Archivo guardado', `Exportado con éxito: ${res.path}`, 'success', 5000);
      }
    } else {
      // Fallback de descarga directa en navegador
      downloadDirectFile(format, defaultFilename);
    }
  } catch (err) {
    showToast('Error al exportar', err.message, 'error');
  }
}

function downloadDirectFile(format, filename) {
  let content = '';
  if (format === 'srt') {
    content = generateSRT(state.subtitles);
  } else if (format === 'vtt') {
    content = generateVTT(state.subtitles);
  } else {
    content = state.subtitles.map(s => s.text).join('\n');
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Descargado', `Archivo ${filename} generado`, 'success');
}

function copySubtitlesToClipboard() {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Aviso', 'No hay subtítulos para copiar', 'warning');
    return;
  }
  const text = state.subtitles.map(s => s.text).join(' ');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado', 'Texto de la transcripción copiado al portapapeles', 'success');
  }).catch(err => {
    showToast('Error', 'No se pudo copiar al portapapeles', 'error');
  });
}

// ==========================================================================
// Generadores de Formato
// ==========================================================================
function generateSRT(subs) {
  return subs.map((s, idx) => {
    return `${idx + 1}\n${formatTimeSRT(s.start)} --> ${formatTimeSRT(s.end)}\n${s.text}\n`;
  }).join('\n');
}

function generateVTT(subs) {
  const body = subs.map((s, idx) => {
    return `${idx + 1}\n${formatTimeVTT(s.start)} --> ${formatTimeVTT(s.end)}\n${s.text}\n`;
  }).join('\n');
  return `WEBVTT\n\n${body}`;
}

// ==========================================================================
// Utilidades de Tiempo y Formato
// ==========================================================================
function formatTimeSRT(sec) {
  sec = Math.max(0, parseFloat(sec) || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatTimeVTT(sec) {
  sec = Math.max(0, parseFloat(sec) || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function formatTimeDisplay(sec) {
  sec = Math.max(0, parseFloat(sec) || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function parseTimeToSeconds(str) {
  if (!str) return 0.0;
  str = String(str).trim().replace(',', '.');
  const parts = str.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(str) || 0.0;
}

function pad(num, size = 2) {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==========================================================================
// Sistema de Notificaciones Toast
// ==========================================================================
function showToast(title, desc, type = 'success', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-body">
      <h5 class="toast-title">${escapeHtml(title)}</h5>
      <p class="toast-desc">${escapeHtml(desc)}</p>
    </div>
    <button type="button" class="toast-close">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    removeToast(toast);
  }, duration);
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.style.animation = 'toast-slide-in 0.25s reverse forwards';
  setTimeout(() => {
    toast.remove();
  }, 250);
}
