// Chop filter for daily-timeframe swing setups.
// Returns true when conditions are too sideways/rangey to generate quality signals.
export function isChoppy(candles, ema9, ema20, rsiFast, rsiSlow) {
  const n = candles.length
  if (n < 15) return true

  const i = n - 1

  // Filter 1: price range over last 15 candles < 3% (tight sideways)
  const last15 = candles.slice(n - 15)
  const rangeHigh = Math.max(...last15.map(c => c.high))
  const rangeLow  = Math.min(...last15.map(c => c.low))
  if ((rangeHigh - rangeLow) / rangeLow < 0.03) return true

  // Filter 2: EMA9 and EMA20 within 0.5% of each other for last 5 candles (flat/converging)
  let emaFlatCount = 0
  for (let j = i; j >= Math.max(0, i - 4); j--) {
    const e9 = ema9[j], e20 = ema20[j]
    if (e9 != null && e20 != null && Math.abs(e9 - e20) / e20 < 0.005) emaFlatCount++
  }
  if (emaFlatCount >= 5) return true

  // Filter 3: RSI Fast/Slow overlap (|diff| < 2) on more than 8 of last 10 candles
  if (rsiFast.length >= 10 && rsiSlow.length >= 10) {
    const fastSlice = rsiFast.slice(n - 10)
    const slowSlice = rsiSlow.slice(n - 10)
    let overlapCount = 0
    for (let j = 0; j < 10; j++) {
      if (Math.abs(fastSlice[j] - slowSlice[j]) < 2) overlapCount++
    }
    if (overlapCount > 8) return true
  }

  // Filter 4: more than 3 EMA9 crosses (close flips sides of EMA9) in last 10 candles
  if (ema9.length >= 10) {
    const last10Candles = candles.slice(n - 10)
    const last10Ema9    = ema9.slice(n - 10)
    let crossCount = 0
    for (let j = 1; j < 10; j++) {
      if (last10Ema9[j] == null || last10Ema9[j - 1] == null) continue
      const wasAbove = last10Candles[j - 1].close >= last10Ema9[j - 1]
      const isAbove  = last10Candles[j].close     >= last10Ema9[j]
      if (wasAbove !== isAbove) crossCount++
    }
    if (crossCount > 3) return true
  }

  return false
}
