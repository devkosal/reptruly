export type SyncDomain = 'reviews' | 'rates' | 'calendar' | 'analytics'
export type SyncState = 'idle' | 'running' | 'success' | 'failed'

export interface SyncStatusRow {
  domain: SyncDomain
  status: SyncState
  last_synced_at: string | null
  last_started_at: string | null
  last_duration_ms: number | null
  last_record_count: number
  last_error: string
}

export async function fetchAllSyncStatus(): Promise<SyncStatusRow[]> {
  const res = await fetch('/api/sync/status', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to load sync status (${res.status})`)
  return res.json()
}

export async function fetchSyncStatus(domain: SyncDomain): Promise<SyncStatusRow> {
  const res = await fetch(`/api/sync/status/${domain}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to load ${domain} sync status (${res.status})`)
  return res.json()
}

export async function triggerSync(domain: SyncDomain): Promise<{ queued: boolean; task_id: string | null }> {
  const res = await fetch(`/api/sync/${domain}/run`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Failed to trigger ${domain} sync (${res.status})`)
  return res.json()
}

export function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'never'
  const diffMs = Date.now() - t
  if (diffMs < 0) return 'just now'
  const m = Math.floor(diffMs / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

export function formatAbsolute(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}
