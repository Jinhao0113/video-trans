# MediaForge 开发者文档

本文档面向**开发者**，介绍项目架构、IPC 通信设计、开发规范与扩展指南。

---

## 目录

- [技术架构总览](#技术架构总览)
- [开发环境搭建](#开发环境搭建)
- [项目结构详解](#项目结构详解)
- [Electron 进程通信（IPC）设计](#electron-进程通信ipc设计)
- [FFmpeg 集成层](#ffmpeg-集成层)
- [前端架构](#前端架构)
- [全局设计系统（CSS）](#全局设计系统css)
- [新增功能模块指南](#新增功能模块指南)
- [调试技巧](#调试技巧)
- [构建与发布](#构建与发布)

---

## 技术架构总览

```
┌─────────────── Electron App ──────────────────────────────────────┐
│                                                                   │
│  ┌─── Main Process (Node.js) ──────────────────────────────────┐  │
│  │  index.ts      — 窗口管理 / IPC 注册 / media:// 协议         │  │
│  │  ffmpeg.ts     — FFmpeg 调用、任务管理、流探针               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│            ↕ IPC (contextBridge / ipcMain / ipcRenderer)          │
│  ┌─── Preload Script ─────────────────────────────────────────┐   │
│  │  index.ts      — 安全暴露 window.api 到渲染进程             │   │
│  └─────────────────────────────────────────────────────────────┘  │
│            ↕                                                       │
│  ┌─── Renderer Process (React + Vite) ────────────────────────┐   │
│  │  App.tsx       — 根组件、布局、路由、主题                    │   │
│  │  components/   — 功能页面（转换 / 裁剪 / 批量 / 媒体信息）   │   │
│  │  context/      — SharedFileContext（跨模块文件共享）          │   │
│  │  hooks/        — useTheme（主题持久化）                      │   │
│  │  utils/        — IPC 类型封装、格式元数据                    │   │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 安全模型

| 设置 | 值 | 说明 |
|------|-----|------|
| `contextIsolation` | `true` | 渲染进程与预加载脚本隔离 |
| `nodeIntegration` | `false` | 渲染进程不可直接使用 Node API |
| `sandbox` | `false` | 主进程功能通过 contextBridge 安全暴露 |
| `webSecurity` | `true` | 保留 Web 安全策略 |

---

## 开发环境搭建

### 前置工具

```bash
node --version   # 需要 >= 18
npm --version    # 随 Node.js 附带
ffmpeg -version  # 确认 FFmpeg 可被检测
```

### 安装与启动

```bash
# 克隆仓库
git clone https://github.com/your-username/mediaforge.git
cd mediaforge

# 安装依赖
npm install

# 启动开发模式（热重载）
npm run dev
```

`npm run dev` 会同时启动：
- **electron-vite** 构建 main/preload/renderer 三个进程
- **Electron** 加载 `ELECTRON_RENDERER_URL`（开发时为本地 Vite 服务）

### 可用脚本

```bash
npm run dev        # 开发模式（热重载）
npm run build      # 编译 TypeScript（不打包）
npm run preview    # 预览生产版本
npm run pack       # 打包为目录（不生成安装包，用于快速测试）
npm run dist       # 生成所有平台安装包
npm run dist:mac   # 仅生成 macOS 包
npm run dist:win   # 仅生成 Windows 包
npm run dist:linux # 仅生成 Linux 包
```

---

## 项目结构详解

### `src/main/index.ts` — 主进程入口

职责：

1. **窗口管理**：创建 `BrowserWindow`，配置无标题栏（`frame: false`），macOS 使用 `hiddenInset` 样式保留系统红绿灯。
2. **media:// 协议**：注册自定义协议，安全地将本地文件映射为可播放的媒体资源（支持 Range 请求/流式传输）。
3. **IPC 注册**：统一在 `registerIpcHandlers()` 中挂载所有 `ipcMain.handle/on` 监听器。
4. **平台适配**：macOS 下 `window-all-closed` 不退出进程（符合 macOS 行为规范）。

### `src/main/ffmpeg.ts` — FFmpeg 集成模块

职责：

- FFmpeg 路径自动检测（优先级：内置二进制 → 系统 PATH → 常见路径）
- `probeFile()`：调用 ffprobe 获取媒体元数据
- `convertFile()`：格式转换，支持完整编解码参数与硬件加速
- `trimVideo()`：视频裁剪，使用 output-side seek 保证帧精度
- `extractSubtitles()` / `embedSubtitles()`：字幕操作
- `cancelTask()`：通过 SIGKILL 终止正在运行的 FFmpeg 进程

所有耗时操作均返回 `Promise`，通过 `onProgress` 回调实时上报进度。

### `src/preload/index.ts` — 预加载桥接

通过 `contextBridge.exposeInMainWorld('api', electronAPI)` 将安全 API 挂载到 `window.api`，渲染进程通过 `window.api.xxx()` 调用，全程不接触 Node.js 原始 API。

关键 API 设计：

```ts
// 进度监听返回取消函数（防内存泄漏）
onProgress: (callback) => () => void

// 拖放文件路径获取（依赖 webUtils）
getPathForFile: (file: File) => string
```

---

## Electron 进程通信（IPC）设计

### 通信模式

| 模式 | 使用场景 | 示例 |
|------|---------|------|
| `ipcMain.handle` + `ipcRenderer.invoke` | 请求-响应型（有返回值） | 文件探针、格式转换 |
| `ipcMain.on` + `ipcRenderer.send` | 单向通知（无需响应） | 窗口最小化/关闭 |
| `event.sender.send` | 主进程主动推送 | 进度更新事件 |

### IPC 频道命名规范

格式：`domain:action`

```
window:minimize       // 窗口控制
window:maximize
window:close
window:isMaximized

ffmpeg:status         // FFmpeg 状态与操作
ffmpeg:setPath
ffmpeg:probe
ffmpeg:convert
ffmpeg:trim
ffmpeg:cancel
ffmpeg:extractSubtitles
ffmpeg:embedSubtitles
ffmpeg:progress       // ← 主进程推送给渲染进程

dialog:openFile       // 系统对话框
dialog:openFiles
dialog:saveFile
dialog:openDirectory

shell:showItemInFolder // Shell 操作
```

### 进度事件流

```
Renderer                  Main
   |                        |
   |-- ffmpeg:convert ----> |  开始任务
   |                        |
   | <-- ffmpeg:progress -- |  进度 10%
   | <-- ffmpeg:progress -- |  进度 50%
   | <-- ffmpeg:progress -- |  进度 100%
   |                        |
   | <-- invoke resolved -- |  任务完成 { success: true }
```

渲染进程通过 `window.api.onProgress(cb)` 注册监听，该方法返回一个**取消函数**，组件卸载时应调用以移除监听器，避免内存泄漏：

```tsx
useEffect(() => {
  const unsubscribe = window.api?.onProgress((data) => {
    // 处理进度
  })
  return () => unsubscribe?.()
}, [])
```

---

## FFmpeg 集成层

### 路径检测策略

```ts
function detectFFmpegPath(): { ffmpegPath, ffprobePath } | null {
  // 1. 优先检查打包内置路径
  //    - 生产: process.resourcesPath/ffmpeg-bin/ffmpeg
  //    - 开发: app.getAppPath()/ffmpeg-bin/ffmpeg
  
  // 2. 检查系统 PATH（which/where）
  
  // 3. 检查常见安装位置（Homebrew、winget 默认路径等）
}
```

### 硬件加速实现

| 加速方式 | FFmpeg 实现 |
|---------|------------|
| VideoToolbox (macOS) | `-hwaccel videotoolbox` 输入选项 |
| NVENC (NVIDIA) | 使用 `h264_nvenc` 等 GPU 编解码器名称 |
| QSV (Intel) | `-hwaccel qsv` 输入选项 |
| VAAPI (Linux) | `-hwaccel vaapi -hwaccel_output_format vaapi` |

### 任务取消机制

```ts
const activeTasks = new Map<string, FfmpegCommand>()

// 开始任务时注册
activeTasks.set(taskId, cmd)

// 取消时发送 SIGKILL
cmd.kill('SIGKILL')
activeTasks.delete(taskId)
```

每次 `convert` / `trim` 调用都生成一个唯一的 `taskId`（UUID），渲染进程通过此 ID 区分不同任务的进度事件，也用于取消特定任务。

---

## 前端架构

### 组件职责

| 组件 | 文件 | 主要职责 |
|------|------|---------|
| `App` | App.tsx | 全局布局、侧边栏导航、主题切换、FFmpeg 状态轮询 |
| `Converter` | components/Converter.tsx | 单文件格式转换，参数配置 UI |
| `Trimmer` | components/Trimmer.tsx | 视频裁剪，时间轴 + 视频预览 |
| `BatchProcessor` | components/BatchProcessor.tsx | 多文件批量处理队列 |
| `MediaInfo` | components/MediaInfo.tsx | 媒体流信息展示、字幕操作 |
| `Settings` | components/Settings.tsx | FFmpeg 路径设置 |

### SharedFileContext — 跨模块文件共享

**问题**：用户在「格式转换」中选好文件后，切到「媒体信息」还需重新选，体验割裂。

**解决方案**：在 App 根节点包裹 `SharedFileProvider`，将文件路径与 probe 数据存储于全局 Context。

```tsx
// App.tsx
<SharedFileProvider>
  {/* 所有子组件均可访问 */}
</SharedFileProvider>
```

```ts
// 任意子组件中使用
const { sharedFile, loadSharedFile, clearSharedFile } = useSharedFile()

// 选中文件后调用（自动触发 ffprobe）
await loadSharedFile('/path/to/video.mp4')

// 读取结果
sharedFile.filePath    // 文件路径
sharedFile.probeData   // ffprobe 元数据
sharedFile.isLoading   // 是否加载中
sharedFile.error       // 错误信息
```

### useTheme Hook

```ts
const { theme, toggleTheme } = useTheme()
// theme: 'light' | 'dark'
// 偏好持久化至 localStorage，并实时更新 <html data-theme="...">
```

CSS 变量通过 `[data-theme="dark"]` 选择器切换，无需 JavaScript 动态修改样式。

### utils/ipc.ts

封装了所有 IPC 调用的 TypeScript 类型，以及从原始 `ProbeResult` 中提取视频流、音频流等的工具函数。组件应通过此文件的封装调用，而非直接使用 `window.api`，这样更易测试和替换。

### utils/formats.ts

定义了支持的输出格式列表与每种格式对应的：
- 可用视频编解码器
- 可用音频编解码器
- 文件扩展名
- 格式描述

新增格式支持只需在此文件中添加条目。

---

## 全局设计系统（CSS）

`src/renderer/src/styles/global.css` 定义了完整的设计 Token 体系。

### CSS 变量（部分）

```css
/* 颜色 */
--bg-primary       /* 主背景 */
--bg-secondary     /* 次级背景（卡片、面板） */
--bg-tertiary      /* 第三层背景 */
--accent-primary   /* 强调色（按钮、高亮） */
--text-primary     /* 主文字 */
--text-secondary   /* 次级文字 */
--text-tertiary    /* 辅助文字 */
--border-color     /* 边框色 */

/* 间距 */
--spacing-xs / sm / md / lg / xl / 2xl

/* 圆角 */
--border-radius-sm / md / lg / xl / full

/* 阴影 */
--shadow-sm / md / lg
```

### 主题切换

亮色/暗色主题完全通过 CSS 变量实现，切换时只需修改 `<html>` 标签的 `data-theme` 属性：

```css
:root { /* 默认（暗色）变量 */ }
[data-theme="light"] { /* 覆盖为亮色值 */ }
```

### 动画工具类

```css
.animate-fade-in    /* 淡入（页面切换使用） */
.animate-slide-up   /* 向上滑入 */
```

---

## 新增功能模块指南

以下步骤演示如何添加一个新的功能页（以「音频提取」为例）：

### 1. 创建组件文件

```
src/renderer/src/components/AudioExtractor.tsx
```

基本结构参考 `Converter.tsx`：
- 文件选择（拖拽 + 按钮）
- 调用 `window.api.convert(...)` 或新的 IPC 调用
- 进度展示

### 2. 在 App.tsx 中注册导航项

```tsx
// 在 NAV_ITEMS 数组中添加
{ id: 'audio-extractor', icon: Music, label: '音频提取' }

// 在 renderPage() 中添加分支
case 'audio-extractor':
  return <AudioExtractor />
```

### 3. 如需新 IPC 调用

**主进程** (`src/main/ffmpeg.ts`)：
```ts
export function extractAudio(
  input: string,
  output: string,
  taskId: string,
  onProgress: (p: ProgressInfo) => void
): Promise<{ success: boolean; output: string }> {
  // fluent-ffmpeg 实现
}
```

**主进程注册** (`src/main/index.ts`)：
```ts
ipcMain.handle('ffmpeg:extractAudio', async (event, args) => {
  return extractAudio(args.input, args.output, args.taskId, (progress) => {
    event.sender.send('ffmpeg:progress', { taskId: args.taskId, progress })
  })
})
```

**预加载** (`src/preload/index.ts`)：
```ts
// 在 ElectronAPI 接口中添加
extractAudio: (args: { input: string; output: string; taskId: string }) => Promise<unknown>

// 在实现中添加
extractAudio: (args) => ipcRenderer.invoke('ffmpeg:extractAudio', args),
```

### 4. 在 utils/formats.ts 中添加格式元数据（如需要）

---

## 调试技巧

### 打开 DevTools

在 `src/main/index.ts` 的 `createWindow()` 中，开发模式下会自动打开 DevTools（electron-vite 默认行为）。也可手动触发：

```ts
mainWindow.webContents.openDevTools()
```

### 查看主进程日志

主进程的 `console.log` 输出在**终端**（运行 `npm run dev` 的窗口）中查看，不在浏览器 DevTools 中。

### FFmpeg 命令调试

`src/main/ffmpeg.ts` 中 `.on('start', commandLine => console.log(...))` 会打印完整的 FFmpeg 命令行，可复制到终端手动执行验证。

### IPC 调试

在预加载脚本中临时添加日志：

```ts
const originalConvert = electronAPI.convert
electronAPI.convert = (args) => {
  console.log('[IPC] ffmpeg:convert', args)
  return originalConvert(args)
}
```

### media:// 协议调试

如果视频预览失败，检查浏览器控制台的网络请求。`media://` 协议的错误会在主进程终端输出，包含详细的路径解析信息。

---

## 构建与发布

详见 **[build.md](../build.md)**，包含：

- 各平台 FFmpeg 二进制文件准备
- macOS 签名与公证配置
- Windows 代码签名
- GitHub Actions CI/CD 配置示例
- 跨平台构建兼容性矩阵
- 文件大小优化策略

### 快速打包测试

```bash
# 编译但不打包为安装文件（最快）
npm run pack
# 输出在 release/{platform}-unpacked/

# 完整安装包
npm run dist
# 输出在 release/
```
