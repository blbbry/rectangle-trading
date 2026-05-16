import useStore from '../store/useStore.js'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'wss://rectangle-trading.fly.dev/ws'

const BACKOFF_STEPS = [1000, 2000, 4000, 8000, 16000, 30000]

let ws = null
let retryCount = 0
let retryTimer = null
let destroyed = false

function scheduleReconnect() {
  if (destroyed) return
  const delay = BACKOFF_STEPS[Math.min(retryCount, BACKOFF_STEPS.length - 1)]
  retryCount++
  console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${retryCount})`)
  retryTimer = setTimeout(connect, delay)
}

export function connect() {
  if (destroyed) return
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    console.log('[WS] Connected')
    retryCount = 0
    useStore.getState().setConnected(true)
  }

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data)
      useStore.getState().handleEvent(event)
    } catch (err) {
      console.warn('[WS] Bad message:', err.message)
    }
  }

  ws.onerror = (err) => {
    console.warn('[WS] Error:', err.message ?? 'unknown')
  }

  ws.onclose = () => {
    console.log('[WS] Disconnected')
    useStore.getState().setConnected(false)
    scheduleReconnect()
  }
}

export function disconnect() {
  destroyed = true
  clearTimeout(retryTimer)
  if (ws) {
    ws.onclose = null  // prevent reconnect loop
    ws.close()
    ws = null
  }
}
