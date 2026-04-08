import { useState, useCallback, useEffect } from 'react'
import { FolderUp, Settings2, Clock, Loader2, CheckCircle2, XCircle, Square, X } from 'lucide-react'
import {
  VIDEO_FORMATS,
  AUDIO_FORMATS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  MEDIA_FILTER,
  formatFileSize,
  getFileName,
  getFileNameWithoutExt,
  getFileExtension,
  generateTaskId
} from '../utils/formats'
import type { ProgressInfo } from '../utils/ipc'

interface BatchFile {
  id: string
  path: string
  name: string
  size: number
  status: 'pending' | 'processing' | 'done' | 'error' | 'cancelled'
  progress: number
  error?: string
  taskId?: string
}

interface BatchOptions {
  outputFormat: string
  videoCodec: string
  audioCodec: string
  outputDir: string
}

export default function BatchProcessor() {
  const [files, setFiles] = useState<BatchFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [options, setOptions] = useState<BatchOptions>({
    outputFormat: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    outputDir: ''
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)

  // Listen for progress updates
  useEffect(() => {
    const cleanup = window.api?.onProgress((data) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.taskId === data.taskId
            ? { ...f, progress: (data.progress as ProgressInfo).percent }
            : f
        )
      )
    })
    return cleanup
  }, [])

  const addFiles = useCallback(async (paths: string[]) => {
    const newFiles: BatchFile[] = []
    for (const path of paths) {
      try {
        const data = await window.api?.probe(path)
        newFiles.push({
          id: generateTaskId(),
          path,
          name: getFileName(path),
          size: (data as any)?.format?.size || 0,
          status: 'pending',
          progress: 0
        })
      } catch {
        newFiles.push({
          id: generateTaskId(),
          path,
          name: getFileName(path),
          size: 0,
          status: 'pending',
          progress: 0
        })
      }
    }
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleBrowse = useCallback(async () => {
    const result = await window.api?.openFiles({
      filters: [MEDIA_FILTER, { name: '所有文件', extensions: ['*'] }]
    })
    if (result && !result.canceled && result.filePaths.length > 0) {
      addFiles(result.filePaths)
    }
  }, [addFiles])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
        .map((f) => window.api?.getPathForFile(f))
        .filter(Boolean) as string[]
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles)
      }
    },
    [addFiles]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    if (!isProcessing) {
      setFiles([])
    }
  }, [isProcessing])

  const selectOutputDir = useCallback(async () => {
    const result = await window.api?.openDirectory()
    if (result && !result.canceled && result.filePaths[0]) {
      setOptions((prev) => ({ ...prev, outputDir: result.filePaths[0] }))
    }
  }, [])

  const processFiles = useCallback(async () => {
    if (files.length === 0) return

    // Select output directory if not set
    let outputDir = options.outputDir
    if (!outputDir) {
      const result = await window.api?.openDirectory()
      if (!result || result.canceled || !result.filePaths[0]) return
      outputDir = result.filePaths[0]
      setOptions((prev) => ({ ...prev, outputDir }))
    }

    setIsProcessing(true)

    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error')

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i]
      const taskId = generateTaskId()

      setCurrentIndex(i)
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: 'processing', progress: 0, taskId, error: undefined } : f
        )
      )

      const outputName = `${getFileNameWithoutExt(file.path)}.${options.outputFormat}`
      const outputPath = `${outputDir}/${outputName}`

      try {
        const convertOptions: Record<string, unknown> = {}
        if (options.videoCodec) convertOptions.videoCodec = options.videoCodec
        if (options.audioCodec) convertOptions.audioCodec = options.audioCodec

        const result = await window.api?.convert({
          input: file.path,
          output: outputPath,
          options: convertOptions,
          taskId
        })

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: result?.success ? 'done' : 'cancelled', progress: result?.success ? 100 : 0 }
              : f
          )
        )
      } catch (err: unknown) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'error',
                  progress: 0,
                  error: err instanceof Error ? err.message : String(err)
                }
              : f
          )
        )
      }
    }

    setIsProcessing(false)
    setCurrentIndex(-1)
  }, [files, options])

  const cancelAll = useCallback(async () => {
    const processing = files.filter((f) => f.status === 'processing')
    for (const file of processing) {
      if (file.taskId) {
        await window.api?.cancel(file.taskId)
      }
    }
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'processing' ? { ...f, status: 'cancelled', progress: 0 } : f
      )
    )
    setIsProcessing(false)
    setCurrentIndex(-1)
  }, [files])

  const totalFiles = files.length
  const doneFiles = files.filter((f) => f.status === 'done').length
  const overallProgress = totalFiles > 0 ? (doneFiles / totalFiles) * 100 : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
      case 'processing': return <Loader2 size={14} strokeWidth={1.5} style={{ marginRight: 4 }} className="animate-spin" />
      case 'done': return <CheckCircle2 size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
      case 'error': return <XCircle size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
      case 'cancelled': return <Square size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
      default: return <Clock size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-info'
      case 'processing': return 'badge-warning'
      case 'done': return 'badge-success'
      case 'error': return 'badge-danger'
      case 'cancelled': return 'badge-danger'
      default: return 'badge-info'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '等待中'
      case 'processing': return '处理中'
      case 'done': return '完成'
      case 'error': return '失败'
      case 'cancelled': return '已取消'
      default: return status
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">批量处理</h1>
        <p className="page-header__subtitle">批量转换多个媒体文件，统一输出设置</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`dropzone ${isDragOver ? 'active' : ''}`}
        style={{ padding: files.length > 0 ? '24px' : undefined }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={handleBrowse}
      >
        <div className="dropzone__content">
          <div className="dropzone__icon">
            <FolderUp size={files.length > 0 ? 28 : 48} strokeWidth={1.5} />
          </div>
          <div className="dropzone__title" style={{ fontSize: files.length > 0 ? 'var(--font-size-base)' : undefined }}>
            {files.length > 0 ? '继续添加文件' : '拖拽多个文件到此处'}
          </div>
          <div className="dropzone__subtitle">
            或 <span className="dropzone__browse">浏览文件</span> 选择媒体文件
          </div>
        </div>
      </div>

      {/* Settings */}
      {files.length > 0 && (
        <div className="card mt-16 animate-fade-in">
          <div className="card__header">
            <h2 className="card__title">
              <span className="card__title-icon" style={{ display: 'flex' }}><Settings2 size={18} strokeWidth={1.5} /></span>
              输出设置
            </h2>
            <span className="badge badge-primary">
              {totalFiles} 个文件 · {doneFiles} 已完成
            </span>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">输出格式</label>
              <select
                className="form-select"
                value={options.outputFormat}
                onChange={(e) => setOptions({ ...options, outputFormat: e.target.value })}
                disabled={isProcessing}
              >
                <optgroup label="视频格式">
                  {VIDEO_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </optgroup>
                <optgroup label="音频格式">
                  {AUDIO_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">视频编码</label>
              <select
                className="form-select"
                value={options.videoCodec}
                onChange={(e) => setOptions({ ...options, videoCodec: e.target.value })}
                disabled={isProcessing}
              >
                {VIDEO_CODECS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">音频编码</label>
              <select
                className="form-select"
                value={options.audioCodec}
                onChange={(e) => setOptions({ ...options, audioCodec: e.target.value })}
                disabled={isProcessing}
              >
                {AUDIO_CODECS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">输出目录</label>
              <div className="flex gap-8">
                <input
                  className="form-input"
                  value={options.outputDir}
                  placeholder="选择输出目录..."
                  readOnly
                  onClick={selectOutputDir}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Overall Progress */}
          {isProcessing && (
            <div className="mt-16">
              <div className="progress-bar">
                <div
                  className="progress-bar__fill"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <div className="progress-info">
                <span>
                  总进度: {doneFiles}/{totalFiles}
                </span>
                <span>{overallProgress.toFixed(0)}%</span>
              </div>
            </div>
          )}

          <div className="divider" />

          {/* File List */}
          <div className="batch-list">
            {files.map((file, index) => (
              <div key={file.id} className="batch-item animate-slide-in">
                <div className="batch-item__index">{index + 1}</div>
                <div className="batch-item__info">
                  <div className="batch-item__name">{file.name}</div>
                  <div className="batch-item__size">
                    {formatFileSize(file.size)}
                    {file.error && (
                      <span style={{ color: 'var(--color-danger)', marginLeft: 8 }}>
                        {file.error}
                      </span>
                    )}
                  </div>
                </div>

                {file.status === 'processing' && (
                  <div className="batch-item__progress">
                    <div className="progress-bar">
                      <div
                        className="progress-bar__fill"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="batch-item__status">
                  <span className={`badge ${getStatusBadge(file.status)}`} style={{ display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon(file.status)} {getStatusLabel(file.status)}
                  </span>
                </div>

                <div className="batch-item__actions">
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'processing'}
                    title="移除"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          {/* Actions */}
          <div className="flex gap-12 justify-between">
            <div className="flex gap-12">
              {!isProcessing ? (
                <button
                  className="btn btn-primary"
                  onClick={processFiles}
                  disabled={files.filter((f) => f.status === 'pending' || f.status === 'error').length === 0}
                >
                  开始处理
                </button>
              ) : (
                <button className="btn btn-danger" onClick={cancelAll}>
                  全部取消
                </button>
              )}
            </div>
            <button className="btn btn-ghost" onClick={clearAll} disabled={isProcessing}>
              清空列表
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
