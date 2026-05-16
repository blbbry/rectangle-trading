import { formatPrice, formatET } from '../utils/formatters.js'

function FsmBadge({ fsm }) {
  const isBreakout = fsm === 'BREAKOUT_RETEST'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
      isBreakout
        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        : 'bg-green-500/10 text-green-500 border border-green-500/20'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isBreakout ? 'bg-amber-400' : 'bg-green-500'}`} />
      {fsm ?? 'WATCHING'}
    </span>
  )
}

function edgeInfo(close, rect) {
  if (!close || !rect) return null
  const distHigh = Math.abs(close - rect.high) / close * 100
  const distLow  = Math.abs(close - rect.low)  / close * 100
  if (distHigh < distLow) {
    return { pct: distHigh.toFixed(2), label: 'HIGH', color: close > rect.high ? 'text-amber-400' : 'text-gray-400' }
  }
  return { pct: distLow.toFixed(2), label: 'LOW', color: close < rect.low ? 'text-amber-400' : 'text-gray-400' }
}

function slopeInfo(candles) {
  if (!candles?.length || candles.length < 6) return null
  const n = candles.length
  const cur  = candles[n - 1].close
  const prev = candles[n - 6].close
  const pct  = (cur - prev) / prev * 100
  if (pct >  0.3) return { arrow: '↑', label: `+${pct.toFixed(1)}%`, color: 'text-green-400' }
  if (pct < -0.3) return { arrow: '↓', label: `${pct.toFixed(1)}%`,  color: 'text-red-400' }
  return { arrow: '→', label: `${pct.toFixed(1)}%`, color: 'text-gray-500' }
}

function TimeframeColumn({ label, state, borderColor, candles }) {
  const rect     = state?.rectangle
  const fsm      = state?.fsm ?? 'WATCHING'
  const breakout = state?.breakout
  const ts       = state?.lastProcessedCandleTs

  const lastClose = candles?.at(-1)?.close ?? null
  const edge  = edgeInfo(lastClose, rect)
  const slope = slopeInfo(candles)

  return (
    <div className={`flex-1 border-l-2 ${borderColor} pl-3 min-w-0`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">{label}</span>
        <FsmBadge fsm={fsm} />
      </div>

      {rect ? (
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500">High</span>
            <span className="text-gray-200">{formatPrice(rect.high)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Mid</span>
            <span className="text-gray-400">{formatPrice(rect.mid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Low</span>
            <span className="text-gray-200">{formatPrice(rect.low)}</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-700">No data</div>
      )}

      {/* Context metrics */}
      {(edge || slope) && (
        <div className="mt-1.5 flex gap-2 text-[10px] font-mono flex-wrap">
          {edge && (
            <span className={edge.color}>
              {edge.pct}% → {edge.label}
            </span>
          )}
          {slope && (
            <span className={slope.color}>
              {slope.arrow} {slope.label}
            </span>
          )}
        </div>
      )}

      {fsm === 'BREAKOUT_RETEST' && breakout?.level != null && (
        <div className="mt-2 p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
          <div className="text-[10px] text-amber-500 font-semibold mb-0.5">BREAKOUT ACTIVE</div>
          <div className="text-xs font-mono flex justify-between">
            <span className="text-gray-400">Level</span>
            <span className="text-amber-300">{formatPrice(breakout.level)}</span>
          </div>
          <div className="text-xs font-mono flex justify-between">
            <span className="text-gray-400">Dir</span>
            <span className={breakout.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}>
              {breakout.direction ?? '—'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 text-[10px] text-gray-700 font-mono">
        {ts ? `Updated ${formatET(ts)}` : 'No tick yet'}
      </div>
    </div>
  )
}

export default function StatePanel({ daily, weekly, candles15m = [], candles30m = [] }) {
  return (
    <div className="bg-gray-925 border border-gray-800 rounded-lg p-3">
      <div className="flex gap-4">
        <TimeframeColumn label="Daily"  state={daily}  borderColor="border-blue-600/50"   candles={candles15m} />
        <TimeframeColumn label="Weekly" state={weekly} borderColor="border-purple-600/50" candles={candles30m} />
      </div>
    </div>
  )
}
