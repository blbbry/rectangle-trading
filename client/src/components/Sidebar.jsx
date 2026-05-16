import useStore from '../store/useStore.js'
import TickerRow from './TickerRow.jsx'

// Ordered category groups matching config/tickers.js
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

export default function Sidebar({ onClose }) {
  const connected   = useStore((s) => s.connected)
  const alertCount  = useStore((s) => s.alerts.length)

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
              {alertCount} alert{alertCount !== 1 ? 's' : ''}
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

      {/* Ticker list */}
      <div className="flex-1 overflow-y-auto py-1">
        {CATEGORIES.map(({ label, tickers }) => (
          <div key={label}>
            <div className="px-3 pt-3 pb-1">
              <span className="text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                {label}
              </span>
            </div>
            {tickers.map((ticker) => (
              <TickerRow key={ticker} ticker={ticker} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
