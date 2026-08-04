import { EpubHandler } from './epubHandler.js';

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
    showToast('请选择有效的 .epub 文件！', 'error');
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
    showToast('正在解析 EPUB 文件...', 'info');
    const result = await epubHandler.load(arrayBuffer, fileName);

    currentMetadata = { ...result.metadata };
    currentFilePath = path || null;
    fillForm(currentMetadata);
    initHistory();

    // 更新封面
    updateCoverPreview(result.coverUrl);

    // 更新文件名展示与导出文件名输入框
    fileNameDisplay.textContent = `文件: ${fileName}`;
    document.getElementById('input-filename').value = fileName;

    // 界面状态切换
    dropZone.classList.add('hidden');
    editorSection.classList.remove('hidden');
    headerActions.classList.remove('hidden');

    showToast('解析成功！你可以开始编辑元数据。', 'success');
  } catch (err) {
    console.error(err);
    showToast(`解析失败: ${err.message}`, 'error');
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
    showToast(`读取文件失败: ${err.message || err}`, 'error');
  }
}

// 将表单值写入输入框（metadata 缺失 filename 时不动文件名）
function applyFormValues(values) {
  document.getElementById('input-title').value = values.title || '';
  document.getElementById('input-creator').value = values.creator || '';
  document.getElementById('input-language').value = values.language || '';
  document.getElementById('input-publisher').value = values.publisher || '';
  document.getElementById('input-date').value = values.date || '';
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

// 更换封面按钮
btnChangeCover.addEventListener('click', () => {
  coverInput.click();
});

coverInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    const coverFile = e.target.files[0];
    const previewUrl = epubHandler.setNewCover(coverFile);
    updateCoverPreview(previewUrl);
    showToast('已更新封面预览，点击“保存”生效。', 'info');
  }
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
  showToast('已重置为初始提取的元数据和文件名。', 'info');
});

// 表单提交：导出修改后的 EPUB
metadataForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    showToast('正在打包导出 EPUB...', 'info');
    const newMetadata = getFormValues();
    const newBlob = await epubHandler.save(newMetadata);

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
      const path = await save({
        defaultPath: customFileName,
        filters: [{ name: 'EPUB', extensions: ['epub'] }]
      });
      if (!path) return; // 用户取消保存

      const { invoke } = await import('@tauri-apps/api/core');
      const bytes = new Uint8Array(await newBlob.arrayBuffer());
      await invoke('save_epub_file', { path, data: Array.from(bytes) });
      showToast(`EPUB 文件已保存至: ${path}`, 'success');
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
      showToast(`EPUB 文件 [${customFileName}] 导出成功！`, 'success');
    }
  } catch (err) {
    console.error(err);
    showToast(`导出失败: ${err.message}`, 'error');
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
      updateStatusText.textContent = '正在下载更新包...';

      let downloadedBytes = 0;
      let totalBytes = 0;

      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0;
            updateStatusText.textContent = '开始下载...';
            break;
          case 'Progress':
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              const percent = Math.floor((downloadedBytes / totalBytes) * 100);
              updateProgressBar.style.width = `${percent}%`;
              updatePercentText.textContent = `${percent}%`;
              updateStatusText.textContent = `正在下载: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB`;
            } else {
              updateStatusText.textContent = `已下载: ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`;
            }
            break;
          case 'Finished':
            updateProgressBar.style.width = '100%';
            updatePercentText.textContent = '100%';
            updateStatusText.textContent = '下载完成，正在准备安装重启...';
            break;
        }
      });

      showToast('更新已安装完成，正在重启应用...', 'success');

      try {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch (e) {
        console.log('Relaunch error or web mode:', e);
      }
    } catch (err) {
      console.error('Update failed:', err);
      showToast(`更新安装失败: ${err.message || err}`, 'error');
      btnStartUpdate.disabled = false;
      btnCancelUpdate.disabled = false;
    }
  });

  // 检查更新主逻辑
  async function checkForUpdates(manual = false) {
    if (manual) {
      showToast('正在检查应用更新...', 'info');
    }
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update && update.available) {
        pendingUpdate = update;
        updateCurrentVer.textContent = `当前版本 v${update.currentVersion || '0.1.0'}`;
        updateLatestVer.textContent = `最新版本 v${update.version}`;
        updateNotes.textContent = update.body || '包含最新性能优化与修复。';
        updateProgressContainer.classList.add('hidden');
        updateProgressBar.style.width = '0%';
        updatePercentText.textContent = '0%';
        btnStartUpdate.disabled = false;
        btnCancelUpdate.disabled = false;
        updateModal.classList.remove('hidden');
      } else {
        if (manual) {
          showToast('当前已是最新版本！', 'success');
        }
      }
    } catch (err) {
      console.warn('Check update fail:', err);
      if (manual) {
        showToast(`检查更新失败: ${err.message || err}`, 'error');
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

