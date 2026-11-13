// Voice control panel — microphone, listening indicator, PTT
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, VolumeX, Radio, Wifi } from 'lucide-react'
import { useJarvisStore } from '../store/useJarvisStore'

interface VoiceControlPanelProps {
  onStartListening: () => void
  onStopListening: () => void
}

export default function VoiceControlPanel({ onStartListening, onStopListening }: VoiceControlPanelProps) {
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false)

  const micActive = useJarvisStore(s => s.micActive)
  const status = useJarvisStore(s => s.status)
  const settings = useJarvisStore(s => s.settings)

  const isListening = status === 'listening'
  const isTranscribing = status === 'transcribing'

  const handleMicClick = () => {
    if (micActive || isListening) {
      onStopListening()
    } else {
      onStartListening()
    }
  }

  return (
    <div className="glass-panel p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--jarvis-green)', boxShadow: '0 0 8px var(--jarvis-green)' }} />
        <span className="panel-title">Voice Controls</span>
      </div>

      {/* Main PTT button */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Pulse rings when listening */}
          <AnimatePresence>
            {isListening && (
              <>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border border-[var(--jarvis-green)]"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 2.8, opacity: 0 }}
                    transition={{ duration: 1.5, delay: i * 0.4, repeat: Infinity }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          <button
            onMouseDown={handleMicClick}
            className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isListening
                ? 'linear-gradient(135deg, rgba(0,255,136,0.3), rgba(0,255,136,0.1))'
                : micActive
                ? 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,102,255,0.1))'
                : 'rgba(0,212,255,0.06)',
              border: `2px solid ${isListening ? 'var(--jarvis-green)' : 'rgba(0,212,255,0.3)'}`,
              boxShadow: isListening ? '0 0 30px rgba(0,255,136,0.3)' : '0 0 15px rgba(0,212,255,0.1)',
            }}
          >
            {isListening ? (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Mic size={24} style={{ color: 'var(--jarvis-green)' }} />
              </motion.div>
            ) : (
              <MicOff size={22} style={{ color: 'var(--text-dim)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs font-orbitron tracking-widest"
            style={{
              color: isListening ? 'var(--jarvis-green)' :
                     isTranscribing ? 'var(--jarvis-blue)' :
                     'var(--text-dim)',
            }}
          >
            {isListening ? 'LISTENING...' :
             isTranscribing ? 'TRANSCRIBING...' :
             'CLICK TO SPEAK'}
          </motion.p>
        </AnimatePresence>
        <p className="text-[10px] text-[var(--text-dim)] mt-1 font-mono-code">
          or {settings.pushToTalkKey}
        </p>
      </div>

      {/* Waveform indicator when listening */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-1 overflow-hidden"
          >
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="wave-bar rounded-sm"
                style={{
                  background: 'var(--jarvis-green)',
                  animationDelay: `${i * 0.06}s`,
                  animationDuration: `${0.5 + (i % 3) * 0.15}s`,
                  height: `${12 + (i % 4) * 6}px`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="border-t border-[var(--border-dim)]" />

      {/* Voice options */}
      <div className="space-y-3">
        {/* Voice response toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {voiceMuted ? <VolumeX size={12} style={{ color: 'var(--text-dim)' }} /> : <Volume2 size={12} style={{ color: 'var(--jarvis-cyan)' }} />}
            <span className="text-xs text-[var(--text-secondary)]">Voice Responses</span>
          </div>
          <button
            onClick={() => setVoiceMuted(!voiceMuted)}
            className="relative w-8 h-4 rounded-full transition-all"
            style={{
              background: !voiceMuted ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${!voiceMuted ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            <motion.div
              animate={{ x: voiceMuted ? 2 : 16 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="absolute top-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: !voiceMuted ? 'var(--jarvis-cyan)' : 'rgba(255,255,255,0.4)' }}
            />
          </button>
        </div>

        {/* Wake word toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={12} style={{ color: wakeWordEnabled ? 'var(--jarvis-purple)' : 'var(--text-dim)' }} />
            <div>
              <span className="text-xs text-[var(--text-secondary)]">Wake Word</span>
              <p className="text-[10px] font-mono-code text-[var(--text-dim)]">"{settings.wakeWord}"</p>
            </div>
          </div>
          <button
            onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
            className="relative w-8 h-4 rounded-full transition-all"
            style={{
              background: wakeWordEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${wakeWordEnabled ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            <motion.div
              animate={{ x: wakeWordEnabled ? 16 : 2 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="absolute top-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: wakeWordEnabled ? 'var(--jarvis-purple)' : 'rgba(255,255,255,0.4)' }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
