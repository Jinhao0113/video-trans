import { useState, useCallback, useEffect } from 'react'
import { Settings2, Book, Command, Monitor, Terminal, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface FFmpegStatus {
  available: boolean
  version: string
  path: string
  ffprobePath: string
}

export default function Settings() {
  const [status, setStatus] = useState<FFmpegStatus | null>(null)
  const [customPath, setCustomPath] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    window.api?.getFFmpegStatus().then((s) => {
      setStatus(s)
      if (s.path) setCustomPath(s.path)
    })
  }, [])

  const handleBrowse = useCallback(async () => {
    const result = await window.api?.openFile({
      filters: [{ name: 'FFmpeg', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
    })
    if (result && !result.canceled && result.filePaths[0]) {
      setCustomPath(result.filePaths[0])
    }
  }, [])

  const handleApply = useCallback(async () => {
    setError('')
    setSuccess('')
    try {
      const newStatus = (await window.api?.setFFmpegPath(customPath)) as FFmpegStatus
      setStatus(newStatus)
      setSuccess('FFmpeg 路径已更新')
    } catch (err: unknown) {
      setError(`设置失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [customPath])

  const handleRefresh = useCallback(async () => {
    const s = await window.api?.getFFmpegStatus()
    if (s) {
      setStatus(s)
      if (s.path) setCustomPath(s.path)
    }
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">设置</h1>
        <p className="page-header__subtitle">配置 FFmpeg 路径和应用偏好</p>
      </div>

      <div className="card mb-16 animate-fade-in">
        <div className="settings-section">
          <h3 className="settings-section__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={18} strokeWidth={1.5} /> FFmpeg 配置
          </h3>

          {/* Status */}
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-8 mb-8">
                <span
                  className={`status-dot ${status?.available ? 'status-dot--online' : 'status-dot--offline'}`}
                />
                <span style={{ fontWeight: 600 }}>
                  {status?.available ? 'FFmpeg 已就绪' : 'FFmpeg 未检测到'}
                </span>
              </div>
              {status?.available && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  版本: {status.version}
                </div>
              )}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={handleRefresh}>
              刷新
            </button>
          </div>

          {/* Path */}
          {status && (
            <>
              <div className="media-info mt-16">
                <div className="media-info__item">
                  <div className="media-info__label">FFmpeg 路径</div>
                  <div className="media-info__value media-info__value--mono select-text">
                    {status.path || '未设置'}
                  </div>
                </div>
                <div className="media-info__item">
                  <div className="media-info__label">FFprobe 路径</div>
                  <div className="media-info__value media-info__value--mono select-text">
                    {status.ffprobePath || '未设置'}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="divider" />

          {/* Custom Path */}
          <div>
            <label className="form-label mb-8" style={{ display: 'block' }}>
              自定义 FFmpeg 路径
            </label>
            <div className="flex gap-8">
              <input
                className="form-input"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="输入 FFmpeg 可执行文件路径..."
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm btn-secondary" onClick={handleBrowse}>
                浏览
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleApply}>
                应用
              </button>
            </div>

            {error && (
              <div className="mt-16">
                <div className="badge badge-danger" style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} strokeWidth={1.5} /> {error}
                </div>
              </div>
            )}
            {success && (
              <div className="mt-16">
                <div className="badge badge-success" style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} strokeWidth={1.5} /> {success}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help section */}
      <div className="card animate-fade-in">
        <div className="settings-section">
          <h3 className="settings-section__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Book size={18} strokeWidth={1.5} /> 安装 FFmpeg
          </h3>

          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <p className="mb-12">
              <strong>MediaForge</strong> 需要系统中安装 FFmpeg 才能进行媒体处理操作。
            </p>

            <div className="media-info">
              <div className="media-info__item">
                <div className="media-info__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Command size={14} strokeWidth={1.5} /> macOS</div>
                <div className="media-info__value media-info__value--mono select-text">
                  brew install ffmpeg
                </div>
              </div>
              <div className="media-info__item">
                <div className="media-info__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Monitor size={14} strokeWidth={1.5} /> Windows</div>
                <div className="media-info__value media-info__value--mono select-text">
                  winget install ffmpeg
                </div>
              </div>
              <div className="media-info__item">
                <div className="media-info__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Terminal size={14} strokeWidth={1.5} /> Ubuntu/Debian</div>
                <div className="media-info__value media-info__value--mono select-text">
                  sudo apt install ffmpeg
                </div>
              </div>
              <div className="media-info__item">
                <div className="media-info__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Terminal size={14} strokeWidth={1.5} /> Fedora</div>
                <div className="media-info__value media-info__value--mono select-text">
                  sudo dnf install ffmpeg
                </div>
              </div>
              <div className="media-info__item">
                <div className="media-info__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Terminal size={14} strokeWidth={1.5} /> Arch Linux</div>
                <div className="media-info__value media-info__value--mono select-text">
                  sudo pacman -S ffmpeg
                </div>
              </div>
            </div>

            <p className="mt-16">
              安装完成后，FFmpeg 会被自动检测。如果未能自动检测，请使用上方的"自定义路径"功能手动指定 FFmpeg 路径。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
