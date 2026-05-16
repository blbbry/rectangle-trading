import { useState, useRef, useEffect } from 'react'
import { formatPrice } from '../utils/formatters.js'

const SVG_W = 800
const SVG_H = 420
const LABEL_W = 72
const PAD = 0.06   // 6% padding above / below

function priceRange(daily, weekly, showDaily, showWeekly) {
  const rects = []
  if (showDaily  && daily?.rectangle)  rects.push(daily.rectangle)
  if (showWeekly && weekly?.rectangle) rects.push(weekly.rectangle)
  if (rects.length === 0) return null
  const low  = Math.min(...rects.map((r) => r.low))
  const high = Math.max(...rects.map((r) => r.high))
  const pad  = (high - low) * PAD
  return { low: low - pad, high: high + pad }
}

function toY(price, range) {
  if (!range) return SVG_H / 2
  return SVG_H * (1 - (price - range.low) / (range.high - range.low))
}

function RectZone({ rectangle, range, stroke, fill, dash }) {
  if (!rectangle || !range) return null
  const y1 = toY(rectangle.high, range)
  const y2 = toY(rectangle.low, range)
  const h  = Math.abs(y2 - y1)
  return (
    <>
      <rect
        x={LABEL_W} y={Math.min(y1, y2)}
        width={SVG_W - LABEL_W} height={h}
        fill={fill} stroke={stroke} strokeWidth={1.5}
        strokeDasharray={dash}
        style={{ transition: 'y 0.4s ease, height 0.4s ease' }}
      />
      {/* High line */}
      <line x1={LABEL_W} x2={SVG_W} y1={y1} y2={y1} stroke={stroke} strokeWidth={1} strokeDasharray="4 4" />
      {/* Mid line */}
      <line x1={LABEL_W} x2={SVG_W} y1={toY(rectangle.mid, range)} y2={toY(rectangle.mid, range)}
        stroke={stroke} strokeWidth={0.75} strokeOpacity={0.6} strokeDasharray="2 6" />
      {/* Low line */}
      <line x1={LABEL_W} x2={SVG_W} y1={y2} y2={y2} stroke={stroke} strokeWidth={1} strokeDasharray="4 4" />
    </>
  )
}

function PriceLabel({ price, range, color, label, align = 'left' }) {
  if (price == null || !range) return null
  const y = toY(price, range)
  const x = align === 'left' ? 4 : SVG_W - 4
  return (
    <text
      x={x} y={y - 3}
      fill={color} fontSize={9} fontFamily="monospace"
      textAnchor={align === 'left' ? 'start' : 'end'}
    >
      {label} {formatPrice(price)}
    </text>
  )
}

export default function RectangleOverlay({ daily, weekly, lastAlert }) {
  const [showDaily,  setShowDaily]  = useState(true)
  const [showWeekly, setShowWeekly] = useState(true)
  const [flashing,   setFlashing]   = useState(false)
  const prevFsmRef = useRef(null)

  const activeFsm = daily?.fsm === 'BREAKOUT_RETEST' || weekly?.fsm === 'BREAKOUT_RETEST'
    ? 'BREAKOUT_RETEST' : 'WATCHING'

  // Flash when FSM transitions to BREAKOUT_RETEST
  useEffect(() => {
    if (prevFsmRef.current !== 'BREAKOUT_RETEST' && activeFsm === 'BREAKOUT_RETEST') {
      setFlashing(true)
      setTimeout(() => setFlashing(false), 800)
    }
    prevFsmRef.current = activeFsm
  }, [activeFsm])

  const range = priceRange(daily, weekly, showDaily, showWeekly)

  const breakoutLevel = daily?.fsm  === 'BREAKOUT_RETEST' ? daily?.breakout?.level
    : weekly?.fsm === 'BREAKOUT_RETEST' ? weekly?.breakout?.level : null

  const hasData = (showDaily && daily?.rectangle) || (showWeekly && weekly?.rectangle)

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {/* Toggle buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() => setShowDaily((v) => !v)}
          className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-colors ${
            showDaily
              ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
              : 'bg-transparent border-gray-700 text-gray-600'
          }`}
        >
          DAILY
        </button>
        <button
          onClick={() => setShowWeekly((v) => !v)}
          className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-colors ${
            showWeekly
              ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
              : 'bg-transparent border-gray-700 text-gray-600'
          }`}
        >
          WEEKLY
        </button>
      </div>

      {/* SVG chart */}
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden rounded-lg border transition-all duration-300 ${
          flashing
            ? 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
            : 'border-gray-800'
        }`}
      >
        {!hasData ? (
          <div className="text-gray-600 text-sm">No rectangle data yet</div>
        ) : (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Background grid */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y = (SVG_H / 6) * (i + 1)
              return <line key={i} x1={LABEL_W} x2={SVG_W} y1={y} y2={y}
                stroke="#1f2937" strokeWidth={0.5} />
            })}

            {/* WEEKLY (behind) */}
            {showWeekly && (
              <RectZone
                rectangle={weekly?.rectangle}
                range={range}
                stroke="#a855f7"
                fill="rgba(168,85,247,0.07)"
                dash="6 3"
              />
            )}

            {/* DAILY (front) */}
            {showDaily && (
              <RectZone
                rectangle={daily?.rectangle}
                range={range}
                stroke="#3b82f6"
                fill="rgba(59,130,246,0.10)"
                dash={null}
              />
            )}

            {/* Breakout level */}
            {breakoutLevel != null && range && (
              <>
                <line
                  x1={LABEL_W} x2={SVG_W}
                  y1={toY(breakoutLevel, range)} y2={toY(breakoutLevel, range)}
                  stroke="#ef4444" strokeWidth={1.5} strokeDasharray="8 4"
                />
                <text x={SVG_W - 4} y={toY(breakoutLevel, range) - 4}
                  fill="#ef4444" fontSize={9} fontFamily="monospace" textAnchor="end">
                  BRK {formatPrice(breakoutLevel)}
                </text>
              </>
            )}

            {/* Last alert entry / stop */}
            {lastAlert?.entryPrice != null && range && (
              <line x1={LABEL_W} x2={SVG_W}
                y1={toY(lastAlert.entryPrice, range)} y2={toY(lastAlert.entryPrice, range)}
                stroke="#f9fafb" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} />
            )}

            {/* Price axis labels — DAILY */}
            {showDaily && daily?.rectangle && range && (
              <>
                <PriceLabel price={daily.rectangle.high} range={range} color="#60a5fa" label="D.H" />
                <PriceLabel price={daily.rectangle.mid}  range={range} color="#93c5fd" label="D.M" />
                <PriceLabel price={daily.rectangle.low}  range={range} color="#60a5fa" label="D.L" />
              </>
            )}

            {/* Price axis labels — WEEKLY */}
            {showWeekly && weekly?.rectangle && range && (
              <>
                <PriceLabel price={weekly.rectangle.high} range={range} color="#c084fc" label="W.H" align="right" />
                <PriceLabel price={weekly.rectangle.mid}  range={range} color="#d8b4fe" label="W.M" align="right" />
                <PriceLabel price={weekly.rectangle.low}  range={range} color="#c084fc" label="W.L" align="right" />
              </>
            )}

            {/* Left axis border */}
            <line x1={LABEL_W} x2={LABEL_W} y1={0} y2={SVG_H} stroke="#374151" strokeWidth={0.5} />
          </svg>
        )}
      </div>
    </div>
  )
}
