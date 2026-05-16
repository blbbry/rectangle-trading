import { EventEmitter }        from 'events'
import { fetchDailyCandles,
         fetch4HCandles }      from '../scanner/fetchCandles.js'
import { computeEMA }          from '../indicators/ema.js'
import { computeRSI }          from '../indicators/rsi.js'
import { isChoppy }            from '../strategies/antiChop.js'
import { evalDailyTrend }      from '../strategies/trendFilter.js'
import { evalPullbackSetup }   from '../strategies/setupDetector.js'
import { evalMomentumRestart } from '../strategies/strategyA.js'
import { gradeSetup }          from '../strategies/gradeEngine.js'

const POLL_INTERVAL = 60_000   // 60 s — re-fetches every minute; new 4H data arrives ~hourly
const MIN_CANDLES   = 30       // minimum 4H bars needed after OFFSET alignment
const BATCH_SIZE    = 5        // concurrent tickers per tick (rate-limit guard)
const OFFSET        = 15       // RSI alignment offset (same for daily + 4H)

export class ScannerEngine extends EventEmitter {
  constructor(tickers) {
    super()
    this.tickers = tickers
    this.signalState = new Map(
      tickers.map(t => [t, {
        state: 'NONE', strategy: null,
        grade: null, score: null, trendStrength: null,
        emaAlignment: null, overextended: false,
        rsiFast: null, rsiSlow: null,
        lastTransition: null, lastHourlyTs: null,
        candles: [], ema9: [], ema20: [], rsiFastArr: [], rsiSlowArr: [],
      }])
    )
    this._timer   = null
    this._running = false
  }

  start() {
    console.log('[Engine] Starting 4H swing scanner engine...')
    this._tick()
    this._timer = setInterval(() => this._tick(), POLL_INTERVAL)
  }

  stop() {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
  }

  getState() {
    const out = {}
    for (const [ticker, s] of this.signalState) {
      out[ticker] = {
        state:          s.state,
        strategy:       s.strategy,
        grade:          s.grade,
        score:          s.score,
        trendStrength:  s.trendStrength,
        emaAlignment:   s.emaAlignment,
        overextended:   s.overextended,
        rsiFast:        s.rsiFast,
        rsiSlow:        s.rsiSlow,
        lastTransition: s.lastTransition,
        candles:    s.candles.slice(-100),
        ema9:       s.ema9.slice(-100),
        ema20:      s.ema20.slice(-100),
        rsiFastArr: s.rsiFastArr.slice(-100),
        rsiSlowArr: s.rsiSlowArr.slice(-100),
      }
    }
    return out
  }

  async _tick() {
    if (this._running) return
    this._running = true
    try {
      const tickers = this.tickers.slice()
      for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batch = tickers.slice(i, i + BATCH_SIZE)
        await Promise.allSettled(batch.map(t => this._processTicker(t)))
      }
    } finally {
      this._running = false
    }
  }

  async _processTicker(ticker) {
    try {
      // Fetch daily (trend filter) and 4H (signal engine) in parallel
      const [dailyResult, fourHResult] = await Promise.all([
        fetchDailyCandles(ticker, 60),
        fetch4HCandles(ticker, 60),
      ])

      // 4H data is required — bail if missing or insufficient
      if (!fourHResult || !Array.isArray(fourHResult.candles)) return
      const { candles: candles4H, lastHourlyTs } = fourHResult
      if (candles4H.length < MIN_CANDLES) return

      // Dedup: only re-evaluate when a new 60m candle has arrived (~hourly)
      const prev       = this.signalState.get(ticker)
      const sameHourly = lastHourlyTs && lastHourlyTs === prev.lastHourlyTs

      // Compute indicators on 4H series
      const closes4H   = candles4H.map(c => c.close)
      const ema9Raw    = computeEMA(closes4H, 9)
      const ema20Raw   = computeEMA(closes4H, 20)
      const rsiFastRaw = computeRSI(closes4H, 7)
      const rsiSlowRaw = computeRSI(closes4H, 14)

      // Align arrays (rsiSlow[0] ↔ candles4H[OFFSET])
      const aligned  = candles4H.slice(OFFSET)
      const ema9A    = ema9Raw.slice(OFFSET)
      const ema20A   = ema20Raw.slice(OFFSET)
      const rsiFastA = rsiFastRaw.slice(OFFSET - 8)   // rsiFast[7] ↔ candle[15]
      const rsiSlowA = rsiSlowRaw

      const n           = aligned.length
      const rsiFastLast = parseFloat(rsiFastA[n - 1].toFixed(2))
      const rsiSlowLast = parseFloat(rsiSlowA[n - 1].toFixed(2))
      const ema9Last    = ema9A[n - 1]
      const ema20Last   = ema20A[n - 1]

      const nextBase = {
        lastHourlyTs,
        candles:     aligned,
        ema9:        ema9A,
        ema20:       ema20A,
        rsiFastArr:  rsiFastA,
        rsiSlowArr:  rsiSlowA,
        rsiFast:     rsiFastLast,
        rsiSlow:     rsiSlowLast,
        emaAlignment: ema9Last != null && ema20Last != null ? ema9Last > ema20Last : null,
      }

      // Always broadcast chart data so the UI stays fresh
      this.emit('tick_update', {
        ticker,
        candles:    aligned.slice(-100),
        ema9:       ema9A.slice(-100),
        ema20:      ema20A.slice(-100),
        rsiFastArr: rsiFastA.slice(-100),
        rsiSlowArr: rsiSlowA.slice(-100),
      })

      if (sameHourly) {
        // No new 60m candle — refresh chart data but skip signal re-evaluation
        this.signalState.set(ticker, { ...prev, ...nextBase })
        return
      }

      // ── Daily trend filter (uses daily candles for structural context) ────
      let trend = null
      const hasDaily = Array.isArray(dailyResult) && dailyResult.length >= OFFSET + 5
      if (hasDaily) {
        const dCloses   = dailyResult.map(c => c.close)
        const dEma20    = computeEMA(dCloses, 20)
        const dRsiSlow  = computeRSI(dCloses, 14)
        const dAligned  = dailyResult.slice(OFFSET)
        const dEma20A   = dEma20.slice(OFFSET)
        trend = evalDailyTrend(dAligned, dEma20A, dRsiSlow)
      } else {
        // Fallback: derive broad trend from 4H data if daily unavailable
        trend = evalDailyTrend(aligned, ema20A, rsiSlowA)
      }

      const trendStr = trend.strength
      const choppy   = isChoppy(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)

      const prevState = prev.state
      let   nextState = prevState
      let   strategy  = prev.strategy
      let   grade     = prev.grade
      let   score     = prev.score
      let   overext   = false

      if (prevState === 'LONG') {
        if (this._isInvalidated(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)) {
          nextState = 'NONE'; strategy = null; grade = null; score = null
        }
      } else if (trend.bullish && !choppy) {
        const restart = evalMomentumRestart(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
        overext = restart.overextended

        if (restart.signal === 1) {
          const { pullbackCandles } = evalPullbackSetup(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
          const graded = gradeSetup({
            trendStrength: trendStr,
            candles: aligned, ema9: ema9A, ema20: ema20A,
            rsiFast: rsiFastA, rsiSlow: rsiSlowA,
            pullbackCandles, choppy,
          })
          if (graded.grade !== 'D') {
            nextState = 'LONG'; strategy = 'Momentum'
            grade = graded.grade; score = graded.score
          }
        } else {
          const setup = evalPullbackSetup(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
          if (setup.waiting) {
            nextState = 'WAITING'; strategy = 'Momentum'
          } else {
            nextState = 'NONE'; strategy = null; grade = null; score = null
          }
        }
      } else {
        if (prevState === 'WAITING') {
          nextState = 'NONE'; strategy = null; grade = null; score = null
        }
      }

      const stateChanged = nextState !== prevState
      this.signalState.set(ticker, {
        ...nextBase,
        state:          nextState,
        strategy,
        grade,
        score,
        trendStrength:  trendStr,
        overextended:   overext,
        lastTransition: stateChanged ? new Date().toISOString() : prev.lastTransition,
      })

      if (stateChanged) {
        const lastCandle = aligned[n - 1]
        const payload = {
          ticker, prev: prevState, next: nextState, strategy,
          grade, score, trendStrength: trendStr, overextended: overext,
          price:  parseFloat(lastCandle.close.toFixed(4)),
          open:   parseFloat(lastCandle.open.toFixed(4)),
          high:   parseFloat(lastCandle.high.toFixed(4)),
          low:    parseFloat(lastCandle.low.toFixed(4)),
          ema9:   ema9Last  != null ? parseFloat(ema9Last.toFixed(4))  : null,
          ema20:  ema20Last != null ? parseFloat(ema20Last.toFixed(4)) : null,
          rsiFast: rsiFastLast, rsiSlow: rsiSlowLast,
          lastTransition: new Date().toISOString(),
        }
        this.emit('state_change', payload)
        if (nextState === 'LONG' && score >= 60) this.emit('email_trigger', payload)
        console.log(`[Engine] ${ticker}: ${prevState} → ${nextState}${grade ? ' (' + grade + ' ' + score + '/100)' : ''} [4H]`)
      }
    } catch (err) {
      console.error(`[Engine] Error processing ${ticker}:`, err.message)
    }
  }

  _isInvalidated(candles, ema9, ema20, rsiFast, rsiSlow) {
    const n = candles.length
    const i = n - 1

    // Condition 1: price closed below ema20 for 2 consecutive 4H bars
    let belowEma20 = 0
    for (let j = i; j >= Math.max(0, i - 1); j--) {
      if (ema20[j] != null && candles[j].close < ema20[j]) belowEma20++
      else break
    }
    if (belowEma20 >= 2) return true

    // Condition 2: failed higher low + RSI weakening
    if (i >= 1 && candles[i].low < candles[i - 1].low && rsiFast[i] < rsiFast[i - 1]) return true

    // Condition 3: RSI fast crosses below slow AND RSI < 40
    const crossBelow = i >= 1 &&
      rsiFast[i - 1] >= rsiSlow[i - 1] && rsiFast[i] < rsiSlow[i]
    if (crossBelow && rsiFast[i] < 40) return true

    return false
  }
}
