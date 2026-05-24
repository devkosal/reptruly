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
  const dotColor = failed ? '#ef4444' : running ? '#f59e0b' : '#10b981'
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
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid #f3e8ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      backdropFilter: 'blur(6px)',
      boxShadow: '0 1px 3px rgba(168,85,247,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: dotColor,
          boxShadow: `0 0 0 4px ${dotColor}22`,
          animation: running ? 'sync-pulse 1.4s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#7c3aed',
          }}>
            {DOMAIN_LABEL[domain]} sync
          </div>
          <div style={{ fontSize: 13, color: '#1f2937', fontWeight: 600, marginTop: 1 }}>
            {statusLabel}
            {row?.last_synced_at && !running && (
              <span style={{ color: '#6b7280', fontWeight: 500, marginLeft: 6 }}>
                · {formatAbsolute(row.last_synced_at)}
              </span>
            )}
          </div>
          {failed && row?.last_error && (
            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3 }}>
              {row.last_error.slice(0, 200)}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3 }}>{error}</div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onForceSync}
        disabled={running}
        style={{
          background: running
            ? '#f3f4f6'
            : 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          color: running ? '#9ca3af' : '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.02em',
          cursor: running ? 'wait' : 'pointer',
          boxShadow: running ? 'none' : '0 3px 10px rgba(168,85,247,0.3)',
          flexShrink: 0,
        }}
      >
        {running ? 'Syncing…' : actionLabel || `Sync ${DOMAIN_LABEL[domain].toLowerCase()} now`}
      </button>
      <style>{`@keyframes sync-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
