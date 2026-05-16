import useStore from '../store/useStore.js'

function worstFsm(daily, weekly) {
  if (daily?.fsm === 'BREAKOUT_RETEST' || weekly?.fsm === 'BREAKOUT_RETEST') return 'BREAKOUT_RETEST'
  return 'WATCHING'
}

export default function TickerRow({ ticker }) {
  const selected       = useStore((s) => s.selectedTicker)
  const setSelected    = useStore((s) => s.setSelectedTicker)
  const tickerState    = useStore((s) => s.tickers[ticker])
  const daily          = tickerState?.daily
  const weekly         = tickerState?.weekly
  const hasAlert       = daily?.hasAlert || weekly?.hasAlert
  const fsm            = worstFsm(daily, weekly)
  const isSelected     = selected === ticker

  return (
    <button
      onClick={() => setSelected(ticker)}
      className={`
        w-full flex items-center justify-between px-3 py-2 text-left
        transition-colors duration-100 group
        ${isSelected
          ? 'bg-blue-900/40 border-l-2 border-blue-400'
          : 'border-l-2 border-transparent hover:bg-gray-800/50'}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
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

      {/* FSM badge */}
      <span className={`
        ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0
        ${fsm === 'BREAKOUT_RETEST'
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          : 'bg-green-500/10 text-green-500 border border-green-500/20'}
      `}>
        {fsm === 'BREAKOUT_RETEST' ? 'BRKT' : 'WTCH'}
      </span>
    </button>
  )
}
