import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PhoneField from '../components/PhoneField'
import ThemedPage from '../components/ThemedPage'
import { useAuth } from '../context/AuthContext'
import { Property, useProperty } from '../context/PropertyContext'
import { COUNTRIES, citiesFor, dialCodeFor } from '../data/locations'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
}

const selectInputStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%235b6472' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
  cursor: 'pointer',
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  const bg = done ? 'var(--good)' : active ? 'var(--grad-accent)' : 'var(--surface-2)'
  const fg = done || active ? '#fff' : 'var(--text-faint)'
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', background: bg, color: fg,
      border: done || active ? 'none' : '1px solid var(--border)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 13, flexShrink: 0,
    }}>
      {done ? '✓' : n}
    </div>
  )
}

function StepHeader({
  step, total, title, subtitle, done, active,
}: {
  step: number; total: number; title: string; subtitle: string; done: boolean; active: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <StepBadge n={step} done={done} active={active} />
      <div>
        <div style={{
          fontSize: 11, color: 'var(--text-faint)', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Step {step} of {total}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function ProfileForm() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [companyName, setCompanyName] = useState(user?.company_name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState(user?.address || '')
  const [city, setCity] = useState(user?.city || '')
  const [country, setCountry] = useState(user?.country || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = name.trim().length > 0 && country.trim().length > 0
  const cityOptions = useMemo(() => citiesFor(country, ''), [country])
  const phoneDefaultCode = useMemo(() => dialCodeFor(country), [country])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Your name is required.')
      return
    }
    if (!country.trim()) {
      setError('Country is required — it sets your currency and timezone defaults.')
      return
    }
    setSaving(true)
    try {
      await updateProfile({
        name: name.trim(),
        company_name: companyName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
      })
    } catch (err: any) {
      setError(err.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
        <Field label="Your full name *" required>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
        </Field>
        <Field label="Country *" required>
          <select
            style={selectInputStyle}
            value={country}
            onChange={e => setCountry(e.target.value)}
            required
          >
            <option value="">Select country</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
        <Field label="Company / hotel group">
          <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} />
        </Field>
        <Field label="City">
          {cityOptions.length > 0 ? (
            <select
              style={selectInputStyle}
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={!country}
            >
              <option value="">{country ? 'Select city' : 'Pick country first'}</option>
              {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} disabled={!country} placeholder={country ? '' : 'Pick country first'} />
          )}
        </Field>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Field label="Address">
          <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} />
        </Field>
      </div>
      <div style={{ marginBottom: 16 }}>
        <PhoneField label="Phone" value={phone} defaultCode={phoneDefaultCode} onChange={setPhone} />
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>*</span>
        <span>Required. Everything else can be added later from your profile.</span>
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || !canSubmit}
        style={{ padding: '11px 26px', cursor: saving ? 'wait' : undefined }}
      >
        {saving ? 'Saving…' : 'Save profile →'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </label>
  )
}

type OTAKey = 'booking' | 'expedia' | 'google'

const OTA_META: Record<OTAKey, {
  label: string
  initial: string
  brand: string
  brandSoft: string
  cadence: string
}> = {
  booking:  { label: 'Booking.com',  initial: 'B', brand: '#1e5aa7', brandSoft: '#e9f1fb', cadence: 'First sync on add · then daily' },
  expedia:  { label: 'Expedia',      initial: 'E', brand: '#b07207', brandSoft: '#fdf4e4', cadence: 'First sync on add · then daily' },
  google:   { label: 'Google Maps',  initial: 'G', brand: '#237a3c', brandSoft: '#e9f5ec', cadence: 'First sync on add · then daily · latest 5 only' },
}

function OTAField({
  ota, value, onChange,
}: {
  ota: OTAKey; value: string; onChange: (v: string) => void
}) {
  const meta = OTA_META[ota]
  const filled = value.trim().length > 0
  const [focused, setFocused] = useState(false)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${focused ? 'var(--accent)' : filled ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused
          ? '0 0 0 3px rgba(79,70,229,0.12)'
          : 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: filled ? meta.brand : meta.brandSoft,
            color: filled ? '#fff' : meta.brand,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {meta.initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{meta.label}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 999,
              background: filled ? 'var(--good-soft)' : 'var(--surface-2)',
              color: filled ? 'var(--good)' : 'var(--text-faint)',
              border: `1px solid ${filled ? '#c4ebda' : 'var(--border)'}`,
            }}>
              {filled ? '✓ Connected' : 'Optional'}
            </span>
          </div>
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: '100%', border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: 'var(--text)', padding: '2px 0', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8, paddingLeft: 46, fontWeight: 500 }}>
        Paste a URL or property ID · {meta.cadence}
      </div>
    </div>
  )
}

function AddPropertyForm() {
  const { addProperty } = useProperty()
  const [propertyName, setPropertyName] = useState('')
  const [bookingInput, setBookingInput] = useState('')
  const [expediaInput, setExpediaInput] = useState('')
  const [googleInput, setGoogleInput] = useState('')
  const [nameFocused, setNameFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  const connectedCount =
    Number(bookingInput.trim().length > 0) +
    Number(expediaInput.trim().length > 0) +
    Number(googleInput.trim().length > 0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setWarnings([])
    const name = propertyName.trim()
    if (!name) {
      setError('Property name is required.')
      return
    }
    setSubmitting(true)
    try {
      const created = await addProperty({
        property_name: name,
        booking_hotel_id: bookingInput.trim() || undefined,
        expedia_property_id: expediaInput.trim() || undefined,
        google_place_id: googleInput.trim() || undefined,
      })
      if (created.sync_warnings?.length) setWarnings(created.sync_warnings)
    } catch (err: any) {
      setError(err.message || 'Could not add property')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      {warnings.length > 0 && (
        <div style={{
          background: 'var(--warn-soft)', border: '1px solid #f5e0b8', color: 'var(--warn)',
          padding: '12px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, lineHeight: 1.5,
        }}>
          <strong>Property saved, but:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Property name — hero input */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, marginBottom: 8, letterSpacing: '0.02em' }}>
          Property name <span style={{ color: 'var(--bad)' }}>*</span>
        </div>
        <input
          value={propertyName}
          onChange={e => setPropertyName(e.target.value)}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          required
          style={{
            width: '100%', padding: '13px 16px', fontSize: 16, fontWeight: 600,
            borderRadius: 10,
            border: `1px solid ${nameFocused ? 'var(--accent)' : 'var(--border-strong)'}`,
            boxShadow: nameFocused ? '0 0 0 3px rgba(79,70,229,0.12)' : 'none',
            background: 'var(--surface)', color: 'var(--text)',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
      </div>

      {/* OTA connections */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700, letterSpacing: '0.02em' }}>
          Connect review channels
        </div>
        <span className={connectedCount > 0 ? 'chip chip-good' : 'chip'} style={{ fontSize: 11 }}>
          {connectedCount}/3 connected
        </span>
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        <OTAField ota="booking" value={bookingInput} onChange={setBookingInput} />
        <OTAField ota="expedia" value={expediaInput} onChange={setExpediaInput} />
        <OTAField ota="google"  value={googleInput}  onChange={setGoogleInput}  />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 16,
      }}>
        <span>OTA links are optional — connect any you have now, add the rest later from the sidebar.</span>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || !propertyName.trim()}
        style={{ padding: '12px 28px', cursor: submitting ? 'wait' : undefined }}
      >
        {submitting ? 'Connecting…' : connectedCount > 0 ? `Connect property · ${connectedCount} channel${connectedCount > 1 ? 's' : ''} →` : 'Connect property →'}
      </button>
    </form>
  )
}

function EmailVerifyBanner() {
  const { user } = useAuth()
  const [sent, setSent] = useState(false)
  const justVerified = useMemo(
    () => new URLSearchParams(window.location.search).get('verified'),
    [],
  )

  if (!user?.email) return null

  if (justVerified === '1') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--good-soft)', border: '1px solid #c4ebda', color: 'var(--good)',
        borderRadius: 12, padding: '11px 16px', marginBottom: 20,
        fontSize: 13, fontWeight: 600,
      }}>
        ✓ Email confirmed — alerts and digests will reach {user.email}.
      </div>
    )
  }

  if (user.email_verified) return null

  async function resend() {
    try {
      await fetch('/api/auth/resend-verification', { method: 'POST', credentials: 'include' })
      setSent(true)
    } catch {
      /* banner stays; user can retry */
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      flexWrap: 'wrap',
      background: 'var(--warn-soft)', border: '1px solid #f5e0b8',
      borderRadius: 12, padding: '11px 16px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600 }}>
        {justVerified === 'expired'
          ? 'That confirmation link expired — request a fresh one.'
          : <>Please confirm your email ({user.email}) so alerts and digests reach you.</>}
      </div>
      {sent ? (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>
          ✓ Sent — check your inbox
        </span>
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={resend}>
          Resend confirmation email
        </button>
      )}
    </div>
  )
}

const FEATURES = [
  { icon: '⭐', title: 'Reviews',   desc: 'Read & reply to guest reviews', href: '/reviews' },
  { icon: '💰', title: 'Rates',     desc: 'Live rate vs. competitors',     href: '/rates' },
  { icon: '📅', title: 'Demand',    desc: 'Events, holidays, weather',     href: '/calendar' },
  { icon: '📊', title: 'Analytics', desc: 'Per-OTA scores & trends',       href: '/analytics' },
]

interface OTAStats {
  total: number
  avg_score: number | null
  pending_reply: number
}

interface SummaryStats {
  total_reviews: number
  avg_score: number | null
  replied: number
  pending_reply: number
  reviews_by_ota: Record<string, number>
  per_ota: Record<string, OTAStats>
}

function scoreColors(score: number | null | undefined) {
  if (score == null) return { bg: 'var(--surface-2)', fg: 'var(--text-faint)' }
  if (score >= 7) return { bg: 'var(--good-soft)', fg: 'var(--good)' }
  if (score >= 5) return { bg: 'var(--warn-soft)', fg: 'var(--warn)' }
  return { bg: 'var(--bad-soft)', fg: 'var(--bad)' }
}

// Review stats for one property (or the whole portfolio when propertyName is null).
function usePropertySummary(propertyName: string | null) {
  const [stats, setStats] = useState<SummaryStats | null>(null)
  useEffect(() => {
    let cancelled = false
    setStats(null)
    const qs = propertyName ? `?property_name=${encodeURIComponent(propertyName)}` : ''
    fetch(`/api/reviews/analytics/summary${qs}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setStats(d) })
      .catch(() => { /* tiles fall back to em-dashes */ })
    return () => { cancelled = true }
  }, [propertyName])
  return stats
}

const CHANNELS = [
  { key: 'booking_hotel_id', label: 'Booking.com' },
  { key: 'expedia_property_id', label: 'Expedia' },
  { key: 'google_place_id', label: 'Google' },
] as const

function ChannelChip({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
      background: connected ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)',
      color: connected ? '#6ee7b7' : 'rgba(255,255,255,0.55)',
      border: `1px solid ${connected ? 'rgba(110,231,183,0.35)' : 'rgba(255,255,255,0.14)'}`,
      whiteSpace: 'nowrap',
    }}>
      {connected ? '✓ ' : ''}{label}{connected ? '' : ' · not linked'}
    </span>
  )
}

function StatTiles({ stats, lastSyncedLabel }: { stats: SummaryStats | null; lastSyncedLabel: string }) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Guest reviews</div>
        <div className="stat-value">{stats ? stats.total_reviews : '—'}</div>
        <div className="stat-sub">Synced from connected channels</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Average score</div>
        <div className="stat-value">
          {stats?.avg_score != null ? stats.avg_score.toFixed(1) : '—'}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-faint)' }}> / 10</span>
        </div>
        <div className="stat-sub">Across all channels</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Awaiting reply</div>
        <div className="stat-value">{stats ? stats.pending_reply : '—'}</div>
        <div className="stat-sub">
          <Link to="/reviews" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Reply from the inbox →
          </Link>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Last synced</div>
        <div className="stat-value" style={{ fontSize: 22, marginTop: 10 }}>{lastSyncedLabel}</div>
        <div className="stat-sub">Auto-refreshes every day</div>
      </div>
    </div>
  )
}

const TOOL_LINKS = [
  { key: 'reviews',   label: 'Reviews',   icon: '⭐', href: '/reviews' },
  { key: 'rates',     label: 'Rates',     icon: '💰', href: '/rates' },
  { key: 'demand',    label: 'Demand',    icon: '📅', href: '/calendar' },
  { key: 'analytics', label: 'Analytics', icon: '📊', href: '/analytics' },
]

// Tab bar shown under the property hero. "Overview" is this dashboard view;
// the rest jump to the tool pages, already scoped to the selected property.
function PropertyTabs() {
  const navigate = useNavigate()
  return (
    <div style={{
      display: 'flex', gap: 2, borderBottom: '1px solid var(--border)',
      marginBottom: 22, overflowX: 'auto',
    }}>
      <span style={{
        fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
        color: 'var(--accent)', padding: '10px 14px',
        borderBottom: '2px solid var(--accent)', marginBottom: -1,
        whiteSpace: 'nowrap',
      }}>
        Overview
      </span>
      {TOOL_LINKS.map(t => (
        <button
          key={t.key}
          onClick={() => navigate(t.href)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
            color: 'var(--text-muted)', padding: '10px 14px',
            borderBottom: '2px solid transparent', marginBottom: -1,
            whiteSpace: 'nowrap', transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}

// Per-channel breakdown for the focused property.
function ChannelBreakdown({ stats }: { stats: SummaryStats }) {
  const entries = Object.entries(stats.per_ota ?? {})
  if (!entries.length) return null
  const max = Math.max(...entries.map(([, s]) => s.total), 1)
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="section-title">Reviews by channel</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {entries.map(([name, s]) => {
          const sc = scoreColors(s.avg_score)
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 110, fontSize: 13, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
                {name}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  width: `${(s.total / max) * 100}%`, height: '100%', borderRadius: 999,
                  background: 'var(--grad-accent)',
                }} />
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', width: 90, textAlign: 'right', flexShrink: 0 }}>
                {s.total} review{s.total === 1 ? '' : 's'}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                background: sc.bg, color: sc.fg, flexShrink: 0, minWidth: 42, textAlign: 'center',
              }}>
                {s.avg_score != null ? s.avg_score.toFixed(1) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Focused view: everything about the one property picked in the sidebar.
function PropertyOverview({
  property, showBack, onBack,
}: { property: Property; showBack: boolean; onBack: () => void }) {
  const stats = usePropertySummary(property.property_name)
  const lastSyncedLabel = property.last_synced_at
    ? new Date(property.last_synced_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'Pending'

  return (
    <>
      <div style={{
        background: 'radial-gradient(ellipse at top left, rgba(79,70,229,0.28), transparent 55%), var(--grad-dark)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0, flex: '1 1 320px' }}>
          <div style={{
            width: 54, height: 54, borderRadius: 14, flexShrink: 0,
            background: 'var(--grad-accent)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22,
          }}>
            {property.property_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            {showBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                  fontFamily: 'inherit', marginBottom: 4,
                }}
              >
                ← Back to all properties
              </button>
            )}
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
              {property.property_name}
            </div>
            {property.location && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{property.location}</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {CHANNELS.map(c => (
                <ChannelChip key={c.key} label={c.label} connected={!!property[c.key]} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            to={`/connect-property?edit=${encodeURIComponent(property.id)}`}
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Edit channels
          </Link>
          <Link to="/reviews" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            View reviews →
          </Link>
        </div>
      </div>

      <PropertyTabs />

      <div className="section-title">This property at a glance</div>
      <StatTiles stats={stats} lastSyncedLabel={lastSyncedLabel} />
      {stats && <ChannelBreakdown stats={stats} />}
    </>
  )
}

// One card per property on the portfolio dashboard: identity, review summary,
// channel status, and shortcuts into each tool scoped to that property.
function PropertyCard({
  property, onOpen, onTool,
}: { property: Property; onOpen: () => void; onTool: (href: string) => void }) {
  const stats = usePropertySummary(property.property_name)
  const connected = CHANNELS.filter(c => !!property[c.key])
  const sc = scoreColors(stats?.avg_score)

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      style={{
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = ''
        e.currentTarget.style.transform = ''
        e.currentTarget.style.borderColor = ''
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 17,
        }}>
          {property.property_name?.[0]?.toUpperCase() ?? '?'}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.3 }}>
            {property.property_name}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {property.location || 'Location not set'}
          </div>
        </div>
        <span
          title="Average review score"
          style={{
            fontSize: 14, fontWeight: 800, padding: '4px 10px', borderRadius: 10,
            background: sc.bg, color: sc.fg, flexShrink: 0,
          }}
        >
          {stats?.avg_score != null ? stats.avg_score.toFixed(1) : '—'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--ink)' }}>{stats ? stats.total_reviews : '…'}</strong> reviews</span>
        <span><strong style={{ color: stats?.pending_reply ? 'var(--warn)' : 'var(--ink)' }}>{stats ? stats.pending_reply : '…'}</strong> awaiting reply</span>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {connected.length
          ? connected.map(c => <span key={c.key} className="chip chip-good" style={{ fontSize: 11 }}>{c.label}</span>)
          : <span className="chip" style={{ fontSize: 11 }}>No channels connected</span>}
      </div>

      <div style={{
        display: 'flex', borderTop: '1px solid var(--border)',
        margin: '2px -20px -20px', padding: '0 8px',
      }}>
        {TOOL_LINKS.map(t => (
          <button
            key={t.key}
            onClick={e => { e.stopPropagation(); onTool(t.href) }}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              color: 'var(--text-muted)', padding: '11px 4px', borderRadius: 8,
              transition: 'color 0.15s, background 0.15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Portfolio view: totals across every property plus one summary card each.
function PortfolioOverview({
  properties, channelsConnected, onSelect,
}: { properties: Property[]; channelsConnected: number; onSelect: (p: Property) => void }) {
  const stats = usePropertySummary(null)
  const navigate = useNavigate()

  return (
    <>
      <div style={{
        background: 'radial-gradient(ellipse at top left, rgba(79,70,229,0.28), transparent 55%), var(--grad-dark)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)', marginBottom: 6,
          }}>
            All properties
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} · {channelsConnected} review {channelsConnected === 1 ? 'channel' : 'channels'} connected
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            Reviews sync daily. Rates and demand signals update live.
          </div>
        </div>
        <Link to="/reviews" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          View reviews →
        </Link>
      </div>

      <div className="section-title">Portfolio at a glance</div>
      <StatTiles stats={stats} lastSyncedLabel="Daily" />

      <div className="section-title" style={{ marginBottom: 4 }}>
        Your properties ({properties.length})
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
        Click a card for the full overview, or jump straight into a tool for that property.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {properties.map(p => (
          <PropertyCard
            key={p.id}
            property={p}
            onOpen={() => onSelect(p)}
            onTool={href => { onSelect(p); navigate(href) }}
          />
        ))}
      </div>
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { properties, propertiesLoaded, selectedProperty, setSelectedProperty } = useProperty()

  // The property whose overview is shown: the sidebar selection, or the only
  // property when there is just one (no "All properties" row in that case).
  const focus = selectedProperty ?? (properties.length === 1 ? properties[0] : null)

  const profileDone = !!user?.profile_completed
  const hasProperty = properties.length > 0
  const allReady = profileDone && hasProperty

  // Determine which step is currently active.
  const activeStep = !profileDone ? 1 : !hasProperty ? 2 : 3
  const doneCount = Number(profileDone) + Number(hasProperty)

  const channelsConnected = properties.reduce((sum, p) =>
    sum
    + Number(!!p.booking_hotel_id)
    + Number(!!p.expedia_property_id)
    + Number(!!p.google_place_id), 0)

  return (
    <ThemedPage
      eyebrow="Dashboard"
      title={`Welcome to reptruly${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
      subtitle={allReady
        ? 'Your workspace is ready. Jump into any tool below or use the sidebar.'
        : 'Two quick steps and you\'re live with reviews + rates + demand.'}
    >
      <EmailVerifyBanner />

      {/* Onboarding — setup hero + checklist with a "what you unlock" rail */}
      {!allReady && (
        <div style={{
          background: 'radial-gradient(ellipse at top left, rgba(79,70,229,0.30), transparent 55%), radial-gradient(ellipse at bottom right, rgba(124,58,237,0.18), transparent 60%), var(--grad-dark)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '24px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)', marginBottom: 6,
            }}>
              Let's get you set up
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
              {doneCount === 0
                ? 'Two steps to your live workspace'
                : 'One step to go — connect your property'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              Reviews, rates and demand start syncing the moment you connect.
            </div>
          </div>
          <div style={{ flex: '0 1 240px', minWidth: 200 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 8,
            }}>
              <span>Progress</span>
              <span>{doneCount} of 2 complete</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999, background: 'var(--grad-accent)',
                width: `${Math.max(doneCount / 2 * 100, 6)}%`, transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {[{ label: 'Profile', done: profileDone }, { label: 'Property', done: hasProperty }].map(s => (
                <span key={s.label} style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                  background: s.done ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)',
                  color: s.done ? '#6ee7b7' : 'rgba(255,255,255,0.6)',
                  border: `1px solid ${s.done ? 'rgba(110,231,183,0.35)' : 'rgba(255,255,255,0.14)'}`,
                }}>
                  {s.done ? '✓ ' : ''}{s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!allReady && (
        <div className="onboarding-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="section-title">Setup checklist</div>

          {/* Step 1: profile */}
          <section style={{ marginBottom: profileDone ? 16 : 24 }}>
            <StepHeader
              step={1}
              total={2}
              title="Create your profile"
              subtitle={profileDone
                ? `${user?.name}${user?.company_name ? ` · ${user.company_name}` : ''}${user?.city ? ` · ${user.city}` : ''}`
                : 'Tell us a bit about you and your hotel business.'}
              done={profileDone}
              active={activeStep === 1}
            />
            {!profileDone && activeStep === 1 && <ProfileForm />}
          </section>

          {/* Step 2: first property */}
          <section style={{ paddingTop: 20, borderTop: profileDone ? '1px solid var(--border)' : 'none' }}>
            <StepHeader
              step={2}
              total={2}
              title="Add your first property"
              subtitle={hasProperty
                ? `${properties.length} ${properties.length === 1 ? 'property' : 'properties'} connected`
                : 'Paste any Booking.com, Expedia, or Google Maps URL — we\'ll sync the reviews automatically.'}
              done={hasProperty}
              active={activeStep === 2}
            />
            {profileDone && !hasProperty && propertiesLoaded && <AddPropertyForm />}
            {profileDone && !hasProperty && !propertiesLoaded && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading properties…</div>
            )}
            {!profileDone && (
              <div style={{ color: 'var(--text-faint)', fontSize: 13, marginLeft: 44 }}>
                Finish step 1 first.
              </div>
            )}
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <div className="section-title">What you unlock</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {FEATURES.map(f => (
                <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {f.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: 'var(--accent-soft)', borderColor: '#dcdffc' }}>
            <div className="section-title" style={{ color: 'var(--accent)' }}>How syncing works</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {[
                'Booking.com, Expedia & Google reviews in one inbox',
                'Automatic refresh every day — no manual imports',
                'Rates vs. nearby competitors, live',
                '12-month demand outlook from events, holidays & weather',
              ].map(line => (
                <li key={line} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
        </div>
      )}

      {/* Area 1 — property overview, driven by the sidebar selection */}
      {allReady && (
        focus ? (
          <PropertyOverview
            property={focus}
            showBack={properties.length > 1}
            onBack={() => setSelectedProperty(null)}
          />
        ) : (
          <PortfolioOverview
            properties={properties}
            channelsConnected={channelsConnected}
            onSelect={setSelectedProperty}
          />
        )
      )}

    </ThemedPage>
  )
}
