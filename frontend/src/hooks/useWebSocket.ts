// WebSocket connection hook
import { useEffect, useRef, useCallback } from 'react'
import { useJarvisStore } from '../store/useJarvisStore'

const WS_URL = 'ws://localhost:8000/ws'
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const {
    setWsConnected, setStatus, addMessage, addActivity,
    addApproval, removeApproval, addScreenshot,
  } = useJarvisStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      addActivity({ event: 'connected', message: 'Connected to JARVIS backend', timestamp: Date.now() / 1000 })
    }

    ws.onclose = () => {
      setWsConnected(false)
      addActivity({ event: 'disconnected', message: 'Connection lost. Reconnecting...', timestamp: Date.now() / 1000 })
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = () => {
      addActivity({ event: 'error', message: 'WebSocket error', timestamp: Date.now() / 1000 })
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }
  }, []) // eslint-disable-line

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string

    switch (type) {
      case 'connected':
        setStatus((data.status as string || 'idle') as Parameters<typeof setStatus>[0])
        break

      case 'status':
        setStatus((data.status as string || 'idle') as Parameters<typeof setStatus>[0])
        break

      case 'message':
        addMessage({
          role: data.role as 'user' | 'assistant' | 'system',
          content: data.content as string,
          timestamp: data.timestamp as number,
          metadata: data.metadata as Record<string, unknown> | undefined,
        })
        break

      case 'activity':
        addActivity({
          event: data.event as string,
          message: data.message as string,
          data: data.data as Record<string, unknown>,
          timestamp: data.timestamp as number,
        })
        break

      case 'approval_request':
        addApproval({
          action_id: data.action_id as number,
          action: data.action as Parameters<typeof addApproval>[0]['action'],
          timestamp: data.timestamp as number,
        })
        addActivity({
          event: 'approval_needed',
          message: `Approval needed: ${(data.action as Record<string, string>)?.description}`,
          timestamp: data.timestamp as number,
        })
        break

      case 'screenshot':
        addScreenshot({
          filepath: data.filepath as string,
          description: data.description as string | undefined,
          timestamp: data.timestamp as number,
        })
        break

      case 'action_result':
        addActivity({
          event: 'action_result',
          message: `Action: ${(data.action as Record<string, string>)?.description}`,
          data: data.result as Record<string, unknown>,
          timestamp: data.timestamp as number,
        })
        break

      case 'pong':
        break
    }
  }, [addMessage, addActivity, addApproval, addScreenshot, setStatus])

  useEffect(() => {
    connect()
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => {
      clearInterval(pingInterval)
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { sendMessage, wsRef }
}
