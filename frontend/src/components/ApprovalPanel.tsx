// Approval controls — approve or deny sensitive pending actions
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle, XCircle, Shield, Terminal, Trash2, Mail, Package } from 'lucide-react'
import { useJarvisStore } from '../store/useJarvisStore'

interface ApprovalPanelProps {
  onApprove: (actionId: number) => void
  onDeny: (actionId: number) => void
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  delete_file: <Trash2 size={14} />,
  shell_command: <Terminal size={14} />,
  send_email: <Mail size={14} />,
  install: <Package size={14} />,
}

export default function ApprovalPanel({ onApprove, onDeny }: ApprovalPanelProps) {
  const pendingApprovals = useJarvisStore(s => s.pendingApprovals)
  const removeApproval = useJarvisStore(s => s.removeApproval)

  const handleApprove = (actionId: number) => {
    onApprove(actionId)
    removeApproval(actionId)
  }

  const handleDeny = (actionId: number) => {
    onDeny(actionId)
    removeApproval(actionId)
  }

  return (
    <div className="glass-panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-4 rounded-full"
            style={{
              background: pendingApprovals.length > 0 ? 'var(--jarvis-orange)' : 'var(--jarvis-green)',
              boxShadow: `0 0 8px ${pendingApprovals.length > 0 ? 'var(--jarvis-orange)' : 'var(--jarvis-green)'}`,
            }}
          />
          <span className="panel-title">Approval Controls</span>
        </div>
        {pendingApprovals.length > 0 && (
          <div
            className="px-2 py-0.5 rounded-full text-[10px] font-orbitron font-bold"
            style={{ background: 'rgba(255,107,53,0.2)', color: 'var(--jarvis-orange)', border: '1px solid rgba(255,107,53,0.4)' }}
          >
            {pendingApprovals.length} PENDING
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 panel-scroll p-4">
        <AnimatePresence mode="popLayout">
          {pendingApprovals.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center gap-3"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}
              >
                <Shield size={20} style={{ color: 'var(--jarvis-green)', opacity: 0.7 }} />
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)]">All clear</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  No pending approvals
                </p>
              </div>
            </motion.div>
          ) : (
            pendingApprovals.map(req => (
              <motion.div
                key={req.action_id}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.25 }}
                className="approval-card mb-3"
              >
                {/* Warning header */}
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} style={{ color: 'var(--jarvis-orange)' }} />
                  <span className="text-xs font-orbitron font-bold tracking-wider" style={{ color: 'var(--jarvis-orange)' }}>
                    ACTION REQUIRES APPROVAL
                  </span>
                </div>

                {/* Action details */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="p-1 rounded"
                      style={{ background: 'rgba(255,107,53,0.15)', color: 'var(--jarvis-orange)' }}
                    >
                      {ACTION_ICONS[req.action.type] || <Terminal size={14} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{req.action.description}</p>
                      <span
                        className="action-tag text-[10px]"
                        style={{ color: 'var(--jarvis-orange)', borderColor: 'rgba(255,107,53,0.3)' }}
                      >
                        {req.action.type}
                      </span>
                    </div>
                  </div>

                  {/* Parameters */}
                  {req.action.parameters && Object.keys(req.action.parameters).length > 0 && (
                    <pre
                      className="text-[11px] font-mono-code p-2 rounded mt-2 overflow-x-auto"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(255,107,53,0.15)',
                      }}
                    >
                      {JSON.stringify(req.action.parameters, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req.action_id)}
                    className="flex-1 btn-jarvis btn-success flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={12} />
                    APPROVE
                  </button>
                  <button
                    onClick={() => handleDeny(req.action_id)}
                    className="flex-1 btn-jarvis btn-danger flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={12} />
                    DENY
                  </button>
                </div>

                <p className="text-[10px] text-[var(--text-dim)] mt-2 text-center">
                  Requested at {new Date(req.timestamp * 1000).toLocaleTimeString()}
                </p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
