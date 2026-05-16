import { EventEmitter }             from 'events'
import { fetchDailyCandles }        from '../scanner/fetchCandles.js'
import { fetch15mCandles,
         fetch30mCandles,
         fetch5mCandles,
         buildDailyRectangle,
         buildWeeklyRectangle,
         getETDate,
         getISOWeek }               from '../scanner/fetchRectangleCandles.js'
import { evalRectangle }            from '../strategies/rectangleStrategy.js'

const POLL_INTERVAL   = 60_000   // 60s — one full evaluation pass per minute
const BATCH_SIZE      = 5        // concurrent tickers per tick (Yahoo rate-limit guard)
const INTER_BATCH_MS  = 200      // delay between batches
const WEEKLY_TF_EVERY = 5        // fetch 30m data only every 5th tick

const DAILY_OPTIONS = {
  timeframe:              'DAILY',
  edgeTolerance:          0.003,
  retestTolerance:        0.003,
  cooldownMs:             5 * 60 * 1000,
  breakoutTimeoutMs:      60 * 60 * 1000,
  breakoutBufferAtrMult:  0.25,
  breakoutBufferPct:      0.002,
  meanRevZoneMult:        0.5,
  atrPeriod:              14,
}

const WEEKLY_OPTIONS = { ...DAILY_OPTIONS, timeframe: 'WEEKLY' }

function emptyBreakout() {
  return { level: null, direction: null, ts: null }
}

function makeInitialState(ticker, timeframe) {
  return {
    ticker,
    timeframe,
    fsm:                  'WATCHING',
    breakout:             emptyBreakout(),
    lastAlertTs:          0,
    lastProcessedCandleTs: 0,
    lastResetDate:        null,  // ET date string — DAILY reset key
    lastResetWeek:        null,  // ISO week string — WEEKLY reset key
  }
}

// Engine uses Date.now() ONLY here (reset detection) — strategy layer never calls Date.now()
function maybeResetDaily(state) {
  const etToday = getETDate(Date.now())
  if (state.lastResetDate === etToday) return state
  return {
    ...state,
    fsm:                  'WATCHING',
    breakout:             emptyBreakout(),
    lastAlertTs:          0,
    lastProcessedCandleTs: 0,
    lastResetDate:        etToday,
  }
}

function maybeResetWeekly(state) {
  const currentWeek = getISOWeek(new Date())
  if (state.lastResetWeek === currentWeek) return state
  return {
    ...state,
    fsm:                  'WATCHING',
    breakout:             emptyBreakout(),
    lastAlertTs:          0,
    lastProcessedCandleTs: 0,
    lastResetWeek:        currentWeek,
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class RectangleEngine extends EventEmitter {
  constructor(tickers) {
    super()
    this.tickers    = tickers
    this._tickCount = 0
    this._timer     = null

    this._state = new Map()
    for (const ticker of tickers) {
      this._state.set(`${ticker}:DAILY`,  makeInitialState(ticker, 'DAILY'))
      this._state.set(`${ticker}:WEEKLY`, makeInitialState(ticker, 'WEEKLY'))
    }
  }

  start() {
    console.log('[RectangleEngine] Starting rectangle range engine...')
    this._tick()
    this._timer = setInterval(() => this._tick(), POLL_INTERVAL)
  }

  stop() {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
  }

  getState() {
    const out = {}
    for (const [key, s] of this._state) {
      out[key] = {
        ticker:               s.ticker,
        timeframe:            s.timeframe,
        fsm:                  s.fsm,
        breakout:             s.breakout,
        lastAlertTs:          s.lastAlertTs,
        lastProcessedCandleTs: s.lastProcessedCandleTs,
        lastResetDate:        s.lastResetDate,
        lastResetWeek:        s.lastResetWeek,
      }
    }
    return out
  }

  async _tick() {
    this._tickCount++
    const fetchWeekly = this._tickCount % WEEKLY_TF_EVERY === 0
    const tickers     = this.tickers.slice()

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(t => this._processTicker(t, fetchWeekly)))
      if (i + BATCH_SIZE < tickers.length) await sleep(INTER_BATCH_MS)
    }
  }

  async _processTicker(ticker, fetchWeekly) {
    try {
      // Always fetch daily + intraday in parallel
      const [dailyCandles, candles15m, candles5m] = await Promise.all([
        fetchDailyCandles(ticker, 30),
        fetch15mCandles(ticker, 5),
        fetch5mCandles(ticker),
      ])

      // ── DAILY rectangle strategy ──────────────────────────────────────────
      const dailyRect = buildDailyRectangle(dailyCandles)
      if (dailyRect && candles15m.length > 0 && candles5m.length > 0) {
        const key   = `${ticker}:DAILY`
        const state = maybeResetDaily(this._state.get(key))
        const { nextState, alert } = evalRectangle(candles15m, candles5m, dailyRect, state, DAILY_OPTIONS)
        this._state.set(key, nextState)

        if (alert) {
          this.emit('alert', alert)
          console.log(`[RectangleEngine] ALERT ${ticker} DAILY ${alert.strategyMode} ${alert.direction}`)
        }
        this.emit('tick', {
          ticker,
          timeframe:            'DAILY',
          rectangle:            dailyRect,
          fsm:                  nextState.fsm,
          lastProcessedCandleTs: nextState.lastProcessedCandleTs,
        })
      }

      // ── WEEKLY rectangle strategy (every 5th tick only) ───────────────────
      if (fetchWeekly) {
        const candles30m = await fetch30mCandles(ticker, 30)
        const weeklyRect = buildWeeklyRectangle(dailyCandles)

        if (weeklyRect && candles30m.length > 0 && candles15m.length > 0) {
          const key   = `${ticker}:WEEKLY`
          const state = maybeResetWeekly(this._state.get(key))
          const { nextState, alert } = evalRectangle(candles30m, candles15m, weeklyRect, state, WEEKLY_OPTIONS)
          this._state.set(key, nextState)

          if (alert) {
            this.emit('alert', alert)
            console.log(`[RectangleEngine] ALERT ${ticker} WEEKLY ${alert.strategyMode} ${alert.direction}`)
          }
          this.emit('tick', {
            ticker,
            timeframe:            'WEEKLY',
            rectangle:            weeklyRect,
            fsm:                  nextState.fsm,
            lastProcessedCandleTs: nextState.lastProcessedCandleTs,
          })
        }
      }
    } catch (err) {
      // Partial failures are logged but don't affect other tickers.
      // lastProcessedCandleTs staleness guard: if Yahoo returns stale data,
      // the same candle ts will be seen next tick and skipped automatically.
      console.error(`[RectangleEngine] ${ticker}:`, err.message)
    }
  }
}
