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

    return {
      title: getText('title'),
      creator: getText('creator'),
      language: getText('language'),
      publisher: getText('publisher'),
      identifier: getText('identifier'),
      date: getText('date'),
      description: getText('description')
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
   */
  async save(newMetadata) {
    if (!this.zip || !this.opfDoc) {
      throw new Error('未加载任何 EPUB 文件');
    }

    const metadataEl = this.opfDoc.querySelector('metadata') || this.opfDoc.querySelector('opf\\:metadata');
    if (!metadataEl) {
      throw new Error('OPF XML 中缺失 <metadata> 节点');
    }

    // 常用 Dublin Core 字段映射
    const fields = ['title', 'creator', 'language', 'publisher', 'identifier', 'date', 'description'];

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
    return await newZip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
  }

  /**
   * 将新封面写入 ZIP 并在 OPF 中保留/创建对应清单项
   */
  async updateCoverInZip(file) {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
    const mimeType = file.type || this.getMIMETypeFromPath(ext);

    let targetCoverPath = this.coverPath;
    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);

    if (!targetCoverPath) {
      // 如果此前没有封面，新建一个标准路径
      targetCoverPath = `${opfDir}cover${ext}`;
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
    }

    // 写入图片二进制文件
    this.zip.file(targetCoverPath, arrayBuffer);
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
