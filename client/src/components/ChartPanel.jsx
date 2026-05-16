import useStore from '../store/useStore.js'
import CandleChart from './CandleChart.jsx'
import StatePanel from './StatePanel.jsx'
import AlertFeed from './AlertFeed.jsx'

export default function ChartPanel() {
  const selectedTicker = useStore((s) => s.selectedTicker)
  const tickerState    = useStore((s) => selectedTicker ? s.tickers[selectedTicker] : null)
  const lastAlert      = useStore((s) =>
    s.alerts.find((a) => a.ticker === selectedTicker) ?? null
  )

  if (!selectedTicker) {
    return (
      <div className="flex items-center justify-center h-full text-gray-700">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-20">▭</div>
          <div className="text-sm">Select a ticker from the sidebar</div>
        </div>
      </div>
    )
  }

  const daily  = tickerState?.daily  ?? null
  const weekly = tickerState?.weekly ?? null

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Ticker header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <h2 className="text-xl font-bold tracking-wider text-white">{selectedTicker}</h2>
        {daily?.fsm === 'BREAKOUT_RETEST' && (
          <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded animate-pulse font-semibold">
            BREAKOUT — DAILY
          </span>
        )}
        {weekly?.fsm === 'BREAKOUT_RETEST' && (
          <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded animate-pulse font-semibold">
            BREAKOUT — WEEKLY
          </span>
        )}
      </div>

      {/* Candlestick chart */}
      <div className="flex-1 min-h-0 rounded border border-gray-800 overflow-hidden">
        <CandleChart
          candles={tickerState?.candles ?? []}
          ema9={tickerState?.ema9 ?? []}
          ema20={tickerState?.ema20 ?? []}
          daily={daily}
          weekly={weekly}
        />
      </div>

      {/* Bottom: StatePanel + AlertFeed side-by-side */}
      <div className="flex gap-3 flex-shrink-0 h-52">
        <div className="flex-shrink-0 w-72">
          <StatePanel daily={daily} weekly={weekly} />
        </div>
        <div className="flex-1 min-w-0">
          <AlertFeed ticker={selectedTicker} />
        </div>
      </div>
    </div>
  )
}
