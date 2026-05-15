import { WebSocketServer } from 'ws'

export function createWsServer(httpServer, engine) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  function broadcast(msg) {
    const data = JSON.stringify(msg)
    for (const client of wss.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(data)
      }
    }
  }

  wss.on('connection', ws => {
    // Send full state snapshot immediately on connect
    try {
      ws.send(JSON.stringify({ type: 'snapshot', data: engine.getState() }))
    } catch (err) {
      console.error('[WS] Failed to send snapshot:', err.message)
    }
    ws.on('error', err => console.error('[WS] Client error:', err.message))
  })

  engine.on('state_change', payload => broadcast({ type: 'state_change', ...payload }))
  engine.on('tick_update',  payload => broadcast({ type: 'tick_update',  ...payload }))

  console.log('[WS] WebSocket server attached at /ws')
  return wss
}
