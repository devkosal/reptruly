import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Property, useProperty } from '../context/PropertyContext'

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  dashboard: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10',
  reviews: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  rates: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  analytics: 'M18 20V10M12 20V4M6 20v-6',
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking anywhere outside this menu.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  if (!user) return null
  const initial = user.name?.[0]?.toUpperCase() ?? user.username?.[0]?.toUpperCase() ?? 'U'
  const displayName = user.name || user.username

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: 16, right: 24, zIndex: 100 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '5px 12px 5px 5px',
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          font: 'inherit',
        }}
      >
        <span style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--grad-accent)',
          color: '#fff', fontWeight: 700, fontSize: 13,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{initial}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{displayName}</span>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 220,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
          </div>
          <MenuItem icon="👤" label="Profile" onClick={() => go('/profile')} />
          <MenuItem icon="⚙️" label="Settings" onClick={() => go('/settings')} />
          <div style={{ height: 1, background: 'var(--border)' }} />
          <MenuItem icon="↩" label="Log out" onClick={handleLogout} danger />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon, label, onClick, danger = false,
}: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '10px 14px',
        background: 'var(--surface)', border: 'none', cursor: 'pointer',
        font: 'inherit', textAlign: 'left',
        fontSize: 13, fontWeight: 500,
        color: danger ? 'var(--bad)' : 'var(--text)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'var(--bad-soft)' : 'var(--surface-2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
    >
      <span style={{ width: 18, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { properties, selectedProperty, setSelectedProperty, removeProperty } = useProperty()
  const navigate = useNavigate()

  // Add / edit now live on the dedicated /connect-property page.
  function openCreate() {
    navigate('/connect-property')
  }

  function openEdit(p: Property) {
    navigate(`/connect-property?edit=${encodeURIComponent(p.id)}`)
  }

  async function handleRemove(id: string, name: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (!confirm(`Remove "${name}" and its synced reviews?`)) return
    try {
      await removeProperty(id)
    } catch (err: any) {
      alert(err.message || 'Could not remove property')
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo" title="Back to reptruly.com">
          rep<span>truly</span>
        </Link>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            <NavIcon d={ICONS.dashboard} /> Dashboard
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => isActive ? 'active' : ''}>
            <NavIcon d={ICONS.reviews} /> Reviews
          </NavLink>
          <NavLink to="/rates" className={({ isActive }) => isActive ? 'active' : ''}>
            <NavIcon d={ICONS.rates} /> Rates
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
            <NavIcon d={ICONS.calendar} /> Demand Calendar
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
            <NavIcon d={ICONS.analytics} /> Analytics
          </NavLink>
        </nav>

        <div className="sidebar-properties">
          <div className="sidebar-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>Properties</span>
            <button
              onClick={openCreate}
              title="Connect a new property"
              style={{
                background: 'rgba(129,140,248,0.15)',
                border: '1px solid rgba(129,140,248,0.4)',
                color: '#c7d2fe',
                borderRadius: 7,
                padding: '3px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.15)'; e.currentTarget.style.color = '#c7d2fe' }}
            >
              + Add
            </button>
          </div>
          {properties.length > 0 && (
            <button
              className={`sidebar-property-btn ${selectedProperty === null ? 'active' : ''}`}
              onClick={() => setSelectedProperty(null)}
            >
              <span className="sp-dot" />
              All Properties
            </button>
          )}
          {properties.map(p => {
            const otaBadges = [
              p.booking_hotel_id && 'B',
              p.expedia_property_id && 'E',
              p.google_place_id && 'G',
            ].filter(Boolean) as string[]
            const isActive = selectedProperty?.id === p.id
            return (
              <div
                key={p.id}
                className="sidebar-property-row"
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
              >
                <button
                  className={`sidebar-property-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedProperty(p)}
                  style={{ flex: '1 1 auto', minWidth: 0 }}
                >
                  <span className="sp-dot" />
                  <span className="sp-name">{p.property_name}</span>
                  <span className="sp-loc">
                    {p.location || `${otaBadges.join(' · ')}`}
                  </span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(p) }}
                  title="Edit OTA links"
                  aria-label="Edit property"
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.55)',
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => handleRemove(p.id, p.property_name, e)}
                  title="Remove property"
                  aria-label="Remove property"
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.55)',
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontSize: 13,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bad)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--bad)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                >
                  ×
                </button>
              </div>
            )
          })}
          {properties.length === 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '8px 4px' }}>
              No properties yet. Click "+ Add" to connect one.
            </div>
          )}
        </div>

      </aside>
      <UserMenu />
      <main className="main">{children}</main>

    </div>
  )
}
