import { useState, useCallback, useEffect } from 'react'
import { Film, Music, X, Settings2, AlertTriangle, CheckCircle2, FolderOpen } from 'lucide-react'
import {
  VIDEO_FORMATS,
  AUDIO_FORMATS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  VIDEO_BITRATES,
  AUDIO_BITRATES,
  RESOLUTIONS,
  FRAME_RATES,
  MEDIA_FILTER,
  formatFileSize,
  formatDuration,
  getFileName,
  getFileNameWithoutExt,
  generateTaskId,
  isVideoFormat,
  getFileExtension
} from '../utils/formats'
import type { ProgressInfo } from '../utils/ipc'
import { useSharedFile } from '../context/SharedFileContext'

interface ConvertOptions {
  outputFormat: string
  videoCodec: string
  audioCodec: string
  videoBitrate: string
  audioBitrate: string
  resolution: string
  frameRate: number
}

export default function Converter() {
  const { sharedFile, loadSharedFile, clearSharedFile } = useSharedFile()
  const inputFile = sharedFile.filePath
  const probeData = sharedFile.probeData

  const [outputDir, setOutputDir] = useState<string>('')
  const [options, setOptions] = useState<ConvertOptions>({
    outputFormat: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '',
    audioBitrate: '',
    resolution: '',
    frameRate: 0
  })
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [taskId, setTaskId] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isVideo, setIsVideo] = useState(true)

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

  const loadFile = useCallback(async (filePath: string) => {
    setError('')
    setSuccess('')
    setProgress(null)

    const ext = getFileExtension(filePath).replace('.', '')
    const isVid = isVideoFormat(ext)
    setIsVideo(isVid)

    // Auto-set output directory to same as input
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    const dir = lastSlash >= 0 ? filePath.substring(0, lastSlash) : ''
    setOutputDir(dir)

    await loadSharedFile(filePath)
  }, [loadSharedFile])

  const handleBrowse = useCallback(async () => {
    const result = await window.api?.openFile({
      filters: [MEDIA_FILTER, { name: '所有文件', extensions: ['*'] }]
    })
    if (result && !result.canceled && result.filePaths[0]) {
      loadFile(result.filePaths[0])
    }
  }, [loadFile])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        const filePath = window.api?.getPathForFile(file)
        if (filePath) loadFile(filePath)
      }
    },
    [loadFile]
  )

  const handleConvert = useCallback(async () => {
    if (!inputFile) return

    setIsConverting(true)
    setError('')
    setSuccess('')
    setProgress(null)

    const newTaskId = generateTaskId()
    setTaskId(newTaskId)

    const outputFileName = `${getFileNameWithoutExt(inputFile)}_converted.${options.outputFormat}`
    const outputPath = outputDir ? `${outputDir}/${outputFileName}` : outputFileName

    // Let user choose output path
    const saveResult = await window.api?.saveFile({
      defaultPath: outputPath,
      filters: [
        {
          name: options.outputFormat.toUpperCase(),
          extensions: [options.outputFormat]
        }
      ]
    })

    if (!saveResult || saveResult.canceled || !saveResult.filePath) {
      setIsConverting(false)
      return
    }

    try {
      const convertOptions: Record<string, unknown> = {}
      if (options.videoCodec) convertOptions.videoCodec = options.videoCodec
      if (options.audioCodec) convertOptions.audioCodec = options.audioCodec
      if (options.videoBitrate) convertOptions.videoBitrate = options.videoBitrate
      if (options.audioBitrate) convertOptions.audioBitrate = options.audioBitrate
      if (options.resolution) convertOptions.resolution = options.resolution
      if (options.frameRate) convertOptions.frameRate = options.frameRate

      // Check for hardware acceleration
      const selectedCodec = VIDEO_CODECS.find((c) => c.value === options.videoCodec)
      if (selectedCodec?.hwAccel) {
        convertOptions.hwAccel = selectedCodec.hwAccel
      }

      const result = await window.api?.convert({
        input: inputFile,
        output: saveResult.filePath,
        options: convertOptions,
        taskId: newTaskId
      })

      if (result?.success) {
        setSuccess(`转换完成！输出: ${getFileName(saveResult.filePath)}`)
      } else {
        setError('转换已取消')
      }
    } catch (err: unknown) {
      setError(`转换失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsConverting(false)
    }
  }, [inputFile, options, outputDir])

  const handleCancel = useCallback(async () => {
    if (taskId) {
      await window.api?.cancel(taskId)
    }
  }, [taskId])

  const handleClear = () => {
    clearSharedFile()
    setProgress(null)
    setError('')
    setSuccess('')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">格式转换</h1>
        <p className="page-header__subtitle">
          转换视频和音频文件格式，支持多种编码器和硬件加速
        </p>
      </div>

      {/* Drop Zone — shown only when no file is loaded */}
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
            <div className="dropzone__title">拖拽媒体文件到此处</div>
            <div className="dropzone__subtitle">
              或 <span className="dropzone__browse">浏览文件</span> 选择视频或音频
            </div>
          </div>
        </div>
      )}

      {/* Settings card — shown after file is loaded */}
      {inputFile && (
        <div className="animate-fade-in">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">
                <span className="card__title-icon" style={{ display: 'flex' }}><Settings2 size={18} strokeWidth={1.5} /></span>
                转换设置
              </h2>
            </div>

            <div className="form-grid">
              {/* Output Format */}
              <div className="form-group">
                <label className="form-label">输出格式</label>
                <select
                  className="form-select"
                  value={options.outputFormat}
                  onChange={(e) => setOptions({ ...options, outputFormat: e.target.value })}
                >
                  <optgroup label="视频格式">
                    {VIDEO_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="音频格式">
                    {AUDIO_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Video Codec */}
              {isVideo && (
                <div className="form-group">
                  <label className="form-label">视频编码</label>
                  <select
                    className="form-select"
                    value={options.videoCodec}
                    onChange={(e) => setOptions({ ...options, videoCodec: e.target.value })}
                  >
                    <optgroup label="软件编码">
                      {VIDEO_CODECS.filter((c) => !c.hwAccel).map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="硬件加速">
                      {VIDEO_CODECS.filter((c) => c.hwAccel).map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Audio Codec */}
              <div className="form-group">
                <label className="form-label">音频编码</label>
                <select
                  className="form-select"
                  value={options.audioCodec}
                  onChange={(e) => setOptions({ ...options, audioCodec: e.target.value })}
                >
                  {AUDIO_CODECS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Video Bitrate */}
              {isVideo && (
                <div className="form-group">
                  <label className="form-label">视频码率</label>
                  <select
                    className="form-select"
                    value={options.videoBitrate}
                    onChange={(e) => setOptions({ ...options, videoBitrate: e.target.value })}
                  >
                    {VIDEO_BITRATES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Audio Bitrate */}
              <div className="form-group">
                <label className="form-label">音频码率</label>
                <select
                  className="form-select"
                  value={options.audioBitrate}
                  onChange={(e) => setOptions({ ...options, audioBitrate: e.target.value })}
                >
                  {AUDIO_BITRATES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resolution */}
              {isVideo && (
                <div className="form-group">
                  <label className="form-label">分辨率</label>
                  <select
                    className="form-select"
                    value={options.resolution}
                    onChange={(e) => setOptions({ ...options, resolution: e.target.value })}
                  >
                    {RESOLUTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Frame Rate */}
              {isVideo && (
                <div className="form-group">
                  <label className="form-label">帧率</label>
                  <select
                    className="form-select"
                    value={options.frameRate}
                    onChange={(e) =>
                      setOptions({ ...options, frameRate: parseInt(e.target.value) || 0 })
                    }
                  >
                    {FRAME_RATES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* File Info — auto-shown after file is loaded */}
            {probeData && (
              <>
                <div className="divider" />
                <div className="file-info">
                  <div className="file-info__icon">
                    {isVideo ? <Film size={28} strokeWidth={1.5} /> : <Music size={28} strokeWidth={1.5} />}
                  </div>
                  <div className="file-info__details">
                    <div className="file-info__name">{getFileName(inputFile)}</div>
                    <div className="file-info__meta">
                      <span>{probeData.format.formatLongName}</span>
                      <span>{formatFileSize(probeData.format.size)}</span>
                      <span>{formatDuration(probeData.format.duration)}</span>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={handleBrowse} style={{ gap: 6 }}>
                    <FolderOpen size={14} /> 更换
                  </button>
                  <button className="file-info__remove" onClick={handleClear} title="清除">
                    <X size={16} />
                  </button>
                </div>
              </>
            )}

            <div className="divider" />

            {/* Progress */}
            {isConverting && progress && (
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
                  <span>
                    {progress.currentFps > 0 ? `${progress.currentFps.toFixed(0)} fps` : ''}
                    {progress.currentKbps > 0 ? ` · ${progress.currentKbps.toFixed(0)} kbps` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Error / Success Messages */}
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
              {!isConverting ? (
                <button className="btn btn-primary" onClick={handleConvert} disabled={!inputFile}>
                  开始转换
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleCancel}>
                  取消
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleClear} disabled={isConverting}>
                清除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
