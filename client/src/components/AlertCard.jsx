import { useState } from 'react'
import { formatPrice, formatPct, formatRelativeTime, formatET } from '../utils/formatters.js'

const STRENGTH_COLOR = {
  STRONG: 'bg-green-500/15 text-green-400 border-green-500/25',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  BASIC:  'bg-gray-800 text-gray-500 border-gray-700',
}

function rVolColor(rv) {
  if (rv == null) return 'bg-gray-800 text-gray-600 border-gray-700'
  if (rv >= 2)   return 'bg-green-500/15 text-green-400 border-green-500/25'
  return 'bg-amber-500/15 text-amber-400 border-amber-500/25'
}

function distFromEdge(entry, high, low, direction) {
  const edge = direction === 'LONG' ? low : high
  if (!edge) return null
  return Math.abs((entry - edge) / edge * 100)
}

export default function AlertCard({ alert }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = alert.direction === 'LONG'
  const risk   = formatPct(alert.entryPrice, alert.stopLevel)

  return (
    <div className={`border-l-2 rounded-r-lg bg-gray-900/60 border border-l-0 border-gray-800 overflow-hidden ${
      isLong ? 'border-l-green-500' : 'border-l-red-500'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            isLong
              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
              : 'bg-red-500/15 text-red-400 border border-red-500/25'
          }`}>
            {alert.direction}
          </span>
          <span className="text-sm font-bold text-white">{alert.ticker}</span>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded uppercase tracking-wide">
            {alert.timeframe}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wide">
            {alert.strategyMode?.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-gray-600 font-mono" title={formatET(alert.timestamp)}>
            {formatRelativeTime(alert.timestamp)}
          </div>
        </div>
      </div>

      {/* Pattern + signal context chips */}
      <div className="px-3 pb-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-mono text-gray-300">{alert.patternType}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${STRENGTH_COLOR[alert.patternStrength] ?? STRENGTH_COLOR.BASIC}`}>
          {alert.patternStrength}
        </span>
        {alert.relativeVolume != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${rVolColor(alert.relativeVolume)}`}>
            {alert.relativeVolume.toFixed(1)}× vol
          </span>
        )}
        {(() => {
          const d = distFromEdge(alert.entryPrice, alert.rectangleHigh, alert.rectangleLow, alert.direction)
          return d != null ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-800 text-gray-500 border-gray-700 font-mono">
              {d.toFixed(2)}% from edge
            </span>
          ) : null
        })()}
      </div>

      {/* Price row */}
      <div className="px-3 pb-2 flex gap-4 text-xs font-mono">
        <div>
          <span className="text-gray-500">Entry </span>
          <span className="text-gray-100">{formatPrice(alert.entryPrice)}</span>
        </div>
        <div>
          <span className="text-gray-500">Stop </span>
          <span className="text-gray-100">{formatPrice(alert.stopLevel)}</span>
        </div>
        <div>
          <span className={`${isLong ? 'text-green-400' : 'text-red-400'}`}>{risk}</span>
        </div>
      </div>

      {/* Level chips */}
      <div className="px-3 pb-2 flex gap-1.5 flex-wrap text-[10px] font-mono">
        <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
          H {formatPrice(alert.rectangleHigh)}
        </span>
        <span className="bg-gray-800 text-blue-400 px-1.5 py-0.5 rounded">
          LVL {formatPrice(alert.rectangleLevel)}
        </span>
        <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
          L {formatPrice(alert.rectangleLow)}
        </span>
      </div>

      {/* Expandable reasons */}
      {alert.reasons?.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 border-t border-gray-800/50 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Hide' : 'Show'} reasons ({alert.reasons.length})
          </button>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: expanded ? `${alert.reasons.length * 24 + 8}px` : '0px' }}
          >
            <ul className="px-3 pb-2 space-y-0.5">
              {alert.reasons.map((r, i) => (
                <li key={i} className="text-[10px] text-gray-500 flex gap-1.5">
                  <span className="text-gray-700 flex-shrink-0">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
