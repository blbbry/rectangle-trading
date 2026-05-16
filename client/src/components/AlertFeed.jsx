import { useRef, useEffect, useState } from 'react'
import useStore from '../store/useStore.js'
import AlertCard from './AlertCard.jsx'

const TF_OPTIONS  = ['ALL', 'DAILY', 'WEEKLY']
const DIR_OPTIONS = ['ALL', 'LONG', 'SHORT']

export default function AlertFeed({ ticker }) {
  const allAlerts    = useStore((s) => s.alerts)
  const feedRef      = useRef(null)
  const pausedRef    = useRef(false)
  const prevLenRef   = useRef(allAlerts.length)

  const [tfFilter,      setTfFilter]      = useState('ALL')
  const [dirFilter,     setDirFilter]     = useState('ALL')
  const [patternFilter, setPatternFilter] = useState('ALL')

  // Collect unique pattern types seen in the full alert list
  const seenPatterns = ['ALL', ...new Set(allAlerts.map((a) => a.patternType).filter(Boolean))]

  // Filter alerts
  const filtered = allAlerts.filter((a) => {
    if (ticker && a.ticker !== ticker) return false
    if (tfFilter  !== 'ALL' && a.timeframe  !== tfFilter)  return false
    if (dirFilter !== 'ALL' && a.direction  !== dirFilter) return false
    if (patternFilter !== 'ALL' && a.patternType !== patternFilter) return false
    return true
  })

  // Auto-scroll to top when new alerts arrive (newest-first list)
  useEffect(() => {
    if (!pausedRef.current && allAlerts.length !== prevLenRef.current) {
      feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevLenRef.current = allAlerts.length
  }, [allAlerts.length])

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-925 border border-gray-800 rounded-lg overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 flex-shrink-0 flex-wrap">
        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mr-1">Alerts</span>
        <span className="text-[10px] text-gray-700 bg-gray-800 px-1.5 py-0.5 rounded">{filtered.length}</span>

        <FilterGroup value={tfFilter}      onChange={setTfFilter}      options={TF_OPTIONS} />
        <FilterGroup value={dirFilter}     onChange={setDirFilter}     options={DIR_OPTIONS} />
        <FilterGroup value={patternFilter} onChange={setPatternFilter} options={seenPatterns.slice(0, 6)} />
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto p-2 space-y-2"
        onMouseEnter={() => { pausedRef.current = true  }}
        onMouseLeave={() => { pausedRef.current = false }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-700 text-sm">No alerts yet</span>
          </div>
        ) : (
          filtered.map((alert, i) => (
            <AlertCard key={`${alert.timestamp}:${alert.ticker}:${alert.direction}:${i}`} alert={alert} />
          ))
        )}
      </div>
    </div>
  )
}

function FilterGroup({ value, onChange, options }) {
  return (
    <div className="flex gap-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors ${
            value === opt
              ? 'bg-gray-600 text-white'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
