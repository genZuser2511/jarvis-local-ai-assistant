// Global JARVIS state store using Zustand
import { create } from 'zustand'

export type JarvisStatus = 'idle' | 'listening' | 'thinking' | 'acting' | 'speaking' | 'transcribing' | 'error'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    thought?: string
    plan?: Action[]
  }
}

export interface Action {
  type: string
  description: string
  parameters?: Record<string, unknown>
  requires_approval?: boolean
  id?: number
}

export interface ActivityItem {
  id: string
  event: string
  message: string
  data?: Record<string, unknown>
  timestamp: number
}

export interface ApprovalRequest {
  action_id: number
  action: Action
  timestamp: number
}

export interface Screenshot {
  filepath: string
  description?: string
  timestamp: number
}

export interface OllamaModel {
  name: string
}

interface JarvisState {
  // Connection
  wsConnected: boolean
  backendOnline: boolean

  // Status
  status: JarvisStatus

  // Chat
  messages: Message[]
  addMessage: (msg: Omit<Message, 'id'>) => void
  clearMessages: () => void

  // Activity
  activityLog: ActivityItem[]
  addActivity: (item: Omit<ActivityItem, 'id'>) => void

  // Approvals
  pendingApprovals: ApprovalRequest[]
  addApproval: (req: ApprovalRequest) => void
  removeApproval: (actionId: number) => void

  // Screenshots
  screenshots: Screenshot[]
  latestScreenshot: Screenshot | null
  addScreenshot: (s: Screenshot) => void

  // Microphone
  micActive: boolean
  setMicActive: (v: boolean) => void

  // Settings
  settings: {
    ollamaModel: string
    whisperModelSize: string
    pushToTalkKey: string
    stopKey: string
    wakeWord: string
    requireApproval: boolean
    voiceEnabled: boolean
    autoScreenshot: boolean
  }
  updateSettings: (s: Partial<JarvisState['settings']>) => void

  // Setters
  setWsConnected: (v: boolean) => void
  setBackendOnline: (v: boolean) => void
  setStatus: (s: JarvisStatus) => void

  // Models
  availableModels: string[]
  setAvailableModels: (m: string[]) => void
}

export const useJarvisStore = create<JarvisState>((set, get) => ({
  wsConnected: false,
  backendOnline: false,
  status: 'idle',
  messages: [],
  activityLog: [],
  pendingApprovals: [],
  screenshots: [],
  latestScreenshot: null,
  micActive: false,
  availableModels: [],

  settings: {
    ollamaModel: 'qwen2.5:7b',
    whisperModelSize: 'base',
    pushToTalkKey: 'ctrl+shift+space',
    stopKey: 'ctrl+shift+x',
    wakeWord: 'jarvis',
    requireApproval: true,
    voiceEnabled: true,
    autoScreenshot: false,
  },

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { ...msg, id: `msg-${Date.now()}-${Math.random()}` }]
  })),

  clearMessages: () => set({ messages: [] }),

  addActivity: (item) => set((state) => ({
    activityLog: [
      { ...item, id: `act-${Date.now()}-${Math.random()}` },
      ...state.activityLog
    ].slice(0, 100)
  })),

  addApproval: (req) => set((state) => ({
    pendingApprovals: [...state.pendingApprovals, req]
  })),

  removeApproval: (actionId) => set((state) => ({
    pendingApprovals: state.pendingApprovals.filter(a => a.action_id !== actionId)
  })),

  addScreenshot: (s) => set((state) => ({
    screenshots: [s, ...state.screenshots].slice(0, 10),
    latestScreenshot: s,
  })),

  setMicActive: (v) => set({ micActive: v }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setBackendOnline: (v) => set({ backendOnline: v }),
  setStatus: (s) => set({ status: s }),
  updateSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),
  setAvailableModels: (m) => set({ availableModels: m }),
}))
