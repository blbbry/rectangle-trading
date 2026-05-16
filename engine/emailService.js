import nodemailer from 'nodemailer'

const COOLDOWN_MS = parseInt(process.env.EMAIL_COOLDOWN_MS || '600000', 10)  // default 10 min

function buildTransport() {
  const host = process.env.EMAIL_HOST
  if (!host) return null

  if (host === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

function gradeBar(score) {
  const filled = Math.round((score / 100) * 20)
  return '█'.repeat(filled) + '░'.repeat(20 - filled) + ` ${score}/100`
}

function extensionRisk(price, ema20) {
  if (ema20 == null) return 'N/A'
  const pct = ((price - ema20) / ema20) * 100
  if (pct > 15) return `HIGH  (+${pct.toFixed(1)}% above EMA 20)`
  if (pct > 8)  return `MODERATE  (+${pct.toFixed(1)}% above EMA 20)`
  return `LOW  (+${pct.toFixed(1)}% above EMA 20)`
}

function emaPct(price, ema, label) {
  if (ema == null) return `${label}: N/A`
  const pct = ((price - ema) / ema * 100).toFixed(2)
  const sign = pct >= 0 ? '+' : ''
  return `${label}: $${ema.toFixed(4)}  (${sign}${pct}%)`
}

export function startEmailService(engine) {
  const transport = buildTransport()
  const cooldowns = new Map()

  if (!transport) {
    console.log('[Email] No EMAIL_HOST set — email alerts disabled')
    return
  }

  engine.on('email_trigger', async ({ ticker, strategy, grade, score, trendStrength,
    price, open, high, low, ema9, ema20, rsiFast, rsiSlow, overextended, lastTransition }) => {

    const last = cooldowns.get(ticker) ?? 0
    if (Date.now() - last < COOLDOWN_MS) {
      console.log(`[Email] ${ticker} on cooldown, skipping`)
      return
    }
    cooldowns.set(ticker, Date.now())

    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
    const to   = process.env.EMAIL_TO   || from

    const trendLabel = ['WEAK', 'MODERATE', 'STRONG', 'VERY STRONG', 'STRONG'][Math.min(trendStrength ?? 0, 4)]
    const trendFlags = `${trendStrength ?? 0}/4 conditions met`
    const stopRef    = ema9 != null ? `$${ema9.toFixed(4)} (9 EMA)` : 'N/A'
    const rsiBias    = rsiFast > rsiSlow ? 'Fast > Slow (bullish momentum)' : 'Fast ≤ Slow'

    const subject = `📈 [SWING] ${ticker} — Grade ${grade} (${score}/100)`
    const text = [
      `╔══════════════════════════════════════════╗`,
      `║  Momentum Pullback Continuation System  ║`,
      `╚══════════════════════════════════════════╝`,
      ``,
      `  Ticker:      ${ticker}`,
      `  Grade:       ${grade}  (score: ${score}/100)`,
      `  Confidence:  ${gradeBar(score)}`,
      `  Strategy:    Momentum Pullback Continuation`,
      ``,
      `── Trend ──────────────────────────────────────`,
      `  Daily Trend: ${trendLabel} (${trendFlags})`,
      `  EMA Align:   ${ema9 != null && ema20 != null && ema9 > ema20 ? '9 EMA > 20 EMA ✓ (bullish)' : '9 EMA < 20 EMA (caution)'}`,
      `  Ext. Risk:   ${overextended ? '⚠ EXTENDED' : extensionRisk(price, ema20)}`,
      ``,
      `── Price Action ────────────────────────────────`,
      `  Current:     $${price}`,
      `  O/H/L/C:     $${open} / $${high} / $${low} / $${price}`,
      ``,
      `── EMA Levels ──────────────────────────────────`,
      `  ${emaPct(price, ema9,  '9 EMA ')}`,
      `  ${emaPct(price, ema20, '20 EMA')}`,
      ``,
      `── RSI ─────────────────────────────────────────`,
      `  RSI Fast  (7):  ${rsiFast}`,
      `  RSI Slow (14):  ${rsiSlow}`,
      `  RSI Bias:       ${rsiBias}`,
      ``,
      `── Risk Reference ──────────────────────────────`,
      `  Stop Reference: ${stopRef}`,
      `  Hold Target:    1–3 days (PDT-friendly swing)`,
      ``,
      `── Meta ────────────────────────────────────────`,
      `  Signal Time: ${new Date(lastTransition).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
      ``,
      `Grade ${grade} = ${grade === 'A+' ? 'highest-confidence setup' : grade === 'A' ? 'high-quality setup' : 'tradable setup — review carefully'}`,
    ].join('\n')

    try {
      await transport.sendMail({ from, to, subject, text })
      console.log(`[Email] Sent swing alert for ${ticker} (${grade} ${score}/100) to ${to}`)
    } catch (err) {
      console.error(`[Email] Failed to send for ${ticker}:`, err.message)
    }
  })

  console.log('[Email] Email alert service started')
}

export function startRectangleEmailService(engine) {
  const transport = buildTransport()
  const cooldowns = new Map()

  if (!transport) return  // EMAIL_HOST not set — silently skip

  engine.on('alert', async (payload) => {
    const { ticker, strategyMode, timeframe, direction,
            rectangleHigh, rectangleLow, rectangleLevel,
            entryPrice, stopLevel, patternType, patternStrength,
            reasons, timestamp } = payload

    const key  = `${ticker}:${timeframe}:${strategyMode}`
    const last = cooldowns.get(key) ?? 0
    if (Date.now() - last < COOLDOWN_MS) return
    cooldowns.set(key, Date.now())

    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
    const to   = process.env.EMAIL_TO   || from
    const dir  = direction === 'LONG' ? '🟢 LONG' : '🔴 SHORT'

    const subject = `[RECT] ${ticker} ${timeframe} — ${strategyMode} ${direction}`
    const text = [
      `╔══════════════════════════════════════════╗`,
      `║       Rectangle Range Alert System       ║`,
      `╚══════════════════════════════════════════╝`,
      ``,
      `  Ticker:      ${ticker}`,
      `  Timeframe:   ${timeframe}`,
      `  Signal:      ${strategyMode}`,
      `  Direction:   ${dir}`,
      ``,
      `── Rectangle ───────────────────────────────`,
      `  High:        $${rectangleHigh.toFixed(4)}`,
      `  Low:         $${rectangleLow.toFixed(4)}`,
      `  Level:       $${rectangleLevel.toFixed(4)}`,
      ``,
      `── Trade ───────────────────────────────────`,
      `  Entry:       $${entryPrice.toFixed(4)}`,
      `  Stop:        $${stopLevel.toFixed(4)}`,
      ``,
      `── Pattern ─────────────────────────────────`,
      `  Type:        ${patternType}`,
      `  Strength:    ${patternStrength}`,
      ``,
      `── Reasons ─────────────────────────────────`,
      ...reasons.map(r => `  • ${r}`),
      ``,
      `── Meta ────────────────────────────────────`,
      `  Signal Time: ${new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
    ].join('\n')

    try {
      await transport.sendMail({ from, to, subject, text })
      console.log(`[Email] Sent rectangle alert: ${ticker} ${timeframe} ${strategyMode} ${direction}`)
    } catch (err) {
      console.error(`[Email] Failed to send rectangle alert for ${ticker}:`, err.message)
    }
  })

  console.log('[Email] Rectangle email alert service started')
}
