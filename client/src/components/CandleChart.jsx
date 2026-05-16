import { useState, useRef, useEffect, useMemo } from 'react'
import { formatPrice } from '../utils/formatters.js'

// ─── Layout constants ────────────────────────────────────────────────────────
const PRICE_AXIS_W  = 70
const TIME_AXIS_H   = 22
const VOL_PANE_FRAC = 0.15   // bottom 15% of chart reserved for volume bars
const MIN_CANDLE_W  = 3
const MAX_CANDLE_W  = 18
const DEFAULT_VISIBLE = 60   // candles shown on load

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }

function priceToY(price, lo, hi, chartH) {
  if (hi === lo) return chartH / 2
  return chartH * (1 - (price - lo) / (hi - lo))
}

function timeLabel(ts) {
  if (!ts) return ''
  const d = new Date(typeof ts === 'number' ? ts : ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

function niceStep(range, targetTicks = 6) {
  const raw = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const steps = [1, 2, 2.5, 5, 10]
  const step = steps.find((s) => s * mag >= raw) ?? 10
  return step * mag
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RectBand({ lo, hi, chartH, chartW, color, fill, dash }) {
  const y1 = priceToY(hi, lo, hi + (hi - lo), chartH)
  // We receive the price range externally and map manually
  return null  // rendered inline in main SVG with correct scale
}

function PriceGrid({ priceMin, priceMax, chartH, chartW }) {
  const step   = niceStep(priceMax - priceMin)
  const first  = Math.ceil(priceMin / step) * step
  const lines  = []
  for (let p = first; p <= priceMax + step * 0.01; p += step) {
    if (p < priceMin || p > priceMax) continue
    const y = priceToY(p, priceMin, priceMax, chartH)
    lines.push(
      <g key={p}>
        <line x1={0} x2={chartW} y1={y} y2={y} stroke="#1f2937" strokeWidth={0.5} />
        <text x={chartW + 4} y={y + 3.5} fill="#4b5563" fontSize={9} fontFamily="monospace">
          {formatPrice(p)}
        </text>
      </g>
    )
  }
  return <>{lines}</>
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function CandleChart({ candles15m = [], candles30m = [], ema9 = [], ema20 = [], daily, weekly }) {
  const containerRef  = useRef(null)
  const [dims, setDims] = useState({ w: 800, h: 420 })
  const [visibleEnd, setVisibleEnd]     = useState(null)  // null = latest
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const [showDaily,  setShowDaily]  = useState(true)
  const [showWeekly, setShowWeekly] = useState(true)
  const [showEma,    setShowEma]    = useState(true)

  // Active candle series: 30m when only weekly is shown, otherwise 15m
  const candles = (!showDaily && showWeekly && candles30m.length) ? candles30m : candles15m

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const chartW   = dims.w - PRICE_AXIS_W
  const chartH   = dims.h - TIME_AXIS_H
  const volPaneH = chartH * VOL_PANE_FRAC
  const priceH   = chartH * (1 - VOL_PANE_FRAC)  // price candles live in top portion

  // Reset visible window when candle series changes
  const candleLen = candles.length
  useEffect(() => { setVisibleEnd(null) }, [candleLen])

  // Slice visible candles
  const visible = useMemo(() => {
    if (!candles.length) return []
    const end   = visibleEnd ?? candles.length
    const start = Math.max(0, end - visibleCount)
    return candles.slice(start, end)
  }, [candles, visibleEnd, visibleCount])

  const visibleEma9  = useMemo(() => {
    if (!ema9.length || !candles.length) return []
    const end   = visibleEnd ?? candles.length
    const start = Math.max(0, end - visibleCount)
    return ema9.slice(start, end)
  }, [ema9, candles.length, visibleEnd, visibleCount])

  const visibleEma20 = useMemo(() => {
    if (!ema20.length || !candles.length) return []
    const end   = visibleEnd ?? candles.length
    const start = Math.max(0, end - visibleCount)
    return ema20.slice(start, end)
  }, [ema20, candles.length, visibleEnd, visibleCount])

  // Price range from visible candles + rectangle zones
  const { priceMin, priceMax } = useMemo(() => {
    const prices = []
    visible.forEach((c) => { prices.push(c.high, c.low) })
    if (showDaily  && daily?.rectangle)  prices.push(daily.rectangle.high,  daily.rectangle.low)
    if (showWeekly && weekly?.rectangle) prices.push(weekly.rectangle.high, weekly.rectangle.low)
    if (!prices.length) return { priceMin: 0, priceMax: 1 }
    const lo = Math.min(...prices)
    const hi = Math.max(...prices)
    const pad = (hi - lo) * 0.04
    return { priceMin: lo - pad, priceMax: hi + pad }
  }, [visible, daily, weekly, showDaily, showWeekly])

  // Candle geometry
  const candleW = clamp(chartW / Math.max(visible.length, 1) * 0.75, MIN_CANDLE_W, MAX_CANDLE_W)
  const colW    = chartW / Math.max(visible.length, 1)

  // EMA polyline points (mapped into price pane = top priceH pixels)
  function emaPoints(arr) {
    return arr
      .map((v, i) => v == null ? null : `${colW * i + colW / 2},${priceToY(v, priceMin, priceMax, priceH)}`)
      .filter(Boolean)
      .join(' ')
  }

  // Volume bar heights for visible candles
  const maxVol = useMemo(
    () => Math.max(...visible.map(c => c.volume || 0), 1),
    [visible]
  )

  // Scroll wheel: zoom in/out
  function onWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 10 : -10
    setVisibleCount((n) => clamp(n + delta, 10, Math.max(candles.length, 10)))
  }

  // Time axis labels (show ~6 evenly spaced)
  const timeLabels = useMemo(() => {
    if (!visible.length) return []
    const step = Math.max(1, Math.floor(visible.length / 6))
    return visible
      .map((c, i) => ({ i, label: timeLabel(c.timestamp) }))
      .filter((_, i) => i % step === 0)
  }, [visible])

  // Rectangle band helper — maps into price pane
  function rectBand(rect, stroke, fill, dash) {
    if (!rect) return null
    const y1 = priceToY(rect.high, priceMin, priceMax, priceH)
    const y2 = priceToY(rect.low,  priceMin, priceMax, priceH)
    const midY = priceToY(rect.mid, priceMin, priceMax, priceH)
    const h  = Math.abs(y2 - y1)
    return (
      <g>
        <rect x={0} y={Math.min(y1, y2)} width={chartW} height={h}
          fill={fill} stroke={stroke} strokeWidth={1} strokeDasharray={dash} />
        <line x1={0} x2={chartW} y1={midY} y2={midY}
          stroke={stroke} strokeWidth={0.5} strokeOpacity={0.5} strokeDasharray="3 5" />
      </g>
    )
  }

  // Breakout level
  const breakoutLevel = daily?.fsm === 'BREAKOUT_RETEST' ? daily?.breakout?.level
    : weekly?.fsm === 'BREAKOUT_RETEST' ? weekly?.breakout?.level : null

  return (
    <div ref={containerRef} className="relative w-full h-full select-none">
      {/* Toggle buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        {[
          { label: 'DAILY',  active: showDaily,  toggle: () => setShowDaily((v) => !v),  style: 'blue' },
          { label: 'WEEKLY', active: showWeekly, toggle: () => setShowWeekly((v) => !v), style: 'purple' },
          { label: 'EMA',    active: showEma,    toggle: () => setShowEma((v) => !v),    style: 'yellow' },
        ].map(({ label, active, toggle, style }) => (
          <button key={label} onClick={toggle}
            className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-colors ${
              active
                ? style === 'blue'   ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                : style === 'purple' ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                :                      'bg-yellow-600/20 border-yellow-500/40 text-yellow-300'
                : 'bg-transparent border-gray-700 text-gray-600'
            }`}>
            {label}
          </button>
        ))}
        <span className="text-[10px] text-gray-600 ml-1 self-center">
          {(!showDaily && showWeekly) ? '30m' : '15m'} · scroll to zoom
        </span>
      </div>

      {!candles.length && !daily?.rectangle && !weekly?.rectangle ? (
        <div className="flex items-center justify-center h-full text-gray-700 text-sm">
          Waiting for data…
        </div>
      ) : (
        <svg
          width={dims.w} height={dims.h}
          onWheel={onWheel}
          style={{ cursor: 'crosshair' }}
        >
          {/* Clip paths */}
          <defs>
            <clipPath id="chart-clip">
              <rect x={0} y={0} width={chartW} height={priceH} />
            </clipPath>
            <clipPath id="vol-clip">
              <rect x={0} y={priceH} width={chartW} height={volPaneH} />
            </clipPath>
          </defs>

          {/* No-candles notice — rectangles still render */}
          {!candles.length && (
            <text x={chartW / 2} y={priceH / 2} textAnchor="middle"
              fill="#374151" fontSize={11} fontFamily="monospace">
              Zones from prior session — candles load at market open
            </text>
          )}

          {/* ── Price pane ── */}
          <g clipPath="url(#chart-clip)">
            <PriceGrid priceMin={priceMin} priceMax={priceMax} chartH={priceH} chartW={chartW} />

            {showWeekly && rectBand(weekly?.rectangle, '#a855f7', 'rgba(168,85,247,0.06)', '5 3')}
            {showDaily  && rectBand(daily?.rectangle,  '#3b82f6', 'rgba(59,130,246,0.08)', null)}

            {breakoutLevel != null && (() => {
              const y = priceToY(breakoutLevel, priceMin, priceMax, priceH)
              return (
                <g>
                  <line x1={0} x2={chartW} y1={y} y2={y}
                    stroke="#ef4444" strokeWidth={1.5} strokeDasharray="8 4" />
                  <text x={4} y={y - 3} fill="#ef4444" fontSize={9} fontFamily="monospace">
                    BRK {formatPrice(breakoutLevel)}
                  </text>
                </g>
              )
            })()}

            {showEma && visibleEma9.length > 0 && (
              <polyline points={emaPoints(visibleEma9)}
                fill="none" stroke="#fbbf24" strokeWidth={1} strokeOpacity={0.8} />
            )}
            {showEma && visibleEma20.length > 0 && (
              <polyline points={emaPoints(visibleEma20)}
                fill="none" stroke="#f97316" strokeWidth={1} strokeOpacity={0.8} />
            )}

            {visible.map((c, i) => {
              const x      = colW * i + colW / 2
              const openY  = priceToY(c.open,  priceMin, priceMax, priceH)
              const closeY = priceToY(c.close, priceMin, priceMax, priceH)
              const highY  = priceToY(c.high,  priceMin, priceMax, priceH)
              const lowY   = priceToY(c.low,   priceMin, priceMax, priceH)
              const bull   = c.close >= c.open
              const color  = bull ? '#22c55e' : '#ef4444'
              const bodyY  = Math.min(openY, closeY)
              const bodyH  = Math.max(1, Math.abs(closeY - openY))
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={1} />
                  <rect x={x - candleW / 2} y={bodyY} width={candleW} height={bodyH}
                    fill={color} fillOpacity={bull ? 0.85 : 1} stroke={color} strokeWidth={0.5} />
                </g>
              )
            })}
          </g>

          {/* ── Volume pane ── */}
          <g clipPath="url(#vol-clip)">
            <line x1={0} x2={chartW} y1={priceH} y2={priceH} stroke="#1f2937" strokeWidth={0.5} />
            {visible.map((c, i) => {
              const bull   = c.close >= c.open
              const barH   = ((c.volume || 0) / maxVol) * (volPaneH - 2)
              const x      = colW * i + colW / 2
              return (
                <rect key={i}
                  x={x - candleW / 2} y={priceH + volPaneH - barH}
                  width={candleW} height={barH}
                  fill={bull ? '#22c55e' : '#ef4444'} fillOpacity={0.4}
                />
              )
            })}
          </g>

          {/* Price axis (right) */}
          <g transform={`translate(${chartW}, 0)`}>
            <line x1={0} x2={0} y1={0} y2={priceH} stroke="#374151" strokeWidth={0.5} />
            <PriceGrid priceMin={priceMin} priceMax={priceMax} chartH={priceH} chartW={0} />
          </g>

          {/* Time axis (bottom of price pane) */}
          <g transform={`translate(0, ${chartH})`}>
            <line x1={0} x2={chartW} y1={0} y2={0} stroke="#374151" strokeWidth={0.5} />
            {timeLabels.map(({ i, label }) => (
              <text key={i}
                x={colW * i + colW / 2} y={14}
                fill="#4b5563" fontSize={9} fontFamily="monospace" textAnchor="middle">
                {label}
              </text>
            ))}
          </g>

          {/* EMA legend */}
          {showEma && (
            <g transform={`translate(8, ${priceH - 20})`}>
              <rect width={6} height={2} y={0} fill="#fbbf24" />
              <text x={10} y={3} fill="#fbbf24" fontSize={8} fontFamily="monospace">EMA 9</text>
              <rect width={6} height={2} y={10} fill="#f97316" />
              <text x={10} y={13} fill="#f97316" fontSize={8} fontFamily="monospace">EMA 20</text>
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
