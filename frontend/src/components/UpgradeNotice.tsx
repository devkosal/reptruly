import { Link } from 'react-router-dom'

/**
 * Rendered when the API returns 402 (plan entitlement block).
 * Shows the server's message plus an upgrade call-to-action.
 */
export default function UpgradeNotice({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      background: 'var(--accent-soft)',
      border: '1px solid #dcdffc', borderRadius: 12, padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>✨</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Pro feature</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{message}</div>
        </div>
      </div>
      <Link
        to="/settings"
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0, textDecoration: 'none' }}
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}

/** True when a fetch Response was blocked by plan entitlements. */
export function isUpgradeBlocked(status: number): boolean {
  return status === 402
}
