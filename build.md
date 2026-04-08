# MediaForge 构建与打包指南

本文档说明如何为不同平台构建和打包 MediaForge 应用，以及每个平台需要注意的 FFmpeg 二进制文件处理。

## 前置要求

- **Node.js** >= 18
- **npm** 或 **yarn** 或 **pnpm**
- **FFmpeg** 已安装在系统中（开发时需要）

## 开发环境

```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev
```

## 构建生产版本

```bash
# 构建所有平台
npm run build

# 仅打包（不创建安装包）
npm run pack

# 创建安装包
npm run dist
```

---

## 各平台打包说明

### FFmpeg 二进制文件策略

MediaForge **不使用** `ffmpeg-static` npm 包。应用支持两种 FFmpeg 获取方式：

1. **系统安装的 FFmpeg**（推荐开发和高级用户使用）
2. **打包内置 FFmpeg 二进制文件**（推荐分发使用）

如果你想将 FFmpeg 内置到应用包中，需要在项目根目录创建以下结构：

```
ffmpeg-bin/
├── mac/            # macOS
│   ├── ffmpeg
│   └── ffprobe
├── win/             # Windows
│   ├── ffmpeg.exe
│   └── ffprobe.exe
└── linux/          # Linux
    ├── ffmpeg
    └── ffprobe
```

`electron-builder` 在 `package.json` 中已配置 `extraResources`，会自动将对应平台的二进制文件打包到应用资源目录中。

---

### 🍎 macOS

#### 获取 FFmpeg 二进制文件

```bash
# 方法 1: 从 Homebrew 复制（仅限 macOS 构建）
cp $(which ffmpeg) ffmpeg-bin/mac/ffmpeg
cp $(which ffprobe) ffmpeg-bin/mac/ffprobe

# 方法 2: 从官方静态构建下载
# 访问 https://evermeet.cx/ffmpeg/ 下载 macOS 静态构建版本
# 或使用 https://github.com/BtbN/FFmpeg-Builds/releases
```

#### 构建命令

```bash
npm run dist:mac
```

#### 签名与公证（发布时必需）

如果需要分发到用户或上架 App Store：

```bash
# 设置签名环境变量
export CSC_LINK=path/to/your/Developer_ID_Application.p12
export CSC_KEY_PASSWORD=your_password

# 公证（macOS 10.15+ 要求）
export APPLE_ID=your_apple_id@email.com
export APPLE_APP_SPECIFIC_PASSWORD=your_app_specific_password
export APPLE_TEAM_ID=your_team_id

# 在 package.json 的 build.mac 中添加：
# "hardenedRuntime": true,
# "entitlements": "entitlements.mac.plist",
# "entitlementsInherit": "entitlements.mac.plist",
# "notarize": true
```

**entitlements.mac.plist** 文件（如果需要签名，在项目根目录创建）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

#### 输出

- `release/MediaForge-x.x.x.dmg` - DMG 安装包
- `release/MediaForge-x.x.x-mac.zip` - ZIP 压缩包

#### 注意事项

- macOS 下的 FFmpeg 二进制文件需要 `chmod +x` 确保有执行权限
- 如果使用 Apple Silicon (M1/M2/M3)，确保 FFmpeg 二进制为 arm64 或 universal 版本
- VideoToolbox 硬件加速仅在 macOS 上可用

---

### 🪟 Windows

#### 获取 FFmpeg 二进制文件

```powershell
# 方法 1: 从官方下载
# 访问 https://www.gyan.dev/ffmpeg/builds/ 下载 Windows 静态构建
# 选择 "ffmpeg-release-essentials.zip" 或 "ffmpeg-release-full.zip"

# 方法 2: 使用 winget
winget install ffmpeg

# 将 ffmpeg.exe 和 ffprobe.exe 复制到:
# ffmpeg-bin/win/ffmpeg.exe
# ffmpeg-bin/win/ffprobe.exe
```

#### 构建命令

```bash
npm run dist:win
```

#### 代码签名（可选，推荐用于分发）

```bash
# 设置签名环境变量
set CSC_LINK=path/to/your/certificate.pfx
set CSC_KEY_PASSWORD=your_password
```

#### 输出

- `release/MediaForge Setup x.x.x.exe` - NSIS 安装包
- `release/MediaForge-x.x.x-win.zip` - ZIP 便携版

#### 注意事项

- Windows 上 NVENC 硬件加速需要 NVIDIA GPU 和最新驱动
- QSV 硬件加速需要 Intel 集成显卡
- FFmpeg 二进制通常是 `.exe` 后缀
- 如果未签名，用户可能会看到 SmartScreen 警告

---

### 🐧 Linux

#### 获取 FFmpeg 二进制文件

```bash
# 方法 1: 从包管理器安装（用户自行安装，不内置）
# Ubuntu/Debian: sudo apt install ffmpeg
# Fedora: sudo dnf install ffmpeg
# Arch: sudo pacman -S ffmpeg

# 方法 2: 下载静态构建用于内置
# 访问 https://johnvansickle.com/ffmpeg/ 下载 Linux 静态构建
# 或 https://github.com/BtbN/FFmpeg-Builds/releases

# 将下载的二进制文件复制到:
# ffmpeg-bin/linux/ffmpeg
# ffmpeg-bin/linux/ffprobe
chmod +x ffmpeg-bin/linux/ffmpeg ffmpeg-bin/linux/ffprobe
```

#### 构建命令

```bash
npm run dist:linux
```

#### 输出

- `release/MediaForge-x.x.x.AppImage` - AppImage 便携包
- `release/mediaforge_x.x.x_amd64.deb` - Debian/Ubuntu 安装包

#### 注意事项

- AppImage 需要 `FUSE` 支持 (大部分现代 Linux 发行版已内置)
- VAAPI 硬件加速需要安装 `libva` 和对应的驱动
- 确保 FFmpeg 二进制文件有执行权限
- 如果需要 RPM 包，在 `package.json` 的 `build.linux.target` 中添加 `"rpm"`

---

## 跨平台构建注意事项

### 在一个平台构建其他平台的包

electron-builder 支持跨平台构建，但有一些限制：

| 构建平台 | macOS 包 | Windows 包 | Linux 包 |
|---------|-----------|------------|----------|
| macOS   | ✅        | ✅         | ✅       |
| Windows | ❌        | ✅         | ❌       |
| Linux   | ❌        | ✅ (需要 Wine) | ✅   |

> **建议**：使用 [GitHub Actions](https://github.com/electron/forge/blob/main/docs/guides/github-actions.md) 或类似 CI/CD 工具在各平台原生环境中构建。

### CI/CD 配置示例 (GitHub Actions)

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install FFmpeg
        uses: FedericoCarboni/setup-ffmpeg@v3

      - name: Copy FFmpeg binaries
        run: |
          mkdir -p ffmpeg-bin/${{ runner.os == 'macOS' && 'darwin' || runner.os == 'Windows' && 'win32' || 'linux' }}
          cp $(which ffmpeg) ffmpeg-bin/${{ runner.os == 'macOS' && 'darwin' || runner.os == 'Windows' && 'win32' || 'linux' }}/
          cp $(which ffprobe) ffmpeg-bin/${{ runner.os == 'macOS' && 'darwin' || runner.os == 'Windows' && 'win32' || 'linux' }}/
        shell: bash

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-build
          path: release/*
```

---

## FFmpeg 硬件加速支持

| 加速方式        | 平台      | 需要的硬件/驱动                |
|----------------|-----------|-------------------------------|
| VideoToolbox   | macOS     | macOS 10.8+，内置支持          |
| NVENC          | Win/Linux | NVIDIA GPU + 驱动 >= 471.41   |
| QSV            | Win/Linux | Intel GPU + Intel Media SDK   |
| VAAPI          | Linux     | Intel/AMD GPU + libva + 驱动   |

> **提示**：并非所有 FFmpeg 构建都包含所有硬件加速器。下载时请选择 "full" 或包含硬件加速的版本。

---

## 文件大小优化

内置 FFmpeg 会显著增加应用包大小（约 70-150 MB）。以下策略可减小体积：

1. **使用精简版 FFmpeg**：只包含常用编解码器
2. **自行编译 FFmpeg**：仅启用需要的功能
3. **不内置 FFmpeg**：要求用户自己安装（应用会自动检测系统 PATH）

---

## 许可证说明

FFmpeg 使用 LGPL 或 GPL 许可证（取决于启用的功能）。如果内置分发：

- **LGPL 版本**：必须动态链接，或提供用户替换库的方式
- **GPL 版本**：你的应用也必须以 GPL 发布，或购买商业许可

建议使用仅包含 LGPL 组件的 FFmpeg 构建，或让用户自行安装。

详情请参阅 [FFmpeg License](https://ffmpeg.org/legal.html)
