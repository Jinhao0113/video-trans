import { useState, useEffect } from 'react'
import { useTheme } from './hooks/useTheme'
import Converter from './components/Converter'
import Trimmer from './components/Trimmer'
import BatchProcessor from './components/BatchProcessor'
import MediaInfo from './components/MediaInfo'
import Settings from './components/Settings'
import { SharedFileProvider } from './context/SharedFileContext'
import { 
  ArrowRightLeft, 
  Scissors, 
  Layers, 
  Info, 
  Settings as SettingsIcon, 
  Moon, 
  Sun,
  MonitorPlay
} from 'lucide-react'

type Page = 'converter' | 'trimmer' | 'batch' | 'mediainfo' | 'settings'

const NAV_ITEMS: { id: Page; icon: React.FC<any>; label: string; section?: string }[] = [
  { id: 'converter', icon: ArrowRightLeft, label: '格式转换', section: '处理' },
  { id: 'trimmer', icon: Scissors, label: '视频裁剪' },
  { id: 'batch', icon: Layers, label: '批量处理' },
  { id: 'mediainfo', icon: Info, label: '媒体信息', section: '工具' },
  { id: 'settings', icon: SettingsIcon, label: '设置', section: '系统' }
]

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('converter')
  const { theme, toggleTheme } = useTheme()
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null)
  const isMac = window.api?.getPlatform() === 'darwin'

  useEffect(() => {
    window.api?.getFFmpegStatus().then((status) => {
      setFfmpegAvailable(status.available)
    })
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'converter':
        return <Converter />
      case 'trimmer':
        return <Trimmer />
      case 'batch':
        return <BatchProcessor />
      case 'mediainfo':
        return <MediaInfo />
      case 'settings':
        return <Settings />
      default:
        return <Converter />
    }
  }

  let lastSection = ''

  return (
    <SharedFileProvider>
      <>
        {/* Title Bar */}
        <div className="titlebar">
          <div className="titlebar__logo">
            <div className="titlebar__logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MonitorPlay size={16} strokeWidth={2} />
            </div>
            <span className="titlebar__title">MediaForge</span>
          </div>
          <div className="titlebar__controls">
            {ffmpegAvailable !== null && (
              <div className="flex items-center gap-8" style={{ marginRight: 8 }}>
                <span
                  className={`status-dot ${ffmpegAvailable ? 'status-dot--online' : 'status-dot--offline'}`}
                />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                  FFmpeg {ffmpegAvailable ? '就绪' : '未检测到'}
                </span>
              </div>
            )}
            {/* Only show custom window controls on non-macOS platforms */}
            {!isMac && (
              <>
                <button className="titlebar__btn" onClick={() => window.api?.minimize()} title="最小化">
                  ─
                </button>
                <button className="titlebar__btn" onClick={() => window.api?.maximize()} title="最大化">
                  □
                </button>
                <button
                  className="titlebar__btn"
                  onClick={() => window.api?.close()}
                  title="关闭"
                  style={{ borderRadius: 'var(--border-radius-sm)' }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="app-layout">
          {/* Sidebar */}
          <nav className="sidebar">
            <div className="sidebar__nav">
              {NAV_ITEMS.map((item) => {
                const showSection = item.section && item.section !== lastSection
                if (item.section) lastSection = item.section

                const Icon = item.icon

                return (
                  <div key={item.id}>
                    {showSection && (
                      <div className="sidebar__section-label">{item.section}</div>
                    )}
                    <button
                      className={`sidebar__item ${currentPage === item.id ? 'active' : ''}`}
                      onClick={() => setCurrentPage(item.id)}
                    >
                      <span className="sidebar__icon">
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      {item.label}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="sidebar__footer">
              <button className="theme-toggle" onClick={toggleTheme}>
                <span className="sidebar__icon">
                  {theme === 'dark' ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {theme === 'dark' ? '暗色模式' : '亮色模式'}
                </span>
                <div className="theme-toggle__track">
                  <div className="theme-toggle__thumb" />
                </div>
              </button>
            </div>
          </nav>

          {/* Content */}
          <main className="main-content">
            <div className="animate-fade-in" key={currentPage}>
              {renderPage()}
            </div>
          </main>
        </div>
      </>
    </SharedFileProvider>
  )
}
