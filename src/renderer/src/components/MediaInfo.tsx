import { useState, useCallback } from 'react'
import { Film, Music, MessageSquare, Paperclip, FileText, Info, X, LayoutDashboard, List, AlertTriangle, FileSearch } from 'lucide-react'
import {
  MEDIA_FILTER,
  SUBTITLE_FILTER,
  SUBTITLE_FORMATS,
  formatFileSize,
  formatDuration,
  formatBitrate,
  getFileName,
  generateTaskId
} from '../utils/formats'
import type { StreamInfo } from '../utils/ipc'
import { useSharedFile } from '../context/SharedFileContext'

export default function MediaInfo() {
  const { sharedFile, loadSharedFile, clearSharedFile } = useSharedFile()
  const inputFile = sharedFile.filePath
  const probeData = sharedFile.probeData
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'streams' | 'subtitles'>('overview')

  const loadFile = useCallback(async (filePath: string) => {
    setError('')
    setActiveTab('overview')
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

  const handleClear = () => {
    clearSharedFile()
    setError('')
  }

  const handleExtractSubtitle = useCallback(
    async (stream: StreamInfo) => {
      if (!inputFile) return

      const format = SUBTITLE_FORMATS.find((f) => f.value === 'srt') || SUBTITLE_FORMATS[0]
      const saveResult = await window.api?.saveFile({
        defaultPath: `${getFileName(inputFile)}_subtitle_${stream.index}${format.extension}`,
        filters: SUBTITLE_FORMATS.map((f) => ({
          name: f.label,
          extensions: [f.value]
        }))
      })

      if (!saveResult || saveResult.canceled || !saveResult.filePath) return

      try {
        const taskId = generateTaskId()
        await window.api?.extractSubtitles({
          input: inputFile,
          output: saveResult.filePath,
          streamIndex: stream.index,
          taskId
        })
        alert(`字幕提取完成: ${getFileName(saveResult.filePath)}`)
      } catch (err: unknown) {
        alert(`字幕提取失败: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [inputFile]
  )

  const handleEmbedSubtitle = useCallback(async () => {
    if (!inputFile) return

    const subtitleResult = await window.api?.openFile({
      filters: [SUBTITLE_FILTER, { name: '所有文件', extensions: ['*'] }]
    })

    if (!subtitleResult || subtitleResult.canceled || !subtitleResult.filePaths[0]) return

    const saveResult = await window.api?.saveFile({
      defaultPath: `${getFileName(inputFile)}_subtitled.mp4`,
      filters: [{ name: 'MP4', extensions: ['mp4'] }, { name: 'MKV', extensions: ['mkv'] }]
    })

    if (!saveResult || saveResult.canceled || !saveResult.filePath) return

    try {
      const taskId = generateTaskId()
      await window.api?.embedSubtitles({
        input: inputFile,
        subtitleFile: subtitleResult.filePaths[0],
        output: saveResult.filePath,
        taskId
      })
      alert(`字幕嵌入完成: ${getFileName(saveResult.filePath)}`)
    } catch (err: unknown) {
      alert(`字幕嵌入失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [inputFile])

  const videoStreams = probeData?.streams.filter((s) => s.codecType === 'video') || []
  const audioStreams = probeData?.streams.filter((s) => s.codecType === 'audio') || []
  const subtitleStreams = probeData?.streams.filter((s) => s.codecType === 'subtitle') || []

  const getCodecTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Film size={14} style={{ marginRight: 4, display: 'inline-block' }} />
      case 'audio': return <Music size={14} style={{ marginRight: 4, display: 'inline-block' }} />
      case 'subtitle': return <MessageSquare size={14} style={{ marginRight: 4, display: 'inline-block' }} />
      case 'data': return <Paperclip size={14} style={{ marginRight: 4, display: 'inline-block' }} />
      default: return <FileText size={14} style={{ marginRight: 4, display: 'inline-block' }} />
    }
  }

  const getCodecTypeName = (type: string) => {
    switch (type) {
      case 'video': return '视频'
      case 'audio': return '音频'
      case 'subtitle': return '字幕'
      case 'data': return '数据'
      default: return type
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header__title">媒体信息</h1>
        <p className="page-header__subtitle">查看媒体文件的详细信息和流数据</p>
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
            <div className="dropzone__icon"><FileSearch size={48} strokeWidth={1.5} /></div>
            <div className="dropzone__title">拖拽文件查看信息</div>
            <div className="dropzone__subtitle">
              或 <span className="dropzone__browse">浏览文件</span> 选择媒体文件
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card mt-16">
          <div className="badge badge-danger" style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} strokeWidth={1.5} /> {error}
          </div>
        </div>
      )}

      {inputFile && probeData && (
        <div className="animate-fade-in">
          {/* File Header */}
          <div className="card mb-16">
            <div className="file-info">
              <div className="file-info__icon"><Info size={32} strokeWidth={1.5} /></div>
              <div className="file-info__details">
                <div className="file-info__name select-text">{getFileName(inputFile)}</div>
                <div className="file-info__meta select-text">
                  <span>{probeData.format.formatLongName}</span>
                  <span>{formatFileSize(probeData.format.size)}</span>
                  <span>{formatDuration(probeData.format.duration)}</span>
                </div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={handleBrowse}>
                更换文件
              </button>
              <button className="file-info__remove" onClick={handleClear} title="清除">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="tab-bar">
            <button
              className={`tab-bar__item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <LayoutDashboard size={14} style={{ marginRight: 6 }} /> 概览
            </button>
            <button
              className={`tab-bar__item ${activeTab === 'streams' ? 'active' : ''}`}
              onClick={() => setActiveTab('streams')}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <List size={14} style={{ marginRight: 6 }} /> 流详情
            </button>
            <button
              className={`tab-bar__item ${activeTab === 'subtitles' ? 'active' : ''}`}
              onClick={() => setActiveTab('subtitles')}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <MessageSquare size={14} style={{ marginRight: 6 }} /> 字幕
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="card animate-scale-in">
              <h3 className="card__title mb-16">
                <span className="card__title-icon" style={{ display: 'flex' }}><LayoutDashboard size={18} strokeWidth={1.5} /></span>
                文件概览
              </h3>

              <div className="media-info">
                <div className="media-info__item">
                  <div className="media-info__label">文件名</div>
                  <div className="media-info__value select-text">{getFileName(inputFile)}</div>
                </div>
                <div className="media-info__item">
                  <div className="media-info__label">容器格式</div>
                  <div className="media-info__value select-text">
                    {probeData.format.formatName} ({probeData.format.formatLongName})
                  </div>
                </div>
                <div className="media-info__item">
                  <div className="media-info__label">文件大小</div>
                  <div className="media-info__value">{formatFileSize(probeData.format.size)}</div>
                </div>
                <div className="media-info__item">
                  <div className="media-info__label">时长</div>
                  <div className="media-info__value">{formatDuration(probeData.format.duration)}</div>
                </div>
                <div className="media-info__item">
                  <div className="media-info__label">总码率</div>
                  <div className="media-info__value">{formatBitrate(probeData.format.bitRate)}</div>
                </div>
                <div className="media-info__item">
                  <div className="media-info__label">流数量</div>
                  <div className="media-info__value">
                    {probeData.format.nbStreams} ({videoStreams.length} 视频, {audioStreams.length} 音频
                    {subtitleStreams.length > 0 ? `, ${subtitleStreams.length} 字幕` : ''})
                  </div>
                </div>

                {/* Video info */}
                {videoStreams[0] && (
                  <>
                    <div className="media-info__item">
                      <div className="media-info__label">视频编码</div>
                      <div className="media-info__value select-text">
                        {videoStreams[0].codecLongName || videoStreams[0].codecName}
                        {videoStreams[0].profile ? ` (${videoStreams[0].profile})` : ''}
                      </div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">分辨率</div>
                      <div className="media-info__value">
                        {videoStreams[0].width}×{videoStreams[0].height}
                        {videoStreams[0].displayAspectRatio ? ` (${videoStreams[0].displayAspectRatio})` : ''}
                      </div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">帧率</div>
                      <div className="media-info__value">{videoStreams[0].frameRate || 'N/A'}</div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">像素格式</div>
                      <div className="media-info__value">{videoStreams[0].pixFmt || 'N/A'}</div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">视频码率</div>
                      <div className="media-info__value">
                        {videoStreams[0].bitRate ? formatBitrate(videoStreams[0].bitRate) : 'N/A'}
                      </div>
                    </div>
                  </>
                )}

                {/* Audio info */}
                {audioStreams[0] && (
                  <>
                    <div className="media-info__item">
                      <div className="media-info__label">音频编码</div>
                      <div className="media-info__value select-text">
                        {audioStreams[0].codecLongName || audioStreams[0].codecName}
                      </div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">采样率</div>
                      <div className="media-info__value">
                        {audioStreams[0].sampleRate ? `${audioStreams[0].sampleRate} Hz` : 'N/A'}
                      </div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">声道</div>
                      <div className="media-info__value">
                        {audioStreams[0].channels || 'N/A'}
                        {audioStreams[0].channelLayout ? ` (${audioStreams[0].channelLayout})` : ''}
                      </div>
                    </div>
                    <div className="media-info__item">
                      <div className="media-info__label">音频码率</div>
                      <div className="media-info__value">
                        {audioStreams[0].bitRate ? formatBitrate(audioStreams[0].bitRate) : 'N/A'}
                      </div>
                    </div>
                  </>
                )}

                {/* Tags */}
                {probeData.format.tags &&
                  Object.keys(probeData.format.tags).length > 0 &&
                  Object.entries(probeData.format.tags).map(([key, value]) => (
                    <div className="media-info__item" key={key}>
                      <div className="media-info__label">{key}</div>
                      <div className="media-info__value select-text">{value}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Streams Tab */}
          {activeTab === 'streams' && (
            <div className="card animate-scale-in">
              <h3 className="card__title mb-16">
                <span className="card__title-icon" style={{ display: 'flex' }}><List size={18} strokeWidth={1.5} /></span>
                流信息 ({probeData.streams.length} 个流)
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table className="streams-table select-text">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>类型</th>
                      <th>编码</th>
                      <th>详情</th>
                      <th>码率</th>
                      <th>语言</th>
                    </tr>
                  </thead>
                  <tbody>
                    {probeData.streams.map((stream) => (
                      <tr key={stream.index}>
                        <td>{stream.index}</td>
                        <td>
                          <span className="badge badge-primary">
                            {getCodecTypeIcon(stream.codecType)} {getCodecTypeName(stream.codecType)}
                          </span>
                        </td>
                        <td>
                          {stream.codecLongName || stream.codecName}
                          {stream.profile ? ` (${stream.profile})` : ''}
                        </td>
                        <td>
                          {stream.codecType === 'video' && (
                            <>
                              {stream.width}×{stream.height}
                              {stream.frameRate ? ` @ ${stream.frameRate} fps` : ''}
                              {stream.pixFmt ? ` · ${stream.pixFmt}` : ''}
                            </>
                          )}
                          {stream.codecType === 'audio' && (
                            <>
                              {stream.sampleRate ? `${stream.sampleRate} Hz` : ''}
                              {stream.channels ? ` · ${stream.channels}ch` : ''}
                              {stream.channelLayout ? ` (${stream.channelLayout})` : ''}
                            </>
                          )}
                          {stream.codecType === 'subtitle' && (
                            <>{stream.title || stream.codecName}</>
                          )}
                        </td>
                        <td>{stream.bitRate ? formatBitrate(stream.bitRate) : 'N/A'}</td>
                        <td>{stream.language || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subtitles Tab */}
          {activeTab === 'subtitles' && (
            <div className="card animate-scale-in">
              <div className="card__header">
                <h3 className="card__title">
                  <span className="card__title-icon" style={{ display: 'flex' }}><MessageSquare size={18} strokeWidth={1.5} /></span>
                  字幕管理
                </h3>
                <button className="btn btn-sm btn-secondary" onClick={handleEmbedSubtitle}>
                  嵌入字幕
                </button>
              </div>

              {subtitleStreams.length > 0 ? (
                <div className="batch-list">
                  {subtitleStreams.map((stream) => (
                    <div key={stream.index} className="batch-item">
                      <div className="batch-item__index" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MessageSquare size={18} /></div>
                      <div className="batch-item__info">
                        <div className="batch-item__name">
                          字幕流 #{stream.index}
                          {stream.title ? ` - ${stream.title}` : ''}
                        </div>
                        <div className="batch-item__size">
                          {stream.codecName}
                          {stream.language ? ` · ${stream.language}` : ''}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleExtractSubtitle(stream)}
                      >
                        提取
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state__icon"><MessageSquare size={48} strokeWidth={1.5} /></div>
                  <div className="empty-state__title">未检测到字幕流</div>
                  <div className="empty-state__description">
                    该文件不包含内嵌字幕。你可以使用"嵌入字幕"功能添加外部字幕文件。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
