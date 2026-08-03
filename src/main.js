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
  fileInput.click();
});

btnOpenNew.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

// 处理 EPUB 文件加载
async function handleFileSelect(file) {
  try {
    showToast('正在解析 EPUB 文件...', 'info');
    const arrayBuffer = await file.arrayBuffer();
    const result = await epubHandler.load(arrayBuffer, file.name);

    currentMetadata = { ...result.metadata };
    fillForm(currentMetadata);

    // 更新封面
    updateCoverPreview(result.coverUrl);

    // 更新文件名展示与导出文件名输入框
    fileNameDisplay.textContent = `文件: ${file.name}`;
    document.getElementById('input-filename').value = file.name;

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

// 填充表单
function fillForm(metadata) {
  document.getElementById('input-title').value = metadata.title || '';
  document.getElementById('input-creator').value = metadata.creator || '';
  document.getElementById('input-language').value = metadata.language || '';
  document.getElementById('input-publisher').value = metadata.publisher || '';
  document.getElementById('input-date').value = metadata.date || '';
  document.getElementById('input-identifier').value = metadata.identifier || '';
  document.getElementById('input-description').value = metadata.description || '';
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
  };
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

// 重置修改
btnReset.addEventListener('click', () => {
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

    // 触发浏览器/Tauri 导出下载
    const downloadUrl = URL.createObjectURL(newBlob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = customFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    showToast(`EPUB 文件 [${customFileName}] 导出成功！`, 'success');
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

