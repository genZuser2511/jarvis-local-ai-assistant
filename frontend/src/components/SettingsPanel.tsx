// Settings panel
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Save, RefreshCw, Cpu, Mic, Keyboard, Shield, Volume2, Eye } from 'lucide-react'
import { useJarvisStore } from '../store/useJarvisStore'
import axios from 'axios'

const API = 'http://localhost:8000'

interface SettingsPanelProps {
  onClose: () => void
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
      style={{
        background: value ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)',
        border: `1px solid ${value ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
      }}
    >
      <motion.div
        animate={{ x: value ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="absolute top-0.5 w-3.5 h-3.5 rounded-full"
        style={{ background: value ? 'var(--jarvis-cyan)' : 'rgba(255,255,255,0.4)' }}
      />
    </button>
  )
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, availableModels, setAvailableModels } = useJarvisStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  const local = { ...settings }

  useEffect(() => {
    loadModels()
    loadCurrentSettings()
  }, []) // eslint-disable-line

  const loadModels = async () => {
    setLoadingModels(true)
    try {
      const { data } = await axios.get(`${API}/models`)
      setAvailableModels(data.models || [])
    } catch {
      setAvailableModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const loadCurrentSettings = async () => {
    try {
      const { data } = await axios.get(`${API}/settings`)
      updateSettings({
        ollamaModel: data.ollama_model,
        whisperModelSize: data.whisper_model_size,
        pushToTalkKey: data.push_to_talk_key,
        stopKey: data.stop_key,
        wakeWord: data.wake_word,
        requireApproval: data.require_approval_for_sensitive,
      })
    } catch { /* backend offline */ }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.post(`${API}/settings`, {
        ollama_model: settings.ollamaModel,
        whisper_model_size: settings.whisperModelSize,
        push_to_talk_key: settings.pushToTalkKey,
        stop_key: settings.stopKey,
        wake_word: settings.wakeWord,
        require_approval_for_sensitive: settings.requireApproval,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[var(--jarvis-cyan)]">{icon}</div>
        <span className="text-xs font-orbitron tracking-widest text-[var(--jarvis-cyan)]">{title}</span>
      </div>
      <div className="space-y-3 pl-5">{children}</div>
    </div>
  )

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">{label}</span>
      <div className="flex-1 max-w-[180px]">{children}</div>
    </div>
  )

  return (
    <div className="glass-panel flex flex-col h-full">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--jarvis-purple)', boxShadow: '0 0 8px var(--jarvis-purple)' }} />
          <span className="panel-title">Configuration</span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-dim)] hover:text-[var(--text-primary)] text-xs font-mono-code transition-colors"
        >
          [ESC]
        </button>
      </div>

      <div className="flex-1 panel-scroll p-5">
        {/* AI Model */}
        <Section icon={<Cpu size={13} />} title="AI MODEL">
          <Field label="Ollama Model">
            <div className="flex gap-1">
              <select
                value={settings.ollamaModel}
                onChange={e => updateSettings({ ollamaModel: e.target.value })}
                className="flex-1 jarvis-input text-xs py-1.5 px-2"
                style={{ height: 'auto' }}
              >
                {availableModels.length > 0
                  ? availableModels.map(m => <option key={m} value={m}>{m}</option>)
                  : <option value={settings.ollamaModel}>{settings.ollamaModel}</option>
                }
              </select>
              <button onClick={loadModels} className="p-1.5 rounded" style={{ border: '1px solid var(--border-dim)', color: 'var(--text-dim)' }}>
                <RefreshCw size={11} className={loadingModels ? 'animate-spin' : ''} />
              </button>
            </div>
          </Field>
        </Section>

        {/* Speech */}
        <Section icon={<Mic size={13} />} title="SPEECH RECOGNITION">
          <Field label="Whisper Model">
            <select
              value={settings.whisperModelSize}
              onChange={e => updateSettings({ whisperModelSize: e.target.value })}
              className="w-full jarvis-input text-xs py-1.5 px-2"
              style={{ height: 'auto' }}
            >
              {['tiny', 'base', 'small', 'medium', 'large'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Wake Word">
            <input
              value={settings.wakeWord}
              onChange={e => updateSettings({ wakeWord: e.target.value })}
              className="w-full jarvis-input text-xs py-1.5 px-2"
              style={{ height: 'auto' }}
            />
          </Field>
          <Field label="Voice Responses">
            <ToggleSwitch value={settings.voiceEnabled} onChange={v => updateSettings({ voiceEnabled: v })} />
          </Field>
        </Section>

        {/* Hotkeys */}
        <Section icon={<Keyboard size={13} />} title="HOTKEYS">
          <Field label="Push-to-Talk">
            <input
              value={settings.pushToTalkKey}
              onChange={e => updateSettings({ pushToTalkKey: e.target.value })}
              className="w-full jarvis-input text-xs py-1.5 px-2 font-mono-code"
              style={{ height: 'auto' }}
            />
          </Field>
          <Field label="Stop / Cancel">
            <input
              value={settings.stopKey}
              onChange={e => updateSettings({ stopKey: e.target.value })}
              className="w-full jarvis-input text-xs py-1.5 px-2 font-mono-code"
              style={{ height: 'auto' }}
            />
          </Field>
        </Section>

        {/* Safety */}
        <Section icon={<Shield size={13} />} title="SAFETY">
          <Field label="Require Approval">
            <ToggleSwitch value={settings.requireApproval} onChange={v => updateSettings({ requireApproval: v })} />
          </Field>
          <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
            When enabled, JARVIS will ask before executing sensitive actions like deleting files, running shell commands, or sending messages.
          </p>
        </Section>

        {/* Vision */}
        <Section icon={<Eye size={13} />} title="SCREEN VISION">
          <Field label="Auto-screenshot">
            <ToggleSwitch value={settings.autoScreenshot} onChange={v => updateSettings({ autoScreenshot: v })} />
          </Field>
          <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
            Automatically include a screenshot when sending commands for better context.
          </p>
        </Section>
      </div>

      {/* Save footer */}
      <div className="p-4 border-t border-[var(--border-dim)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full btn-jarvis flex items-center justify-center gap-2 py-2.5"
          style={saved ? { borderColor: 'rgba(0,255,136,0.5)', color: 'var(--jarvis-green)' } : {}}
        >
          {saving ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : saved ? (
            <>✓ SAVED</>
          ) : (
            <>
              <Save size={12} />
              SAVE SETTINGS
            </>
          )}
        </button>
      </div>
    </div>
  )
}
