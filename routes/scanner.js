import { Router } from 'express'
import { runScan } from '../scanner/runScan.js'
import { DEFAULT_TICKERS } from '../config/tickers.js'

const router = Router()

// Scan the default watchlist — no body needed
router.get('/scan', async (req, res) => {
  try {
    const signals = await runScan(DEFAULT_TICKERS)
    res.json({
      scannedAt: new Date().toISOString(),
      count: DEFAULT_TICKERS.length,
      signals,
    })
  } catch (err) {
    res.status(500).json({ error: 'scan failed', detail: err.message })
  }
})

router.post('/scan', async (req, res) => {
  const { tickers } = req.body

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: 'tickers must be a non-empty array' })
  }
  if (tickers.length > 50) {
    return res.status(400).json({ error: 'maximum 50 tickers per request' })
  }

  const normalized = tickers.map(t => String(t).toUpperCase().trim()).filter(Boolean)
  if (normalized.length === 0) {
    return res.status(400).json({ error: 'no valid tickers provided' })
  }

  try {
    const signals = await runScan(normalized)
    res.json({
      scannedAt: new Date().toISOString(),
      count: normalized.length,
      signals,
    })
  } catch (err) {
    res.status(500).json({ error: 'scan failed', detail: err.message })
  }
})

export default router
