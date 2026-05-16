import { useEffect, useState } from 'react'
import { connect, disconnect } from './services/websocket.js'
import useStore from './store/useStore.js'
import Sidebar from './components/Sidebar.jsx'
import ChartPanel from './components/ChartPanel.jsx'

export default function App() {
  const connected = useStore((s) => s.connected)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100 font-mono">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-30 md:z-auto h-full flex-shrink-0
          w-64 bg-gray-925 border-r border-gray-800
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-925 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 rounded text-gray-400 hover:text-gray-200"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-semibold tracking-widest text-gray-300 uppercase">
              Rectangle Range
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}
            />
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
        </header>

        {/* Chart area */}
        <main className="flex-1 overflow-hidden">
          <ChartPanel />
        </main>
      </div>
    </div>
  )
}
