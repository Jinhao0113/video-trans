import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface ElectronAPI {
  // Window controls
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>

  // FFmpeg
  getFFmpegStatus: () => Promise<{
    available: boolean
    version: string
    path: string
    ffprobePath: string
  }>
  setFFmpegPath: (path: string) => Promise<unknown>
  probe: (filePath: string) => Promise<unknown>
  convert: (args: {
    input: string
    output: string
    options: Record<string, unknown>
    taskId: string
  }) => Promise<unknown>
  trim: (args: {
    input: string
    output: string
    start: number
    end: number
    taskId: string
  }) => Promise<unknown>
  cancel: (taskId: string) => Promise<boolean>
  extractSubtitles: (args: {
    input: string
    output: string
    streamIndex: number
    taskId: string
  }) => Promise<unknown>
  embedSubtitles: (args: {
    input: string
    subtitleFile: string
    output: string
    taskId: string
  }) => Promise<unknown>
  onProgress: (
    callback: (data: { taskId: string; progress: unknown }) => void
  ) => () => void

  // File path (for drag-and-drop with contextIsolation)
  getPathForFile: (file: File) => string

  // Platform info
  getPlatform: () => string

  // Dialog
  openFile: (options?: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>
  openFiles: (options?: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>
  saveFile: (options?: unknown) => Promise<{ canceled: boolean; filePath?: string }>
  openDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>

  // Shell
  showItemInFolder: (path: string) => void
}

const electronAPI: ElectronAPI = {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // FFmpeg
  getFFmpegStatus: () => ipcRenderer.invoke('ffmpeg:status'),
  setFFmpegPath: (path: string) => ipcRenderer.invoke('ffmpeg:setPath', path),
  probe: (filePath: string) => ipcRenderer.invoke('ffmpeg:probe', filePath),
  convert: (args) => ipcRenderer.invoke('ffmpeg:convert', args),
  trim: (args) => ipcRenderer.invoke('ffmpeg:trim', args),
  cancel: (taskId: string) => ipcRenderer.invoke('ffmpeg:cancel', taskId),
  extractSubtitles: (args) => ipcRenderer.invoke('ffmpeg:extractSubtitles', args),
  embedSubtitles: (args) => ipcRenderer.invoke('ffmpeg:embedSubtitles', args),
  onProgress: (callback) => {
    const handler = (_: unknown, data: { taskId: string; progress: unknown }) => callback(data)
    ipcRenderer.on('ffmpeg:progress', handler)
    return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
  },

  // Dialog
  openFile: (options?) => ipcRenderer.invoke('dialog:openFile', options),
  openFiles: (options?) => ipcRenderer.invoke('dialog:openFiles', options),
  saveFile: (options?) => ipcRenderer.invoke('dialog:saveFile', options),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // File path (for drag-and-drop with contextIsolation)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // Platform info
  getPlatform: () => process.platform,

  // Shell
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path)
}

contextBridge.exposeInMainWorld('api', electronAPI)
