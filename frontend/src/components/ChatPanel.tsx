// Chat interface — messages and text input
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, MicOff, Camera, Trash2, ChevronDown } from 'lucide-react'
import { useJarvisStore } from '../store/useJarvisStore'
import type { Message } from '../store/useJarvisStore'

interface ChatPanelProps {
  onSendMessage: (text: string, includeScreenshot: boolean) => void
  onStartListening: () => void
  onStopListening: () => void
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] font-mono-code text-[var(--text-dim)] bg-[rgba(0,212,255,0.04)] px-3 py-1 rounded-full border border-[var(--border-dim)]">
          {msg.content}
        </span>
      </div>
    )
  }

  return (
    <motion.div
      className={`message-bubble flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {!isUser && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-1 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #00d4ff40, #0066ff40)', border: '1px solid #00d4ff50' }}>
          <span className="font-orbitron text-[8px] text-[var(--jarvis-cyan)]">J</span>
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
          style={isUser ? {
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,102,255,0.12))',
            border: '1px solid rgba(0,212,255,0.25)',
            color: 'var(--text-primary)',
            borderRadius: '18px 18px 4px 18px',
          } : {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-primary)',
            borderRadius: '18px 18px 18px 4px',
          }}
        >
          {msg.content}
        </div>

        {/* Action plan tags */}
        {!isUser && msg.metadata?.plan && (msg.metadata.plan as unknown[]).length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {(msg.metadata.plan as Array<{ type: string }>).map((a, i) => (
              <span
                key={i}
                className="action-tag"
                style={{
                  color: '#00d4ff99',
                  borderColor: '#00d4ff33',
                  background: 'rgba(0,212,255,0.05)',
                }}
              >
                {a.type}
              </span>
            ))}
          </div>
        )}

        <span className="text-[10px] text-[var(--text-dim)] px-1">
          {new Date(msg.timestamp * 1000).toLocaleTimeString()}
        </span>
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center ml-2 mt-1 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(0,102,255,0.4))', border: '1px solid rgba(124,58,237,0.5)' }}>
          <span className="font-orbitron text-[8px] text-white">U</span>
        </div>
      )}
    </motion.div>
  )
}

export default function ChatPanel({ onSendMessage, onStartListening, onStopListening }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [includeScreenshot, setIncludeScreenshot] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const messages = useJarvisStore(s => s.messages)
  const micActive = useJarvisStore(s => s.micActive)
  const status = useJarvisStore(s => s.status)
  const clearMessages = useJarvisStore(s => s.clearMessages)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSendMessage(text, includeScreenshot)
    setInput('')
    setIncludeScreenshot(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isDisabled = status === 'thinking' || status === 'acting'

  return (
    <div className="glass-panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--jarvis-cyan)', boxShadow: '0 0 8px var(--jarvis-cyan)' }} />
          <span className="panel-title">Neural Interface</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-dim)] font-mono-code">
            {messages.length} msg
          </span>
          <button
            onClick={clearMessages}
            className="p-1 rounded hover:text-[var(--jarvis-red)] text-[var(--text-dim)] transition-colors"
            title="Clear history"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 panel-scroll p-4 relative"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <div className="font-orbitron text-2xl font-bold" style={{ color: 'var(--jarvis-cyan)', textShadow: '0 0 20px var(--jarvis-cyan)' }}>
              JARVIS
            </div>
            <p className="text-[var(--text-secondary)] text-sm max-w-xs">
              Your local AI desktop assistant. Type a command or press the mic to speak.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                'Open Notepad and write a reminder',
                'What apps are currently open?',
                'Take a screenshot and describe it',
                'Search for AI news online',
              ].map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="text-left px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--jarvis-cyan)] transition-colors"
                  style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        <AnimatePresence>
          {status === 'thinking' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 mb-3 pl-8"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--jarvis-purple)' }}
                    animate={{ y: [-4, 4, -4] }}
                    transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--text-dim)]">JARVIS is processing...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 p-2 rounded-full"
            style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}
          >
            <ChevronDown size={14} className="text-[var(--jarvis-cyan)]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-4 border-t border-[var(--border-dim)]">
        <div className="flex gap-2 items-end">
          {/* Screenshot toggle */}
          <button
            onClick={() => setIncludeScreenshot(!includeScreenshot)}
            className="p-2.5 rounded-lg transition-all flex-shrink-0"
            title="Include screenshot with command"
            style={{
              background: includeScreenshot ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.04)',
              border: `1px solid ${includeScreenshot ? 'rgba(0,212,255,0.5)' : 'rgba(0,212,255,0.15)'}`,
              color: includeScreenshot ? 'var(--jarvis-cyan)' : 'var(--text-dim)',
            }}
          >
            <Camera size={14} />
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or question..."
              disabled={isDisabled}
              rows={1}
              className="jarvis-input"
              style={{ minHeight: '42px', maxHeight: '120px', paddingRight: '16px' }}
            />
          </div>

          {/* Mic button */}
          <button
            onClick={micActive ? onStopListening : onStartListening}
            className="p-2.5 rounded-lg flex-shrink-0 transition-all relative"
            style={{
              background: micActive ? 'rgba(0,255,136,0.15)' : 'rgba(0,212,255,0.04)',
              border: `1px solid ${micActive ? 'rgba(0,255,136,0.5)' : 'rgba(0,212,255,0.15)'}`,
              color: micActive ? 'var(--jarvis-green)' : 'var(--text-dim)',
            }}
          >
            {micActive ? <Mic size={14} /> : <MicOff size={14} />}
            {micActive && (
              <span
                className="absolute inset-0 rounded-lg animate-ping"
                style={{ background: 'rgba(0,255,136,0.2)' }}
              />
            )}
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isDisabled}
            className="p-2.5 rounded-lg flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !isDisabled ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.04)',
              border: `1px solid ${input.trim() && !isDisabled ? 'rgba(0,212,255,0.5)' : 'rgba(0,212,255,0.1)'}`,
              color: input.trim() && !isDisabled ? 'var(--jarvis-cyan)' : 'var(--text-dim)',
            }}
          >
            <Send size={14} />
          </button>
        </div>

        {includeScreenshot && (
          <p className="text-[10px] text-[var(--jarvis-cyan)] mt-2 font-mono-code">
            📷 Screenshot will be included with your command
          </p>
        )}
      </div>
    </div>
  )
}
