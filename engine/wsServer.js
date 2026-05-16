import { WebSocketServer } from 'ws'

export function createWsServer(httpServer, engine, rectangleEngine) {
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
    // Send full state snapshots immediately on connect
    try {
      ws.send(JSON.stringify({ type: 'snapshot', data: engine.getState() }))
      if (rectangleEngine) {
        ws.send(JSON.stringify({ type: 'rectangle_snapshot', data: rectangleEngine.getState() }))
      }
    } catch (err) {
      console.error('[WS] Failed to send snapshot:', err.message)
    }
    ws.on('error', err => console.error('[WS] Client error:', err.message))
  })

  engine.on('state_change', payload => broadcast({ type: 'state_change', ...payload }))
  engine.on('tick_update',  payload => broadcast({ type: 'tick_update',  ...payload }))

  if (rectangleEngine) {
    rectangleEngine.on('alert', payload => broadcast({ type: 'rectangle_alert', ...payload }))
    rectangleEngine.on('tick',  payload => broadcast({ type: 'rectangle_tick',  ...payload }))
  }

  console.log('[WS] WebSocket server attached at /ws')
  return wss
}
