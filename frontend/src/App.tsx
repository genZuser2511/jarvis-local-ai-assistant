// Main App — wires everything together
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import axios from 'axios'

import { useJarvisStore } from './store/useJarvisStore'
import { useWebSocket } from './hooks/useWebSocket'

import Header from './components/Header'
import JarvisOrb from './components/JarvisOrb'
import ChatPanel from './components/ChatPanel'
import ActivityPanel from './components/ActivityPanel'
import ScreenPreviewPanel from './components/ScreenPreviewPanel'
import ApprovalPanel from './components/ApprovalPanel'
import VoiceControlPanel from './components/VoiceControlPanel'
import SettingsPanel from './components/SettingsPanel'

const API = 'http://localhost:8000'

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [rightPanel, setRightPanel] = useState<'activity' | 'screen' | 'approval'>('activity')

  const {
    setMicActive, setBackendOnline, pendingApprovals, addActivity, removeApproval,
  } = useJarvisStore()

  const { sendMessage } = useWebSocket()

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await axios.get(`${API}/health`, { timeout: 3000 })
        setBackendOnline(true)
        addActivity({
          event: 'system',
          message: `Backend online — Ollama: ${data.ollama_available ? '✓' : '✗'} | Model: ${data.ollama_models?.[0] || 'none'}`,
          timestamp: Date.now() / 1000,
        })
      } catch {
        setBackendOnline(false)
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  // Auto-switch to approval tab when there are pending approvals
  useEffect(() => {
    if (pendingApprovals.length > 0) setRightPanel('approval')
  }, [pendingApprovals.length])

  const handleSendMessage = useCallback((text: string, includeScreenshot: boolean) => {
    sendMessage({ type: 'command', text, include_screenshot: includeScreenshot })
  }, [sendMessage])

  const handleStartListening = useCallback(() => {
    setMicActive(true)
    sendMessage({ type: 'start_listening' })
  }, [sendMessage, setMicActive])

  const handleStopListening = useCallback(() => {
    setMicActive(false)
    sendMessage({ type: 'stop_listening' })
  }, [sendMessage, setMicActive])

  const handleApprove = useCallback((actionId: number) => {
    sendMessage({ type: 'approve', action_id: actionId })
    removeApproval(actionId)
  }, [sendMessage, removeApproval])

  const handleDeny = useCallback((actionId: number) => {
    sendMessage({ type: 'deny', action_id: actionId })
    removeApproval(actionId)
  }, [sendMessage, removeApproval])

  const handleTakeScreenshot = useCallback(() => {
    sendMessage({ type: 'screenshot' })
  }, [sendMessage])

  const handleStopAll = useCallback(async () => {
    try { await axios.post(`${API}/stop`) } catch { /* ignore */ }
    addActivity({ event: 'system', message: 'Emergency stop triggered', timestamp: Date.now() / 1000 })
  }, [addActivity])

  const RightPanelTab = ({ id, label, badge }: { id: typeof rightPanel; label: string; badge?: number }) => (
    <button
      onClick={() => setRightPanel(id)}
      className="flex-1 py-1.5 text-[10px] font-orbitron tracking-widest transition-all relative"
      style={{
        color: rightPanel === id ? 'var(--jarvis-cyan)' : 'var(--text-dim)',
        borderBottom: `2px solid ${rightPanel === id ? 'var(--jarvis-cyan)' : 'transparent'}`,
      }}
    >
      {label}
      {badge && badge > 0 && (
        <span
          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px]"
          style={{ background: 'rgba(255,107,53,0.3)', color: 'var(--jarvis-orange)' }}
        >
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden">
      {/* Background layers */}
      <div className="jarvis-bg" />
      <div className="grid-overlay" />
      <div className="scanline" />

      {/* Header */}
      <div className="relative z-10">
        <Header onSettingsClick={() => setShowSettings(!showSettings)} onStopAll={handleStopAll} />
      </div>

      {/* Main layout */}
      <div className="relative z-10 flex-1 flex gap-3 p-3 overflow-hidden">

        {/* LEFT COLUMN: Orb + Voice */}
        <div className="w-56 flex flex-col gap-3 flex-shrink-0">
          {/* JARVIS Orb panel */}
          <div className="glass-panel p-5 flex flex-col items-center justify-center flex-shrink-0">
            <JarvisOrb />
          </div>

          {/* Voice control */}
          <VoiceControlPanel
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
          />
        </div>

        {/* CENTER COLUMN: Chat */}
        <div className="flex-1 min-w-0">
          <ChatPanel
            onSendMessage={handleSendMessage}
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
          />
        </div>

        {/* RIGHT COLUMN: Tabbed panels */}
        <div className="w-72 flex flex-col gap-0 flex-shrink-0">
          {/* Tab bar */}
          <div
            className="flex rounded-t-lg overflow-hidden"
            style={{ background: 'rgba(0,212,255,0.04)', borderTop: '1px solid var(--border-dim)', borderLeft: '1px solid var(--border-dim)', borderRight: '1px solid var(--border-dim)' }}
          >
            <RightPanelTab id="activity" label="ACTIVITY" />
            <RightPanelTab id="screen" label="SCREEN" />
            <RightPanelTab id="approval" label="APPROVE" badge={pendingApprovals.length} />
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0" style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            <AnimatePresence mode="wait">
              {rightPanel === 'activity' && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                  style={{ borderRadius: '0 0 12px 12px' }}
                >
                  <ActivityPanel />
                </motion.div>
              )}
              {rightPanel === 'screen' && (
                <motion.div
                  key="screen"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <ScreenPreviewPanel onTakeScreenshot={handleTakeScreenshot} />
                </motion.div>
              )}
              {rightPanel === 'approval' && (
                <motion.div
                  key="approval"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <ApprovalPanel onApprove={handleApprove} onDeny={handleDeny} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Settings overlay */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-96"
              style={{ padding: '14px 14px 14px 0' }}
            >
              <SettingsPanel onClose={() => setShowSettings(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
