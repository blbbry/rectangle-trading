import { fetchDailyCandles,
         fetch4HCandles }      from './fetchCandles.js'
import { computeEMA }          from '../indicators/ema.js'
import { computeRSI }          from '../indicators/rsi.js'
import { isChoppy }            from '../strategies/antiChop.js'
import { evalDailyTrend }      from '../strategies/trendFilter.js'
import { evalPullbackSetup }   from '../strategies/setupDetector.js'
import { evalMomentumRestart } from '../strategies/strategyA.js'
import { gradeSetup }          from '../strategies/gradeEngine.js'

const MIN_CANDLES = 30   // minimum 4H bars after OFFSET alignment
const BATCH_SIZE  = 5    // Yahoo Finance rate-limit guard
const OFFSET      = 15   // RSI alignment offset

async function scanTicker(ticker) {
  const [dailyResult, fourHResult] = await Promise.all([
    fetchDailyCandles(ticker, 60),
    fetch4HCandles(ticker, 60),
  ])

  if (!fourHResult || !Array.isArray(fourHResult.candles)) {
    return { ticker, signal: 0, error: fourHResult?.error || 'fetch_error' }
  }

  const { candles: candles4H } = fourHResult
  if (candles4H.length < MIN_CANDLES) {
    return { ticker, signal: 0, error: 'insufficient_data', candleCount: candles4H.length }
  }

  // Compute indicators on 4H series
  const closes4H   = candles4H.map(c => c.close)
  const ema9Raw    = computeEMA(closes4H, 9)
  const ema20Raw   = computeEMA(closes4H, 20)
  const rsiFastRaw = computeRSI(closes4H, 7)
  const rsiSlowRaw = computeRSI(closes4H, 14)

  const aligned  = candles4H.slice(OFFSET)
  const ema9A    = ema9Raw.slice(OFFSET)
  const ema20A   = ema20Raw.slice(OFFSET)
  const rsiFastA = rsiFastRaw.slice(OFFSET - 8)
  const rsiSlowA = rsiSlowRaw

  const n           = aligned.length
  const rsiFastLast = parseFloat(rsiFastA[n - 1].toFixed(2))
  const rsiSlowLast = parseFloat(rsiSlowA[n - 1].toFixed(2))

  // Daily trend filter
  let trend = null
  const hasDaily = Array.isArray(dailyResult) && dailyResult.length >= OFFSET + 5
  if (hasDaily) {
    const dCloses  = dailyResult.map(c => c.close)
    const dEma20   = computeEMA(dCloses, 20)
    const dRsiSlow = computeRSI(dCloses, 14)
    const dAligned = dailyResult.slice(OFFSET)
    const dEma20A  = dEma20.slice(OFFSET)
    trend = evalDailyTrend(dAligned, dEma20A, dRsiSlow)
  } else {
    trend = evalDailyTrend(aligned, ema20A, rsiSlowA)
  }

  if (!trend.bullish) {
    return { ticker, signal: 0, reason: 'trend_reject', trendStrength: trend.strength }
  }

  const choppy = isChoppy(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
  if (choppy) return { ticker, signal: 0, reason: 'chop_filter' }

  // Full momentum restart on 4H
  const restart = evalMomentumRestart(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
  if (restart.signal === 1) {
    const { pullbackCandles } = evalPullbackSetup(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
    const { score, grade, factors } = gradeSetup({
      trendStrength: trend.strength,
      candles: aligned, ema9: ema9A, ema20: ema20A,
      rsiFast: rsiFastA, rsiSlow: rsiSlowA,
      pullbackCandles, choppy,
    })
    return {
      ticker, signal: 1, strategy: 'Momentum',
      grade, score, trendStrength: trend.strength, trendFlags: trend.flags,
      overextended: restart.overextended,
      rsiFast: rsiFastLast, rsiSlow: rsiSlowLast,
      ema9:  parseFloat(ema9A[n - 1]?.toFixed(4) ?? 0),
      ema20: parseFloat(ema20A[n - 1]?.toFixed(4) ?? 0),
      factors,
    }
  }

  const setup = evalPullbackSetup(aligned, ema9A, ema20A, rsiFastA, rsiSlowA)
  if (setup.waiting) {
    return { ticker, signal: 0, waiting: true, rsiFast: rsiFastLast, rsiSlow: rsiSlowLast, trendStrength: trend.strength }
  }

  return { ticker, signal: 0 }
}

export async function runScan(tickers) {
  const results = []
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch   = tickers.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(batch.map(scanTicker))
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') results.push(r.value)
      else results.push({ ticker: batch[j], signal: 0, error: r.reason?.message || 'unknown_error' })
    })
  }
  return results
}
