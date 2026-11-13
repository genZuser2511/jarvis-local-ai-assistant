// JARVIS animated orb — the central visual indicator
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore, type JarvisStatus } from '../store/useJarvisStore'

const STATUS_COLORS: Record<JarvisStatus, string> = {
  idle: '#00d4ff',
  listening: '#00ff88',
  thinking: '#7c3aed',
  acting: '#ff6b35',
  speaking: '#ffd700',
  transcribing: '#0066ff',
  error: '#ff2d55',
}

const STATUS_LABEL: Record<JarvisStatus, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  acting: 'EXECUTING',
  speaking: 'RESPONDING',
  transcribing: 'TRANSCRIBING',
  error: 'ERROR',
}

const WaveBars = ({ color }: { color: string }) => (
  <div className="flex items-center gap-[3px] h-8">
    {[...Array(7)].map((_, i) => (
      <div
        key={i}
        className="wave-bar rounded-sm"
        style={{
          background: color,
          animationDelay: `${i * 0.1}s`,
          animationDuration: `${0.6 + i * 0.05}s`,
        }}
      />
    ))}
  </div>
)

export default function JarvisOrb() {
  const status = useJarvisStore(s => s.status)
  const color = STATUS_COLORS[status]
  const label = STATUS_LABEL[status]

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Main orb */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Outer spinning ring */}
        <div
          className="absolute inset-0 rounded-full border border-dashed spin-slow"
          style={{ borderColor: `${color}33` }}
        />
        {/* Middle ring */}
        <div
          className="absolute inset-4 rounded-full border spin-slow-reverse"
          style={{ borderColor: `${color}55` }}
        />

        {/* Pulse rings (listening / speaking) */}
        <AnimatePresence>
          {(status === 'listening' || status === 'speaking') && (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: color }}
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 1.8, delay: i * 0.5, repeat: Infinity }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Thinking orbit dots */}
        <AnimatePresence>
          {status === 'thinking' && (
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              {[0, 120, 240].map((deg) => (
                <div
                  key={deg}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: color,
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${deg}deg) translateX(56px) translateY(-50%)`,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Core sphere */}
        <motion.div
          className="w-24 h-24 rounded-full flex items-center justify-center cursor-default"
          animate={{
            scale: status === 'listening' ? [1, 1.05, 1] : 1,
            filter: status === 'error' ? 'brightness(1.5)' : 'brightness(1)',
          }}
          transition={{ duration: 0.8, repeat: status === 'listening' ? Infinity : 0 }}
          style={{
            background: `radial-gradient(circle at 35% 35%, ${color}60, ${color}20 40%, #020b18 70%)`,
            boxShadow: `0 0 30px ${color}60, 0 0 60px ${color}30, inset 0 0 20px ${color}20`,
            border: `1px solid ${color}80`,
          }}
        >
          {/* Inner glow */}
          <div
            className="w-12 h-12 rounded-full"
            style={{
              background: `radial-gradient(circle, ${color}90, ${color}30)`,
              filter: 'blur(4px)',
            }}
          />
        </motion.div>
      </div>

      {/* Status label */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-orbitron text-xs font-bold tracking-[4px]"
          style={{ color }}
        >
          {label}
        </motion.div>

        {/* Waveform for listening/speaking */}
        <AnimatePresence>
          {(status === 'listening' || status === 'speaking') && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
            >
              <WaveBars color={color} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking dots */}
        <AnimatePresence>
          {status === 'thinking' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-1"
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: color }}
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
