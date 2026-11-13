// Top header bar for JARVIS
import { motion } from 'framer-motion'
import { Settings, Square, Wifi, WifiOff, Cpu, AlertTriangle } from 'lucide-react'
import { useJarvisStore } from '../store/useJarvisStore'

interface HeaderProps {
  onSettingsClick: () => void
  onStopAll: () => void
}

export default function Header({ onSettingsClick, onStopAll }: HeaderProps) {
  const status = useJarvisStore(s => s.status)
  const wsConnected = useJarvisStore(s => s.wsConnected)
  const pendingApprovals = useJarvisStore(s => s.pendingApprovals)

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <header
      className="relative z-10 flex items-center justify-between px-6 h-14"
      style={{
        background: 'rgba(2,11,24,0.95)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.3), rgba(0,102,255,0.2))',
              border: '1px solid rgba(0,212,255,0.5)',
              boxShadow: '0 0 20px rgba(0,212,255,0.2)',
            }}
          >
            <Cpu size={14} className="text-[var(--jarvis-cyan)]" />
          </div>
          <div
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
            style={{
              background: wsConnected ? 'var(--jarvis-green)' : 'var(--jarvis-red)',
              boxShadow: `0 0 6px ${wsConnected ? 'var(--jarvis-green)' : 'var(--jarvis-red)'}`,
            }}
          />
        </div>
        <div>
          <div className="font-orbitron text-sm font-bold text-[var(--jarvis-cyan)] tracking-[3px]" style={{ textShadow: '0 0 10px var(--jarvis-cyan)' }}>
            JARVIS
          </div>
          <div className="text-[9px] font-mono-code text-[var(--text-dim)] tracking-widest">
            LOCAL AI ASSISTANT v1.0
          </div>
        </div>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-6">
        {/* Status badge */}
        <motion.div
          key={status}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{
            background: 'rgba(0,212,255,0.06)',
            border: '1px solid rgba(0,212,255,0.15)',
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: status === 'idle' ? 'var(--jarvis-cyan)' :
                         status === 'error' ? 'var(--jarvis-red)' : 'var(--jarvis-green)',
              boxShadow: `0 0 6px ${status === 'idle' ? 'var(--jarvis-cyan)' : status === 'error' ? 'var(--jarvis-red)' : 'var(--jarvis-green)'}`,
              animation: status !== 'idle' ? 'status-glow 1s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[10px] font-orbitron tracking-widest text-[var(--text-secondary)]">
            {status.toUpperCase()}
          </span>
        </motion.div>

        {/* Pending approval warning */}
        {pendingApprovals.length > 0 && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.4)' }}
          >
            <AlertTriangle size={10} style={{ color: 'var(--jarvis-orange)' }} />
            <span className="text-[10px] font-orbitron" style={{ color: 'var(--jarvis-orange)' }}>
              {pendingApprovals.length} PENDING
            </span>
          </motion.div>
        )}
      </div>

      {/* Right: Controls + Clock */}
      <div className="flex items-center gap-4">
        {/* Clock */}
        <div className="text-right">
          <div className="font-mono-code text-sm text-[var(--jarvis-cyan)]" style={{ letterSpacing: '2px' }}>
            {timeStr}
          </div>
          <div className="font-mono-code text-[10px] text-[var(--text-dim)]">{dateStr}</div>
        </div>

        {/* Connection */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded"
          style={{ border: '1px solid var(--border-dim)' }}
        >
          {wsConnected ? (
            <Wifi size={12} style={{ color: 'var(--jarvis-green)' }} />
          ) : (
            <WifiOff size={12} style={{ color: 'var(--jarvis-red)' }} />
          )}
          <span
            className="text-[9px] font-mono-code"
            style={{ color: wsConnected ? 'var(--jarvis-green)' : 'var(--jarvis-red)' }}
          >
            {wsConnected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        {/* Stop button */}
        <button
          onClick={onStopAll}
          className="btn-jarvis btn-danger flex items-center gap-1.5 py-1.5"
          title="Stop all actions immediately"
        >
          <Square size={10} />
          STOP
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg transition-all"
          style={{ border: '1px solid var(--border-dim)', color: 'var(--text-dim)' }}
        >
          <Settings size={14} className="hover:text-[var(--jarvis-cyan)]" />
        </button>
      </div>
    </header>
  )
}
