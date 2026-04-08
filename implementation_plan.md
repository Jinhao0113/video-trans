# MediaForge - 跨平台 FFmpeg 媒体处理应用

基于 Electron + Vite + React 构建的跨平台媒体格式转换与处理工具，使用系统/捆绑的 FFmpeg 二进制文件（不使用 `ffmpeg-static`）。

## User Review Required

> [!IMPORTANT]
> **FFmpeg 二进制分发策略**：不使用 `ffmpeg-static`，而是要求用户在系统中安装 FFmpeg，或在打包时手动将 FFmpeg 二进制文件放入 `extraResources` 目录。`build.md` 将详细说明各平台的操作。

> [!IMPORTANT]
> **技术栈选择**：Electron + Vite + React + TypeScript。UI 使用纯 CSS（不使用 Tailwind），包含精美暗色/亮色模式切换。

## 核心功能

1. **格式转换（核心）**
   - 支持主流视频格式：MP4, MKV, AVI, MOV, WebM, FLV, WMV, TS
   - 支持主流音频格式：MP3, AAC, WAV, FLAC, OGG, WMA
   - 可选视频编码器：H.264, H.265/HEVC, VP9, AV1
   - 可选音频编码器：AAC, MP3, FLAC, Opus, Vorbis
   - 自定义比特率、分辨率、帧率等参数

2. **视频裁剪（Trimmer）**
   - 内置 HTML5 视频预览播放器
   - 可视化时间轴选择起止时间
   - 精确到帧的裁剪控制
   - 实时预览裁剪区域

3. **批处理**
   - 拖拽添加多个文件
   - 统一设置输出格式和参数
   - 队列管理（开始/暂停/取消）
   - 进度条显示每个文件和总体进度

4. **拖拽支持**
   - 全局拖拽区域
   - 支持拖拽文件到任意模块

5. **暗色/亮色模式**
   - 系统偏好自动检测
   - 手动切换
   - CSS 变量驱动的主题系统

## 架构设计

```
video-trans-elec/
├── electron.vite.config.ts          # Vite 配置
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── build.md                         # 各平台打包说明
├── resources/                       # 应用图标等静态资源
├── src/
│   ├── main/                        # Electron 主进程
│   │   ├── index.ts                 # 主入口，窗口管理
│   │   └── ffmpeg.ts                # FFmpeg 封装（路径检测、命令执行、进度解析）
│   ├── preload/                     # 预加载脚本
│   │   └── index.ts                 # contextBridge API 暴露
│   └── renderer/                    # 渲染进程（React）
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx             # React 入口
│       │   ├── App.tsx              # 主应用组件
│       │   ├── styles/
│       │   │   ├── global.css       # 全局样式 + CSS 变量主题
│       │   │   └── components.css   # 组件样式
│       │   ├── components/
│       │   │   ├── Layout.tsx       # 布局（侧边栏 + 内容区）
│       │   │   ├── Sidebar.tsx      # 侧边栏导航
│       │   │   ├── ThemeToggle.tsx  # 主题切换
│       │   │   ├── DropZone.tsx     # 拖拽上传区域
│       │   │   ├── FileList.tsx     # 文件列表
│       │   │   ├── ProgressBar.tsx  # 进度条
│       │   │   ├── Converter.tsx    # 格式转换模块
│       │   │   ├── Trimmer.tsx      # 视频裁剪模块
│       │   │   ├── BatchProcessor.tsx # 批处理模块
│       │   │   └── Settings.tsx     # FFmpeg 路径设置
│       │   ├── hooks/
│       │   │   ├── useFFmpeg.ts     # FFmpeg 操作 Hook
│       │   │   └── useTheme.ts      # 主题管理 Hook
│       │   └── utils/
│       │       ├── formats.ts       # 格式/编码器常量定义
│       │       └── ipc.ts           # IPC 通信封装
│       └── ...
```

## Proposed Changes

### 1. 项目基础架构

#### [NEW] package.json
Electron + Vite + React + TypeScript 项目配置，包含 `electron-vite`、`fluent-ffmpeg`、`react`、`electron-builder` 等依赖。

#### [NEW] electron.vite.config.ts
配置主进程、预加载脚本和渲染进程的 Vite 构建选项。

#### [NEW] tsconfig*.json
TypeScript 配置文件。

---

### 2. Electron 主进程

#### [NEW] src/main/index.ts
- 窗口创建与管理
- `media://` 协议注册（安全访问本地视频文件预览）
- IPC 处理器注册

#### [NEW] src/main/ffmpeg.ts
- FFmpeg 路径自动检测（PATH / 常见安装位置 / app 内置）
- `fluent-ffmpeg` 封装
- 格式转换执行与进度回传
- 视频裁剪执行
- 文件元数据探测（ffprobe）
- 批处理队列管理

---

### 3. 预加载脚本

#### [NEW] src/preload/index.ts
通过 `contextBridge` 安全暴露 API：
- `convertFile(input, output, options)` → 格式转换
- `trimVideo(input, output, start, end)` → 视频裁剪
- `probeFile(path)` → 获取文件信息
- `selectOutputPath()` → 选择输出路径
- `onProgress(callback)` → 进度监听
- `getFFmpegStatus()` → 检查 FFmpeg 是否可用
- `batchProcess(files, options)` → 批处理

---

### 4. 渲染进程（React UI）

#### [NEW] src/renderer/src/styles/global.css
完整的 CSS 变量主题系统：
- **亮色模式**：清新浅色背景 + 蓝紫色调强调色
- **暗色模式**：深色背景 + 霓虹蓝/紫渐变强调色
- 玻璃态效果（glassmorphism）
- 平滑过渡动画
- 响应式排版

#### [NEW] src/renderer/src/components/Converter.tsx
格式转换核心界面：
- 拖拽/选择输入文件
- 输出格式选择（下拉菜单 + 编码器选项）
- 参数配置面板（比特率、分辨率、帧率等）
- 实时进度展示
- 输出路径选择

#### [NEW] src/renderer/src/components/Trimmer.tsx
视频裁剪界面：
- HTML5 `<video>` 预览播放器
- 自定义时间轴滑块（双手柄选择起止时间）
- 播放/暂停控制
- 当前时间显示
- 精确时间输入框
- 裁剪执行与进度

#### [NEW] src/renderer/src/components/BatchProcessor.tsx
批处理界面：
- 多文件拖拽添加
- 文件列表（可删除/重排）
- 统一输出格式设置
- 队列进度管理
- 开始/暂停/全部取消

---

### 5. 打包文档

#### [NEW] build.md
各平台打包指南：
- macOS：签名、公证、FFmpeg 二进制位置
- Windows：安装包配置、FFmpeg 二进制位置
- Linux：AppImage/deb/rpm、FFmpeg 依赖声明

## UI 设计理念

- **玻璃态侧边栏**：半透明背景 + 模糊效果
- **渐变强调色**：蓝→紫渐变用于按钮和高亮
- **微动画**：hover 效果、进度条动画、页面切换过渡
- **圆角卡片布局**：内容区使用卡片式布局，视觉层次清晰
- **Google Fonts**：使用 Inter 字体
- **响应式设计**：适应不同窗口大小

## Open Questions

1. **是否需要支持硬件加速编码（NVENC/QSV/VideoToolbox）**？这会增加编码器选项的复杂度。
2. **是否需要支持字幕提取/嵌入功能**？
3. **应用名称**：暂定为 "MediaForge"，是否有其他偏好？

## Verification Plan

### Automated Tests
- 运行 `npm run dev` 验证开发环境启动
- 测试拖拽上传功能
- 测试格式转换流程
- 测试视频裁剪预览与执行
- 测试批处理队列管理
- 测试暗色/亮色模式切换

### Manual Verification
- 在浏览器中用 `npm run dev` 验证 UI 渲染效果
- 截图验证亮色和暗色两种模式的视觉效果
- 使用实际视频文件测试转换/裁剪功能
