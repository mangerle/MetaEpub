import { EpubHandler } from './epubHandler.js';
import { initI18n, setLang, getLang, t } from './i18n.js';

// 初始化 i18n（在 DOM 就绪后应用）
initI18n();

// 语言切换器
const langSelect = document.getElementById('lang-select');
if (langSelect) {
  langSelect.value = getLang();
  langSelect.addEventListener('change', () => setLang(langSelect.value));
}

// 初始化组件与元素引用
const epubHandler = new EpubHandler();

const dropZone = document.getElementById('drop-zone');
const editorSection = document.getElementById('editor-section');
const headerActions = document.getElementById('header-actions');
const fileInput = document.getElementById('file-input');
const coverInput = document.getElementById('cover-input');

const coverImg = document.getElementById('cover-img');
const coverPlaceholder = document.getElementById('cover-placeholder');
const fileNameDisplay = document.getElementById('file-name-display');
const contentPreviewBody = document.getElementById('content-preview-body');

const btnOpenNew = document.getElementById('btn-open-new');
const btnChangeCover = document.getElementById('btn-change-cover');
const btnReset = document.getElementById('btn-reset');
const metadataForm = document.getElementById('metadata-form');
const toastEl = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

let currentMetadata = {};
let currentFilePath = null; // 当前打开文件的本地路径（用于最近文件等）

// 检测是否运行在 Tauri 桌面环境
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// 监听拖拽上传
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].name.toLowerCase().endsWith('.epub')) {
    handleFileSelect(files[0]);
  } else {
    showToast(t('toast.invalidEpub'), 'error');
  }
});

// 点击 dropZone 唤起文件选择
dropZone.addEventListener('click', () => {
  openWithNativeDialog();
});

btnOpenNew.addEventListener('click', () => {
  openWithNativeDialog();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

// 处理 EPUB 文件加载（arrayBuffer 形式）
async function handleFileLoad(arrayBuffer, fileName, path) {
  try {
    showToast(t('toast.parsing'), 'info');
    const result = await epubHandler.load(arrayBuffer, fileName);

    currentMetadata = { ...result.metadata };
    currentFilePath = path || null;
    fillForm(currentMetadata);
    initHistory();
    if (path) addRecentFile(path, fileName);

    // 更新封面
    updateCoverPreview(result.coverUrl);

    // 更新书籍目录预览（失败不影响主流程）
    try {
      await updateTocPreview();
    } catch (previewErr) {
      console.warn('目录预览提取失败:', previewErr);
    }

    // 更新文件名展示与导出文件名输入框
    fileNameDisplay.textContent = t('file.info', fileName);
    document.getElementById('input-filename').value = fileName;

    // 界面状态切换
    dropZone.classList.add('hidden');
    editorSection.classList.remove('hidden');
    headerActions.classList.remove('hidden');

    showToast(t('toast.parseSuccess'), 'success');
  } catch (err) {
    console.error(err);
    showToast(`${t('toast.parseFail')}: ${err.message}`, 'error');
  }
}

// 处理拖拽/选择的 File 对象
async function handleFileSelect(file) {
  const arrayBuffer = await file.arrayBuffer();
  await handleFileLoad(arrayBuffer, file.name, null);
}

// 通过原生文件对话框打开 EPUB（Tauri 环境）
async function openWithNativeDialog() {
  if (!isTauri) {
    fileInput.click();
    return;
  }
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({
      multiple: false,
      filters: [{ name: 'EPUB', extensions: ['epub'] }]
    });
    if (!path) return; // 用户取消

    const { invoke } = await import('@tauri-apps/api/core');
    const data = await invoke('read_epub_file', { path });
    const fileName = path.split(/[\\/]/).pop() || 'book.epub';
    await handleFileLoad(data, fileName, path);
  } catch (err) {
    console.error(err);
    showToast(`${t('toast.readFail')}: ${err.message || err}`, 'error');
  }
}

// 将任意日期字符串转换为 date 输入框可接受的 yyyy-mm-dd 格式
function toDateInputValue(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, '0')}-01`;
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return '';
}

// 将表单值写入输入框（metadata 缺失 filename 时不动文件名）
function applyFormValues(values) {
  document.getElementById('input-title').value = values.title || '';
  document.getElementById('input-creator').value = values.creator || '';
  document.getElementById('input-language').value = values.language || '';
  document.getElementById('input-publisher').value = values.publisher || '';
  document.getElementById('input-date').value = toDateInputValue(values.date);
  document.getElementById('input-identifier').value = values.identifier || '';
  document.getElementById('input-description').value = values.description || '';
  document.getElementById('input-subject').value = values.subject || '';
  document.getElementById('input-contributor').value = values.contributor || '';
  document.getElementById('input-rights').value = values.rights || '';
  document.getElementById('input-source').value = values.source || '';
  document.getElementById('input-series').value = values.series || '';
  document.getElementById('input-series-index').value = values.seriesIndex || '';
  if (values.filename !== undefined) {
    document.getElementById('input-filename').value = values.filename;
  }
}

// 填充表单
function fillForm(metadata) {
  applyFormValues(metadata);
}

// 收集表单数据
function getFormValues() {
  return {
    title: document.getElementById('input-title').value.trim(),
    creator: document.getElementById('input-creator').value.trim(),
    language: document.getElementById('input-language').value.trim(),
    publisher: document.getElementById('input-publisher').value.trim(),
    date: document.getElementById('input-date').value.trim(),
    identifier: document.getElementById('input-identifier').value.trim(),
    description: document.getElementById('input-description').value.trim(),
    subject: document.getElementById('input-subject').value.trim(),
    contributor: document.getElementById('input-contributor').value.trim(),
    rights: document.getElementById('input-rights').value.trim(),
    source: document.getElementById('input-source').value.trim(),
    series: document.getElementById('input-series').value.trim(),
    seriesIndex: document.getElementById('input-series-index').value.trim(),
    filename: document.getElementById('input-filename').value.trim(),
  };
}

// ===== 撤销 / 重做历史栈 =====
let undoStack = [];
let redoStack = [];
let lastSnapshot = null;
let snapshotTimer = null;

// 记录当前表单状态到撤销栈（输入防抖后调用）
function snapshotForm() {
  const current = getFormValues();
  const key = JSON.stringify(current);
  if (lastSnapshot !== key) {
    undoStack.push(current);
    if (undoStack.length > 50) undoStack.shift(); // 限制历史深度
    lastSnapshot = key;
    redoStack = [];
    updateHistoryButtons();
  }
}

// 输入防抖：停止输入 400ms 后记录快照
function scheduleSnapshot() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(snapshotForm, 400);
}

// 撤销：将当前状态入重做栈，恢复上一个快照
function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(getFormValues());
  const prev = undoStack.pop();
  lastSnapshot = JSON.stringify(prev);
  applyFormValues(prev);
  updateHistoryButtons();
}

// 重做：将当前状态入撤销栈，恢复下一个快照
function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(getFormValues());
  const next = redoStack.pop();
  lastSnapshot = JSON.stringify(next);
  applyFormValues(next);
  updateHistoryButtons();
}

// 初始化历史栈（加载新书后调用）
function initHistory() {
  undoStack = [];
  redoStack = [];
  lastSnapshot = JSON.stringify(getFormValues());
  updateHistoryButtons();
}

// 更新撤销/重做按钮的可用状态
function updateHistoryButtons() {
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  if (btnUndo) btnUndo.disabled = undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

// 更新封面预览
function updateCoverPreview(url) {
  if (url) {
    coverImg.src = url;
    coverImg.classList.remove('hidden');
    coverPlaceholder.classList.add('hidden');
  } else {
    coverImg.classList.add('hidden');
    coverPlaceholder.classList.remove('hidden');
  }
}

// 更新书籍目录预览
async function updateTocPreview() {
  if (!contentPreviewBody) return;
  const toc = await epubHandler.extractToc();
  if (!toc || toc.length === 0) {
    contentPreviewBody.textContent = t('preview.empty');
    return;
  }
  contentPreviewBody.innerHTML = '';
  contentPreviewBody.appendChild(renderTocList(toc));
}

// 渲染目录树形列表
function renderTocList(items) {
  const ul = document.createElement('ul');
  ul.className = 'toc-list';
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'toc-item';
    li.textContent = item.label;
    if (item.children && item.children.length) {
      li.appendChild(renderTocList(item.children));
    }
    ul.appendChild(li);
  });
  return ul;
}

// 更换封面按钮
btnChangeCover.addEventListener('click', () => {
  coverInput.click();
});

// ===== 封面裁剪弹窗 =====
const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const cropZoom = document.getElementById('crop-zoom');
const btnConfirmCrop = document.getElementById('btn-confirm-crop');
const btnCancelCrop = document.getElementById('btn-cancel-crop');
const btnCloseCrop = document.getElementById('btn-close-crop-modal');

const CROP_W = 300;
const CROP_H = 400;

let cropState = null; // { file, base, scale, dx, dy }
let cropDragging = false;
let cropDragStart = null;

function openCropModal(file) {
  cropState = { file, base: 1, scale: 1, dx: 0, dy: 0 };
  cropZoom.value = 1;
  cropImage.onload = () => {
    cropState.base = Math.max(CROP_W / cropImage.naturalWidth, CROP_H / cropImage.naturalHeight);
    renderCrop();
  };
  cropImage.src = URL.createObjectURL(file);
  cropModal.classList.remove('hidden');
}

function closeCropModal() {
  cropModal.classList.add('hidden');
  URL.revokeObjectURL(cropImage.src);
  cropImage.src = '';
  cropState = null;
}

function renderCrop() {
  if (!cropState) return;
  const s = cropState.base * cropState.scale;
  cropImage.style.transform = `translate(calc(-50% + ${cropState.dx}px), calc(-50% + ${cropState.dy}px)) scale(${s})`;
}

// 拖动图片调整位置
cropImage.addEventListener('mousedown', (e) => {
  if (!cropState) return;
  cropDragging = true;
  cropDragStart = { x: e.clientX, y: e.clientY, dx: cropState.dx, dy: cropState.dy };
});
document.addEventListener('mousemove', (e) => {
  if (!cropDragging || !cropState) return;
  cropState.dx = cropDragStart.dx + (e.clientX - cropDragStart.x);
  cropState.dy = cropDragStart.dy + (e.clientY - cropDragStart.y);
  renderCrop();
});
document.addEventListener('mouseup', () => {
  cropDragging = false;
});

// 缩放滑块
cropZoom.addEventListener('input', () => {
  if (!cropState) return;
  cropState.scale = parseFloat(cropZoom.value);
  renderCrop();
});

// 确认裁剪：用 canvas 生成裁剪后的封面
btnConfirmCrop.addEventListener('click', () => {
  if (!cropState) return;
  const file = cropState.file;
  const canvas = document.createElement('canvas');
  canvas.width = CROP_W;
  canvas.height = CROP_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CROP_W, CROP_H);
  const dw = cropImage.naturalWidth * cropState.base * cropState.scale;
  const dh = cropImage.naturalHeight * cropState.base * cropState.scale;
  const imgLeft = (CROP_W - dw) / 2 + cropState.dx;
  const imgTop = (CROP_H - dh) / 2 + cropState.dy;
  ctx.drawImage(cropImage, imgLeft, imgTop, dw, dh, 0, 0, CROP_W, CROP_H);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const croppedFile = new File([blob], file.name, { type: blob.type || 'image/jpeg' });
    const previewUrl = epubHandler.setNewCover(croppedFile);
    updateCoverPreview(previewUrl);
    closeCropModal();
    showToast(t('toast.coverUpdated'), 'info');
  }, 'image/jpeg', 0.92);
});

// 取消 / 关闭
btnCancelCrop?.addEventListener('click', closeCropModal);
btnCloseCrop?.addEventListener('click', closeCropModal);

// 更换封面：选择文件后打开裁剪弹窗
coverInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    openCropModal(e.target.files[0]);
  }
  e.target.value = ''; // 允许重复选择同一文件
});

// 表单输入时记录历史（防抖）
metadataForm.addEventListener('input', scheduleSnapshot);

// 撤销 / 重做按钮
document.getElementById('btn-undo')?.addEventListener('click', undo);
document.getElementById('btn-redo')?.addEventListener('click', redo);

// 重置修改
btnReset.addEventListener('click', () => {
  snapshotForm(); // 记录当前状态以便撤销
  fillForm(currentMetadata);
  document.getElementById('input-filename').value = epubHandler.originalFileName;
  showToast(t('toast.reset'), 'info');
});

// 表单提交：导出修改后的 EPUB
metadataForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    showToast(t('toast.exporting'), 'info');
    const newMetadata = getFormValues();
    const newBlob = await epubHandler.save(newMetadata, settings.compressionLevel ?? 9);

    // 获取导出文件名（若没有加 .epub 则自动补全）
    let customFileName = document.getElementById('input-filename').value.trim();
    if (!customFileName) {
      customFileName = epubHandler.originalFileName || 'edited_book.epub';
    }
    if (!customFileName.toLowerCase().endsWith('.epub')) {
      customFileName += '.epub';
    }

    if (isTauri) {
      // 桌面环境：原生保存对话框，由 Rust 写入文件
      const { save } = await import('@tauri-apps/plugin-dialog');
      const defaultPath = settings.exportDir ? `${settings.exportDir}\\${customFileName}` : customFileName;
      const path = await save({
        defaultPath,
        filters: [{ name: 'EPUB', extensions: ['epub'] }]
      });
      if (!path) return; // 用户取消保存

      // 记录导出目录，下次默认打开
      const dir = path.replace(/[\\/][^\\/]*$/, '');
      if (dir && dir !== settings.exportDir) {
        settings.exportDir = dir;
        saveSettings();
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const bytes = new Uint8Array(await newBlob.arrayBuffer());
      await invoke('save_epub_file', { path, data: Array.from(bytes) });
      showToast(t('toast.savedTo', path), 'success');
    } else {
      // Web 模式：浏览器下载
      const downloadUrl = URL.createObjectURL(newBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = customFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      showToast(t('toast.exportSuccess', customFileName), 'success');
    }
  } catch (err) {
    console.error(err);
    showToast(`${t('toast.exportFail')}: ${err.message}`, 'error');
  }
});

// Toast 提示框
function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3500);
}

// 自动更新逻辑控制
let pendingUpdate = null;

function initUpdater() {
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const updateModal = document.getElementById('update-modal');
  const btnCloseModal = document.getElementById('btn-close-update-modal');
  const btnCancelUpdate = document.getElementById('btn-cancel-update');
  const btnStartUpdate = document.getElementById('btn-start-update');
  const updateCurrentVer = document.getElementById('update-current-ver');
  const updateLatestVer = document.getElementById('update-latest-ver');
  const updateNotes = document.getElementById('update-notes');
  const updateProgressContainer = document.getElementById('update-progress-container');
  const updateProgressBar = document.getElementById('update-progress-bar');
  const updateStatusText = document.getElementById('update-status-text');
  const updatePercentText = document.getElementById('update-percent-text');

  // 关闭弹窗
  const closeModal = () => {
    updateModal.classList.add('hidden');
  };
  btnCloseModal?.addEventListener('click', closeModal);
  btnCancelUpdate?.addEventListener('click', closeModal);

  // 点击检查更新按钮
  btnCheckUpdate?.addEventListener('click', () => {
    checkForUpdates(true);
  });

  // 立即升级按钮
  btnStartUpdate?.addEventListener('click', async () => {
    if (!pendingUpdate) return;
    try {
      btnStartUpdate.disabled = true;
      btnCancelUpdate.disabled = true;
      updateProgressContainer.classList.remove('hidden');
      updateStatusText.textContent = t('update.statusDownloading');

      let downloadedBytes = 0;
      let totalBytes = 0;

      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            updateStatusText.textContent = t('update.statusStarted');
            break;
          case 'Progress':
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              const percent = Math.floor((downloadedBytes / totalBytes) * 100);
              updateProgressBar.style.width = `${percent}%`;
              updatePercentText.textContent = `${percent}%`;
              updateStatusText.textContent = t('update.progressDownloading', (downloadedBytes / 1024 / 1024).toFixed(1), (totalBytes / 1024 / 1024).toFixed(1));
            } else {
              updateStatusText.textContent = t('update.progressDownloaded', (downloadedBytes / 1024 / 1024).toFixed(1));
            }
            break;
          case 'Finished':
            updateProgressBar.style.width = '100%';
            updatePercentText.textContent = '100%';
            updateStatusText.textContent = t('update.statusFinished');
            break;
        }
      });

      showToast(t('toast.updateInstalled'), 'success');

      try {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch (e) {
        console.log('Relaunch error or web mode:', e);
      }
    } catch (err) {
      console.error('Update failed:', err);
      showToast(`${t('toast.updateInstallFail')}: ${err.message || err}`, 'error');
      btnStartUpdate.disabled = false;
      btnCancelUpdate.disabled = false;
    }
  });

  // 检查更新主逻辑
  async function checkForUpdates(manual = false) {
    if (manual) {
      showToast(t('toast.checkingUpdate'), 'info');
    }
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update && update.available) {
        pendingUpdate = update;
        updateCurrentVer.textContent = t('update.currentVer', update.currentVersion || '0.1.0');
        updateLatestVer.textContent = t('update.latestVer', update.version);
        updateNotes.textContent = update.body || t('update.notesFallback');
        updateProgressContainer.classList.add('hidden');
        updateProgressBar.style.width = '0%';
        updatePercentText.textContent = '0%';
        btnStartUpdate.disabled = false;
        btnCancelUpdate.disabled = false;
        updateModal.classList.remove('hidden');
      } else {
        if (manual) {
          showToast(t('toast.latest'), 'success');
        }
      }
    } catch (err) {
      console.warn('Check update fail:', err);
      if (manual) {
        showToast(`${t('toast.checkUpdateFail')}: ${err.message || err}`, 'error');
      }
    }
  }

  // 启动 3 秒后自动静默检查一次更新
  setTimeout(() => {
    checkForUpdates(false);
  }, 3000);
}

// 启动更新控制器
initUpdater();

// ===== 最近打开文件 =====
const RECENT_KEY = 'metaepub.recentFiles';

function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function addRecentFile(path, name) {
  if (!path) return;
  const list = getRecentFiles().filter(f => f.path !== path);
  list.unshift({ path, name, time: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  renderRecentMenu();
}

function renderRecentMenu() {
  const menu = document.getElementById('recent-menu');
  if (!menu) return;
  const list = getRecentFiles();
  menu.innerHTML = '';
  if (list.length === 0) {
    menu.innerHTML = `<div class="recent-empty">${t('recent.empty')}</div>`;
    return;
  }
  list.forEach(f => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.textContent = f.name;
    item.title = f.path;
    item.addEventListener('click', () => reopenRecent(f.path));
    menu.appendChild(item);
  });
}

async function reopenRecent(path) {
  document.getElementById('recent-menu')?.classList.add('hidden');
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const data = await invoke('read_epub_file', { path });
    const fileName = path.split(/[\\/]/).pop() || 'book.epub';
    await handleFileLoad(data, fileName, path);
  } catch (err) {
    showToast(`${t('toast.readFail')}: ${err.message || err}`, 'error');
  }
}

function initRecentMenu() {
  const btnRecent = document.getElementById('btn-recent');
  const menu = document.getElementById('recent-menu');
  btnRecent?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.toggle('hidden');
    renderRecentMenu();
  });
  document.addEventListener('click', () => menu?.classList.add('hidden'));
}

// ===== 导出设置 =====
const SETTINGS_KEY = 'metaepub.settings';
let settings = loadSettings();

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function initSettings() {
  const modal = document.getElementById('settings-modal');
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('btn-close-settings-modal');
  const btnConfirm = document.getElementById('btn-confirm-settings');
  const btnPickDir = document.getElementById('btn-pick-dir');
  const compressionInput = document.getElementById('input-compression');
  const dirInput = document.getElementById('input-export-dir');

  const open = () => {
    compressionInput.value = settings.compressionLevel ?? 9;
    dirInput.value = settings.exportDir || '';
    modal.classList.remove('hidden');
  };
  const close = () => modal.classList.add('hidden');

  btnSettings?.addEventListener('click', open);
  btnClose?.addEventListener('click', close);
  btnConfirm?.addEventListener('click', () => {
    settings.compressionLevel = parseInt(compressionInput.value, 10) || 9;
    settings.exportDir = dirInput.value.trim() || null;
    saveSettings();
    close();
    showToast(t('toast.settingsSaved'), 'success');
  });
  btnPickDir?.addEventListener('click', async () => {
    if (!isTauri) {
      showToast(t('toast.dirNativeOnly'), 'info');
      return;
    }
    const { open } = await import('@tauri-apps/plugin-dialog');
    const dir = await open({ directory: true, multiple: false });
    if (dir) dirInput.value = dir;
  });
}

// 关于弹窗控制
function initAboutModal() {
  const btnAbout = document.getElementById('btn-about');
  const aboutModal = document.getElementById('about-modal');
  const btnCloseAbout = document.getElementById('btn-close-about-modal');
  const btnConfirmAbout = document.getElementById('btn-confirm-about');

  const closeAboutModal = () => {
    aboutModal?.classList.add('hidden');
  };

  btnAbout?.addEventListener('click', () => {
    aboutModal?.classList.remove('hidden');
  });

  btnCloseAbout?.addEventListener('click', closeAboutModal);
  btnConfirmAbout?.addEventListener('click', closeAboutModal);
}

initAboutModal();
initRecentMenu();
initSettings();

// 更多菜单：检查更新 / 关于
function initMoreMenu() {
  const btnMore = document.getElementById('btn-more');
  const menu = document.getElementById('more-menu');
  btnMore?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.toggle('hidden');
  });
  // 点击菜单项后关闭
  menu?.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => menu.classList.add('hidden'));
  });
  document.addEventListener('click', () => menu?.classList.add('hidden'));
}
initMoreMenu();

// ===== 快捷键支持 =====
// Ctrl/Cmd+O 打开文件，Ctrl/Cmd+S 保存导出
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'o') {
    e.preventDefault();
    openWithNativeDialog();
  } else if (key === 's' && !editorSection.classList.contains('hidden')) {
    e.preventDefault();
    metadataForm.requestSubmit();
  }
});

