export function formatRelativeTime(params: { ts?: number }) {
  const { ts } = params
  if (!ts) return ''
  const diffMs = Date.now() - ts
  if (diffMs < 30_000) return 'just now'
  const min = Math.floor(diffMs / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  return `${day}d`
}
