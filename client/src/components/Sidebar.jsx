import { useState, useMemo } from 'react'
import useStore from '../store/useStore.js'
import TickerRow from './TickerRow.jsx'

const CATEGORIES = [
  { label: 'AI / Tech',        tickers: ['BBAI','SOUN','AI','PLTR','NOTE','INOD','VERI','GFAI','PATH','CRNC','EXAI','AMPL','INTA','TEM'] },
  { label: 'Space',            tickers: ['TLS','RDW','SPIR','RKLB','BKSY','PL','MNTS','SIDU','ASTS','SATL','LUNR','EVEX'] },
  { label: 'Quantum',          tickers: ['RGTI','QBTS','IONQ','ARQQ'] },
  { label: 'Aviation / Auto',  tickers: ['ACHR','SERV','AVAV','KTOS','JOBY'] },
  { label: 'Fintech',          tickers: ['UPST','SOFI','AFRM','RKT','HIMS','OPEN'] },
  { label: 'Crypto Mining',    tickers: ['RIOT','MARA','CIFR','BTBT','IREN','WULF','CORZ'] },
  { label: 'Clean Energy',     tickers: ['FCEL','CLNE','NRGV','NVVE','IMPP','RUN','STEM','CHPT','BE','BLNK','LCID','PLUG','MAXN','ENVX'] },
  { label: 'Biotech',          tickers: ['OCGN','BCRX','SNTI','CLOV','CGC','TLRY'] },
  { label: 'Other',            tickers: ['OUST','SATS','VLD','REKR'] },
]

const ALL_TICKERS = CATEGORIES.flatMap((c) => c.tickers)

const NEAR_EDGE_PCT = 0.005  // within 0.5% of rectangle edge

function tickerGroup(tickerState) {
  const d = tickerState?.daily?.fsm
  const w = tickerState?.weekly?.fsm
  if (d === 'BREAKOUT_RETEST' || w === 'BREAKOUT_RETEST') return 'BREAKOUT'

  // Check if last 15m candle close is near daily rectangle edge
  const close = tickerState?.candles15m?.at(-1)?.close
  const rect  = tickerState?.daily?.rectangle
  if (close && rect) {
    const distHigh = Math.abs(close - rect.high) / close
    const distLow  = Math.abs(close - rect.low)  / close
    if (distHigh <= NEAR_EDGE_PCT || distLow <= NEAR_EDGE_PCT) return 'NEAR_EDGE'
  }
  return 'WATCHING'
}

const GROUP_ORDER  = ['BREAKOUT', 'NEAR_EDGE', 'WATCHING']
const GROUP_LABELS = { BREAKOUT: 'Active Breakout', NEAR_EDGE: 'Near Edge', WATCHING: 'Watching' }

export default function Sidebar({ onClose }) {
  const connected  = useStore((s) => s.connected)
  const alertCount = useStore((s) => s.alerts.length)
  const tickers    = useStore((s) => s.tickers)

  const [query, setQuery] = useState('')

  const filteredCategories = useMemo(() => {
    const q = query.trim().toUpperCase()

    if (q) {
      // Search mode: flat sorted list
      const matches = ALL_TICKERS.filter((t) => t.includes(q))
      matches.sort((a, b) => {
        const ga = GROUP_ORDER.indexOf(tickerGroup(tickers[a]))
        const gb = GROUP_ORDER.indexOf(tickerGroup(tickers[b]))
        if (ga !== gb) return ga - gb
        return a.localeCompare(b)
      })
      return matches.length ? [{ label: 'Results', tickers: matches }] : []
    }

    // Default: group by trading state
    const groups = { BREAKOUT: [], NEAR_EDGE: [], WATCHING: [] }
    for (const t of ALL_TICKERS) {
      const g = tickerGroup(tickers[t])
      groups[g].push(t)
    }
    for (const g of GROUP_ORDER) groups[g].sort((a, b) => a.localeCompare(b))

    return GROUP_ORDER
      .filter((g) => groups[g].length > 0)
      .map((g) => ({ label: GROUP_LABELS[g], tickers: groups[g] }))
  }, [query, tickers])

  const breakoutCount = useMemo(
    () => ALL_TICKERS.filter((t) => tickerGroup(tickers[t]) === 'BREAKOUT').length,
    [tickers]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-500 animate-pulse'}`} />
          <span className="text-xs text-gray-400 font-medium">
            {connected ? 'Live' : 'Reconnecting'}
          </span>
          {alertCount > 0 && (
            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-semibold">
              {alertCount}▲
            </span>
          )}
          {breakoutCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold">
              {breakoutCount} BRKT
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 text-gray-500 hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-gray-800 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker…"
          className="w-full bg-gray-800/60 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Ticker list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredCategories.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-600 text-center">No matches</div>
        ) : (
          filteredCategories.map(({ label, tickers: t }) => (
            <div key={label}>
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                  {label}
                </span>
              </div>
              {t.map((ticker) => (
                <TickerRow key={ticker} ticker={ticker} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
