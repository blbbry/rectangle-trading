// Daily trend filter — determines structural bullishness before setup evaluation.
// Returns { bullish: bool, strength: 0-4, flags: string[] }
export function evalDailyTrend(candles, ema20, rsiSlow) {
  const n = candles.length
  if (n < 20 || ema20.length < n || rsiSlow.length < n) {
    return { bullish: false, strength: 0, flags: [] }
  }

  const i     = n - 1
  const close = candles[i].close
  const flags = []

  // Condition 1: price above 20 EMA
  if (ema20[i] != null && close > ema20[i]) {
    flags.push('above_ema20')
  }

  // Condition 2: daily RSI Slow > 50
  if (rsiSlow[i] > 50) {
    flags.push('rsi_bullish')
  }

  // Condition 3: higher highs + higher lows in last 10 candles
  // Compare the min of the last 5 lows against the min of the prior 5 lows
  if (n >= 10) {
    const prior5Lows = candles.slice(n - 10, n - 5).map(c => c.low)
    const last5Lows  = candles.slice(n - 5).map(c => c.low)
    const prior5Highs = candles.slice(n - 10, n - 5).map(c => c.high)
    const last5Highs  = candles.slice(n - 5).map(c => c.high)
    const higherLows   = Math.min(...last5Lows)  > Math.min(...prior5Lows)
    const higherHighs  = Math.max(...last5Highs) > Math.max(...prior5Highs)
    if (higherLows && higherHighs) flags.push('hh_hl_structure')
  }

  // Condition 4: recent breakout — price made a new 20-day high within last 5 candles
  if (n >= 20) {
    const prior20High = Math.max(...candles.slice(n - 20, n - 5).map(c => c.high))
    const last5High   = Math.max(...candles.slice(n - 5).map(c => c.high))
    if (last5High > prior20High) flags.push('recent_breakout')
  }

  const strength = flags.length
  return { bullish: strength >= 1, strength, flags }
}
