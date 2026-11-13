// Screen preview panel — shows latest screenshots
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ZoomIn, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { useJarvisStore } from '../store/useJarvisStore'

interface ScreenPreviewPanelProps {
  onTakeScreenshot: () => void
}

export default function ScreenPreviewPanel({ onTakeScreenshot }: ScreenPreviewPanelProps) {
  const screenshots = useJarvisStore(s => s.screenshots)
  const latestScreenshot = useJarvisStore(s => s.latestScreenshot)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const displayed = screenshots[selectedIndex] || latestScreenshot
  const BACKEND = 'http://localhost:8000'

  const getImgSrc = (filepath: string | undefined) => {
    if (!filepath) return null
    const normalized = filepath.replace(/\\/g, '/')
    const filename = normalized.split('/').pop()
    return `${BACKEND}/screenshots/${filename}`
  }

  return (
    <>
      <div className="glass-panel flex flex-col h-full">
        {/* Header */}
        <div className="panel-header justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--jarvis-blue)', boxShadow: '0 0 8px var(--jarvis-blue)' }} />
            <span className="panel-title">Screen Vision</span>
          </div>
          <div className="flex items-center gap-2">
            {screenshots.length > 0 && (
              <span className="text-[10px] font-mono-code text-[var(--text-dim)]">
                {selectedIndex + 1}/{screenshots.length}
              </span>
            )}
            <button
              onClick={onTakeScreenshot}
              className="btn-jarvis py-1 px-3 flex items-center gap-1.5"
              style={{ fontSize: '9px' }}
            >
              <Camera size={10} />
              CAPTURE
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 p-4 flex flex-col gap-3">
          {displayed ? (
            <>
              {/* Main image */}
              <div
                className="relative rounded-lg overflow-hidden cursor-pointer group flex-1"
                style={{ border: '1px solid var(--border-dim)', background: '#000', minHeight: 0 }}
                onClick={() => setZoomed(true)}
              >
                <img
                  src={getImgSrc(displayed.filepath) || ''}
                  alt="Screen capture"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: '100%' }}
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-[rgba(0,212,255,0.05)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn size={24} className="text-[var(--jarvis-cyan)]" />
                </div>
                {/* Scan line effect */}
                <div
                  className="absolute inset-x-0 top-0 h-px opacity-30 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--jarvis-cyan), transparent)' }}
                />
              </div>

              {/* Description */}
              {displayed.description && (
                <div className="rounded-lg p-3" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Eye size={10} className="text-[var(--jarvis-cyan)]" />
                    <span className="text-[9px] font-orbitron tracking-widest text-[var(--jarvis-cyan)]">AI ANALYSIS</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-4">
                    {displayed.description}
                  </p>
                </div>
              )}

              {/* Thumbnail strip */}
              {screenshots.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {screenshots.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIndex(i)}
                      className="flex-shrink-0 w-12 h-8 rounded overflow-hidden transition-all"
                      style={{
                        border: `1px solid ${i === selectedIndex ? 'var(--jarvis-cyan)' : 'rgba(0,212,255,0.1)'}`,
                        opacity: i === selectedIndex ? 1 : 0.6,
                      }}
                    >
                      <img src={getImgSrc(s.filepath) || ''} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.2)' }}
              >
                <Camera size={28} className="text-[var(--jarvis-blue)]" style={{ opacity: 0.5 }} />
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)]">No screenshots yet</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Click CAPTURE or ask JARVIS to "take a screenshot"
                </p>
              </div>
              <button onClick={onTakeScreenshot} className="btn-jarvis">
                TAKE SCREENSHOT
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zoom modal */}
      <AnimatePresence>
        {zoomed && displayed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)' }}
            onClick={() => setZoomed(false)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full"
              style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}
              onClick={() => setZoomed(false)}
            >
              <X size={16} className="text-[var(--jarvis-cyan)]" />
            </button>
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={getImgSrc(displayed.filepath) || ''}
              alt="Screen capture"
              className="max-w-full max-h-full rounded-lg object-contain"
              style={{ border: '1px solid rgba(0,212,255,0.2)' }}
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
