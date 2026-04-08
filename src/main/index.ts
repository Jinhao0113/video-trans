import { app, shell, BrowserWindow, ipcMain, protocol, dialog, net } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  initFFmpeg,
  getFFmpegStatus,
  probeFile,
  convertFile,
  trimVideo,
  cancelTask,
  setFFmpegPath,
  extractSubtitles,
  embedSubtitles
} from './ffmpeg'

let mainWindow: BrowserWindow | null = null

const MEDIA_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac'
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function getMediaContentType(filePath: string): string {
  return MEDIA_MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

// Register media:// protocol for secure local file access
function registerMediaProtocol(): void {
  protocol.handle('media', async (request) => {
    // Decode URL: media://local/path/to/file → /path/to/file (macOS/Linux)
    //             media://local/C:/path      → C:/path (Windows)
    // Also tolerate legacy malformed URLs like media://users/name/file.mp4.
    const url = new URL(request.url)
    const rawPath =
      url.host && url.host !== 'local' ? `/${url.host}${url.pathname}` : url.pathname
    const filePath = decodeURIComponent(rawPath)
    // On Windows the path may start with / before the drive letter; strip it
    const normalized = process.platform === 'win32' ? filePath.replace(/^\//, '') : filePath

    try {
      const response = await net.fetch(pathToFileURL(normalized).toString(), {
        method: request.method,
        headers: request.headers
      })

      const headers = new Headers(response.headers)
      const contentType = headers.get('content-type')
      if (!contentType || contentType === 'application/octet-stream') {
        headers.set('content-type', getMediaContentType(normalized))
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    } catch (error) {
      console.error('Failed to serve media preview', {
        requestUrl: request.url,
        host: url.host,
        pathname: url.pathname,
        normalized,
        error
      })
      return new Response('Not Found', { status: 404 })
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mediaforge.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerMediaProtocol()
  initFFmpeg()
  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function registerIpcHandlers(): void {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  // FFmpeg status
  ipcMain.handle('ffmpeg:status', () => getFFmpegStatus())
  ipcMain.handle('ffmpeg:setPath', (_event, ffmpegPath: string) => {
    return setFFmpegPath(ffmpegPath)
  })

  // File probe
  ipcMain.handle('ffmpeg:probe', async (_event, filePath: string) => {
    return probeFile(filePath)
  })

  // Convert
  ipcMain.handle(
    'ffmpeg:convert',
    async (
      event,
      args: {
        input: string
        output: string
        options: Record<string, unknown>
        taskId: string
      }
    ) => {
      return convertFile(args.input, args.output, args.options, args.taskId, (progress) => {
        event.sender.send('ffmpeg:progress', { taskId: args.taskId, progress })
      })
    }
  )

  // Trim
  ipcMain.handle(
    'ffmpeg:trim',
    async (
      event,
      args: {
        input: string
        output: string
        start: number
        end: number
        taskId: string
      }
    ) => {
      return trimVideo(args.input, args.output, args.start, args.end, args.taskId, (progress) => {
        event.sender.send('ffmpeg:progress', { taskId: args.taskId, progress })
      })
    }
  )

  // Cancel
  ipcMain.handle('ffmpeg:cancel', (_event, taskId: string) => {
    return cancelTask(taskId)
  })

  // Subtitles
  ipcMain.handle(
    'ffmpeg:extractSubtitles',
    async (
      event,
      args: { input: string; output: string; streamIndex: number; taskId: string }
    ) => {
      return extractSubtitles(
        args.input,
        args.output,
        args.streamIndex,
        args.taskId,
        (progress) => {
          event.sender.send('ffmpeg:progress', { taskId: args.taskId, progress })
        }
      )
    }
  )

  ipcMain.handle(
    'ffmpeg:embedSubtitles',
    async (
      event,
      args: { input: string; subtitleFile: string; output: string; taskId: string }
    ) => {
      return embedSubtitles(
        args.input,
        args.subtitleFile,
        args.output,
        args.taskId,
        (progress) => {
          event.sender.send('ffmpeg:progress', { taskId: args.taskId, progress })
        }
      )
    }
  )

  // Dialog
  ipcMain.handle('dialog:openFile', async (_event, options?: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      ...options
    })
    return result
  })

  ipcMain.handle('dialog:openFiles', async (_event, options?: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      ...options
    })
    return result
  })

  ipcMain.handle('dialog:saveFile', async (_event, options?: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(mainWindow!, options || {})
    return result
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result
  })

  // Shell
  ipcMain.handle('shell:showItemInFolder', (_event, path: string) => {
    shell.showItemInFolder(path)
  })
}
