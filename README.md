# MediaForge

> 🎬 跨平台媒体处理桌面应用 · 基于 Electron + React + FFmpeg

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/electron-33-9FEAF9)](https://www.electronjs.org)

MediaForge 是一款功能强大的跨平台媒体处理工具，以 Electron 为壳、React 为界面框架、FFmpeg 为核心引擎，提供格式转换、视频裁剪、批量处理、媒体信息查看等一站式功能。应用支持亮/暗双主题，所有重量级媒体操作均在主进程后台执行，界面流畅不卡顿。

---

## ✨ 核心功能

| 模块 | 说明 |
|------|------|
| **格式转换** | 支持主流视频/音频格式互转，可选视频编解码器、比特率、分辨率、帧率及硬件加速 |
| **视频裁剪** | 可视化时间轴拖拽裁剪，stream copy 模式保证无损快速剪切，内置视频预览 |
| **批量处理** | 多文件拖拽导入，统一输出目录与编码参数，带整体进度追踪 |
| **媒体信息** | 调用 ffprobe 解析文件的完整流信息（视频/音频/字幕），支持字幕提取与嵌入 |
| **设置** | 自定义 FFmpeg 二进制路径、查看版本信息 |

---

## 🖥️ 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | macOS 10.15+, Windows 10+, Ubuntu 20.04+ |

---

## 🚀 快速开始

在[release](https://github.com/Jinhao0113/video-trans/releases/tag/v1.0.6)（国内用户可以使用[这个](https://git.lug.ustc.edu.cn/jinhao_hu/video-trans/-/releases)）下载对应系统最新版本

## 本地构建

### 1. 克隆项目

```bash
git clone https://github.com/your-username/mediaforge.git
cd mediaforge
```

### 2. 安装依赖

```bash
npm install
```

### 3. 确保 FFmpeg 可用

应用会按以下优先级自动检测 FFmpeg：

1. **项目内置** `ffmpeg-bin/{platform}/ffmpeg`（打包分发时推荐）
2. **系统 PATH** 中的 ffmpeg/ffprobe
3. **常见安装路径**（Homebrew、winget 等）

**macOS（推荐）**
```bash
brew install ffmpeg
```

**Windows**
```powershell
winget install ffmpeg
# 或访问 https://www.gyan.dev/ffmpeg/builds/ 下载
```

**Linux (Ubuntu/Debian)**
```bash
sudo apt install ffmpeg
```

### 4. 启动开发模式

```bash
npm run dev
```

## 📂 项目结构

```
mediaforge/
├── src/
│   ├── main/               # Electron 主进程
│   │   ├── index.ts        # 窗口管理、IPC 注册、media:// 协议
│   │   └── ffmpeg.ts       # FFmpeg 封装（转换、裁剪、探针、字幕）
│   ├── preload/
│   │   └── index.ts        # contextBridge 暴露给渲染进程的 API
│   └── renderer/src/       # React 渲染进程
│       ├── App.tsx          # 根组件（布局、导航、主题）
│       ├── components/      # 各功能页面组件
│       │   ├── Converter.tsx
│       │   ├── Trimmer.tsx
│       │   ├── BatchProcessor.tsx
│       │   ├── MediaInfo.tsx
│       │   └── Settings.tsx
│       ├── context/
│       │   └── SharedFileContext.tsx  # 跨模块共享文件状态
│       ├── hooks/
│       │   └── useTheme.ts  # 亮/暗主题持久化 Hook
│       ├── utils/
│       │   ├── ipc.ts       # IPC 调用封装与类型定义
│       │   └── formats.ts   # 格式/编解码器元数据
│       └── styles/
│           └── global.css   # 全局设计系统（CSS 变量、组件样式）
├── electron.vite.config.ts  # electron-vite 构建配置
├── package.json
├── build.md                 # 打包与发布指南
└── README.md
```

---

## 🔑 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Electron 33](https://www.electronjs.org) |
| 前端框架 | [React 18](https://react.dev) + TypeScript |
| 构建工具 | [electron-vite](https://electron-vite.org) |
| 媒体处理 | [FFmpeg](https://ffmpeg.org) via [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) |
| 图标库 | [lucide-react](https://lucide.dev) |

---
## 编写说明

本应用使用Antigravity+Claude+Gemini编写


## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。FFmpeg 的许可证条款请参见 [FFmpeg Legal](https://ffmpeg.org/legal.html)。
