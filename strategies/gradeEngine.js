// Setup grading engine — produces a numeric confidence score (0-100) and letter grade.
// Inputs are aligned arrays at the same index i = n-1 (current bar).
export function gradeSetup({ trendStrength, candles, ema9, ema20, rsiFast, rsiSlow, pullbackCandles, choppy }) {
  const n = candles.length
  const i = n - 1
  const factors = {}
  let score = 0

  // ── Daily trend strength (25 pts) ─────────────────────────────
  const trendPts = [0, 7, 14, 20, 25][Math.min(trendStrength ?? 0, 4)]
  factors.trendStrength = trendPts
  score += trendPts

  // ── EMA alignment: 9 EMA > 20 EMA (8 pts) ────────────────────
  const e9 = ema9[i], e20 = ema20[i]
  if (e9 != null && e20 != null && e9 > e20) {
    factors.emaAlignment = 8
    score += 8
  } else {
    factors.emaAlignment = 0
  }

  // ── Price near EMA support within 3% (7 pts) ─────────────────
  const close = candles[i].close
  const nearEma9  = e9  != null && Math.abs(close - e9)  / e9  <= 0.03
  const nearEma20 = e20 != null && Math.abs(close - e20) / e20 <= 0.03
  if (nearEma9 || nearEma20) {
    factors.nearEmaSupport = 7
    score += 7
  } else {
    factors.nearEmaSupport = 0
  }

  // ── RSI in reset zone 40–60 (10 pts) ─────────────────────────
  const rF = rsiFast[i]
  if (rF >= 40 && rF <= 60) {
    factors.rsiResetZone = 10
    score += 10
  } else {
    factors.rsiResetZone = 0
  }

  // ── RSI curling up: fast rising last 2 bars AND fast > slow (8 pts) ──
  const rsiCurling = i >= 2 &&
    rsiFast[i]     > rsiFast[i - 1] &&
    rsiFast[i - 1] > rsiFast[i - 2] &&
    rsiFast[i]     > rsiSlow[i]
  if (rsiCurling) {
    factors.rsiCurlingUp = 8
    score += 8
  } else {
    factors.rsiCurlingUp = 0
  }

  // ── RSI bullish cross: fast was ≤ slow, now > slow (4 pts) ───
  const rsiBullishCross = i >= 1 &&
    rsiFast[i - 1] <= rsiSlow[i - 1] &&
    rsiFast[i]     >  rsiSlow[i]
  if (rsiBullishCross) {
    factors.rsiBullishCross = 4
    score += 4
  } else {
    factors.rsiBullishCross = 0
  }

  // ── Clean pullback 2–5 candles (10 pts) ──────────────────────
  const pb = pullbackCandles ?? 0
  if (pb >= 2 && pb <= 5) {
    factors.pullbackClean = 10
    score += 10
  } else if (pb === 1 || pb === 6) {
    factors.pullbackClean = 4
    score += 4
  } else {
    factors.pullbackClean = 0
  }

  // ── Decreasing sell volume during pullback (7 pts) ────────────
  // Down candles in last (pb+1) bars should have declining volume
  if (pb >= 2 && n >= pb + 2) {
    const pullbackSlice = candles.slice(n - pb - 1, n)
    const downCandles = pullbackSlice.filter(c => c.close < c.open)
    let volumeDeclining = true
    for (let j = 1; j < downCandles.length; j++) {
      if (downCandles[j].volume >= downCandles[j - 1].volume) {
        volumeDeclining = false
        break
      }
    }
    if (volumeDeclining && downCandles.length >= 2) {
      factors.pullbackVolumeDeclining = 7
      score += 7
    } else {
      factors.pullbackVolumeDeclining = 0
    }
  } else {
    factors.pullbackVolumeDeclining = 0
  }

  // ── Strong reversal candle body > 60% of range (6 pts) ───────
  const body  = Math.abs(candles[i].close - candles[i].open)
  const range = candles[i].high - candles[i].low
  const strongBody = range > 0 && (body / range) > 0.6 && candles[i].close > candles[i].open
  if (strongBody) {
    factors.strongReversalCandle = 6
    score += 6
  } else {
    factors.strongReversalCandle = 0
  }

  // ── Volume expansion on reversal: current vol ≥ 1.2× 10-bar avg (5 pts) ──
  if (n >= 11) {
    const avgVol = candles.slice(n - 11, n - 1).reduce((s, c) => s + c.volume, 0) / 10
    if (candles[i].volume >= avgVol * 1.2) {
      factors.volumeExpansion = 5
      score += 5
    } else {
      factors.volumeExpansion = 0
    }
  } else {
    factors.volumeExpansion = 0
  }

  // ── Penalties ─────────────────────────────────────────────────
  if (e20 != null) {
    const extPct = (close - e20) / e20
    if (extPct > 0.15) {
      factors.extensionPenalty = -20
      score -= 20
    } else if (extPct > 0.08) {
      factors.extensionPenalty = -10
      score -= 10
    } else {
      factors.extensionPenalty = 0
    }
  } else {
    factors.extensionPenalty = 0
  }

  if (rsiFast[i] > 75) {
    factors.overboughtPenalty = -10
    score -= 10
  } else {
    factors.overboughtPenalty = 0
  }

  if (choppy) {
    factors.choppyPenalty = -10
    score -= 10
  } else {
    factors.choppyPenalty = 0
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  const grade = score >= 80 ? 'A+' :
                score >= 65 ? 'A'  :
                score >= 50 ? 'B'  :
                score >= 35 ? 'C'  : 'D'

  return { score, grade, factors }
}
