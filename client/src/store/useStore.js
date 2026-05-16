import { create } from 'zustand'

function tfKey(timeframe) {
  return timeframe === 'DAILY' ? 'daily' : 'weekly'
}

function alertKey(alert) {
  return `${alert.timestamp}:${alert.ticker}:${alert.direction}`
}

const useStore = create((set, get) => ({
  connected: false,
  selectedTicker: null,
  tickers: {},           // { [symbol]: { daily, weekly } }
  alerts: [],            // AlertPayload[], newest first
  seenAlertKeys: new Set(),

  setConnected: (connected) => set({ connected }),

  setSelectedTicker: (ticker) => {
    set((state) => {
      // Clear hasAlert flag for the selected ticker
      const existing = state.tickers[ticker]
      if (!existing) return { selectedTicker: ticker }
      return {
        selectedTicker: ticker,
        tickers: {
          ...state.tickers,
          [ticker]: {
            daily:  { ...existing.daily,  hasAlert: false },
            weekly: { ...existing.weekly, hasAlert: false },
          },
        },
      }
    })
  },

  handleEvent: (event) => {
    const { type, ...payload } = event

    if (type === 'rectangle_snapshot') {
      // payload.data is keyed by "TICKER:DAILY" / "TICKER:WEEKLY"
      const data = payload.data ?? {}
      const tickers = {}
      for (const [key, state] of Object.entries(data)) {
        const [ticker, tf] = key.split(':')
        if (!tickers[ticker]) tickers[ticker] = { daily: null, weekly: null }
        const candleKey = tf === 'DAILY' ? 'candles15m' : 'candles30m'
        tickers[ticker][tf.toLowerCase()] = {
          rectangle:            state.rectangle ?? null,
          fsm:                  state.fsm ?? 'WATCHING',
          lastProcessedCandleTs: state.lastProcessedCandleTs ?? 0,
          breakout:             state.breakout ?? null,
          hasAlert:             false,
        }
        if (state.candles?.length) tickers[ticker][candleKey] = state.candles
      }
      set({ tickers })
      return
    }

    if (type === 'rectangle_tick') {
      const { ticker, timeframe, rectangle, fsm, lastProcessedCandleTs, candles } = payload
      if (!ticker || !timeframe) return
      const key = tfKey(timeframe)
      set((state) => {
        const existing = state.tickers[ticker] ?? { daily: null, weekly: null }
        // Store candles keyed by timeframe: candles15m (DAILY) or candles30m (WEEKLY)
        const candleKey = timeframe === 'DAILY' ? 'candles15m' : 'candles30m'
        const candleUpdate = candles?.length ? { [candleKey]: candles } : {}
        return {
          tickers: {
            ...state.tickers,
            [ticker]: {
              ...existing,
              ...candleUpdate,
              [key]: {
                ...(existing[key] ?? {}),
                rectangle,
                fsm,
                lastProcessedCandleTs,
              },
            },
          },
        }
      })
      return
    }

    if (type === 'rectangle_alert') {
      const alert = payload
      const key = alertKey(alert)
      const { seenAlertKeys } = get()
      if (seenAlertKeys.has(key)) return

      const tf = tfKey(alert.timeframe ?? 'DAILY')
      const newSeen = new Set(seenAlertKeys)
      newSeen.add(key)

      set((state) => {
        const existing = state.tickers[alert.ticker] ?? { daily: null, weekly: null }
        return {
          seenAlertKeys: newSeen,
          alerts: [alert, ...state.alerts].slice(0, 500), // cap at 500
          tickers: {
            ...state.tickers,
            [alert.ticker]: {
              ...existing,
              [tf]: {
                ...(existing[tf] ?? {}),
                hasAlert: true,
                lastAlert: alert,
              },
            },
          },
        }
      })
      return
    }
    if (type === 'tick_update') {
      const { ticker, candles, ema9, ema20, rsiFastArr, rsiSlowArr } = payload
      if (!ticker || !candles?.length) return
      set((state) => {
        const existing = state.tickers[ticker] ?? { daily: null, weekly: null }
        return {
          tickers: {
            ...state.tickers,
            [ticker]: { ...existing, candles, ema9, ema20, rsiFastArr, rsiSlowArr },
          },
        }
      })
      return
    }

    if (type === 'snapshot') {
      // ScannerEngine snapshot: keyed by ticker, each has candles + indicator arrays
      const data = payload.data ?? {}
      set((state) => {
        const tickers = { ...state.tickers }
        for (const [ticker, s] of Object.entries(data)) {
          tickers[ticker] = {
            ...(tickers[ticker] ?? { daily: null, weekly: null }),
            candles:    s.candles    ?? [],
            ema9:       s.ema9       ?? [],
            ema20:      s.ema20      ?? [],
            rsiFastArr: s.rsiFastArr ?? [],
            rsiSlowArr: s.rsiSlowArr ?? [],
          }
        }
        return { tickers }
      })
      return
    }
    // state_change ignored — we only need candle + rectangle data
  },
}))

export default useStore
