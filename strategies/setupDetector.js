// WAITING state detector — pullback forming but momentum restart not yet confirmed.
// Returns { waiting: bool, pullbackCandles: number }

export function evalPullbackSetup(candles, ema9, ema20, rsiFast, rsiSlow) {
  const n = candles.length
  if (n < 10 || ema9.length < n || ema20.length < n || rsiFast.length < n || rsiSlow.length < n) {
    return { waiting: false, pullbackCandles: 0 }
  }

  const i     = n - 1
  const close = candles[i].close
  const e9    = ema9[i]
  const e20   = ema20[i]

  if (e9 == null || e20 == null) return { waiting: false, pullbackCandles: 0 }

  // Condition 1: broad trend bullish — price above ema20 OR RSI > 45
  const broadlyBullish = close > e20 || rsiFast[i] > 45
  if (!broadlyBullish) return { waiting: false, pullbackCandles: 0 }

  // Condition 2: price within 3% of ema9 or ema20 (in pullback zone)
  const nearEma9  = Math.abs(close - e9)  / e9  <= 0.03
  const nearEma20 = Math.abs(close - e20) / e20 <= 0.03
  if (!nearEma9 && !nearEma20) return { waiting: false, pullbackCandles: 0 }

  // Condition 3: measure pullback length — count consecutive bars where close < ema9
  // (price was below the fast EMA, now approaching / at it)
  let pullbackCandles = 0
  for (let j = i - 1; j >= Math.max(0, i - 7); j--) {
    if (ema9[j] != null && candles[j].close < ema9[j]) pullbackCandles++
    else break
  }
  if (pullbackCandles < 2 || pullbackCandles > 7) return { waiting: false, pullbackCandles: 0 }

  // Condition 4: RSI Fast in reset zone 38–62 (not collapsed, not still overbought)
  if (rsiFast[i] < 38 || rsiFast[i] > 62) return { waiting: false, pullbackCandles: 0 }

  // Condition 5: no violent collapse candle in last 3 bars (>4% single-bar drop)
  for (let j = i; j >= Math.max(0, i - 2); j--) {
    const pct = (candles[j].close - candles[j].open) / candles[j].open
    if (pct < -0.04) return { waiting: false, pullbackCandles: 0 }
  }

  return { waiting: true, pullbackCandles }
}
