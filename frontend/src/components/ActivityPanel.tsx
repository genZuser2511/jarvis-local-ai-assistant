// Live Activity Feed panel
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Zap, AlertTriangle, CheckCircle, XCircle, Info, Wifi, WifiOff, Terminal, Eye } from 'lucide-react'
import { useJarvisStore, type ActivityItem } from '../store/useJarvisStore'

const EVENT_ICONS: Record<string, React.ReactNode> = {
  connected: <Wifi size={11} />,
  disconnected: <WifiOff size={11} />,
  thinking: <Activity size={11} />,
  executing: <Zap size={11} />,
  action_done: <CheckCircle size={11} />,
  action_result: <CheckCircle size={11} />,
  action_error: <XCircle size={11} />,
  approval_needed: <AlertTriangle size={11} />,
  approved: <CheckCircle size={11} />,
  denied: <XCircle size={11} />,
  cancelled: <XCircle size={11} />,
  voice: <Activity size={11} />,
  screenshot: <Eye size={11} />,
  system: <Info size={11} />,
  plan: <Terminal size={11} />,
  error: <XCircle size={11} />,
  warning: <AlertTriangle size={11} />,
  settings: <Info size={11} />,
  transcribing: <Activity size={11} />,
}

const EVENT_COLORS: Record<string, string> = {
  connected: 'var(--jarvis-green)',
  disconnected: 'var(--jarvis-red)',
  thinking: 'var(--jarvis-purple)',
  executing: 'var(--jarvis-orange)',
  action_done: 'var(--jarvis-green)',
  action_result: 'var(--jarvis-green)',
  action_error: 'var(--jarvis-red)',
  approval_needed: 'var(--jarvis-orange)',
  approved: 'var(--jarvis-green)',
  denied: 'var(--jarvis-red)',
  cancelled: 'var(--jarvis-red)',
  voice: 'var(--jarvis-cyan)',
  screenshot: 'var(--jarvis-blue)',
  system: 'var(--text-dim)',
  plan: 'var(--jarvis-cyan)',
  error: 'var(--jarvis-red)',
  warning: 'var(--jarvis-orange)',
  settings: 'var(--jarvis-purple)',
  transcribing: 'var(--jarvis-blue)',
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const color = EVENT_COLORS[item.event] || 'var(--text-dim)'
  const icon = EVENT_ICONS[item.event] || <Info size={11} />
  const time = new Date(item.timestamp * 1000).toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <motion.div
      className="activity-item"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5"
        style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-primary)] leading-snug truncate">{item.message}</p>
        {item.data && Object.keys(item.data).length > 0 && (
          <p className="text-[10px] font-mono-code text-[var(--text-dim)] truncate mt-0.5">
            {JSON.stringify(item.data).slice(0, 80)}
          </p>
        )}
      </div>

      {/* Time */}
      <span className="text-[9px] font-mono-code text-[var(--text-dim)] flex-shrink-0">{time}</span>
    </motion.div>
  )
}

export default function ActivityPanel() {
  const activityLog = useJarvisStore(s => s.activityLog)
  const status = useJarvisStore(s => s.status)
  const wsConnected = useJarvisStore(s => s.wsConnected)

  return (
    <div className="glass-panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--jarvis-orange)', boxShadow: '0 0 8px var(--jarvis-orange)' }} />
          <span className="panel-title">Live Activity</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className="status-dot"
              style={{ background: wsConnected ? 'var(--jarvis-green)' : 'var(--jarvis-red)', color: wsConnected ? 'var(--jarvis-green)' : 'var(--jarvis-red)' }}
            />
            <span className="text-[10px] font-mono-code" style={{ color: wsConnected ? 'var(--jarvis-green)' : 'var(--jarvis-red)' }}>
              {wsConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <span className="text-[10px] text-[var(--text-dim)] font-mono-code">
            {activityLog.length} events
          </span>
        </div>
      </div>

      {/* Current status bar */}
      <div
        className="px-4 py-2 border-b border-[var(--border-dim)] flex items-center gap-2"
        style={{ background: 'rgba(0,212,255,0.02)' }}
      >
        <div
          className="status-dot flex-shrink-0"
          style={{
            background: status === 'idle' ? 'var(--jarvis-cyan)' : 'var(--jarvis-green)',
            color: status === 'idle' ? 'var(--jarvis-cyan)' : 'var(--jarvis-green)',
          }}
        />
        <span className="text-[10px] font-orbitron tracking-widest text-[var(--text-secondary)]">
          STATUS: <span style={{ color: 'var(--jarvis-cyan)' }}>{status.toUpperCase()}</span>
        </span>
      </div>

      {/* Activity list */}
      <div className="flex-1 panel-scroll px-4 py-2">
        {activityLog.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-[var(--text-dim)] text-center">
              No activity yet.<br />Send a command to get started.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {activityLog.map(item => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
