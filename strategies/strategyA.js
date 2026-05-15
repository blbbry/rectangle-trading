// Momentum Restart — full entry signal on daily-timeframe bars.
// Returns { signal: 0|1, overextended: bool, higherLow: bool }
export function evalMomentumRestart(candles, ema9, ema20, rsiFast, rsiSlow) {
  const n = candles.length
  if (n < 3 || ema9.length < n || ema20.length < n || rsiFast.length < n || rsiSlow.length < n) {
    return { signal: 0, overextended: false, higherLow: false }
  }

  const i   = n - 1
  const cur = candles[i]
  const e20 = ema20[i]

  const overextended = (e20 != null && (cur.close - e20) / e20 > 0.10) || rsiFast[i] > 75

  // All entry conditions must be true
  const bullishCandle   = cur.close > cur.open
  const higherLow       = cur.low   > candles[i - 1].low
  const breakAbovePrev  = cur.close > candles[i - 1].high
  const rsiFastAboveSlow = rsiFast[i] > rsiSlow[i]
  const rsiRising       = rsiFast[i]  > rsiFast[i - 1]
  const notOverextended = !overextended

  // Volume confirmation: current candle volume ≥ average of last 10 candles
  let volumeConfirm = true
  if (n >= 11) {
    const avgVol = candles.slice(n - 11, n - 1).reduce((s, c) => s + c.volume, 0) / 10
    volumeConfirm = cur.volume >= avgVol
  }

  const signal = (
    bullishCandle &&
    higherLow &&
    breakAbovePrev &&
    rsiFastAboveSlow &&
    rsiRising &&
    volumeConfirm &&
    notOverextended
  ) ? 1 : 0

  return { signal, overextended, higherLow }
}
