import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Property, useProperty } from '../context/PropertyContext'

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
          padding: '6px 14px 6px 6px',
          borderRadius: 999,
          border: '1px solid #e5e7eb',
          background: '#fff',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          font: 'inherit',
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
          color: '#fff', fontWeight: 700, fontSize: 14,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{initial}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{displayName}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 220,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{user.email}</div>
          </div>
          <MenuItem icon="👤" label="Profile" onClick={() => go('/profile')} />
          <MenuItem icon="⚙️" label="Settings" onClick={() => go('/settings')} />
          <div style={{ height: 1, background: '#f3f4f6' }} />
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
        background: '#fff', border: 'none', cursor: 'pointer',
        font: 'inherit', textAlign: 'left',
        fontSize: 13, fontWeight: 500,
        color: danger ? '#b91c1c' : '#1a1a2e',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? '#fef2f2' : '#f9fafb' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
    >
      <span style={{ width: 18, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )
}

type ModalMode = 'create' | 'edit'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { properties, selectedProperty, setSelectedProperty, addProperty, updateProperty, removeProperty } = useProperty()

  // Modal state — shared between create and edit
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)

  // Form fields
  const [propertyName, setPropertyName] = useState('')
  const [bookingInput, setBookingInput] = useState('')
  const [expediaInput, setExpediaInput] = useState('')
  const [googleInput, setGoogleInput] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  // First-property onboarding lives on /dashboard now (inline form, not modal).
  // The sidebar "+ Add" button still opens this modal for adding additional properties later.

  function resetForm() {
    setPropertyName('')
    setBookingInput('')
    setExpediaInput('')
    setGoogleInput('')
    setError('')
    setWarnings([])
  }

  function openCreate() {
    resetForm()
    setModalMode('create')
    setEditingProperty(null)
    setShowModal(true)
  }

  function openEdit(p: Property) {
    resetForm()
    setModalMode('edit')
    setEditingProperty(p)
    setPropertyName(p.property_name)
    setBookingInput(p.booking_hotel_id)
    setExpediaInput(p.expedia_property_id)
    setGoogleInput(p.google_place_id)
    setShowModal(true)
  }

  function closeModal() {
    if (submitting) return
    setShowModal(false)
    setEditingProperty(null)
    setWarnings([])
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const name = propertyName.trim()
    const booking = bookingInput.trim()
    const expedia = expediaInput.trim()
    const google = googleInput.trim()

    if (!name) {
      setError('Property name is required.')
      return
    }
    // OTAs optional — user can save just a name and add OTAs later via edit.

    setSubmitting(true)
    try {
      if (modalMode === 'create') {
        const created = await addProperty({
          property_name: name,
          booking_hotel_id: booking || undefined,
          expedia_property_id: expedia || undefined,
          google_place_id: google || undefined,
        })
        if (created.sync_warnings?.length) {
          setWarnings(created.sync_warnings)
        } else {
          setShowModal(false)
        }
      } else if (editingProperty) {
        // For edits: send each field unconditionally — '' to remove, value to (re)apply.
        // We send name as the new (possibly unchanged) value too.
        const updated = await updateProperty(editingProperty.id, {
          property_name: name,
          booking_hotel_id: booking,
          expedia_property_id: expedia,
          google_place_id: google,
        })
        if (updated.sync_warnings?.length) {
          setWarnings(updated.sync_warnings)
        } else {
          setShowModal(false)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Could not save property')
    } finally {
      setSubmitting(false)
    }
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ddd',
    boxSizing: 'border-box',
  }

  const isEdit = modalMode === 'edit'
  const submitDisabled = submitting || !propertyName.trim()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">rep<span>truly</span></div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            🏠 Dashboard
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => isActive ? 'active' : ''}>
            ⭐ Reviews
          </NavLink>
          <NavLink to="/rates" className={({ isActive }) => isActive ? 'active' : ''}>
            💰 Rates
          </NavLink>
          <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
            📅 Demand Calendar
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
            📊 Analytics
          </NavLink>
        </nav>

        <div className="sidebar-properties">
          <div className="sidebar-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>Properties</span>
            <button
              onClick={openCreate}
              title="Connect a new property"
              style={{
                background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                border: 'none',
                color: '#fff',
                borderRadius: 6,
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 2px 6px rgba(16,185,129,0.4)',
                letterSpacing: '0.02em',
              }}
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
                    background: 'rgba(108, 99, 255, 0.22)',
                    border: '1px solid rgba(108, 99, 255, 0.45)',
                    color: '#d4d0ff',
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#6c63ff'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(108, 99, 255, 0.18)'; e.currentTarget.style.color = '#c7c2ff' }}
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
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(239, 68, 68, 0.40)',
                    color: '#fecaca',
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontSize: 14,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#fca5a5' }}
                >
                  ×
                </button>
              </div>
            )
          })}
          {properties.length === 0 && (
            <div style={{ fontSize: 12, color: '#888', padding: '8px 4px' }}>
              No properties yet. Click "+ Add" to connect one.
            </div>
          )}
        </div>

      </aside>
      <UserMenu />
      <main className="main">{children}</main>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {isEdit
                ? `Edit ${editingProperty?.property_name}`
                : (properties.length === 0 ? 'Set up your first property' : 'Connect a property')}
            </h2>
            <p style={{ color: '#666', fontSize: 14, marginTop: 0, marginBottom: 18 }}>
              {isEdit
                ? 'Add or remove OTA links. Removing an OTA also deletes its synced reviews. Adding one starts an inline sync.'
                : 'Give your property a name. OTA links are optional — you can connect Booking, Expedia, and/or Google now or add them later from the edit menu.'}
            </p>

            {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

            {warnings.length > 0 && (
              <div style={{
                background: '#fef9c3',
                border: '1px solid #fde047',
                color: '#713f12',
                padding: '12px 14px',
                borderRadius: 6,
                marginBottom: 14,
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                <strong>Saved, but:</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                  {warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
                </ul>
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={closeModal}>Got it</button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 6 }}>
                  Property name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Travelodge Indianapolis Speedway"
                  value={propertyName}
                  onChange={e => setPropertyName(e.target.value)}
                  autoFocus={!isEdit}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Booking.com */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 6 }}>
                  <span><span style={{ color: '#003580' }}>●</span> Booking.com <span style={{ color: '#888', fontWeight: 400 }}>(URL or hotel ID)</span></span>
                  {isEdit && bookingInput && (
                    <button type="button" onClick={() => setBookingInput('')} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>
                      Remove link
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="https://www.booking.com/hotel/... or 58310"
                  value={bookingInput}
                  onChange={e => setBookingInput(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>First sync runs as soon as you save, then daily at 03:00 UTC.</div>
              </div>

              {/* Expedia */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 6 }}>
                  <span><span style={{ color: '#fdcc04' }}>●</span> Expedia <span style={{ color: '#888', fontWeight: 400 }}>(URL or property ID)</span></span>
                  {isEdit && expediaInput && (
                    <button type="button" onClick={() => setExpediaInput('')} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>
                      Remove link
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="https://www.expedia.com/...h12345... or 12345"
                  value={expediaInput}
                  onChange={e => setExpediaInput(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>First sync runs as soon as you save, then daily at 03:00 UTC.</div>
              </div>

              {/* Google */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 6 }}>
                  <span><span style={{ color: '#34a853' }}>●</span> Google <span style={{ color: '#888', fontWeight: 400 }}>(Maps URL or Place ID)</span></span>
                  {isEdit && googleInput && (
                    <button type="button" onClick={() => setGoogleInput('')} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>
                      Remove link
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="https://www.google.com/maps/place/... or ChIJN1t_..."
                  value={googleInput}
                  onChange={e => setGoogleInput(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: '#1f2937', marginTop: 4 }}>
                  First sync runs as soon as you save, then daily at 03:00 UTC. Google's API only returns the latest 5 reviews.
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                {isEdit && editingProperty ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await Promise.resolve(confirm(`Remove "${editingProperty.property_name}" and its synced reviews?`))) {
                        try { await removeProperty(editingProperty.id); setShowModal(false) }
                        catch (err: any) { setError(err.message || 'Could not remove property') }
                      }
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#dc2626' }}
                    disabled={submitting}
                  >
                    Delete property
                  </button>
                ) : <span />}
                <div style={{ display: 'flex', gap: 8 }}>
                  {(isEdit || properties.length > 0) && (
                    <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={submitDisabled}>
                    {submitting
                      ? (isEdit ? 'Saving…' : 'Connecting…')
                      : (isEdit ? 'Save changes' : 'Connect & sync')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
