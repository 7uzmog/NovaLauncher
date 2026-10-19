export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`.replace('.', ',')
}

export function formatSpeed(bps: number): string {
  return bps > 0 ? `${formatBytes(bps)}/s` : '—'
}

export function formatEta(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return ''
  if (seconds < 60) return `${Math.ceil(seconds)} s restantes`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min restantes`
  return `${Math.floor(m / 60)} h ${m % 60} min restantes`
}

export function formatPlayTime(seconds?: number): string {
  if (!seconds) return 'Jamais joué'
  if (seconds < 60) return "Moins d'une minute"
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${(m / 60).toFixed(1).replace('.', ',')} h`
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatRelative(iso?: string): string {
  if (!iso) return 'Jamais'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "À l'instant"
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 30) return `Il y a ${Math.floor(diff / 86400)} j`
  return formatDate(iso)
}
