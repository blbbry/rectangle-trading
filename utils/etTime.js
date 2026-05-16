// DST-correct ET timezone helpers using Intl.DateTimeFormat.
// The old UTC-4 hardcoded offset breaks during EST months (Nov–Mar, UTC-5).

export function getETDate(ms) {
  // en-CA locale produces YYYY-MM-DD format directly
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ms))
}

export function isRegularSession(date) {
  if (!date) return false
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(date)
  const h = parseInt(parts.find(p => p.type === 'hour').value)
  const m = parseInt(parts.find(p => p.type === 'minute').value)
  const mins = h * 60 + m
  return mins >= 570 && mins < 960  // 9:30–16:00 ET
}
