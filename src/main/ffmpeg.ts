import ffmpeg from 'fluent-ffmpeg'
import { execSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

interface FFmpegStatus {
  available: boolean
  version: string
  path: string
  ffprobePath: string
}

interface ProbeResult {
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
  streams: Array<{
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
  }>
}

interface ProgressInfo {
  percent: number
  timemark: string
  currentFps: number
  currentKbps: number
  targetSize: number
}

let ffmpegStatus: FFmpegStatus = {
  available: false,
  version: '',
  path: '',
  ffprobePath: ''
}

// Active tasks map for cancellation
const activeTasks = new Map<string, ChildProcess | ffmpeg.FfmpegCommand>()

// Detect FFmpeg binary paths
function detectFFmpegPath(): { ffmpegPath: string; ffprobePath: string } | null {
  // 1. Check bundled binaries in app resources
  const resourcesPath = app.isPackaged
    ? join(process.resourcesPath, 'ffmpeg-bin')
    : join(app.getAppPath(), 'ffmpeg-bin')

  const platform = process.platform
  const ext = platform === 'win32' ? '.exe' : ''

  const bundledFfmpeg = join(resourcesPath, `ffmpeg${ext}`)
  const bundledFfprobe = join(resourcesPath, `ffprobe${ext}`)

  if (existsSync(bundledFfmpeg) && existsSync(bundledFfprobe)) {
    return { ffmpegPath: bundledFfmpeg, ffprobePath: bundledFfprobe }
  }

  // 2. Check system PATH
  try {
    let ffmpegPath: string
    let ffprobePath: string

    if (platform === 'win32') {
      ffmpegPath = execSync('where ffmpeg', { encoding: 'utf8' }).trim().split('\n')[0]
      ffprobePath = execSync('where ffprobe', { encoding: 'utf8' }).trim().split('\n')[0]
    } else {
      ffmpegPath = execSync('which ffmpeg', { encoding: 'utf8' }).trim()
      ffprobePath = execSync('which ffprobe', { encoding: 'utf8' }).trim()
    }

    if (ffmpegPath && ffprobePath) {
      return { ffmpegPath, ffprobePath }
    }
  } catch {
    // Not found in PATH
  }

  // 3. Check common install locations
  const commonPaths =
    platform === 'win32'
      ? [
          'C:\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe'
        ]
      : platform === 'darwin'
        ? [
            '/usr/local/bin/ffmpeg',
            '/opt/homebrew/bin/ffmpeg',
            '/opt/local/bin/ffmpeg'
          ]
        : [
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/snap/bin/ffmpeg'
          ]

  for (const fp of commonPaths) {
    const probeP = fp.replace('ffmpeg', 'ffprobe')
    if (existsSync(fp) && existsSync(probeP)) {
      return { ffmpegPath: fp, ffprobePath: probeP }
    }
  }

  return null
}

export function initFFmpeg(): void {
  const paths = detectFFmpegPath()
  if (paths) {
    ffmpeg.setFfmpegPath(paths.ffmpegPath)
    ffmpeg.setFfprobePath(paths.ffprobePath)

    // Get version
    try {
      const version = execSync(`"${paths.ffmpegPath}" -version`, { encoding: 'utf8' })
      const versionMatch = version.match(/ffmpeg version (\S+)/)
      ffmpegStatus = {
        available: true,
        version: versionMatch ? versionMatch[1] : 'unknown',
        path: paths.ffmpegPath,
        ffprobePath: paths.ffprobePath
      }
    } catch {
      ffmpegStatus = {
        available: true,
        version: 'unknown',
        path: paths.ffmpegPath,
        ffprobePath: paths.ffprobePath
      }
    }
  }
}

export function setFFmpegPath(ffmpegPath: string): FFmpegStatus {
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')

  if (!existsSync(ffmpegPath)) {
    throw new Error(`FFmpeg not found at: ${ffmpegPath}`)
  }

  ffmpeg.setFfmpegPath(ffmpegPath)
  if (existsSync(ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath)
  }

  try {
    const version = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf8' })
    const versionMatch = version.match(/ffmpeg version (\S+)/)
    ffmpegStatus = {
      available: true,
      version: versionMatch ? versionMatch[1] : 'unknown',
      path: ffmpegPath,
      ffprobePath
    }
  } catch {
    ffmpegStatus = {
      available: true,
      version: 'unknown',
      path: ffmpegPath,
      ffprobePath
    }
  }

  return ffmpegStatus
}

export function getFFmpegStatus(): FFmpegStatus {
  return ffmpegStatus
}

export function probeFile(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(new Error(`Probe failed: ${err.message}`))
        return
      }

      const result: ProbeResult = {
        format: {
          filename: data.format.filename || '',
          formatName: data.format.format_name || '',
          formatLongName: data.format.format_long_name || '',
          duration: data.format.duration || 0,
          size: data.format.size || 0,
          bitRate: data.format.bit_rate ? parseInt(String(data.format.bit_rate)) : 0,
          nbStreams: data.format.nb_streams || 0,
          tags: (data.format.tags as Record<string, string>) || {}
        },
        streams: (data.streams || []).map((stream) => ({
          index: stream.index,
          codecType: stream.codec_type || '',
          codecName: stream.codec_name || '',
          codecLongName: stream.codec_long_name || '',
          profile: stream.profile != null ? String(stream.profile) : undefined,
          width: stream.width,
          height: stream.height,
          displayAspectRatio: stream.display_aspect_ratio,
          pixFmt: stream.pix_fmt,
          frameRate: stream.r_frame_rate,
          bitRate: stream.bit_rate ? parseInt(String(stream.bit_rate)) : undefined,
          sampleRate: stream.sample_rate ? parseInt(String(stream.sample_rate)) : undefined,
          channels: stream.channels,
          channelLayout: stream.channel_layout,
          duration: stream.duration ? parseFloat(String(stream.duration)) : undefined,
          tags: stream.tags as Record<string, string>,
          language: stream.tags?.language,
          title: stream.tags?.title
        }))
      }

      resolve(result)
    })
  })
}

export function convertFile(
  input: string,
  output: string,
  options: Record<string, unknown>,
  taskId: string,
  onProgress: (progress: ProgressInfo) => void
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(input)

    // Video codec
    if (options.videoCodec && options.videoCodec !== 'copy') {
      cmd = cmd.videoCodec(options.videoCodec as string)
    } else if (options.videoCodec === 'copy') {
      cmd = cmd.videoCodec('copy')
    }

    // Audio codec
    if (options.audioCodec && options.audioCodec !== 'copy') {
      cmd = cmd.audioCodec(options.audioCodec as string)
    } else if (options.audioCodec === 'copy') {
      cmd = cmd.audioCodec('copy')
    }

    // Video bitrate
    if (options.videoBitrate) {
      cmd = cmd.videoBitrate(options.videoBitrate as string)
    }

    // Audio bitrate
    if (options.audioBitrate) {
      cmd = cmd.audioBitrate(options.audioBitrate as string)
    }

    // Resolution
    if (options.resolution) {
      cmd = cmd.size(options.resolution as string)
    }

    // Frame rate
    if (options.frameRate) {
      cmd = cmd.fps(options.frameRate as number)
    }

    // Hardware acceleration
    if (options.hwAccel) {
      const hwAccel = options.hwAccel as string
      if (hwAccel === 'videotoolbox') {
        cmd = cmd.inputOptions(['-hwaccel', 'videotoolbox'])
      } else if (hwAccel === 'nvenc') {
        // NVENC is handled via codec name (e.g., h264_nvenc)
      } else if (hwAccel === 'qsv') {
        cmd = cmd.inputOptions(['-hwaccel', 'qsv'])
      } else if (hwAccel === 'vaapi') {
        cmd = cmd.inputOptions(['-hwaccel', 'vaapi', '-hwaccel_output_format', 'vaapi'])
      }
    }

    // Extra output options
    if (options.outputOptions && Array.isArray(options.outputOptions)) {
      cmd = cmd.outputOptions(options.outputOptions as string[])
    }

    // Overwrite
    cmd = cmd.outputOptions('-y')

    cmd
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine)
      })
      .on('progress', (progress) => {
        onProgress({
          percent: progress.percent || 0,
          timemark: progress.timemark || '00:00:00',
          currentFps: progress.currentFps || 0,
          currentKbps: progress.currentKbps || 0,
          targetSize: progress.targetSize || 0
        })
      })
      .on('end', () => {
        activeTasks.delete(taskId)
        resolve({ success: true, output })
      })
      .on('error', (err) => {
        activeTasks.delete(taskId)
        if (err.message.includes('SIGKILL') || err.message.includes('SIGTERM')) {
          resolve({ success: false, output: 'Cancelled' })
        } else {
          reject(new Error(`Conversion failed: ${err.message}`))
        }
      })
      .save(output)

    activeTasks.set(taskId, cmd)
  })
}

export function trimVideo(
  input: string,
  output: string,
  start: number,
  end: number,
  taskId: string,
  onProgress: (progress: ProgressInfo) => void
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    const duration = end - start

    // Use input-side seek (-ss before -i) for speed, but add a small pre-roll
    // to ensure keyframe alignment, then trim precisely with -ss/-to on output side.
    // For stream copy: use output-side seek only (accurate but slower for large files).
    const cmd = ffmpeg(input)
      // Output-side options: seek and duration AFTER the input for frame accuracy with copy
      .outputOptions([
        '-ss', String(start),
        '-t', String(duration),
        '-avoid_negative_ts', 'make_zero',
        '-y'
      ])
      .videoCodec('copy')
      .audioCodec('copy')
      .on('start', (commandLine) => {
        console.log('FFmpeg trim command:', commandLine)
      })
      .on('progress', (progress) => {
        // Calculate percent based on duration
        const timemarkParts = (progress.timemark || '00:00:00').split(':')
        const currentTime =
          parseFloat(timemarkParts[0]) * 3600 +
          parseFloat(timemarkParts[1]) * 60 +
          parseFloat(timemarkParts[2] || '0')
        const percent = Math.min((currentTime / duration) * 100, 100)

        onProgress({
          percent,
          timemark: progress.timemark || '00:00:00',
          currentFps: progress.currentFps || 0,
          currentKbps: progress.currentKbps || 0,
          targetSize: progress.targetSize || 0
        })
      })
      .on('end', () => {
        activeTasks.delete(taskId)
        resolve({ success: true, output })
      })
      .on('error', (err) => {
        activeTasks.delete(taskId)
        if (err.message.includes('SIGKILL') || err.message.includes('SIGTERM')) {
          resolve({ success: false, output: 'Cancelled' })
        } else {
          reject(new Error(`Trim failed: ${err.message}`))
        }
      })
      .save(output)

    activeTasks.set(taskId, cmd)
  })
}

export function extractSubtitles(
  input: string,
  output: string,
  streamIndex: number,
  taskId: string,
  onProgress: (progress: ProgressInfo) => void
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input)
      .outputOptions(['-map', `0:${streamIndex}`, '-y'])
      .on('progress', (progress) => {
        onProgress({
          percent: progress.percent || 0,
          timemark: progress.timemark || '00:00:00',
          currentFps: 0,
          currentKbps: 0,
          targetSize: progress.targetSize || 0
        })
      })
      .on('end', () => {
        activeTasks.delete(taskId)
        resolve({ success: true, output })
      })
      .on('error', (err) => {
        activeTasks.delete(taskId)
        reject(new Error(`Subtitle extraction failed: ${err.message}`))
      })
      .save(output)

    activeTasks.set(taskId, cmd)
  })
}

export function embedSubtitles(
  input: string,
  subtitleFile: string,
  output: string,
  taskId: string,
  onProgress: (progress: ProgressInfo) => void
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input)
      .input(subtitleFile)
      .outputOptions([
        '-c', 'copy',
        '-c:s', 'mov_text',
        '-map', '0:v',
        '-map', '0:a',
        '-map', '1:0',
        '-y'
      ])
      .on('progress', (progress) => {
        onProgress({
          percent: progress.percent || 0,
          timemark: progress.timemark || '00:00:00',
          currentFps: 0,
          currentKbps: 0,
          targetSize: progress.targetSize || 0
        })
      })
      .on('end', () => {
        activeTasks.delete(taskId)
        resolve({ success: true, output })
      })
      .on('error', (err) => {
        activeTasks.delete(taskId)
        reject(new Error(`Subtitle embedding failed: ${err.message}`))
      })
      .save(output)

    activeTasks.set(taskId, cmd)
  })
}

export function cancelTask(taskId: string): boolean {
  const task = activeTasks.get(taskId)
  if (task) {
    if ('kill' in task && typeof task.kill === 'function') {
      ;(task as ffmpeg.FfmpegCommand).kill('SIGKILL')
    }
    activeTasks.delete(taskId)
    return true
  }
  return false
}
