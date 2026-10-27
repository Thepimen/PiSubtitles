/**
 * PiSubtitles Studio v2.0 - Controlador Principal de Interfaz
 * Incluye Simulador Visual 9:16 y 16:9, Plantillas Virales (.ASS),
 * Espectro de Audio en Tiempo Real, Historial Undo/Redo, Split/Merge,
 * Time-Shift, CPS Semáforo, Quemado de Vídeo MP4 y Autoguardado.
 */

const state = {
  currentFile: null,
  subtitles: [],
  undoStack: [],
  redoStack: [],
  isTranscribing: false,
  activeSubId: null,
  segmentationMode: 'words',
  maxWords: 4,
  playbackSpeedIndex: 0,
  speeds: [1.0, 1.25, 1.5, 2.0],
  styleOptions: {
    preset: 'hormozi',
    aspect_ratio: '9:16',
    position: 'bottom',
    font_size: 62
  }
};

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
  fileTypeTag: document.getElementById('fileTypeTag'),
  btnBrowse: document.getElementById('btnBrowse'),
  btnLoadSample: document.getElementById('btnLoadSample'),
  btnChangeFile: document.getElementById('btnChangeFile'),
  btnRemoveFile: document.getElementById('btnRemoveFile'),
  btnQuickSaveSource: document.getElementById('btnQuickSaveSource'),
  btnImportSRT: document.getElementById('btnImportSRT'),
  btnYoutubeChapters: document.getElementById('btnYoutubeChapters'),
  btnShortcutsModal: document.getElementById('btnShortcutsModal'),
  selectLanguage: document.getElementById('selectLanguage'),
  selectModel: document.getElementById('selectModel'),
  selectTask: document.getElementById('selectTask'),
  inputInitialPrompt: document.getElementById('inputInitialPrompt'),
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
  btnSeekBack: document.getElementById('btnSeekBack'),
  btnSeekForward: document.getElementById('btnSeekForward'),
  iconPlay: document.getElementById('iconPlay'),
  iconPause: document.getElementById('iconPause'),
  playerCurrentTime: document.getElementById('playerCurrentTime'),
  playerTotalTime: document.getElementById('playerTotalTime'),
  timelineBar: document.getElementById('timelineBar'),
  timelineFill: document.getElementById('timelineFill'),
  timelineThumb: document.getElementById('timelineThumb'),
  audioSpectrumCanvas: document.getElementById('audioSpectrumCanvas'),
  btnPlaybackSpeed: document.getElementById('btnPlaybackSpeed'),
  btnUndo: document.getElementById('btnUndo'),
  btnRedo: document.getElementById('btnRedo'),
  btnTransformUpper: document.getElementById('btnTransformUpper'),
  btnTransformSentence: document.getElementById('btnTransformSentence'),
  btnTransformCleanPunct: document.getElementById('btnTransformCleanPunct'),
  searchInput: document.getElementById('searchInput'),
  btnToggleReplace: document.getElementById('btnToggleReplace'),
  replaceBar: document.getElementById('replaceBar'),
  replaceFindInput: document.getElementById('replaceFindInput'),
  replaceWithInput: document.getElementById('replaceWithInput'),
  btnApplyReplaceAll: document.getElementById('btnApplyReplaceAll'),
  btnCloseReplace: document.getElementById('btnCloseReplace'),
  subtitlesList: document.getElementById('subtitlesList'),
  subtitlesEmpty: document.getElementById('subtitlesEmpty'),
  subtitlesCountText: document.getElementById('subtitlesCountText'),
  wordsCountText: document.getElementById('wordsCountText'),
  wpmCountText: document.getElementById('wpmCountText'),
  btnAddSubtitleRow: document.getElementById('btnAddSubtitleRow'),
  btnExportSRT: document.getElementById('btnExportSRT'),
  btnExportASS: document.getElementById('btnExportASS'),
  btnExportVTT: document.getElementById('btnExportVTT'),
  btnExportTXT: document.getElementById('btnExportTXT'),
  btnExportJSON: document.getElementById('btnExportJSON'),
  btnBurnVideo: document.getElementById('btnBurnVideo'),
  btnCopyClipboard: document.getElementById('btnCopyClipboard'),
  btnAspect916: document.getElementById('btnAspect916'),
  btnAspect169: document.getElementById('btnAspect169'),
  previewStage: document.getElementById('previewStage'),
  previewVideoElement: document.getElementById('previewVideoElement'),
  previewBackdropDecor: document.getElementById('previewBackdropDecor'),
  previewSubtitleOverlay: document.getElementById('previewSubtitleOverlay'),
  previewSubtitleText: document.getElementById('previewSubtitleText'),
  selectStylePreset: document.getElementById('selectStylePreset'),
  detectedLangBadge: document.getElementById('detectedLangBadge'),
  autosaveStatusText: document.getElementById('autosaveStatusText'),
  modalYoutube: document.getElementById('modalYoutube'),
  youtubeChaptersTextarea: document.getElementById('youtubeChaptersTextarea'),
  btnCopyYoutubeChapters: document.getElementById('btnCopyYoutubeChapters'),
  btnCloseYoutubeModal: document.getElementById('btnCloseYoutubeModal'),
  btnCloseYoutubeModal2: document.getElementById('btnCloseYoutubeModal2'),
  modalShortcuts: document.getElementById('modalShortcuts'),
  btnCloseShortcutsModal: document.getElementById('btnCloseShortcutsModal'),
  btnCloseShortcutsModal2: document.getElementById('btnCloseShortcutsModal2'),
  toastContainer: document.getElementById('toastContainer')
};

// Contexto Web Audio para el visualizador de espectro
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let spectrumAnimId = null;

// ==========================================================================
// Inicialización
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initHardwareStatus();
  setupEventListeners();
  restoreSessionFromStorage();
  drawIdleSpectrum();
});

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
}

// ==========================================================================
// Eventos de Interfaz y Atajos de Teclado
// ==========================================================================
function setupEventListeners() {
  setupDragAndDrop();

  dom.btnBrowse.addEventListener('click', onBrowseFile);
  dom.btnChangeFile.addEventListener('click', onBrowseFile);
  dom.btnRemoveFile.addEventListener('click', clearLoadedFile);
  dom.btnLoadSample.addEventListener('click', loadSampleAudio);
  dom.btnQuickSaveSource.addEventListener('click', quickSaveNextToSource);
  dom.btnImportSRT.addEventListener('click', importExistingSRT);

  // Segmentación
  dom.tabModeWords.addEventListener('click', () => setSegmentationMode('words'));
  dom.tabModeSentence.addEventListener('click', () => setSegmentationMode('sentence'));

  dom.wordsSlider.addEventListener('input', (e) => {
    setWordsPerLine(parseInt(e.target.value, 10));
  });

  document.querySelectorAll('.preset-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setWordsPerLine(parseInt(btn.dataset.val, 10));
    });
  });

  // Transcripción
  dom.btnStartTranscribe.addEventListener('click', startTranscription);
  dom.btnCancelTranscribe.addEventListener('click', cancelTranscription);

  // Reproductor
  setupAudioPlayer();

  // Historial Undo / Redo
  dom.btnUndo.addEventListener('click', undo);
  dom.btnRedo.addEventListener('click', redo);

  // Time-Shift Global
  document.querySelectorAll('[data-shift]').forEach(btn => {
    btn.addEventListener('click', () => {
      shiftAllTimestamps(parseFloat(btn.dataset.shift));
    });
  });

  // Transformaciones de texto
  dom.btnTransformUpper.addEventListener('click', () => transformAllText('upper'));
  dom.btnTransformSentence.addEventListener('click', () => transformAllText('sentence'));
  dom.btnTransformCleanPunct.addEventListener('click', () => transformAllText('clean_punct'));

  // Búsqueda y Reemplazar
  dom.searchInput.addEventListener('input', (e) => {
    filterSubtitles(e.target.value.toLowerCase());
  });
  dom.btnToggleReplace.addEventListener('click', () => {
    const visible = dom.replaceBar.style.display !== 'none';
    dom.replaceBar.style.display = visible ? 'none' : 'flex';
    if (!visible) dom.replaceFindInput.focus();
  });
  dom.btnCloseReplace.addEventListener('click', () => {
    dom.replaceBar.style.display = 'none';
  });
  dom.btnApplyReplaceAll.addEventListener('click', applyReplaceAll);

  // Añadir fila
  dom.btnAddSubtitleRow.addEventListener('click', addNewSubtitleRow);

  // Exportaciones
  dom.btnExportSRT.addEventListener('click', () => exportSubtitles('srt'));
  dom.btnExportASS.addEventListener('click', () => exportSubtitles('ass'));
  dom.btnExportVTT.addEventListener('click', () => exportSubtitles('vtt'));
  dom.btnExportTXT.addEventListener('click', () => exportSubtitles('txt'));
  dom.btnExportJSON.addEventListener('click', () => exportSubtitles('json'));
  dom.btnBurnVideo.addEventListener('click', burnVideoSubtitles);
  dom.btnCopyClipboard.addEventListener('click', copySubtitlesToClipboard);

  // Controles del Simulador Visual (9:16 vs 16:9, Presets, Posición)
  dom.btnAspect916.addEventListener('click', () => setPreviewAspect('9:16'));
  dom.btnAspect169.addEventListener('click', () => setPreviewAspect('16:9'));
  dom.selectStylePreset.addEventListener('change', (e) => {
    setPreviewPreset(e.target.value);
  });
  document.querySelectorAll('.pos-buttons .btn-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      setPreviewPosition(btn.dataset.pos);
    });
  });

  // Modales YouTube y Atajos
  dom.btnYoutubeChapters.addEventListener('click', openYoutubeChaptersModal);
  dom.btnCloseYoutubeModal.addEventListener('click', () => dom.modalYoutube.style.display = 'none');
  dom.btnCloseYoutubeModal2.addEventListener('click', () => dom.modalYoutube.style.display = 'none');
  dom.btnCopyYoutubeChapters.addEventListener('click', () => {
    navigator.clipboard.writeText(dom.youtubeChaptersTextarea.value);
    showToast('Capítulos copiados', 'Listos para pegar en tu descripción de YouTube', 'success');
  });

  dom.btnShortcutsModal.addEventListener('click', () => dom.modalShortcuts.style.display = 'flex');
  dom.btnCloseShortcutsModal.addEventListener('click', () => dom.modalShortcuts.style.display = 'none');
  dom.btnCloseShortcutsModal2.addEventListener('click', () => dom.modalShortcuts.style.display = 'none');

  // Atajos de teclado globales
  window.addEventListener('keydown', (e) => {
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      quickSaveNextToSource();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'z' && !isInput) {
      e.preventDefault();
      undo();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'y' && !isInput) {
      e.preventDefault();
      redo();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      dom.searchInput.focus();
      return;
    }
    if (e.altKey && e.code === 'ArrowLeft') {
      e.preventDefault();
      seekRelative(-2);
      return;
    }
    if (e.altKey && e.code === 'ArrowRight') {
      e.preventDefault();
      seekRelative(2);
      return;
    }
    if (e.code === 'Space' && !isInput) {
      e.preventDefault();
      toggleAudioPlay();
    }
  });
}

// ==========================================================================
// Historial Undo / Redo & Autoguardado Local
// ==========================================================================
function pushUndoState() {
  const snapshot = JSON.stringify(state.subtitles);
  if (state.undoStack.length > 0 && state.undoStack[state.undoStack.length - 1] === snapshot) {
    return;
  }
  state.undoStack.push(snapshot);
  if (state.undoStack.length > 50) state.undoStack.shift();
  state.redoStack = [];
  updateUndoRedoButtons();
  saveSessionToStorage();
}

function undo() {
  if (state.undoStack.length === 0) return;
  state.redoStack.push(JSON.stringify(state.subtitles));
  const prev = state.undoStack.pop();
  state.subtitles = JSON.parse(prev);
  renderSubtitlesTable();
  updateUndoRedoButtons();
  saveSessionToStorage();
  showToast('Deshacer', 'Cambio revertido', 'info', 1800);
}

function redo() {
  if (state.redoStack.length === 0) return;
  state.undoStack.push(JSON.stringify(state.subtitles));
  const next = state.redoStack.pop();
  state.subtitles = JSON.parse(next);
  renderSubtitlesTable();
  updateUndoRedoButtons();
  saveSessionToStorage();
  showToast('Rehacer', 'Cambio restaurado', 'info', 1800);
}

function updateUndoRedoButtons() {
  dom.btnUndo.disabled = state.undoStack.length === 0;
  dom.btnRedo.disabled = state.redoStack.length === 0;
}

function saveSessionToStorage() {
  try {
    localStorage.setItem('pisubtitles_autosave_subs', JSON.stringify(state.subtitles));
    const now = new Date();
    dom.autosaveStatusText.textContent = `Autoguardado: ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  } catch (e) {}
}

function restoreSessionFromStorage() {
  try {
    const saved = localStorage.getItem('pisubtitles_autosave_subs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.subtitles = parsed;
        renderSubtitlesTable();
      }
    }
  } catch (e) {}
}

// ==========================================================================
// Drag & Drop y Carga de Archivos
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

    if (file.name.toLowerCase().endsWith('.srt')) {
      const text = await file.text();
      importSrtTextClient(text, file.name);
      return;
    }

    if (file.path) {
      loadFileFromPath(file.path);
    } else {
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
  dom.fileExtBadge.textContent = (info.extension || 'MP4').replace('.', '').toUpperCase();
  dom.fileTypeTag.textContent = info.is_video ? '🎬 Vídeo listo' : '🎵 Audio listo';

  dom.dropIdleContent.style.display = 'none';
  dom.dropActiveFile.style.display = 'block';
  dom.btnStartTranscribe.disabled = false;

  const mediaUrl = `/api/media?file=${encodeURIComponent(info.path)}`;
  dom.mainAudioElement.src = mediaUrl;
  dom.playerTotalTime.textContent = info.duration_formatted || '00:00';

  if (info.is_video) {
    dom.previewVideoElement.src = mediaUrl;
    dom.previewVideoElement.style.display = 'block';
    dom.previewBackdropDecor.style.display = 'none';
  } else {
    dom.previewVideoElement.src = '';
    dom.previewVideoElement.style.display = 'none';
    dom.previewBackdropDecor.style.display = 'flex';
  }

  updateSubtitlesStats();
  showToast('Archivo cargado', `${info.name} listo en el estudio`, 'success', 2800);
}

function clearLoadedFile() {
  state.currentFile = null;
  dom.dropIdleContent.style.display = 'flex';
  dom.dropActiveFile.style.display = 'none';
  dom.btnStartTranscribe.disabled = true;
  dom.mainAudioElement.pause();
  dom.mainAudioElement.src = '';
  dom.previewVideoElement.src = '';
  dom.previewVideoElement.style.display = 'none';
  dom.previewBackdropDecor.style.display = 'flex';
  dom.playerCurrentTime.textContent = '00:00';
  dom.playerTotalTime.textContent = '00:00';
  dom.timelineFill.style.width = '0%';
}

// ==========================================================================
// Importación de .SRT Existente
// ==========================================================================
async function importExistingSRT() {
  try {
    if (window.pywebview?.api?.import_srt) {
      const res = await window.pywebview.api.import_srt();
      if (res && res.success && Array.isArray(res.subtitles)) {
        pushUndoState();
        state.subtitles = res.subtitles;
        renderSubtitlesTable();
        saveSessionToStorage();
        showToast('SRT Importado', `${res.subtitles.length} subtítulos cargados en el editor`, 'success');
      }
    }
  } catch (err) {
    showToast('Error al importar SRT', err.message, 'error');
  }
}

function importSrtTextClient(content, filename) {
  pushUndoState();
  const blocks = content.trim().split(/\n\s*\n/);
  const subs = [];
  let id = 1;
  blocks.forEach(block => {
    const lines = block.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex(l => l.includes('-->'));
    if (timeIdx !== -1) {
      const parts = lines[timeIdx].split('-->');
      const start = parseTimeToSeconds(parts[0]);
      const end = parseTimeToSeconds(parts[1]);
      const text = lines.slice(timeIdx + 1).join(' ');
      if (text) subs.push({ id: id++, start, end, text });
    }
  });
  if (subs.length > 0) {
    state.subtitles = subs;
    renderSubtitlesTable();
    saveSessionToStorage();
    showToast('SRT Importado', `${subs.length} subtítulos cargados de ${filename}`, 'success');
  }
}

// ==========================================================================
// Modos de Segmentación
// ==========================================================================
function setSegmentationMode(mode) {
  state.segmentationMode = mode;
  dom.tabModeWords.classList.toggle('active', mode === 'words');
  dom.tabModeSentence.classList.toggle('active', mode === 'sentence');
  dom.wordsControlBox.style.display = mode === 'words' ? 'flex' : 'none';
}

function setWordsPerLine(count) {
  state.maxWords = count;
  dom.wordsSlider.value = count;
  dom.sliderValBadge.textContent = `${count} pal.`;

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

  pushUndoState();
  state.isTranscribing = true;
  state.subtitles = [];
  renderSubtitlesTable();

  dom.btnStartTranscribe.style.display = 'none';
  dom.btnCancelTranscribe.style.display = 'inline-flex';
  dom.progressSection.style.display = 'block';
  dom.progressBarFill.style.width = '3%';
  dom.progressPercentageText.textContent = '3%';
  dom.progressStatusText.textContent = 'Iniciando motor Faster-Whisper...';
  dom.liveTickerText.textContent = 'Preparando red neuronal...';

  const config = {
    file_path: state.currentFile.path,
    model_size: dom.selectModel.value,
    language: dom.selectLanguage.value,
    task: dom.selectTask.value,
    initial_prompt: dom.inputInitialPrompt.value,
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
  } catch (err) {}
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
  dom.previewSubtitleText.textContent = sub.text;
  dom.subtitlesList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.__onComplete = function(data) {
  finishTranscriptionState();
  if (data.subtitles && Array.isArray(data.subtitles)) {
    state.subtitles = data.subtitles;
    renderSubtitlesTable();
    saveSessionToStorage();
  }
  if (data.language) {
    dom.detectedLangBadge.textContent = data.language.toUpperCase();
  }
  showToast('¡Transcripción lista!', `${state.subtitles.length} subtítulos generados con éxito.`, 'success', 5000);
};

window.__onError = function(data) {
  finishTranscriptionState();
  showToast('Error de Transcripción', data.error || 'Ocurrió un problema.', 'error', 6000);
};

// ==========================================================================
// Editor de Subtítulos, Métricas CPS y Herramientas Split / Merge
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

function computeCPSInfo(sub) {
  const dur = Math.max(0.25, (sub.end || 0) - (sub.start || 0));
  const chars = (sub.text || '').trim().length;
  const cps = Math.round(chars / dur);
  let cls = 'cps-good';
  let label = 'Velocidad de lectura óptima (<17 CPS)';
  if (cps > 22) {
    cls = 'cps-bad';
    label = 'Muy rápido (>22 CPS). Se recomienda dividir (✂️)';
  } else if (cps >= 17) {
    cls = 'cps-warn';
    label = 'Lectura rápida (17-22 CPS)';
  }
  return { cps, cls, label };
}

function appendSubtitleRow(sub) {
  if (dom.subtitlesEmpty && dom.subtitlesEmpty.parentNode === dom.subtitlesList) {
    dom.subtitlesEmpty.style.display = 'none';
  }

  const cpsInfo = computeCPSInfo(sub);
  const row = document.createElement('div');
  row.className = 'sub-row';
  row.dataset.id = sub.id;

  row.innerHTML = `
    <span class="sub-idx">#${sub.id}</span>
    <div class="sub-times-wrap">
      <input type="text" class="sub-time-input sub-start" value="${formatTimeSRT(sub.start)}" title="Inicio">
      <span class="time-arrow">➔</span>
      <input type="text" class="sub-time-input sub-end" value="${formatTimeSRT(sub.end)}" title="Fin">
    </div>
    <span class="cps-badge ${cpsInfo.cls}" title="${cpsInfo.label}">${cpsInfo.cps} CPS</span>
    <div class="sub-text-wrap">
      <input type="text" class="sub-text-input" value="${escapeHtml(sub.text)}" title="Haz clic para editar el texto">
    </div>
    <div class="sub-actions">
      <button type="button" class="btn-icon btn-play-sub" title="Reproducir este segmento">▶</button>
      <button type="button" class="btn-icon btn-split-sub" title="Dividir subtítulo en 2 mitades">✂️</button>
      <button type="button" class="btn-icon btn-merge-sub" title="Unir con el subtítulo siguiente">🔗</button>
      <button type="button" class="btn-icon btn-icon-danger btn-del-sub" title="Eliminar fila">✕</button>
    </div>
  `;

  const cpsBadge = row.querySelector('.cps-badge');
  const updateRowCPS = () => {
    const info = computeCPSInfo(sub);
    cpsBadge.className = `cps-badge ${info.cls}`;
    cpsBadge.textContent = `${info.cps} CPS`;
    cpsBadge.title = info.label;
  };

  const textInput = row.querySelector('.sub-text-input');
  textInput.addEventListener('focus', () => {
    dom.previewSubtitleText.textContent = sub.text;
  });
  textInput.addEventListener('input', (e) => {
    sub.text = e.target.value;
    dom.previewSubtitleText.textContent = sub.text;
    updateRowCPS();
    updateSubtitlesStats();
    saveSessionToStorage();
  });

  const startInput = row.querySelector('.sub-start');
  startInput.addEventListener('change', (e) => {
    pushUndoState();
    sub.start = parseTimeToSeconds(e.target.value);
    updateRowCPS();
  });

  const endInput = row.querySelector('.sub-end');
  endInput.addEventListener('change', (e) => {
    pushUndoState();
    sub.end = parseTimeToSeconds(e.target.value);
    updateRowCPS();
  });

  row.querySelector('.btn-play-sub').addEventListener('click', () => {
    playSubtitleSegment(sub.start, sub.end);
    dom.previewSubtitleText.textContent = sub.text;
  });

  row.querySelector('.btn-split-sub').addEventListener('click', () => {
    splitSubtitleRow(sub.id);
  });

  row.querySelector('.btn-merge-sub').addEventListener('click', () => {
    mergeSubtitleWithNext(sub.id);
  });

  row.querySelector('.btn-del-sub').addEventListener('click', () => {
    deleteSubtitleRow(sub.id);
  });

  dom.subtitlesList.appendChild(row);
}

function splitSubtitleRow(id) {
  const idx = state.subtitles.findIndex(s => s.id === id);
  if (idx === -1) return;

  const sub = state.subtitles[idx];
  const words = sub.text.trim().split(/\s+/);
  if (words.length < 2) {
    showToast('Aviso', 'Se necesitan al menos 2 palabras para dividir la fila.', 'warning', 2500);
    return;
  }

  pushUndoState();
  const midWord = Math.ceil(words.length / 2);
  const firstText = words.slice(0, midWord).join(' ');
  const secondText = words.slice(midWord).join(' ');
  const midTime = Math.round(((sub.start + sub.end) / 2) * 1000) / 1000;

  const firstSub = { id: sub.id, start: sub.start, end: midTime, text: firstText };
  const secondSub = { id: sub.id + 1, start: midTime, end: sub.end, text: secondText };

  state.subtitles.splice(idx, 1, firstSub, secondSub);
  renderSubtitlesTable();
  saveSessionToStorage();
  showToast('Subtítulo dividido', 'Se dividió la línea en dos segmentos proporcionales.', 'success', 2200);
}

function mergeSubtitleWithNext(id) {
  const idx = state.subtitles.findIndex(s => s.id === id);
  if (idx === -1 || idx >= state.subtitles.length - 1) {
    showToast('Aviso', 'No hay una fila siguiente con la que unir.', 'warning', 2200);
    return;
  }

  pushUndoState();
  const current = state.subtitles[idx];
  const next = state.subtitles[idx + 1];
  const merged = {
    id: current.id,
    start: current.start,
    end: next.end,
    text: `${current.text.trim()} ${next.text.trim()}`.trim()
  };

  state.subtitles.splice(idx, 2, merged);
  renderSubtitlesTable();
  saveSessionToStorage();
  showToast('Filas unidas', 'Se fusionaron ambos subtítulos.', 'success', 2200);
}

function addNewSubtitleRow() {
  pushUndoState();
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
  saveSessionToStorage();

  const newRow = dom.subtitlesList.lastElementChild;
  newRow?.scrollIntoView({ behavior: 'smooth' });
  newRow?.querySelector('.sub-text-input')?.focus();
}

function deleteSubtitleRow(id) {
  pushUndoState();
  state.subtitles = state.subtitles.filter(s => s.id !== id);
  renderSubtitlesTable();
  saveSessionToStorage();
}

// ==========================================================================
// Herramientas Masivas: Time-Shift, Transformaciones y Buscar/Reemplazar
// ==========================================================================
function shiftAllTimestamps(deltaSec) {
  if (!state.subtitles || state.subtitles.length === 0) return;
  pushUndoState();
  state.subtitles.forEach(s => {
    s.start = Math.max(0, Math.round((s.start + deltaSec) * 1000) / 1000);
    s.end = Math.max(s.start + 0.2, Math.round((s.end + deltaSec) * 1000) / 1000);
  });
  renderSubtitlesTable();
  saveSessionToStorage();
  const sign = deltaSec > 0 ? `+${deltaSec}s` : `${deltaSec}s`;
  showToast('Sincronización ajustada', `Todos los subtítulos desplazados ${sign}`, 'info', 2000);
}

function transformAllText(mode) {
  if (!state.subtitles || state.subtitles.length === 0) return;
  pushUndoState();
  state.subtitles.forEach(s => {
    if (!s.text) return;
    if (mode === 'upper') {
      s.text = s.text.toUpperCase();
    } else if (mode === 'sentence') {
      const lower = s.text.toLowerCase();
      s.text = lower.charAt(0).toUpperCase() + lower.slice(1);
    } else if (mode === 'clean_punct') {
      s.text = s.text.replace(/[.,;]+$/g, '').trim();
    }
  });
  renderSubtitlesTable();
  saveSessionToStorage();
  showToast('Estilo aplicado', 'Transformación de texto aplicada a todos los subtítulos', 'success', 2200);
}

function applyReplaceAll() {
  const findStr = dom.replaceFindInput.value;
  const repStr = dom.replaceWithInput.value;
  if (!findStr) return;

  pushUndoState();
  let replacements = 0;
  const regex = new RegExp(findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

  state.subtitles.forEach(s => {
    if (regex.test(s.text)) {
      s.text = s.text.replace(regex, repStr);
      replacements++;
    }
  });

  renderSubtitlesTable();
  saveSessionToStorage();
  showToast('Reemplazo completado', `Se actualizaron ${replacements} líneas.`, 'success', 2800);
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

  const totalDurMin = Math.max(0.25, (state.currentFile?.duration || (state.subtitles[count - 1]?.end || 60)) / 60);
  const wpm = count > 0 ? Math.round(words / totalDurMin) : 0;

  dom.subtitlesCountText.textContent = `${count} subs`;
  dom.wordsCountText.textContent = `${words} pal.`;
  dom.wpmCountText.textContent = `${wpm} WPM`;
}

// ==========================================================================
// Simulador Visual en Vivo (9:16 y 16:9 + Presets Virales)
// ==========================================================================
function setPreviewAspect(aspect) {
  state.styleOptions.aspect_ratio = aspect;
  dom.btnAspect916.classList.toggle('active', aspect === '9:16');
  dom.btnAspect169.classList.toggle('active', aspect === '16:9');
  dom.previewStage.className = `preview-stage ${aspect === '9:16' ? 'aspect-9-16' : 'aspect-16-9'}`;
}

function setPreviewPreset(preset) {
  state.styleOptions.preset = preset;
  updateOverlayClasses();
}

function setPreviewPosition(pos) {
  state.styleOptions.position = pos;
  document.querySelectorAll('.pos-buttons .btn-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === pos);
  });
  updateOverlayClasses();
}

function updateOverlayClasses() {
  dom.previewSubtitleOverlay.className = `preview-subtitle-overlay pos-${state.styleOptions.position} style-${state.styleOptions.preset}`;
}

// ==========================================================================
// Reproductor de Audio Sincronizado y Espectro Web Audio API
// ==========================================================================
function setupAudioPlayer() {
  const audio = dom.mainAudioElement;
  const video = dom.previewVideoElement;

  dom.btnPlayerPlay.addEventListener('click', toggleAudioPlay);
  dom.btnSeekBack.addEventListener('click', () => seekRelative(-2));
  dom.btnSeekForward.addEventListener('click', () => seekRelative(2));

  audio.addEventListener('play', () => {
    dom.iconPlay.style.display = 'none';
    dom.iconPause.style.display = 'block';
    if (video.src) {
      video.currentTime = audio.currentTime;
      video.play().catch(() => {});
    }
    initAudioSpectrum();
  });

  audio.addEventListener('pause', () => {
    dom.iconPlay.style.display = 'block';
    dom.iconPause.style.display = 'none';
    if (video.src) video.pause();
  });

  audio.addEventListener('timeupdate', () => {
    const cur = audio.currentTime;
    const dur = audio.duration || state.currentFile?.duration || 1;
    dom.playerCurrentTime.textContent = formatTimeDisplay(cur);

    const pct = Math.min(100, (cur / dur) * 100);
    dom.timelineFill.style.width = `${pct}%`;
    dom.timelineThumb.style.left = `${pct}%`;

    if (video.src && Math.abs(video.currentTime - cur) > 0.35) {
      video.currentTime = cur;
    }

    highlightActiveSubtitle(cur);
  });

  dom.timelineBar.parentElement.addEventListener('click', (e) => {
    const rect = dom.timelineBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const dur = audio.duration || state.currentFile?.duration || 0;
    audio.currentTime = ratio * dur;
    if (video.src) video.currentTime = audio.currentTime;
  });

  dom.btnPlaybackSpeed.addEventListener('click', () => {
    state.playbackSpeedIndex = (state.playbackSpeedIndex + 1) % state.speeds.length;
    const speed = state.speeds[state.playbackSpeedIndex];
    audio.playbackRate = speed;
    if (video.src) video.playbackRate = speed;
    dom.btnPlaybackSpeed.textContent = `${speed.toFixed(1)}x`;
  });
}

function seekRelative(deltaSec) {
  const audio = dom.mainAudioElement;
  if (!audio.src) return;
  audio.currentTime = Math.max(0, audio.currentTime + deltaSec);
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
  let matched = null;
  for (const sub of state.subtitles) {
    if (time >= sub.start && time <= sub.end) {
      matched = sub;
      break;
    }
  }

  dom.previewSubtitleText.textContent = matched ? matched.text : '';

  const matchedId = matched ? matched.id : null;
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

function initAudioSpectrum() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      sourceNode = audioCtx.createMediaElementSource(dom.mainAudioElement);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!spectrumAnimId) {
      renderSpectrumLoop();
    }
  } catch (e) {}
}

function renderSpectrumLoop() {
  const canvas = dom.audioSpectrumCanvas;
  const ctx = canvas.getContext('2d');
  const bufferLength = analyser ? analyser.frequencyBinCount : 16;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    spectrumAnimId = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (analyser && !dom.mainAudioElement.paused) {
      analyser.getByteFrequencyData(dataArray);
    } else {
      dataArray.fill(18);
    }

    const barCount = 20;
    const barWidth = (canvas.width / barCount) - 2;
    let avgEnergy = 0;

    for (let i = 0; i < barCount; i++) {
      const val = dataArray[i] || 15;
      avgEnergy += val;
      const barHeight = Math.max(3, (val / 255) * canvas.height);
      const x = i * (barWidth + 2);
      const y = canvas.height - barHeight;

      const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Animar el círculo de onda en el simulador cuando es un archivo de audio
    const waveCircle = dom.previewBackdropDecor?.querySelector('.preview-wave-circle');
    if (waveCircle && !dom.mainAudioElement.paused) {
      const scale = 1 + ((avgEnergy / barCount) / 255) * 0.65;
      waveCircle.style.transform = `scale(${scale.toFixed(2)})`;
    }
  }
  draw();
}

function drawIdleSpectrum() {
  const canvas = dom.audioSpectrumCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.fillRect(i * 6.5, canvas.height - 4, 4.5, 4);
  }
}

// ==========================================================================
// Exportación (.SRT, .ASS, .VTT, .TXT, .JSON, Guardado Rápido y Quemado MP4)
// ==========================================================================
async function exportSubtitles(format) {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Sin subtítulos', 'Genera o importa subtítulos antes de exportar.', 'warning');
    return;
  }

  const baseName = state.currentFile?.stem || 'subtitulos';
  const defaultFilename = `${baseName}.${format}`;

  try {
    if (window.pywebview?.api?.export_file) {
      const res = await window.pywebview.api.export_file(format, state.subtitles, defaultFilename, state.styleOptions);
      if (res && res.success) {
        showToast('Exportación completada', `Guardado en: ${res.path}`, 'success', 5000);
      }
    } else {
      downloadDirectFile(format, defaultFilename);
    }
  } catch (err) {
    showToast('Error al exportar', err.message, 'error');
  }
}

async function quickSaveNextToSource() {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Sin subtítulos', 'No hay subtítulos activos para guardar.', 'warning');
    return;
  }
  if (!state.currentFile?.path) {
    exportSubtitles('srt');
    return;
  }

  try {
    if (window.pywebview?.api?.save_quick_next_to_source) {
      const res = await window.pywebview.api.save_quick_next_to_source('srt', state.subtitles, state.currentFile.path, state.styleOptions);
      if (res && res.success) {
        showToast('⚡ Guardado instantáneo (Ctrl+S)', `Creado: ${res.path}`, 'success', 4000);
      } else {
        showToast('Error al guardar', res.error || 'No se pudo escribir el archivo', 'error');
      }
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function burnVideoSubtitles() {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Sin subtítulos', 'Genera o importa subtítulos primero.', 'warning');
    return;
  }
  if (!state.currentFile || !state.currentFile.is_video) {
    showToast('Se requiere un vídeo', 'Carga un archivo de vídeo (.MP4, .MOV, .MKV) para incrustar los subtítulos.', 'warning', 4500);
    return;
  }

  const defaultName = `${state.currentFile.stem}_subtitulado.mp4`;
  showToast('🎬 Quemando subtítulos...', 'Procesando vídeo con FFmpeg y el estilo seleccionado...', 'info', 4000);

  try {
    if (window.pywebview?.api?.burn_video) {
      const res = await window.pywebview.api.burn_video(state.currentFile.path, state.subtitles, defaultName, state.styleOptions);
      if (res && res.success) {
        showToast('¡Vídeo exportado!', `Guardado con subtítulos incrustados: ${res.path}`, 'success', 6000);
      } else if (res && res.error) {
        showToast('Error en FFmpeg', res.error, 'error', 6000);
      }
    }
  } catch (err) {
    showToast('Error al quemar vídeo', err.message, 'error');
  }
}

function downloadDirectFile(format, filename) {
  let content = '';
  if (format === 'srt') {
    content = state.subtitles.map((s, i) => `${i + 1}\n${formatTimeSRT(s.start)} --> ${formatTimeSRT(s.end)}\n${s.text}\n`).join('\n');
  } else if (format === 'vtt') {
    content = 'WEBVTT\n\n' + state.subtitles.map((s, i) => `${i + 1}\n${formatTimeVTT(s.start)} --> ${formatTimeVTT(s.end)}\n${s.text}\n`).join('\n');
  } else if (format === 'json') {
    content = JSON.stringify({ subtitles: state.subtitles }, null, 2);
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
}

function copySubtitlesToClipboard() {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Aviso', 'No hay subtítulos para copiar', 'warning');
    return;
  }
  const text = state.subtitles.map(s => s.text).join(' ');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado', 'Transcripción completa copiada al portapapeles', 'success');
  });
}

// ==========================================================================
// Generador Automático de Capítulos para YouTube
// ==========================================================================
function openYoutubeChaptersModal() {
  if (!state.subtitles || state.subtitles.length === 0) {
    showToast('Sin subtítulos', 'Genera subtítulos primero para extraer los capítulos de YouTube.', 'warning');
    return;
  }

  const lines = ['00:00 Introducción'];
  const intervalSec = Math.max(15, (state.subtitles[state.subtitles.length - 1].end || 60) / 5);
  let nextChapterTime = intervalSec;

  state.subtitles.forEach(s => {
    if (s.start >= nextChapterTime) {
      const cleanTitle = s.text.replace(/[.,;!?]+$/g, '').trim();
      if (cleanTitle.length > 3) {
        lines.push(`${formatTimeDisplay(s.start)} ${cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)}`);
        nextChapterTime = s.start + intervalSec;
      }
    }
  });

  lines.push('\n--- Resumen del Guion ---');
  lines.push(state.subtitles.map(s => s.text).join(' '));

  dom.youtubeChaptersTextarea.value = lines.join('\n');
  dom.modalYoutube.style.display = 'flex';
}

// ==========================================================================
// Utilidades de Formato y Toasts
// ==========================================================================
function formatTimeSRT(sec) {
  sec = Math.max(0, parseFloat(sec) || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor(Math.round((sec - Math.floor(sec)) * 1000));
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(Math.min(999, ms), 3)}`;
}

function formatTimeVTT(sec) {
  return formatTimeSRT(sec).replace(',', '.');
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

function showToast(title, desc, type = 'success', duration = 3800) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '✓';
  if (type === 'error') iconSvg = '⚠';
  else if (type === 'warning') iconSvg = '!';
  else if (type === 'info') iconSvg = 'ℹ';

  toast.innerHTML = `
    <div class="toast-icon"><b>${iconSvg}</b></div>
    <div class="toast-body">
      <h5 class="toast-title">${escapeHtml(title)}</h5>
      <p class="toast-desc">${escapeHtml(desc)}</p>
    </div>
    <button type="button" class="toast-close">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, duration);
}
