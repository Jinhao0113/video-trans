import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { ProbeResult } from '../utils/ipc'

interface SharedFileState {
  filePath: string
  probeData: ProbeResult | null
  isLoading: boolean
  error: string
}

interface SharedFileContextType {
  sharedFile: SharedFileState
  loadSharedFile: (path: string) => Promise<void>
  clearSharedFile: () => void
}

const SharedFileContext = createContext<SharedFileContextType | null>(null)

export function SharedFileProvider({ children }: { children: ReactNode }) {
  const [sharedFile, setSharedFile] = useState<SharedFileState>({
    filePath: '',
    probeData: null,
    isLoading: false,
    error: ''
  })

  const loadSharedFile = useCallback(async (path: string) => {
    setSharedFile({ filePath: path, probeData: null, isLoading: true, error: '' })
    try {
      const data = (await window.api?.probe(path)) as ProbeResult
      setSharedFile({ filePath: path, probeData: data || null, isLoading: false, error: '' })
    } catch (err: unknown) {
      setSharedFile({
        filePath: path,
        probeData: null,
        isLoading: false,
        error: `无法读取文件: ${err instanceof Error ? err.message : String(err)}`
      })
    }
  }, [])

  const clearSharedFile = useCallback(() => {
    setSharedFile({ filePath: '', probeData: null, isLoading: false, error: '' })
  }, [])

  return (
    <SharedFileContext.Provider value={{ sharedFile, loadSharedFile, clearSharedFile }}>
      {children}
    </SharedFileContext.Provider>
  )
}

export function useSharedFile() {
  const ctx = useContext(SharedFileContext)
  if (!ctx) throw new Error('useSharedFile must be used within SharedFileProvider')
  return ctx
}
