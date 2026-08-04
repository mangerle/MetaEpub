import JSZip from 'jszip';

/**
 * EPUB 处理工具类
 * 负责 EPUB (ZIP) 的读取、OPF XML 解析、元数据提取与回写更新
 */
export class EpubHandler {
  constructor() {
    this.zip = null;
    this.opfPath = '';
    this.opfDoc = null;
    this.coverPath = '';
    this.coverBlobUrl = null;
    this.originalFileName = 'edited_book.epub';
    this.newCoverFile = null; // 存储用户上传的新封面文件
  }

  /**
   * 加载 EPUB 文件
   * @param {File|ArrayBuffer} fileData 
   * @param {string} fileName 
   */
  async load(fileData, fileName = 'book.epub') {
    this.originalFileName = fileName;
    this.newCoverFile = null;
    if (this.coverBlobUrl) {
      URL.revokeObjectURL(this.coverBlobUrl);
      this.coverBlobUrl = null;
    }

    // 1. 使用 JSZip 解压文件
    this.zip = await JSZip.loadAsync(fileData);

    // 2. 读取 META-INF/container.xml 获取 OPF 路径
    const containerFile = this.zip.file('META-INF/container.xml');
    if (!containerFile) {
      throw new Error('无效的 EPUB 文件：缺失 META-INF/container.xml');
    }

    const containerXml = await containerFile.async('text');
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootfileEl = containerDoc.querySelector('rootfile');
    
    if (!rootfileEl || !rootfileEl.getAttribute('full-path')) {
      throw new Error('无效的 EPUB 文件：container.xml 中未指明 rootfile');
    }

    this.opfPath = rootfileEl.getAttribute('full-path');

    // 3. 读取并解析 OPF XML
    const opfFile = this.zip.file(this.opfPath);
    if (!opfFile) {
      throw new Error(`找不到 OPF 文件：${this.opfPath}`);
    }

    const opfXml = await opfFile.async('text');
    this.opfDoc = parser.parseFromString(opfXml, 'application/xml');

    // 4. 提取元数据与封面
    const metadata = this.extractMetadata();
    await this.extractCover();

    return {
      metadata,
      coverUrl: this.coverBlobUrl,
      fileName: this.originalFileName
    };
  }

  /**
   * 提取 OPF 中的 Dublin Core 元数据
   */
  extractMetadata() {
    if (!this.opfDoc) return {};

    const metadataEl = this.opfDoc.querySelector('metadata') || this.opfDoc.querySelector('opf\\:metadata');
    if (!metadataEl) return {};

    const getText = (tagName) => {
      // 兼容有无命名空间前缀的节点查找
      const el = metadataEl.querySelector(`dc\\:${tagName}, ${tagName}`);
      return el ? el.textContent.trim() : '';
    };

    // 读取 OPF meta 元素（如 calibre 约定的系列信息）
    const getMeta = (name) => {
      const el = metadataEl.querySelector(`meta[name="${name}"]`);
      return el ? (el.getAttribute('content') || '').trim() : '';
    };

    return {
      title: getText('title'),
      creator: getText('creator'),
      language: getText('language'),
      publisher: getText('publisher'),
      identifier: getText('identifier'),
      date: getText('date'),
      description: getText('description'),
      subject: getText('subject'),
      contributor: getText('contributor'),
      rights: getText('rights'),
      source: getText('source'),
      series: getMeta('calibre:series'),
      seriesIndex: getMeta('calibre:series_index')
    };
  }

  /**
   * 尝试寻找并提取封面图片
   */
  async extractCover() {
    if (!this.opfDoc) return;

    let coverHref = '';
    const manifestEl = this.opfDoc.querySelector('manifest') || this.opfDoc.querySelector('opf\\:manifest');

    // 方式 1: 寻找 meta[name="cover"]
    const coverMeta = this.opfDoc.querySelector('meta[name="cover"]');
    if (coverMeta && manifestEl) {
      const coverId = coverMeta.getAttribute('content');
      if (coverId) {
        const item = manifestEl.querySelector(`item[id="${coverId}"]`);
        if (item) {
          coverHref = item.getAttribute('href');
        }
      }
    }

    // 方式 2: 寻找 item[properties~="cover-image"] (EPUB3 规范)
    if (!coverHref && manifestEl) {
      const coverItem = manifestEl.querySelector('item[properties*="cover-image"]');
      if (coverItem) {
        coverHref = coverItem.getAttribute('href');
      }
    }

    // 方式 3: 模糊搜索 href 包含 cover 的图片
    if (!coverHref && manifestEl) {
      const items = Array.from(manifestEl.querySelectorAll('item'));
      const fallbackItem = items.find(i => {
        const href = (i.getAttribute('href') || '').toLowerCase();
        const mediaType = i.getAttribute('media-type') || '';
        return mediaType.startsWith('image/') && href.includes('cover');
      });
      if (fallbackItem) {
        coverHref = fallbackItem.getAttribute('href');
      }
    }

    if (coverHref) {
      // 处理相对 OPF 文件的完整路径
      const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);
      this.coverPath = opfDir + coverHref;

      const coverZipFile = this.zip.file(this.coverPath);
      if (coverZipFile) {
        const arrayBuffer = await coverZipFile.async('arraybuffer');
        const mimeType = this.getMIMETypeFromPath(this.coverPath);
        const blob = new Blob([arrayBuffer], { type: mimeType });
        this.coverBlobUrl = URL.createObjectURL(blob);
      }
    }
  }

  /**
   * 设置新封面文件
   * @param {File} file 
   */
  setNewCover(file) {
    this.newCoverFile = file;
    if (this.coverBlobUrl) {
      URL.revokeObjectURL(this.coverBlobUrl);
    }
    this.coverBlobUrl = URL.createObjectURL(file);
    return this.coverBlobUrl;
  }

  /**
   * 更新 EPUB 元数据并导出新的 EPUB Blob
   * @param {Object} newMetadata
   * @param {number} [compressionLevel=9] 压缩级别 0-9
   */
  async save(newMetadata, compressionLevel = 9) {
    if (!this.zip || !this.opfDoc) {
      throw new Error('未加载任何 EPUB 文件');
    }

    const metadataEl = this.opfDoc.querySelector('metadata') || this.opfDoc.querySelector('opf\\:metadata');
    if (!metadataEl) {
      throw new Error('OPF XML 中缺失 <metadata> 节点');
    }

    // 记录书名变更前的原值，用于同步目录/导航中的标题
    const oldTitle = (this.opfDoc.querySelector('dc\\:title') || this.opfDoc.querySelector('title'))?.textContent?.trim() || '';

    // 常用 Dublin Core 字段映射
    const fields = ['title', 'creator', 'language', 'publisher', 'identifier', 'date', 'description', 'subject', 'contributor', 'rights', 'source'];

    fields.forEach(field => {
      const value = newMetadata[field] || '';
      let el = metadataEl.querySelector(`dc\\:${field}`) || metadataEl.querySelector(field);

      if (value) {
        if (!el) {
          // 如果节点不存在则动态创建带 namespace 的节点
          el = this.opfDoc.createElementNS('http://purl.org/dc/elements/1.1/', `dc:${field}`);
          metadataEl.appendChild(el);
        }
        el.textContent = value;
      } else if (el) {
        // 如果值为空，则移除该字段节点
        metadataEl.removeChild(el);
      }
    });

    // 系列名与系列序号（OPF meta 元素，calibre 约定）
    const syncMeta = (name, value) => {
      let meta = metadataEl.querySelector(`meta[name="${name}"]`);
      if (value) {
        if (!meta) {
          meta = this.opfDoc.createElement('meta');
          meta.setAttribute('name', name);
          metadataEl.appendChild(meta);
        }
        meta.setAttribute('content', value);
      } else if (meta) {
        metadataEl.removeChild(meta);
      }
    };
    syncMeta('calibre:series', (newMetadata.series || '').trim());
    syncMeta('calibre:series_index', (newMetadata.seriesIndex || '').trim());

    // 书名变更时同步 EPUB2 目录(NCX) 与 EPUB3 导航文档(Nav) 中的标题
    const newTitle = (newMetadata.title || '').trim();
    if (newTitle && oldTitle !== newTitle) {
      await this.syncTitleInNav(newTitle);
    }

    // 处理新封面图替换
    if (this.newCoverFile) {
      await this.updateCoverInZip(this.newCoverFile);
    }

    // 将修改后的 XML 转换为字符串
    const serializer = new XMLSerializer();
    const updatedOpfXml = serializer.serializeToString(this.opfDoc);

    // 将修改后的 OPF XML 回写到 ZIP 中
    this.zip.file(this.opfPath, updatedOpfXml);

    // 构建符合规范的全新 ZIP 包
    // 规范要求：mimetype 必须为第 1 个条目，且压缩方式必须为 STORE (不压缩)
    const newZip = new JSZip();
    newZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 复制原 zip 中的所有文件（排除 mimetype 及目录结构）
    const fileKeys = Object.keys(this.zip.files);
    for (const key of fileKeys) {
      if (key === 'mimetype') continue;
      const zipObj = this.zip.files[key];
      if (!zipObj || zipObj.dir) continue; // 忽略目录节点

      const zipFile = this.zip.file(key);
      if (!zipFile) continue;

      const fileData = await zipFile.async('arraybuffer');
      newZip.file(key, fileData);
    }

    // 导出 Blob
    const blob = await newZip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel }
    });

    // 导出前校验结构完整性，不合格则阻止导出
    const errors = await this.validate(newZip);
    if (errors.length) {
      throw new Error(`EPUB 结构校验未通过：${errors.join('；')}`);
    }

    return blob;
  }

  /**
   * 校验待导出的 EPUB 结构完整性
   * @param {JSZip} zip 待校验的 ZIP 实例
   * @returns {Promise<string[]>} 校验错误列表（空数组表示通过）
   */
  async validate(zip) {
    const errors = [];
    const keys = Object.keys(zip.files);

    // 1. mimetype 必须是第一个条目且为 STORE 压缩
    const firstKey = keys[0];
    if (firstKey !== 'mimetype') {
      errors.push('mimetype 未位于 ZIP 首位');
    } else {
      const mimeFile = zip.file('mimetype');
      if (mimeFile) {
        const content = await mimeFile.async('text');
        if (content.trim() !== 'application/epub+zip') {
          errors.push('mimetype 内容不正确');
        }
        if (mimeFile.options.compression !== 'STORE') {
          errors.push('mimetype 未使用 STORE 压缩');
        }
      }
    }

    // 2. container.xml 存在且指向的 OPF 存在
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
      errors.push('缺少 META-INF/container.xml');
    } else {
      const containerXml = await containerFile.async('text');
      const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
      const rootfile = containerDoc.querySelector('rootfile');
      const opfPath = rootfile?.getAttribute('full-path');
      if (!opfPath) {
        errors.push('container.xml 未指明 OPF 路径');
      } else if (!zip.file(opfPath)) {
        errors.push(`OPF 文件缺失: ${opfPath}`);
      } else {
        // 3. 校验 spine 引用完整性
        const opfXml = await zip.file(opfPath).async('text');
        const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
        const manifestEl = opfDoc.querySelector('manifest') || opfDoc.querySelector('opf\\:manifest');
        const spineEl = opfDoc.querySelector('spine') || opfDoc.querySelector('opf\\:spine');
        if (manifestEl && spineEl) {
          const idToHref = {};
          Array.from(manifestEl.querySelectorAll('item')).forEach(it => {
            if (it.getAttribute('id')) idToHref[it.getAttribute('id')] = it.getAttribute('href');
          });
          const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
          const idrefs = Array.from(spineEl.querySelectorAll('itemref')).map(r => r.getAttribute('idref'));
          for (const idref of idrefs) {
            const href = idToHref[idref];
            if (!href) {
              errors.push(`spine 引用了不存在的 manifest id: ${idref}`);
            } else if (!zip.file(opfDir + href)) {
              errors.push(`spine 引用的文件缺失: ${href}`);
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * 定位 OPF manifest 中对应封面的 item 节点
   */
  findCoverItem() {
    const manifestEl = this.opfDoc.querySelector('manifest') || this.opfDoc.querySelector('opf\\:manifest');
    if (!manifestEl) return null;

    // 方式 1: meta[name="cover"] 的 content 指向 item 的 id
    const coverMeta = this.opfDoc.querySelector('meta[name="cover"]');
    if (coverMeta) {
      const id = coverMeta.getAttribute('content');
      if (id) {
        const item = manifestEl.querySelector(`item[id="${id}"]`);
        if (item) return item;
      }
    }

    // 方式 2: properties 含 cover-image (EPUB3 规范)
    return manifestEl.querySelector('item[properties*="cover-image"]');
  }

  /**
   * 将新封面写入 ZIP 并在 OPF 中保留/创建对应清单项
   * 修复：替换封面时同步 manifest 的 media-type；扩展名变化时改用新路径并更新 href
   */
  async updateCoverInZip(file) {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
    const mimeType = file.type || this.getMIMETypeFromPath(ext);

    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);

    // 已有封面：替换
    if (this.coverPath) {
      const oldExt = this.coverPath.substring(this.coverPath.lastIndexOf('.')).toLowerCase();
      const coverItem = this.findCoverItem();

      if (ext !== oldExt) {
        // 扩展名变化：改用新路径，并同步 manifest 的 href 与 media-type
        const targetCoverPath = this.coverPath.substring(0, this.coverPath.lastIndexOf('.')) + ext;
        if (coverItem) {
          coverItem.setAttribute('href', targetCoverPath.substring(opfDir.length));
          coverItem.setAttribute('media-type', mimeType);
        }
        // 删除旧文件并替换为新的
        const oldFile = this.zip.file(this.coverPath);
        if (oldFile) this.zip.remove(this.coverPath);
        this.coverPath = targetCoverPath;
        this.zip.file(this.coverPath, arrayBuffer);
      } else {
        // 扩展名相同：仅同步 media-type，防止与默认类型不一致
        if (coverItem) coverItem.setAttribute('media-type', mimeType);
        this.zip.file(this.coverPath, arrayBuffer);
      }
      return;
    }

    // 无封面：新建一个标准路径
    const targetCoverPath = `${opfDir}cover${ext}`;
    this.coverPath = targetCoverPath;

    // 在 manifest 中新建 item
    const manifestEl = this.opfDoc.querySelector('manifest') || this.opfDoc.querySelector('opf\\:manifest');
    if (manifestEl) {
      const item = this.opfDoc.createElement('item');
      item.setAttribute('id', 'cover-image');
      item.setAttribute('href', `cover${ext}`);
      item.setAttribute('media-type', mimeType);
      item.setAttribute('properties', 'cover-image');
      manifestEl.appendChild(item);

      // 创建 meta[name="cover"]
      const metadataEl = this.opfDoc.querySelector('metadata') || this.opfDoc.querySelector('opf\\:metadata');
      if (metadataEl) {
        const meta = this.opfDoc.createElement('meta');
        meta.setAttribute('name', 'cover');
        meta.setAttribute('content', 'cover-image');
        metadataEl.appendChild(meta);
      }
    }

    // 写入图片二进制文件
    this.zip.file(targetCoverPath, arrayBuffer);
  }

  /**
   * 同步书名到 EPUB2 目录(NCX) 与 EPUB3 导航文档(Nav) 中的标题
   * @param {string} bookTitle 新的书名
   */
  async syncTitleInNav(bookTitle) {
    const manifestEl = this.opfDoc.querySelector('manifest') || this.opfDoc.querySelector('opf\\:manifest');
    if (!manifestEl) return;

    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);
    const items = Array.from(manifestEl.querySelectorAll('item'));
    const resolvePath = (href) => opfDir + href;

    // 1. EPUB2 NCX 目录文件（media-type 为 application/x-dtbncx+xml）
    const ncxItem = items.find(it => (it.getAttribute('media-type') || '') === 'application/x-dtbncx+xml');
    if (ncxItem) {
      const ncxPath = resolvePath(ncxItem.getAttribute('href'));
      const ncxFile = this.zip.file(ncxPath);
      if (ncxFile) {
        const ncxXml = await ncxFile.async('text');
        const ncxDoc = new DOMParser().parseFromString(ncxXml, 'application/xml');
        const docTitleText = ncxDoc.querySelector('docTitle text');
        if (docTitleText) {
          docTitleText.textContent = bookTitle;
          this.zip.file(ncxPath, new XMLSerializer().serializeToString(ncxDoc));
        }
      }
    }

    // 2. EPUB3 导航文档（manifest item 的 properties 含 nav）
    const navItem = items.find(it => (it.getAttribute('properties') || '').split(/\s+/).includes('nav'));
    if (navItem) {
      const navPath = resolvePath(navItem.getAttribute('href'));
      const navFile = this.zip.file(navPath);
      if (navFile) {
        const navXml = await navFile.async('text');
        const navDoc = new DOMParser().parseFromString(navXml, 'application/xml');
        const titleEl = navDoc.querySelector('head title');
        if (titleEl) {
          titleEl.textContent = bookTitle;
          this.zip.file(navPath, new XMLSerializer().serializeToString(navDoc));
        }
      }
    }
  }

  /**
   * 提取书籍正文内容预览（前几章纯文本）
   * @param {number} [maxChapters=3] 最多提取的章节数
   * @param {number} [maxChars=2000] 最多返回的字符数
   * @returns {Promise<string>} 纯文本预览
   */
  async extractContentPreview(maxChapters = 3, maxChars = 2000) {
    if (!this.zip || !this.opfDoc) return '';
    const manifestEl = this.opfDoc.querySelector('manifest') || this.opfDoc.querySelector('opf\\:manifest');
    const spineEl = this.opfDoc.querySelector('spine') || this.opfDoc.querySelector('opf\\:spine');
    if (!manifestEl || !spineEl) return '';

    const idToItem = {};
    Array.from(manifestEl.querySelectorAll('item')).forEach(it => {
      idToItem[it.getAttribute('id')] = it;
    });

    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);
    const idrefs = Array.from(spineEl.querySelectorAll('itemref')).map(r => r.getAttribute('idref'));

    let text = '';
    let chapterCount = 0;
    for (const idref of idrefs) {
      const item = idToItem[idref];
      if (!item) continue;
      const mediaType = item.getAttribute('media-type') || '';
      const properties = item.getAttribute('properties') || '';
      // 跳过图片等非文本章节
      if (!mediaType.includes('html') && !mediaType.includes('xml')) continue;
      if (properties.split(/\s+/).includes('cover-image')) continue;

      const file = this.zip.file(opfDir + item.getAttribute('href'));
      if (!file) continue;

      const content = await file.async('text');
      const doc = new DOMParser().parseFromString(content, 'text/html');
      const clean = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
      if (clean) {
        text += `\n${clean}`;
        chapterCount++;
      }
      if (chapterCount >= maxChapters) break;
    }

    const trimmed = text.trim();
    return trimmed.length > maxChars ? trimmed.slice(0, maxChars) + '…' : trimmed;
  }

  getMIMETypeFromPath(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return 'image/jpeg';
  }
}
