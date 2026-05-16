import YahooFinance from 'yahoo-finance2'
import { getETDate, isRegularSession } from '../utils/etTime.js'

export { getETDate } from '../utils/etTime.js'

const yahooFinance = new YahooFinance()

function toOHLCV(q) {
  return { timestamp: q.date, open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }
}

function validQuote(q) {
  return q.open != null && q.high != null && q.low != null &&
         q.close != null && q.volume != null && q.volume > 0
}

async function fetchIntraday(ticker, interval, days) {
  try {
    const period1 = new Date()
    period1.setDate(period1.getDate() - days)
    period1.setUTCHours(0, 0, 0, 0)

    const result = await yahooFinance.chart(ticker, { interval, period1 }, { validateResult: false })
    const quotes = result?.quotes ?? []
    if (quotes.length === 0) return []

    return quotes
      .filter(q => validQuote(q) && isRegularSession(q.date))
      .map(toOHLCV)
  } catch (err) {
    const msg = err?.message || 'fetch_error'
    if (msg.toLowerCase().includes('no fundamentals') || msg.toLowerCase().includes('not found')) return []
    console.warn(`[fetchRectangleCandles] ${ticker} ${interval}:`, msg)
    return []
  }
}

export function fetch15mCandles(ticker, days = 5)  { return fetchIntraday(ticker, '15m', days) }
export function fetch30mCandles(ticker, days = 30) { return fetchIntraday(ticker, '30m', days) }

// Re-export 5m intraday from the existing fetcher to avoid duplication
export { fetchIntradayCandles as fetch5mCandles } from './fetchCandles.js'

// ─── Date helpers (wall clock only — used for rectangle construction) ─────────

// ISO-8601 week string: "YYYY-Www" (Mon–Sun)
export function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7         // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day) // Thursday of current week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d - yearStart) / 86_400_000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// ─── Rectangle builders ───────────────────────────────────────────────────────

// Daily rectangle: high/low of the last COMPLETED trading day (not today).
// Uses wall clock only to determine "today" — candle data drives the rectangle.
export function buildDailyRectangle(dailyCandles) {
  if (!Array.isArray(dailyCandles) || dailyCandles.length === 0) return null

  const etToday = getETDate(Date.now())
  const completed = dailyCandles.filter(c => {
    const ts = c.timestamp instanceof Date ? c.timestamp.getTime() : Number(c.timestamp)
    return getETDate(ts) < etToday
  })
  if (completed.length === 0) return null

  const prev = completed[completed.length - 1]
  const high = prev.high
  const low  = prev.low
  return { high, low, mid: (high + low) / 2 }
}

// Weekly rectangle: high/low of the last COMPLETED ISO week (Mon–Fri trading).
// Groups daily bars by ISO week; Saturday/Sunday produce no daily bars so the
// grouping aligns cleanly with the trading week.
export function buildWeeklyRectangle(dailyCandles) {
  if (!Array.isArray(dailyCandles) || dailyCandles.length === 0) return null

  const currentWeek = getISOWeek(new Date())

  const weekMap = new Map()
  for (const c of dailyCandles) {
    const ts   = c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)
    const week = getISOWeek(ts)
    if (week === currentWeek) continue
    if (!weekMap.has(week)) weekMap.set(week, [])
    weekMap.get(week).push(c)
  }

  if (weekMap.size === 0) return null

  const sortedWeeks = [...weekMap.keys()].sort()
  const prevWeek    = sortedWeeks[sortedWeeks.length - 1]
  const bars        = weekMap.get(prevWeek)

  const high = Math.max(...bars.map(c => c.high))
  const low  = Math.min(...bars.map(c => c.low))
  return { high, low, mid: (high + low) / 2 }
}
