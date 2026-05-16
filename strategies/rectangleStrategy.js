import { computeEMA } from '../indicators/ema.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nearLevel(price, level, tolerance) {
  return Math.abs(price - level) <= level * tolerance
}

function isDisplaced(cur, prev, direction) {
  return direction === 'LONG' ? cur.close > prev.close : cur.close < prev.close
}

// ATR computed from breakout TF candles — consistent scale for all signals.
function computeATR(candles, period = 14) {
  if (candles.length < period + 1) return null
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const prevClose = candles[i - 1].close
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }
  const slice = trs.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

// Hybrid breakout buffer: prevents ATR collapse on low-vol days; caps on high-vol.
function breakoutBuffer(atr, level, options) {
  return Math.max(atr * options.breakoutBufferAtrMult, level * options.breakoutBufferPct)
}

// EMA20 slope over `lookback` bars on confirm TF — regime filter for mean reversion.
function ema20slope(candles, lookback = 5) {
  if (candles.length < 21 + lookback) return 0
  const closes = candles.map(c => c.close)
  const ema = computeEMA(closes, 20)
  const n = ema.length
  const last = ema[n - 1]
  const prev = ema[n - 1 - lookback]
  if (last == null || prev == null) return 0
  return last - prev
}

function emptyBreakout() {
  return { level: null, direction: null, ts: null }
}

function relativeVolume(candles, period = 20) {
  const cur  = candles[candles.length - 1]
  const hist = candles.slice(-(period + 1), -1)
  if (!hist.length || !cur?.volume) return null
  const avg = hist.reduce((s, c) => s + (c.volume || 0), 0) / hist.length
  return avg > 0 ? cur.volume / avg : null
}

// ─── Pattern detection — FIRST MATCH WINS ────────────────────────────────────

export function detectPattern(candles) {
  if (candles.length < 2) return null
  const cur  = candles[candles.length - 1]
  const prev = candles[candles.length - 2]

  const range = cur.high - cur.low
  if (range === 0) return null  // doji

  const body      = Math.abs(cur.close - cur.open)
  const bodyRatio = body / range
  const topBody   = Math.max(cur.open, cur.close)
  const botBody   = Math.min(cur.open, cur.close)
  const upperWick = cur.high - topBody
  const lowerWick = botBody - cur.low

  // 1. BULLISH_ENGULFING — current body fully engulfs the previous body
  const prevBodyTop = Math.max(prev.open, prev.close)
  const prevBodyBot = Math.min(prev.open, prev.close)
  if (cur.close > cur.open && cur.open < prevBodyBot && cur.close > prevBodyTop) {
    return { patternType: 'BULLISH_ENGULFING', direction: 'LONG', strength: 'STRONG' }
  }

  // 2. BEARISH_ENGULFING — current body fully engulfs the previous body
  if (cur.close < cur.open && cur.open > prevBodyTop && cur.close < prevBodyBot) {
    return { patternType: 'BEARISH_ENGULFING', direction: 'SHORT', strength: 'STRONG' }
  }

  // 3. HAMMER
  if (lowerWick >= 2 * body && upperWick < body && cur.close > cur.open) {
    return { patternType: 'HAMMER', direction: 'LONG', strength: 'MEDIUM' }
  }

  // 4. SHOOTING_STAR
  if (upperWick >= 2 * body && lowerWick < body && cur.close < cur.open) {
    return { patternType: 'SHOOTING_STAR', direction: 'SHORT', strength: 'MEDIUM' }
  }

  // 5. BULLISH_BAR
  if (cur.close > cur.open) {
    const strength = bodyRatio > 0.65 ? 'STRONG' : bodyRatio > 0.40 ? 'MEDIUM' : 'BASIC'
    return { patternType: 'BULLISH_BAR', direction: 'LONG', strength }
  }

  // 6. BEARISH_BAR
  if (cur.close < cur.open) {
    const strength = bodyRatio > 0.65 ? 'STRONG' : bodyRatio > 0.40 ? 'MEDIUM' : 'BASIC'
    return { patternType: 'BEARISH_BAR', direction: 'SHORT', strength }
  }

  return null
}

// ─── Alert builder ────────────────────────────────────────────────────────────

function buildAlert(state, strategyMode, direction, rectangle, rectangleLevel, candle, pattern, relVol = null) {
  let stopLevel
  if (strategyMode === 'BREAKOUT') {
    // Broken level flips role: support for LONG, resistance for SHORT
    stopLevel = rectangleLevel
  } else {
    stopLevel = direction === 'LONG' ? rectangle.low : rectangle.high
  }

  const reasons = []
  if (strategyMode === 'EDGE_REJECTION') {
    reasons.push(direction === 'LONG'
      ? `Price near rectangle low (${rectangle.low.toFixed(4)})`
      : `Price near rectangle high (${rectangle.high.toFixed(4)})`)
    reasons.push(`${direction === 'LONG' ? 'Bullish' : 'Bearish'} pattern: ${pattern.patternType}`)
    reasons.push('Displacement confirmed')
  } else if (strategyMode === 'MEAN_REVERSION') {
    reasons.push(direction === 'LONG'
      ? `Price in ATR bottom zone near ${rectangle.low.toFixed(4)}`
      : `Price in ATR top zone near ${rectangle.high.toFixed(4)}`)
    reasons.push(`Pattern: ${pattern.patternType} (${pattern.strength})`)
    reasons.push('Displacement confirmed')
    reasons.push('Regime filter passed')
  } else if (strategyMode === 'BREAKOUT') {
    reasons.push(`Breakout retest at ${rectangleLevel.toFixed(4)}`)
    reasons.push(`Direction: ${direction}`)
    reasons.push(`Pattern: ${pattern.patternType}`)
    reasons.push('Displacement confirmed')
  }

  return {
    ticker:          state.ticker,
    strategyMode,
    timeframe:       state.timeframe,
    direction,
    rectangleHigh:   rectangle.high,
    rectangleLow:    rectangle.low,
    rectangleLevel,
    entryPrice:      candle.close,
    stopLevel,
    patternType:     pattern.patternType,
    patternStrength: pattern.strength,
    relativeVolume:  relVol,
    reasons,
    timestamp:       candle.timestamp.getTime(),  // candle time, not wall clock
  }
}

// ─── Signal evaluators ────────────────────────────────────────────────────────

function evalEdgeRejection(candlesConfirm, rectangle, state, options, candleNow) {
  if (candleNow - state.lastAlertTs < options.cooldownMs) return null
  if (candlesConfirm.length < 2) return null

  const cur  = candlesConfirm[candlesConfirm.length - 1]
  const prev = candlesConfirm[candlesConfirm.length - 2]
  const pattern = detectPattern(candlesConfirm)
  if (!pattern) return null
  if (!isDisplaced(cur, prev, pattern.direction)) return null

  if (pattern.direction === 'LONG' && nearLevel(cur.low, rectangle.low, options.edgeTolerance)) {
    return buildAlert(state, 'EDGE_REJECTION', 'LONG', rectangle, rectangle.low, cur, pattern)
  }
  if (pattern.direction === 'SHORT' && nearLevel(cur.high, rectangle.high, options.edgeTolerance)) {
    return buildAlert(state, 'EDGE_REJECTION', 'SHORT', rectangle, rectangle.high, cur, pattern)
  }
  return null
}

function evalMeanReversion(candlesConfirm, rectangle, state, options, atr, candleNow) {
  if (candleNow - state.lastAlertTs < options.cooldownMs) return null
  if (candlesConfirm.length < 2) return null

  const cur  = candlesConfirm[candlesConfirm.length - 1]
  const prev = candlesConfirm[candlesConfirm.length - 2]
  const pattern = detectPattern(candlesConfirm)
  if (!pattern) return null
  if (pattern.strength === 'BASIC') return null  // BASIC ignored for mean reversion
  if (!isDisplaced(cur, prev, pattern.direction)) return null

  const zone   = atr * options.meanRevZoneMult
  const slope  = ema20slope(candlesConfirm)

  if (pattern.direction === 'LONG') {
    if (slope < -atr) return null  // strongly declining — block long mean reversion
    const zoneCenter = rectangle.low + zone / 2
    if (!nearLevel(cur.close, zoneCenter, zone / 2 / zoneCenter)) return null
    return buildAlert(state, 'MEAN_REVERSION', 'LONG', rectangle, rectangle.mid, cur, pattern)
  }

  if (pattern.direction === 'SHORT') {
    if (slope > atr) return null  // strongly rising — block short mean reversion
    const zoneCenter = rectangle.high - zone / 2
    if (!nearLevel(cur.close, zoneCenter, zone / 2 / zoneCenter)) return null
    return buildAlert(state, 'MEAN_REVERSION', 'SHORT', rectangle, rectangle.mid, cur, pattern)
  }

  return null
}

function evalBreakoutDetection(candlesBreakout, rectangle, state, options, atr, candleNow) {
  if (candlesBreakout.length < 1) return null
  const cur = candlesBreakout[candlesBreakout.length - 1]

  // Require volume surge to confirm breakout — prevents false breakouts on low-vol moves
  const relVol = relativeVolume(candlesBreakout)
  if (relVol !== null && relVol < 1.5) return null

  const bufHigh = breakoutBuffer(atr, rectangle.high, options)
  const bufLow  = breakoutBuffer(atr, rectangle.low,  options)

  if (cur.close > rectangle.high + bufHigh) {
    return {
      ...state,
      fsm:      'BREAKOUT_RETEST',
      breakout: { level: rectangle.high, direction: 'LONG', ts: cur.timestamp.getTime() },
    }
  }
  if (cur.close < rectangle.low - bufLow) {
    return {
      ...state,
      fsm:      'BREAKOUT_RETEST',
      breakout: { level: rectangle.low, direction: 'SHORT', ts: cur.timestamp.getTime() },
    }
  }
  return null
}

function evalRetest(candlesConfirm, rectangle, state, options, candleNow) {
  if (candleNow - state.lastAlertTs < options.cooldownMs) return null
  if (candlesConfirm.length < 2) return null

  const { level, direction } = state.breakout
  const cur  = candlesConfirm[candlesConfirm.length - 1]
  const prev = candlesConfirm[candlesConfirm.length - 2]
  const pattern = detectPattern(candlesConfirm)
  if (!pattern || pattern.direction !== direction) return null
  if (!isDisplaced(cur, prev, direction)) return null

  const relVol = relativeVolume(candlesConfirm)

  if (direction === 'LONG') {
    // Candle wicked down to level but closed above it
    if (!nearLevel(cur.low, level, options.retestTolerance)) return null
    if (cur.close <= level) return null
    return buildAlert(state, 'BREAKOUT', 'LONG', rectangle, level, cur, pattern, relVol)
  }

  if (direction === 'SHORT') {
    // Candle wicked up to level but closed below it
    if (!nearLevel(cur.high, level, options.retestTolerance)) return null
    if (cur.close >= level) return null
    return buildAlert(state, 'BREAKOUT', 'SHORT', rectangle, level, cur, pattern, relVol)
  }

  return null
}

// ─── Main evaluation function ─────────────────────────────────────────────────

export function evalRectangle(candlesBreakout, candlesConfirm, rectangle, state, options) {
  if (!candlesConfirm.length) return { nextState: state, alert: null }

  const cur = candlesConfirm[candlesConfirm.length - 1]
  if (!cur) return { nextState: state, alert: null }

  // All strategy logic uses candle timestamp — no Date.now() here
  const candleNow = cur.timestamp.getTime()

  // Dedup: same confirm candle already processed this tick
  if (candleNow === state.lastProcessedCandleTs) return { nextState: state, alert: null }

  const atr = computeATR(candlesBreakout, options.atrPeriod)
  if (!atr) return { nextState: { ...state, lastProcessedCandleTs: candleNow }, alert: null }

  const baseNext = { ...state, lastProcessedCandleTs: candleNow }

  if (state.fsm === 'BREAKOUT_RETEST') {
    if (candleNow - state.breakout.ts > options.breakoutTimeoutMs) {
      return { nextState: { ...baseNext, fsm: 'WATCHING', breakout: emptyBreakout() }, alert: null }
    }
    const alert = evalRetest(candlesConfirm, rectangle, state, options, candleNow)
    if (alert) {
      return {
        nextState: { ...baseNext, fsm: 'WATCHING', breakout: emptyBreakout(), lastAlertTs: candleNow },
        alert,
      }
    }
    return { nextState: baseNext, alert: null }
  }

  // WATCHING — evaluate in priority order
  const edgeAlert = evalEdgeRejection(candlesConfirm, rectangle, state, options, candleNow)
  if (edgeAlert) return { nextState: { ...baseNext, lastAlertTs: candleNow }, alert: edgeAlert }

  const meanAlert = evalMeanReversion(candlesConfirm, rectangle, state, options, atr, candleNow)
  if (meanAlert) return { nextState: { ...baseNext, lastAlertTs: candleNow }, alert: meanAlert }

  const brkState = evalBreakoutDetection(candlesBreakout, rectangle, state, options, atr, candleNow)
  if (brkState) return { nextState: { ...brkState, lastProcessedCandleTs: candleNow }, alert: null }

  return { nextState: baseNext, alert: null }
}
