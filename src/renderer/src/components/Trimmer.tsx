import { useState, useCallback, useEffect, useRef } from 'react'
import { Film, Timer, X, Pause, Play, AlertTriangle, CheckCircle2, FolderOpen } from 'lucide-react'
import {
  VIDEO_FILTER,
  formatDuration,
  formatDurationMs,
  formatFileSize,
  getFileName,
  getFileNameWithoutExt,
  getFileExtension,
  generateTaskId
} from '../utils/formats'
import type { ProgressInfo } from '../utils/ipc'
import { useSharedFile } from '../context/SharedFileContext'

const MIN_TRIM_GAP = 0.1
const SHORT_SEEK_STEP = 1
const MEDIUM_SEEK_STEP = 5
const LONG_SEEK_STEP = 10

function toMediaUrl(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const encodedPath = normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `media://local${encodedPath.startsWith('/') ? encodedPath : `/${encodedPath}`}`
}

function shouldIgnorePlayerHotkeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    tagName === 'button'
  )
}

export default function Trimmer() {
  const { sharedFile, loadSharedFile, clearSharedFile } = useSharedFile()
  const inputFile = sharedFile.filePath
  const probeData = sharedFile.probeData

  const [isDragOver, setIsDragOver] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [isTrimming, setIsTrimming] = useState(false)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [taskId, setTaskId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'start' | 'end' | 'playhead' | null>(null)

  // Reset trim state when file changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause()
    }
    setError('')
    setSuccess('')
    setProgress(null)
    setCurrentTime(0)
    setDuration(0)
    setTrimStart(0)
    setTrimEnd(0)
    setIsPlaying(false)
  }, [inputFile])

  // Listen for progress
  useEffect(() => {
    if (!taskId) return
    const cleanup = window.api?.onProgress((data) => {
      if (data.taskId === taskId) {
        setProgress(data.progress as ProgressInfo)
      }
    })
    return cleanup
  }, [taskId])

  const handleBrowse = useCallback(async () => {
    const result = await window.api?.openFile({
      filters: [VIDEO_FILTER, { name: '所有文件', extensions: ['*'] }]
    })
    if (result && !result.canceled && result.filePaths[0]) {
      loadSharedFile(result.filePaths[0])
    }
  }, [loadSharedFile])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        const filePath = window.api?.getPathForFile(file)
        if (filePath) loadSharedFile(filePath)
      }
    },
    [loadSharedFile]
  )

  // Video event handlers
  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const dur = videoRef.current.duration
      if (dur && isFinite(dur)) {
        setDuration(dur)
        setTrimEnd(dur)
      }
    }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && draggingRef.current !== 'playhead') {
      setCurrentTime(videoRef.current.currentTime)
    }
  }, [])

  const seekToTime = useCallback(
    (time: number) => {
      const nextTime = Math.max(0, Math.min(duration || 0, time))
      setCurrentTime(nextTime)
      if (videoRef.current) {
        videoRef.current.currentTime = nextTime
      }
    },
    [duration]
  )

  const seekBy = useCallback(
    (delta: number) => {
      const baseTime = videoRef.current?.currentTime ?? currentTime
      seekToTime(baseTime + delta)
    },
    [currentTime, seekToTime]
  )

  const setTrimBoundary = useCallback(
    (boundary: 'start' | 'end', time: number) => {
      if (!duration) return
      const minGap = Math.min(MIN_TRIM_GAP, duration)
      const clampedTime = Math.max(0, Math.min(duration, time))
      let nextStart = trimStart
      let nextEnd = trimEnd

      if (boundary === 'start') {
        nextStart = clampedTime
        if (nextStart > nextEnd - minGap) {
          nextEnd = Math.min(duration, nextStart + minGap)
          nextStart = Math.max(0, nextEnd - minGap)
        }
      } else {
        nextEnd = clampedTime
        if (nextEnd < nextStart + minGap) {
          nextStart = Math.max(0, nextEnd - minGap)
          nextEnd = Math.min(duration, nextStart + minGap)
        }
      }

      setTrimStart(nextStart)
      setTrimEnd(nextEnd)
      seekToTime(boundary === 'start' ? nextStart : nextEnd)
    },
    [duration, seekToTime, trimEnd, trimStart]
  )

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    const video = videoRef.current

    if (!video.paused && !video.ended) {
      video.pause()
    } else {
      setError('')
      if (video.currentTime >= trimEnd || video.currentTime < trimStart) {
        video.currentTime = trimStart
      }
      void video.play().catch((err: unknown) => {
        setIsPlaying(false)
        setError(`预览播放失败: ${err instanceof Error ? err.message : String(err)}`)
      })
    }
  }, [trimStart, trimEnd])

  const handleVideoError = useCallback(() => {
    const errorCode = videoRef.current?.error?.code
    const errorMessage =
      errorCode === MediaError.MEDIA_ERR_ABORTED
        ? '视频预览已中止'
        : errorCode === MediaError.MEDIA_ERR_NETWORK
          ? '视频预览加载失败，请检查文件是否仍可访问'
          : errorCode === MediaError.MEDIA_ERR_DECODE
            ? '视频解码失败，请确认文件未损坏'
            : errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
              ? '当前文件格式无法用于预览'
              : '视频预览加载失败'
    setIsPlaying(false)
    setError(errorMessage)
  }, [])

  // Keep playback within trim region
  useEffect(() => {
    if (videoRef.current && isPlaying && currentTime >= trimEnd) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [currentTime, trimEnd, isPlaying])

  useEffect(() => {
    if (!inputFile) return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (shouldIgnorePlayerHotkeys(event.target)) return

      const lowerKey = event.key.toLowerCase()
      const isToggleKey = event.key === ' ' || lowerKey === 'k'
      if (isToggleKey && event.repeat) return

      switch (event.key) {
        case ' ':
        case 'k':
        case 'K':
          event.preventDefault()
          togglePlay()
          return
        case 'ArrowLeft':
          event.preventDefault()
          seekBy(event.shiftKey ? -MEDIUM_SEEK_STEP : -SHORT_SEEK_STEP)
          return
        case 'ArrowRight':
          event.preventDefault()
          seekBy(event.shiftKey ? MEDIUM_SEEK_STEP : SHORT_SEEK_STEP)
          return
        case 'Home':
          event.preventDefault()
          seekToTime(0)
          return
        case 'End':
          event.preventDefault()
          seekToTime(duration)
          return
        case '[':
          event.preventDefault()
          setTrimBoundary('start', videoRef.current?.currentTime ?? currentTime)
          return
        case ']':
          event.preventDefault()
          setTrimBoundary('end', videoRef.current?.currentTime ?? currentTime)
          return
        default:
          break
      }

      if (lowerKey === 'j') {
        event.preventDefault()
        seekBy(-LONG_SEEK_STEP)
      } else if (lowerKey === 'l') {
        event.preventDefault()
        seekBy(LONG_SEEK_STEP)
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [currentTime, duration, inputFile, seekBy, seekToTime, setTrimBoundary, togglePlay])

  // Timeline interactions
  const getTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!timelineRef.current) return 0
      const rect = timelineRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return ratio * duration
    },
    [duration]
  )

  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent, type: 'start' | 'end' | 'playhead') => {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = type

      const handleMouseMove = (ev: MouseEvent) => {
        const time = getTimeFromPosition(ev.clientX)
        if (draggingRef.current === 'start') {
          setTrimStart(Math.min(time, trimEnd - MIN_TRIM_GAP))
        } else if (draggingRef.current === 'end') {
          setTrimEnd(Math.max(time, trimStart + MIN_TRIM_GAP))
        } else if (draggingRef.current === 'playhead') {
          seekToTime(time)
        }
      }

      const handleMouseUp = () => {
        draggingRef.current = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [getTimeFromPosition, seekToTime, trimStart, trimEnd]
  )

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (draggingRef.current) return
      const time = getTimeFromPosition(e.clientX)
      seekToTime(time)
    },
    [getTimeFromPosition, seekToTime]
  )

  const handleStartTimeInput = useCallback(
    (value: string) => {
      const parts = value.split(':')
      if (parts.length === 3) {
        const secs =
          (parseFloat(parts[0]) || 0) * 3600 +
          (parseFloat(parts[1]) || 0) * 60 +
          (parseFloat(parts[2]) || 0)
        if (secs >= 0 && secs <= duration) {
          setTrimBoundary('start', secs)
        }
      }
    },
    [duration, setTrimBoundary]
  )

  const handleEndTimeInput = useCallback(
    (value: string) => {
      const parts = value.split(':')
      if (parts.length === 3) {
        const secs =
          (parseFloat(parts[0]) || 0) * 3600 +
          (parseFloat(parts[1]) || 0) * 60 +
          (parseFloat(parts[2]) || 0)
        if (secs >= 0 && secs <= duration) {
          setTrimBoundary('end', secs)
        }
      }
    },
    [duration, setTrimBoundary]
  )

  const handleTrim = useCallback(async () => {
    if (!inputFile) return

    setIsTrimming(true)
    setError('')
    setSuccess('')
    setProgress(null)

    const newTaskId = generateTaskId()
    setTaskId(newTaskId)

    const ext = getFileExtension(inputFile) || '.mp4'
    const outputName = `${getFileNameWithoutExt(inputFile)}_trimmed${ext}`

    const saveResult = await window.api?.saveFile({
      defaultPath: outputName,
      filters: [{ name: '视频文件', extensions: [ext.replace('.', '')] }]
    })

    if (!saveResult || saveResult.canceled || !saveResult.filePath) {
      setIsTrimming(false)
      return
    }

    try {
      const result = await window.api?.trim({
        input: inputFile,
        output: saveResult.filePath,
        start: trimStart,
        end: trimEnd,
        taskId: newTaskId
      })

      if (result?.success) {
        setSuccess(`裁剪完成！输出: ${getFileName(saveResult.filePath)}`)
      } else {
        setError('裁剪已取消')
      }
    } catch (err: unknown) {
      setError(`裁剪失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsTrimming(false)
    }
  }, [inputFile, trimStart, trimEnd])

  const handleCancel = useCallback(async () => {
    if (taskId) await window.api?.cancel(taskId)
  }, [taskId])

  const handleClear = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
    clearSharedFile()
    setProgress(null)
    setError('')
    setSuccess('')
    setCurrentTime(0)
    setTrimStart(0)
    setTrimEnd(0)
    setIsPlaying(false)
  }

  const trimDuration = trimEnd - trimStart
  const mediaUrl = inputFile ? toMediaUrl(inputFile) : ''
  const timelineDuration = duration || 1

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">视频裁剪</h1>
        <p className="page-header__subtitle">精确裁剪视频片段，支持实时预览</p>
      </div>

      {/* Drop Zone */}
      {!inputFile && (
        <div
          className={`dropzone ${isDragOver ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
        >
          <div className="dropzone__content">
            <div className="dropzone__icon"><Film size={48} strokeWidth={1.5} /></div>
            <div className="dropzone__title">拖拽视频文件到此处</div>
            <div className="dropzone__subtitle">
              或 <span className="dropzone__browse">浏览文件</span> 选择视频
            </div>
          </div>
        </div>
      )}

      {inputFile && (
        <div className="animate-fade-in">
          {/* File Info Bar — auto-shown after file is loaded */}
          <div className="trimmer-file-bar">
            <div className="file-info__icon" style={{ width: 36, height: 36, borderRadius: 8 }}>
              <Film size={18} strokeWidth={1.5} />
            </div>
            <div className="file-info__details">
              <div className="file-info__name">{getFileName(inputFile)}</div>
              {probeData && (
                <div className="file-info__meta">
                  <span>{probeData.format.formatLongName}</span>
                  <span>{formatFileSize(probeData.format.size)}</span>
                  <span>{formatDuration(probeData.format.duration)}</span>
                </div>
              )}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={handleBrowse} title="更换视频">
              <FolderOpen size={14} />
              更换
            </button>
            <button className="file-info__remove" onClick={handleClear} title="清除">
              <X size={16} />
            </button>
          </div>

          {/* Video Preview — centered */}
          <div className="trimmer-preview-wrapper">
            <div className="card trimmer-preview-card">
              <div className="video-preview">
                <video
                  key={mediaUrl}
                  ref={videoRef}
                  src={mediaUrl}
                  onLoadedMetadata={handleVideoLoaded}
                  onTimeUpdate={handleTimeUpdate}
                  onError={handleVideoError}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              </div>

              {/* Controls */}
              <div className="video-controls">
                <button className="video-controls__play-btn" onClick={togglePlay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>

                <span className="video-controls__time">{formatDuration(currentTime)}</span>

                {/* Timeline */}
                <div
                  className="timeline"
                  ref={timelineRef}
                  onClick={handleTimelineClick}
                >
                  <div className="timeline__track">
                    {/* Trim region */}
                    <div
                      className="timeline__trim-region"
                      style={{
                        left: `${(trimStart / timelineDuration) * 100}%`,
                        width: `${((trimEnd - trimStart) / timelineDuration) * 100}%`
                      }}
                    />
                    {/* Playhead */}
                    <div
                      className="timeline__playhead"
                      style={{ left: `${(currentTime / timelineDuration) * 100}%` }}
                    />
                    {/* Start handle */}
                    <div
                      className="timeline__handle timeline__handle--start"
                      style={{ left: `${(trimStart / timelineDuration) * 100}%` }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
                    />
                    {/* End handle */}
                    <div
                      className="timeline__handle timeline__handle--end"
                      style={{ left: `${(trimEnd / timelineDuration) * 100}%` }}
                      onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
                    />
                  </div>
                </div>

                <span className="video-controls__time">{formatDuration(duration)}</span>
              </div>
            </div>
          </div>

          {/* Trim Settings */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                <span className="card__title-icon" style={{ display: 'flex' }}><Timer size={18} strokeWidth={1.5} /></span>
                裁剪范围
              </h2>
              <span className="badge badge-primary">
                片段时长: {formatDuration(trimDuration)}
              </span>
            </div>

            {/* Time inputs + quick set buttons in one row */}
            <div className="trimmer-controls-row">
              <div className="time-input">
                <span className="time-input__label">起点</span>
                <input
                  type="text"
                  className="time-input__field"
                  value={formatDurationMs(trimStart)}
                  onChange={(e) => handleStartTimeInput(e.target.value)}
                />
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setTrimBoundary('start', videoRef.current?.currentTime ?? currentTime)}
                  title="将当前播放头设为起点 ([)"
                >
                  <span className="trim-actions__key">[</span>
                  设为起点
                </button>
              </div>

              <div className="trimmer-controls-divider" />

              <div className="time-input">
                <span className="time-input__label">终点</span>
                <input
                  type="text"
                  className="time-input__field"
                  value={formatDurationMs(trimEnd)}
                  onChange={(e) => handleEndTimeInput(e.target.value)}
                />
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setTrimBoundary('end', videoRef.current?.currentTime ?? currentTime)}
                  title="将当前播放头设为终点 (])"
                >
                  <span className="trim-actions__key">]</span>
                  设为终点
                </button>
              </div>

              <div className="trimmer-current-time">
                <span className="time-input__label">当前</span>
                <span className="trim-actions__playhead-time">{formatDurationMs(currentTime)}</span>
              </div>
            </div>

            <div className="divider" />

            {/* Progress */}
            {isTrimming && progress && (
              <div className="mb-16">
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span>{progress.percent.toFixed(1)}%</span>
                  <span>{progress.timemark}</span>
                </div>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className="mb-16">
                <div className="badge badge-danger" style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} strokeWidth={1.5} /> {error}
                </div>
              </div>
            )}
            {success && (
              <div className="mb-16">
                <div className="badge badge-success" style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} strokeWidth={1.5} /> {success}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-12">
              {!isTrimming ? (
                <button className="btn btn-primary" onClick={handleTrim} disabled={!inputFile}>
                  开始裁剪
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleCancel}>
                  取消
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleClear} disabled={isTrimming}>
                清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
