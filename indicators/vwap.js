export function computeVWAP(candles) {
  let cumulativeTPV = 0
  let cumulativeVol = 0
  let lastVWAP = 0
  const vwapValues = []

  for (const candle of candles) {
    if (candle.volume > 0) {
      const tp = (candle.high + candle.low + candle.close) / 3
      cumulativeTPV += tp * candle.volume
      cumulativeVol += candle.volume
      lastVWAP = cumulativeTPV / cumulativeVol
    }
    vwapValues.push(lastVWAP)
  }

  return vwapValues
}

export function vwapSlope(vwapValues, lookback = 10) {
  const n = vwapValues.length
  if (n < lookback + 1) return null
  return vwapValues[n - 1] - vwapValues[n - 1 - lookback]
}
