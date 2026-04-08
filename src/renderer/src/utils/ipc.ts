// Type-safe wrapper for the Electron API exposed via preload

declare global {
  interface Window {
    api: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      getFFmpegStatus: () => Promise<{
        available: boolean
        version: string
        path: string
        ffprobePath: string
      }>
      setFFmpegPath: (path: string) => Promise<unknown>
      probe: (filePath: string) => Promise<ProbeResult>
      convert: (args: {
        input: string
        output: string
        options: Record<string, unknown>
        taskId: string
      }) => Promise<{ success: boolean; output: string }>
      trim: (args: {
        input: string
        output: string
        start: number
        end: number
        taskId: string
      }) => Promise<{ success: boolean; output: string }>
      cancel: (taskId: string) => Promise<boolean>
      extractSubtitles: (args: {
        input: string
        output: string
        streamIndex: number
        taskId: string
      }) => Promise<{ success: boolean; output: string }>
      embedSubtitles: (args: {
        input: string
        subtitleFile: string
        output: string
        taskId: string
      }) => Promise<{ success: boolean; output: string }>
      onProgress: (
        callback: (data: { taskId: string; progress: ProgressInfo }) => void
      ) => () => void
      openFile: (options?: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>
      openFiles: (options?: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>
      saveFile: (options?: unknown) => Promise<{ canceled: boolean; filePath?: string }>
      openDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
      showItemInFolder: (path: string) => void
      getPathForFile: (file: File) => string
      getPlatform: () => string
    }
  }
}

export interface ProbeResult {
  format: {
    filename: string
    formatName: string
    formatLongName: string
    duration: number
    size: number
    bitRate: number
    nbStreams: number
    tags: Record<string, string>
  }
  streams: StreamInfo[]
}

export interface StreamInfo {
  index: number
  codecType: string
  codecName: string
  codecLongName: string
  profile?: string
  width?: number
  height?: number
  displayAspectRatio?: string
  pixFmt?: string
  frameRate?: string
  bitRate?: number
  sampleRate?: number
  channels?: number
  channelLayout?: string
  duration?: number
  tags?: Record<string, string>
  language?: string
  title?: string
}

export interface ProgressInfo {
  percent: number
  timemark: string
  currentFps: number
  currentKbps: number
  targetSize: number
}

export const api = typeof window !== 'undefined' ? window.api : null
