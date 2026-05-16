import useStore from '../store/useStore.js'

function worstFsm(daily, weekly) {
  if (daily?.fsm === 'BREAKOUT_RETEST' || weekly?.fsm === 'BREAKOUT_RETEST') return 'BREAKOUT_RETEST'
  return 'WATCHING'
}

function Sparkline({ candles }) {
  if (!candles?.length) return <span className="w-12 h-4" />
  const closes = candles.slice(-20).map((c) => c.close)
  if (closes.length < 2) return <span className="w-12 h-4" />

  const lo  = Math.min(...closes)
  const hi  = Math.max(...closes)
  const rng = hi - lo || 1
  const w   = 48
  const h   = 16
  const step = w / (closes.length - 1)

  const pts = closes
    .map((v, i) => `${i * step},${h - ((v - lo) / rng) * h}`)
    .join(' ')

  const bull = closes[closes.length - 1] >= closes[0]

  return (
    <svg width={w} height={h} className="flex-shrink-0 opacity-60">
      <polyline
        points={pts}
        fill="none"
        stroke={bull ? '#22c55e' : '#ef4444'}
        strokeWidth={1}
      />
    </svg>
  )
}

export default function TickerRow({ ticker }) {
  const selected    = useStore((s) => s.selectedTicker)
  const setSelected = useStore((s) => s.setSelectedTicker)
  const tickerState = useStore((s) => s.tickers[ticker])
  const daily       = tickerState?.daily
  const weekly      = tickerState?.weekly
  const hasAlert    = daily?.hasAlert || weekly?.hasAlert
  const fsm         = worstFsm(daily, weekly)
  const isSelected  = selected === ticker
  const candles     = tickerState?.candles

  return (
    <button
      onClick={() => setSelected(ticker)}
      className={`
        w-full flex items-center justify-between px-3 py-1.5 text-left
        transition-colors duration-100 group
        ${isSelected
          ? 'bg-blue-900/40 border-l-2 border-blue-400'
          : 'border-l-2 border-transparent hover:bg-gray-800/50'}
      `}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {/* Alert pulse dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          hasAlert ? 'bg-red-400 animate-pulse' : 'bg-transparent'
        }`} />

        <span className={`text-sm font-bold truncate ${
          isSelected ? 'text-blue-300' : 'text-gray-200 group-hover:text-white'
        }`}>
          {ticker}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mini sparkline */}
        <Sparkline candles={candles} />

        {/* FSM badge */}
        <span className={`
          text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0
          ${fsm === 'BREAKOUT_RETEST'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-green-500/10 text-green-500 border border-green-500/20'}
        `}>
          {fsm === 'BREAKOUT_RETEST' ? 'BRKT' : 'WTCH'}
        </span>
      </div>
    </button>
  )
}
