# 📚 MetaEpub - 现代化 EPUB 元数据编辑器

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue.svg?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**MetaEpub** 是一款基于 **Tauri 2.0 + Rust + Vite** 构建的轻量级、跨平台 EPUB 电子书元数据编辑器。采用精致现代的深色磨砂玻璃 UI 设计，帮助你轻松修改 EPUB 文件的基本元数据和封面图片，并一键重新导出。

---

## ✨ 核心特性

- 📖 **拖拽即用**：支持拖拽或直接选择电脑中的 `.epub` 电子书文件，自动解析并提取内部元数据。
- ✏️ **元数据全面编辑**：
  - 书名 (Title)
  - 作者 (Author)
  - 语言代码 (Language, 如 `zh-CN`, `en`)
  - 出版商 (Publisher)
  - 出版日期 (Date)
  - 标识符 (ISBN / UUID)
  - 书籍简介与描述 (Description)
  - 自定义导出文件名
- 🖼️ **封面自由替换**：实时预览当前电子书封面，支持一键上传并替换新的封面图片。
- ⚡ **毫秒级极速打包导出**：底层离线解包与压缩打包，不依赖任何第三方服务器，保护电子书内容隐私。
- 🚀 **内置自动更新 (Auto-updater)**：支持版本检测与一键增量/全量静默升级，时刻保持最新功能体验。
- 🎨 **现代化极致视觉**：暗黑玻璃磨砂美学、流线型按钮、实时下载进度反馈与丰富的弹窗动画。

---

## 🛠️ 技术栈

- **核心框架**：[Tauri v2](https://tauri.app/) (Rust 强力驱动)
- **前端架构**：HTML5 + Vanilla JavaScript (ES Modules) + Vite
- **底层压缩/解析**：JSZip + Rust Backend
- **样式设计**：Vanilla CSS (Flexbox / Grid / Glassmorphism Design System)

---

## 🚀 快速开始

### 前置要求

在开始构建或本地开发前，请确保开发环境已安装：
- [Node.js](https://nodejs.org/) (建议 v18 或更高版本)
- [Rust Toolchain](https://www.rust-lang.org/tools/install) (Stable 版本)

### 本地开发

1. **克隆本仓库**：
   ```bash
   git clone git@github.com:mangerle/MetaEpub.git
   cd MetaEpub
   ```

2. **安装前端依赖**：
   ```bash
   npm install
   ```

3. **启动 Tauri 桌面开发环境**：
   ```bash
   npm run tauri dev
   ```

### 生产打包构建

运行以下命令即可在本地构建适用于当前操作系统平台的可执行应用发布包（`.msi` / `.nsis` / `.app` / `.deb` / `.tar.gz`）：

```bash
npm run tauri build
```

构建生成的二进制产物将存放于 `src-tauri/target/release/bundle/` 目录下。

---

## 🔄 自动化构建与发布流程 (CI/CD)

本项目配置了完整的 GitHub Actions 工作流（[`.github/workflows/build.yml`](.github/workflows/build.yml)）。

当需要发布全新版本时，只需推送对应的版本 Tag：

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会自动在云端 (Windows / macOS / Linux) 完成跨平台并行打包，自动生成带 ED25519 数字签名的发布包以及 `latest.json` 更新元信息，并同步自动发布至 GitHub Releases 页面，打通客户端内“检查更新”流程！

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。欢迎提交 Issue 或 Pull Request！
