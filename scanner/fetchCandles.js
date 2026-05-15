import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

export async function fetchIntradayCandles(ticker) {
  try {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const result = await yahooFinance.chart(ticker, {
      interval: '5m',
      period1: startOfDay,
    }, { validateResult: false })

    const quotes = result?.quotes
    if (!quotes || quotes.length === 0) return { ticker, error: 'no_data' }

    return quotes
      .filter(q =>
        q.open != null && q.high != null && q.low != null &&
        q.close != null && q.volume != null && q.volume > 0 &&
        isRegularSession(q.date)
      )
      .map(q => ({ timestamp: q.date, open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }))
  } catch (err) {
    const msg = err?.message || 'fetch_error'
    if (msg.toLowerCase().includes('no fundamentals') || msg.toLowerCase().includes('not found')) {
      return { ticker, error: 'invalid_ticker' }
    }
    return { ticker, error: msg }
  }
}

// Regular session: 9:30–16:00 ET (UTC-4 EDT / UTC-5 EST).
function isRegularSession(date) {
  if (!date) return false
  const utcHour = date.getUTCHours()
  const utcMin  = date.getUTCMinutes()
  const afterOpen  = utcHour > 13 || (utcHour === 13 && utcMin >= 30)
  const beforeClose = utcHour < 21
  return afterOpen && beforeClose
}

// Daily candles — used for the trend filter (confirms structural bullishness).
export async function fetchDailyCandles(ticker, days = 60) {
  try {
    const period1 = new Date()
    period1.setDate(period1.getDate() - days)
    period1.setUTCHours(0, 0, 0, 0)

    const result = await yahooFinance.chart(ticker, {
      interval: '1d', period1,
    }, { validateResult: false })

    const quotes = result?.quotes ?? []
    if (quotes.length === 0) return { ticker, error: 'no_data' }

    return quotes
      .filter(q => q.open != null && q.high != null && q.low != null && q.close != null && q.volume > 0)
      .map(q => ({ timestamp: q.date, open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }))
  } catch (err) {
    const msg = err?.message || 'fetch_error'
    if (msg.toLowerCase().includes('no fundamentals') || msg.toLowerCase().includes('not found')) {
      return { ticker, error: 'invalid_ticker' }
    }
    return { ticker, error: msg }
  }
}

// 4-hour candles — primary signal timeframe.
// Yahoo Finance has no native 4H interval, so we fetch 60m and aggregate every
// 4 hourly candles per trading day into one 4H bar.
// Returns { candles: OHLCV[], lastHourlyTs: number|null }
// lastHourlyTs is used by the engine to dedup: re-evaluate only when a new
// 60m candle arrives (~hourly during market hours).
export async function fetch4HCandles(ticker, days = 60) {
  try {
    const period1 = new Date()
    period1.setDate(period1.getDate() - days)
    period1.setUTCHours(0, 0, 0, 0)

    const result = await yahooFinance.chart(ticker, {
      interval: '60m', period1,
    }, { validateResult: false })

    const quotes = result?.quotes ?? []
    if (quotes.length === 0) return { ticker, error: 'no_data' }

    const hourly = quotes
      .filter(q =>
        q.open  != null && q.high  != null &&
        q.low   != null && q.close != null &&
        q.volume > 0 && isRegularSession(q.date)
      )
      .map(q => ({ timestamp: q.date, open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }))

    if (hourly.length === 0) return { ticker, error: 'no_data' }

    const lastHourlyTs = hourly[hourly.length - 1].timestamp?.getTime?.() ?? null
    const candles = aggregate4H(hourly)
    return { candles, lastHourlyTs }
  } catch (err) {
    const msg = err?.message || 'fetch_error'
    if (msg.toLowerCase().includes('no fundamentals') || msg.toLowerCase().includes('not found')) {
      return { ticker, error: 'invalid_ticker' }
    }
    return { ticker, error: msg }
  }
}

// Group regular-session hourly candles into 4H bars.
// Within each trading day, take consecutive groups of 4 hourly candles.
// The last group of the day may be partial (e.g. 3 candles: 13:30–15:30 ET).
function aggregate4H(hourlyCandles) {
  if (hourlyCandles.length === 0) return []

  // Group by ET calendar date. Use UTC-4 approximation (EDT; close enough year-round
  // since we only care about grouping by market day, not precise DST boundary).
  const dayMap = new Map()
  for (const c of hourlyCandles) {
    const etMs  = c.timestamp.getTime() - 4 * 60 * 60 * 1000
    const key   = new Date(etMs).toISOString().slice(0, 10)
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key).push(c)
  }

  const blocks = []
  for (const dayCandles of dayMap.values()) {
    dayCandles.sort((a, b) => a.timestamp - b.timestamp)
    for (let i = 0; i < dayCandles.length; i += 4) {
      const chunk = dayCandles.slice(i, i + 4)
      if (chunk.length === 0) continue
      blocks.push({
        timestamp: chunk[0].timestamp,
        open:   chunk[0].open,
        high:   Math.max(...chunk.map(c => c.high)),
        low:    Math.min(...chunk.map(c => c.low)),
        close:  chunk[chunk.length - 1].close,
        volume: chunk.reduce((s, c) => s + c.volume, 0),
      })
    }
  }

  return blocks
}
