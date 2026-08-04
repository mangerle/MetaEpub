/**
 * 轻量级 i18n 国际化模块
 * 支持中英双语，语言偏好持久化到 localStorage
 */

const messages = {
  zh: {
    // 头部
    'app.title': 'MetaEpub - EPUB 元数据编辑器',
    'app.openOther': '打开其他电子书',
    'app.recent': '🕘 最近打开',
    'app.settings': '⚙️ 设置',
    'app.checkUpdate': '✨ 检查更新',
    'app.about': 'ℹ️ 关于',

    // 拖拽区
    'drop.title': '拖拽 EPUB 文件到此处',
    'drop.subtitle': '或者点击此处选择电脑中的 .epub 电子书',

    // 侧栏
    'cover.placeholder': '暂无封面',
    'cover.change': '更换封面图片',
    'cover.alt': '封面预览',
    'file.info': '文件: {0}',
    'file.infoInitial': '文件: -',

    // 表单标签
    'label.title': '书名 (Title)',
    'label.creator': '作者 (Author)',
    'label.language': '语言 (Language)',
    'label.publisher': '出版商 (Publisher)',
    'label.date': '出版日期 (Date)',
    'label.identifier': '标识符 (ISBN / UUID)',
    'label.description': '书籍简介 / 描述 (Description)',
    'label.subject': '分类 (Subject)',
    'label.contributor': '其他贡献者 (Contributor)',
    'label.rights': '版权 (Rights)',
    'label.source': '来源 (Source)',
    'label.series': '丛书系列 (Series)',
    'label.seriesIndex': '系列序号 (Series Index)',
    'label.filename': '导出文件名 (Export Filename)',

    // 占位符
    'ph.title': '例如：三体',
    'ph.creator': '例如：刘慈欣',
    'ph.language': '例如：zh-CN / en',
    'ph.publisher': '例如：重庆出版社',
    'ph.date': '例如：2008-01-01',
    'ph.identifier': '例如：9787536692930',
    'ph.description': '请输入电子书的简介或描述内容...',
    'ph.subject': '例如：科幻小说',
    'ph.contributor': '例如：译者、插图作者',
    'ph.rights': '例如：© 2026 某出版社',
    'ph.source': '例如：https://...',
    'ph.series': '例如：三体系列',
    'ph.seriesIndex': '例如：1',
    'ph.filename': '例如：my_book.epub',

    // 操作按钮
    'action.undo': '撤销',
    'action.redo': '重做',
    'action.reset': '重置修改',
    'action.save': '保存并导出 EPUB',

    // 更新弹窗
    'update.title': '🚀 发现新版本',
    'update.notesTitle': '更新说明：',
    'update.notesLoading': '解析版本日志中...',
    'update.cancel': '稍后再说',
    'update.start': '立即升级',
    'update.statusPreparing': '正在准备下载...',
    'update.statusDownloading': '正在下载更新包...',
    'update.statusStarted': '开始下载...',
    'update.statusFinished': '下载完成，正在准备安装重启...',
    'update.progressDownloading': '正在下载: {0}MB / {1}MB',
    'update.progressDownloaded': '已下载: {0}MB',
    'update.currentVer': '当前版本 v{0}',
    'update.latestVer': '最新版本 v{0}',
    'update.notesFallback': '包含最新性能优化与修复。',

    // 关于弹窗
    'about.title': '关于 MetaEpub',
    'about.description': 'MetaEpub 是一款轻量、现代化的 EPUB 电子书元数据编辑器。支持便捷修改书名、作者、语言、出版商、出版日期、描述信息与标识符，并支持在线替换封面与离线导出打包。',
    'about.repo': '开源项目：',
    'about.env': '运行环境：',
    'about.envText': 'Tauri 桌面客户端 (Windows / macOS / Linux)',
    'about.confirm': '确定',

    // 设置弹窗
    'settings.title': '⚙️ 设置',
    'settings.compression': '压缩级别（0-9，越大文件越小但导出越慢）',
    'settings.comp0': '0 - 不压缩（最快）',
    'settings.comp1': '1 - 低压缩',
    'settings.comp3': '3 - 中低压缩',
    'settings.comp5': '5 - 中等压缩（推荐）',
    'settings.comp7': '7 - 高压缩',
    'settings.comp9': '9 - 最大压缩（最慢）',
    'settings.exportDir': '默认导出目录',
    'settings.exportDirPlaceholder': '未设置（使用系统默认）',
    'settings.pick': '选择',
    'settings.confirm': '确定',

    // 最近打开
    'recent.empty': '暂无最近打开记录',

    // Toast 消息
    'toast.invalidEpub': '请选择有效的 .epub 文件！',
    'toast.parsing': '正在解析 EPUB 文件...',
    'toast.parseSuccess': '解析成功！你可以开始编辑元数据。',
    'toast.parseFail': '解析失败',
    'toast.coverUpdated': '已更新封面预览，点击“保存”生效。',
    'toast.reset': '已重置为初始提取的元数据和文件名。',
    'toast.exporting': '正在打包导出 EPUB...',
    'toast.savedTo': 'EPUB 文件已保存至: {0}',
    'toast.exportSuccess': 'EPUB 文件 [{0}] 导出成功！',
    'toast.exportFail': '导出失败',
    'toast.readFail': '读取文件失败',
    'toast.settingsSaved': '设置已保存。',
    'toast.dirNativeOnly': '原生目录选择仅在桌面版可用。',
    'toast.checkingUpdate': '正在检查应用更新...',
    'toast.latest': '当前已是最新版本！',
    'toast.checkUpdateFail': '检查更新失败',
    'toast.updateInstalled': '更新已安装完成，正在重启应用...',
    'toast.updateInstallFail': '更新安装失败'
  },

  en: {
    'app.title': 'MetaEpub - EPUB Metadata Editor',
    'app.openOther': 'Open Another Book',
    'app.recent': '🕘 Recent',
    'app.settings': '⚙️ Settings',
    'app.checkUpdate': '✨ Check Update',
    'app.about': 'ℹ️ About',

    'drop.title': 'Drag an EPUB file here',
    'drop.subtitle': 'Or click to select an .epub file',

    'cover.placeholder': 'No cover',
    'cover.change': 'Change Cover',
    'cover.alt': 'Cover preview',
    'file.info': 'File: {0}',
    'file.infoInitial': 'File: -',

    'label.title': 'Title',
    'label.creator': 'Author',
    'label.language': 'Language',
    'label.publisher': 'Publisher',
    'label.date': 'Date',
    'label.identifier': 'Identifier (ISBN / UUID)',
    'label.description': 'Description',
    'label.subject': 'Subject',
    'label.contributor': 'Contributor',
    'label.rights': 'Rights',
    'label.source': 'Source',
    'label.series': 'Series',
    'label.seriesIndex': 'Series Index',
    'label.filename': 'Export Filename',

    'ph.title': 'e.g. The Three-Body Problem',
    'ph.creator': 'e.g. Liu Cixin',
    'ph.language': 'e.g. zh-CN / en',
    'ph.publisher': 'e.g. Publisher',
    'ph.date': 'e.g. 2008-01-01',
    'ph.identifier': 'e.g. 9787536692930',
    'ph.description': 'Enter the book description...',
    'ph.subject': 'e.g. Science Fiction',
    'ph.contributor': 'e.g. Translator, Illustrator',
    'ph.rights': 'e.g. © 2026 Publisher',
    'ph.source': 'e.g. https://...',
    'ph.series': 'e.g. Series Name',
    'ph.seriesIndex': 'e.g. 1',
    'ph.filename': 'e.g. my_book.epub',

    'action.undo': 'Undo',
    'action.redo': 'Redo',
    'action.reset': 'Reset',
    'action.save': 'Save & Export EPUB',

    'update.title': '🚀 New Version Available',
    'update.notesTitle': 'Release Notes:',
    'update.notesLoading': 'Loading release notes...',
    'update.cancel': 'Later',
    'update.start': 'Update Now',
    'update.statusPreparing': 'Preparing to download...',
    'update.statusDownloading': 'Downloading update...',
    'update.statusStarted': 'Starting download...',
    'update.statusFinished': 'Downloaded, preparing to install...',
    'update.progressDownloading': 'Downloading: {0}MB / {1}MB',
    'update.progressDownloaded': 'Downloaded: {0}MB',
    'update.currentVer': 'Current v{0}',
    'update.latestVer': 'Latest v{0}',
    'update.notesFallback': 'Latest performance improvements and fixes.',

    'about.title': 'About MetaEpub',
    'about.description': 'MetaEpub is a lightweight, modern EPUB metadata editor. Easily edit title, author, language, publisher, publication date, description and identifier, replace the cover, and export offline.',
    'about.repo': 'Open Source:',
    'about.env': 'Environment:',
    'about.envText': 'Tauri desktop client (Windows / macOS / Linux)',
    'about.confirm': 'OK',

    'settings.title': '⚙️ Settings',
    'settings.compression': 'Compression level (0-9, higher = smaller but slower)',
    'settings.comp0': '0 - No compression (fastest)',
    'settings.comp1': '1 - Low compression',
    'settings.comp3': '3 - Medium-low compression',
    'settings.comp5': '5 - Medium compression (recommended)',
    'settings.comp7': '7 - High compression',
    'settings.comp9': '9 - Maximum compression (slowest)',
    'settings.exportDir': 'Default export directory',
    'settings.exportDirPlaceholder': 'Not set (system default)',
    'settings.pick': 'Browse',
    'settings.confirm': 'OK',

    'recent.empty': 'No recent files',

    'toast.invalidEpub': 'Please select a valid .epub file!',
    'toast.parsing': 'Parsing EPUB file...',
    'toast.parseSuccess': 'Parsed successfully! You can edit metadata.',
    'toast.parseFail': 'Failed to parse',
    'toast.coverUpdated': 'Cover preview updated. Click "Save" to apply.',
    'toast.reset': 'Reset to initial metadata and filename.',
    'toast.exporting': 'Packaging EPUB...',
    'toast.savedTo': 'EPUB saved to: {0}',
    'toast.exportSuccess': 'EPUB [{0}] exported successfully!',
    'toast.exportFail': 'Export failed',
    'toast.readFail': 'Failed to read file',
    'toast.settingsSaved': 'Settings saved.',
    'toast.dirNativeOnly': 'Native directory picker is desktop-only.',
    'toast.checkingUpdate': 'Checking for updates...',
    'toast.latest': "You're up to date!",
    'toast.checkUpdateFail': 'Check update failed',
    'toast.updateInstalled': 'Update installed, relaunching...',
    'toast.updateInstallFail': 'Update install failed'
  }
};

let currentLang = 'zh';

const LANG_KEY = 'metaepub.lang';

export function initI18n() {
  currentLang = localStorage.getItem(LANG_KEY) || 'zh';
  if (!messages[currentLang]) currentLang = 'zh';
  applyI18n();
}

export function setLang(lang) {
  currentLang = messages[lang] ? lang : 'zh';
  localStorage.setItem(LANG_KEY, currentLang);
  applyI18n();
}

export function getLang() {
  return currentLang;
}

export function t(key, ...args) {
  let s = (messages[currentLang] && messages[currentLang][key]) || messages.zh[key] || key;
  if (args.length) {
    args.forEach((a, i) => {
      s = s.replace(`{${i}}`, String(a));
    });
  }
  return s;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    el.setAttribute('alt', t(el.getAttribute('data-i18n-alt')));
  });
  document.documentElement.lang = currentLang;
}