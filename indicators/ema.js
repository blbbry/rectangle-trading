// Exponential Moving Average — SMA-seeded, same length as closes (null-padded).
export function computeEMA(closes, length) {
  if (closes.length < length) return closes.map(() => null)
  const k   = 2 / (length + 1)
  let   ema = closes.slice(0, length).reduce((a, b) => a + b, 0) / length
  const out = new Array(length - 1).fill(null)
  out.push(ema)
  for (let i = length; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
    out.push(ema)
  }
  return out  // out[i] === null for i < length-1, number thereafter
}
