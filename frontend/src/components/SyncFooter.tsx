import { useCallback, useEffect, useState } from 'react'
import {
  SyncDomain, SyncStatusRow, fetchSyncStatus, formatAbsolute, formatRelative, triggerSync,
} from '../api/sync'

interface SyncFooterProps {
  domain: SyncDomain
  /** Optional label used in the action button (e.g. "Refresh reviews"). */
  actionLabel?: string
}

const DOMAIN_LABEL: Record<SyncDomain, string> = {
  reviews: 'Reviews',
  rates: 'Rates',
  calendar: 'Calendar',
  analytics: 'Analytics',
}

export default function SyncFooter({ domain, actionLabel }: SyncFooterProps) {
  const [row, setRow] = useState<SyncStatusRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [pollUntil, setPollUntil] = useState<number>(0)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRow(await fetchSyncStatus(domain))
    } catch (e: any) {
      setError(e.message || 'Failed to load sync status')
    }
  }, [domain])

  useEffect(() => { load() }, [load])

  // After a force-sync we poll every 2s for up to 60s, until the status
  // changes from running back to a terminal state.
  useEffect(() => {
    if (!pollUntil) return
    const t = setInterval(async () => {
      await load()
      if (Date.now() > pollUntil) {
        setPollUntil(0)
      }
    }, 2000)
    return () => clearInterval(t)
  }, [pollUntil, load])

  useEffect(() => {
    if (row?.status !== 'running' && pollUntil && Date.now() > pollUntil - 50_000) {
      setPollUntil(0)
    }
  }, [row?.status, pollUntil])

  async function onForceSync() {
    setBusy(true)
    setError('')
    try {
      await triggerSync(domain)
      setPollUntil(Date.now() + 60_000)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to start sync')
    } finally {
      setBusy(false)
    }
  }

  const running = row?.status === 'running' || busy
  const failed = row?.status === 'failed'
  const dotColor = failed ? 'var(--bad)' : running ? 'var(--warn)' : 'var(--good)'
  const dotGlow = failed ? 'rgba(225,29,72,0.15)' : running ? 'rgba(217,119,6,0.15)' : 'rgba(5,150,105,0.15)'
  const statusLabel = failed
    ? 'Last sync failed'
    : running
      ? 'Syncing now…'
      : `Updated ${formatRelative(row?.last_synced_at || null)}`

  return (
    <div style={{
      marginTop: 24,
      padding: '14px 18px',
      borderRadius: 14,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: dotColor,
          boxShadow: `0 0 0 4px ${dotGlow}`,
          animation: running ? 'sync-pulse 1.4s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}>
            {DOMAIN_LABEL[domain]} sync
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 1 }}>
            {statusLabel}
            {row?.last_synced_at && !running && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>
                · {formatAbsolute(row.last_synced_at)}
              </span>
            )}
          </div>
          {failed && row?.last_error && (
            <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 3 }}>
              {row.last_error.slice(0, 200)}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 3 }}>{error}</div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onForceSync}
        disabled={running}
        className={running ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
        style={{ cursor: running ? 'wait' : 'pointer', flexShrink: 0 }}
      >
        {running ? 'Syncing…' : actionLabel || `Sync ${DOMAIN_LABEL[domain].toLowerCase()} now`}
      </button>
      <style>{`@keyframes sync-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
