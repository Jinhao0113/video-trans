// Format and codec definitions for MediaForge

export interface FormatOption {
  value: string
  label: string
  extensions: string[]
  type: 'video' | 'audio'
}

export interface CodecOption {
  value: string
  label: string
  type: 'video' | 'audio'
  hwAccel?: string
}

export const VIDEO_FORMATS: FormatOption[] = [
  { value: 'mp4', label: 'MP4', extensions: ['.mp4'], type: 'video' },
  { value: 'mkv', label: 'MKV (Matroska)', extensions: ['.mkv'], type: 'video' },
  { value: 'avi', label: 'AVI', extensions: ['.avi'], type: 'video' },
  { value: 'mov', label: 'MOV (QuickTime)', extensions: ['.mov'], type: 'video' },
  { value: 'webm', label: 'WebM', extensions: ['.webm'], type: 'video' },
  { value: 'flv', label: 'FLV', extensions: ['.flv'], type: 'video' },
  { value: 'wmv', label: 'WMV', extensions: ['.wmv'], type: 'video' },
  { value: 'ts', label: 'TS (MPEG-TS)', extensions: ['.ts'], type: 'video' },
  { value: 'gif', label: 'GIF', extensions: ['.gif'], type: 'video' }
]

export const AUDIO_FORMATS: FormatOption[] = [
  { value: 'mp3', label: 'MP3', extensions: ['.mp3'], type: 'audio' },
  { value: 'aac', label: 'AAC', extensions: ['.aac', '.m4a'], type: 'audio' },
  { value: 'wav', label: 'WAV', extensions: ['.wav'], type: 'audio' },
  { value: 'flac', label: 'FLAC', extensions: ['.flac'], type: 'audio' },
  { value: 'ogg', label: 'OGG', extensions: ['.ogg'], type: 'audio' },
  { value: 'wma', label: 'WMA', extensions: ['.wma'], type: 'audio' },
  { value: 'opus', label: 'Opus', extensions: ['.opus'], type: 'audio' }
]

export const VIDEO_CODECS: CodecOption[] = [
  { value: 'copy', label: '复制（不重新编码）', type: 'video' },
  { value: 'libx264', label: 'H.264 (x264)', type: 'video' },
  { value: 'libx265', label: 'H.265 / HEVC (x265)', type: 'video' },
  { value: 'libvpx-vp9', label: 'VP9', type: 'video' },
  { value: 'libaom-av1', label: 'AV1 (libaom)', type: 'video' },
  { value: 'libsvtav1', label: 'AV1 (SVT-AV1)', type: 'video' },
  { value: 'mpeg4', label: 'MPEG-4', type: 'video' },
  // Hardware accelerated
  { value: 'h264_videotoolbox', label: 'H.264 (VideoToolbox / macOS)', type: 'video', hwAccel: 'videotoolbox' },
  { value: 'hevc_videotoolbox', label: 'HEVC (VideoToolbox / macOS)', type: 'video', hwAccel: 'videotoolbox' },
  { value: 'h264_nvenc', label: 'H.264 (NVENC / NVIDIA)', type: 'video', hwAccel: 'nvenc' },
  { value: 'hevc_nvenc', label: 'HEVC (NVENC / NVIDIA)', type: 'video', hwAccel: 'nvenc' },
  { value: 'h264_qsv', label: 'H.264 (QSV / Intel)', type: 'video', hwAccel: 'qsv' },
  { value: 'hevc_qsv', label: 'HEVC (QSV / Intel)', type: 'video', hwAccel: 'qsv' },
  { value: 'h264_vaapi', label: 'H.264 (VAAPI / Linux)', type: 'video', hwAccel: 'vaapi' }
]

export const AUDIO_CODECS: CodecOption[] = [
  { value: 'copy', label: '复制（不重新编码）', type: 'audio' },
  { value: 'aac', label: 'AAC', type: 'audio' },
  { value: 'libmp3lame', label: 'MP3 (LAME)', type: 'audio' },
  { value: 'flac', label: 'FLAC (无损)', type: 'audio' },
  { value: 'libopus', label: 'Opus', type: 'audio' },
  { value: 'libvorbis', label: 'Vorbis', type: 'audio' },
  { value: 'pcm_s16le', label: 'PCM 16-bit', type: 'audio' },
  { value: 'pcm_s24le', label: 'PCM 24-bit', type: 'audio' }
]

export const VIDEO_BITRATES = [
  { value: '', label: '自动' },
  { value: '500k', label: '500 Kbps' },
  { value: '1000k', label: '1 Mbps' },
  { value: '2000k', label: '2 Mbps' },
  { value: '4000k', label: '4 Mbps' },
  { value: '6000k', label: '6 Mbps' },
  { value: '8000k', label: '8 Mbps' },
  { value: '10000k', label: '10 Mbps' },
  { value: '15000k', label: '15 Mbps' },
  { value: '20000k', label: '20 Mbps' },
  { value: '30000k', label: '30 Mbps' },
  { value: '50000k', label: '50 Mbps' }
]

export const AUDIO_BITRATES = [
  { value: '', label: '自动' },
  { value: '64k', label: '64 Kbps' },
  { value: '96k', label: '96 Kbps' },
  { value: '128k', label: '128 Kbps' },
  { value: '192k', label: '192 Kbps' },
  { value: '256k', label: '256 Kbps' },
  { value: '320k', label: '320 Kbps' }
]

export const RESOLUTIONS = [
  { value: '', label: '保持原始' },
  { value: '3840x2160', label: '4K (3840×2160)' },
  { value: '2560x1440', label: '2K (2560×1440)' },
  { value: '1920x1080', label: '1080p (1920×1080)' },
  { value: '1280x720', label: '720p (1280×720)' },
  { value: '854x480', label: '480p (854×480)' },
  { value: '640x360', label: '360p (640×360)' }
]

export const FRAME_RATES = [
  { value: 0, label: '保持原始' },
  { value: 24, label: '24 fps' },
  { value: 25, label: '25 fps' },
  { value: 30, label: '30 fps' },
  { value: 48, label: '48 fps' },
  { value: 50, label: '50 fps' },
  { value: 60, label: '60 fps' }
]

export const SUBTITLE_FORMATS = [
  { value: 'srt', label: 'SRT', extension: '.srt' },
  { value: 'ass', label: 'ASS/SSA', extension: '.ass' },
  { value: 'vtt', label: 'WebVTT', extension: '.vtt' }
]

// File filter strings for dialogs
export const VIDEO_FILTER = {
  name: '视频文件',
  extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'ts', 'm4v', 'mpg', 'mpeg', '3gp']
}

export const AUDIO_FILTER = {
  name: '音频文件',
  extensions: ['mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'wma', 'opus']
}

export const MEDIA_FILTER = {
  name: '媒体文件',
  extensions: [...VIDEO_FILTER.extensions, ...AUDIO_FILTER.extensions]
}

export const SUBTITLE_FILTER = {
  name: '字幕文件',
  extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub']
}

// Utility functions
export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDurationMs(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '00:00:00.000'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}

export function parseDuration(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 3) return 0
  const h = parseFloat(parts[0]) || 0
  const m = parseFloat(parts[1]) || 0
  const s = parseFloat(parts[2]) || 0
  return h * 3600 + m * 60 + s
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function formatBitrate(bps: number): string {
  if (!bps) return 'N/A'
  if (bps >= 1000000) return `${(bps / 1000000).toFixed(1)} Mbps`
  if (bps >= 1000) return `${(bps / 1000).toFixed(0)} Kbps`
  return `${bps} bps`
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot >= 0 ? filename.substring(lastDot) : ''
}

export function getFileName(filepath: string): string {
  return filepath.split(/[/\\]/).pop() || filepath
}

export function getFileNameWithoutExt(filepath: string): string {
  const name = getFileName(filepath)
  const lastDot = name.lastIndexOf('.')
  return lastDot >= 0 ? name.substring(0, lastDot) : name
}

export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getFormatForExtension(ext: string): FormatOption | undefined {
  const lowerExt = `.${ext.toLowerCase().replace('.', '')}`
  return [...VIDEO_FORMATS, ...AUDIO_FORMATS].find((f) =>
    f.extensions.includes(lowerExt)
  )
}

export function isVideoFormat(ext: string): boolean {
  const lowerExt = ext.toLowerCase().replace('.', '')
  return VIDEO_FILTER.extensions.includes(lowerExt)
}

export function isAudioFormat(ext: string): boolean {
  const lowerExt = ext.toLowerCase().replace('.', '')
  return AUDIO_FILTER.extensions.includes(lowerExt)
}
