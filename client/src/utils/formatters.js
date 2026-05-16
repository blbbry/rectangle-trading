export function formatPrice(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function formatPct(a, b) {
  if (a == null || b == null || b === 0) return '—'
  const pct = ((a - b) / b) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function formatRelativeTime(ts) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  if (diff < 10_000)   return 'just now'
  if (diff < 60_000)   return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86400_000)}d ago`
}

export function formatET(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' ET'
}
