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
      className="topbar-user"
      style={{ position: 'relative', flexShrink: 0 }}
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
        <span className="um-name" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{displayName}</span>
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
  const [mobileOpen, setMobileOpen] = useState(false)

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
      <div className="mobile-topbar">
        <button
          className="hamburger"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(o => !o)}
        >
          &#9776;
        </button>
        <Link to="/" className="mt-logo">rep<span>truly</span></Link>
      </div>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <Link to="/" className="sidebar-logo" title="Back to reptruly.com">
          rep<span>truly</span>
        </Link>

        <div className="sidebar-properties">
          <div className="sidebar-properties-head">
            <span className="sidebar-section-title" style={{ padding: 0 }}>
              Properties{properties.length > 0 ? ` · ${properties.length}` : ''}
            </span>
            <button className="sp-add-btn" onClick={openCreate} title="Connect a new property">
              + Add
            </button>
          </div>
          {properties.length > 0 && (
            <div className="sp-hint">Pick one to focus every page on it.</div>
          )}
          {properties.length > 1 && (
            <button
              className={`sidebar-property-btn ${selectedProperty === null ? 'active' : ''}`}
              onClick={() => { setSelectedProperty(null); setMobileOpen(false) }}
            >
              <span className="sp-avatar sp-avatar-all">⌂</span>
              <span className="sp-text">
                <span className="sp-name">All properties</span>
                <span className="sp-loc">Portfolio overview</span>
              </span>
            </button>
          )}
          {properties.map(p => {
            const otaBadges = [
              p.booking_hotel_id && 'Booking',
              p.expedia_property_id && 'Expedia',
              p.google_place_id && 'Google',
            ].filter(Boolean) as string[]
            // With a single property there is no "All properties" row, so it is the
            // implicit focus even before it's clicked.
            const isActive = selectedProperty ? selectedProperty.id === p.id : properties.length === 1
            return (
              <div key={p.id} className="sidebar-property-row">
                <button
                  className={`sidebar-property-btn ${isActive ? 'active' : ''}`}
                  onClick={() => { setSelectedProperty(p); setMobileOpen(false) }}
                >
                  <span className="sp-avatar">{p.property_name?.[0]?.toUpperCase() ?? '?'}</span>
                  <span className="sp-text">
                    <span className="sp-name">{p.property_name}</span>
                    <span className="sp-loc">
                      {p.location || (otaBadges.length ? otaBadges.join(' · ') : 'No channels yet')}
                    </span>
                  </span>
                </button>
                <div className="sp-actions">
                  <button
                    className="sp-action"
                    onClick={(e) => { e.stopPropagation(); openEdit(p) }}
                    title="Edit OTA links"
                    aria-label="Edit property"
                  >
                    ✎
                  </button>
                  <button
                    className="sp-action sp-action-danger"
                    onClick={(e) => handleRemove(p.id, p.property_name, e)}
                    title="Remove property"
                    aria-label="Remove property"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
          {properties.length === 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '8px 4px', lineHeight: 1.5 }}>
              No properties yet. Click "+ Add" to connect your first one.
            </div>
          )}
        </div>

      </aside>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <div className="workspace">
        <header className="topbar">
          <nav className="topbar-nav">
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
          <UserMenu />
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
