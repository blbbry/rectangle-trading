// Wilder smoothing (RMA) — matches TradingView RSI behavior.
// Returns array of length (closes.length - length).
// rsiValues[0] corresponds to closes[length].
export function computeRSI(closes, length) {
  if (closes.length < length + 1) return []

  const changes = []
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  // Seed with simple average of first `length` gains/losses
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < length; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= length
  avgLoss /= length

  const rsiValues = []

  for (let i = length; i < changes.length; i++) {
    const gain = Math.max(changes[i], 0)
    const loss = Math.abs(Math.min(changes[i], 0))
    avgGain = (avgGain * (length - 1) + gain) / length
    avgLoss = (avgLoss * (length - 1) + loss) / length

    let rsi
    if (avgLoss === 0) {
      rsi = 100
    } else {
      const rs = avgGain / avgLoss
      rsi = 100 - 100 / (1 + rs)
    }
    rsiValues.push(rsi)
  }

  return rsiValues
}
