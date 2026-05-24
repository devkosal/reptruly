import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PhoneField from '../components/PhoneField'
import { useAuth } from '../context/AuthContext'
import { useProperty } from '../context/PropertyContext'
import { COUNTRIES, citiesFor, dialCodeFor } from '../data/locations'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid #e9d5ff',
  background: '#fff',
  color: '#1a1a2e',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
}

const selectInputStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%237c3aed' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
  cursor: 'pointer',
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  const bg = done ? '#10b981' : active ? '#6c63ff' : '#e5e7eb'
  const fg = done || active ? '#fff' : '#9ca3af'
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', background: bg, color: fg,
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
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Step {step} of {total}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: '#1f2937', marginTop: 2 }}>{subtitle}</div>}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
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
        fontSize: 11, color: '#6b7280', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>*</span>
        <span>Required. Everything else can be added later from your profile.</span>
      </div>
      <button
        type="submit"
        disabled={saving || !canSubmit}
        style={{
          background: 'linear-gradient(135deg, #6c63ff 0%, #5848e8 100%)',
          color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8,
          fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
          boxShadow: '0 3px 0 #1a1a2e, 0 4px 12px rgba(108,99,255,0.35)',
          opacity: saving || !canSubmit ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save profile →'}
      </button>
    </form>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 600, marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#dc2626' }}></span>}
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
  booking:  { label: 'Booking.com',  initial: 'B', brand: '#003580', brandSoft: '#e6edf7', cadence: 'First sync on add · then daily' },
  expedia:  { label: 'Expedia',      initial: 'E', brand: '#fdb913', brandSoft: '#fff6dd', cadence: 'First sync on add · then daily' },
  google:   { label: 'Google Maps',  initial: 'G', brand: '#4285f4', brandSoft: '#e7f0fe', cadence: 'First sync on add · then daily · latest 5 only' },
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
        background: '#fff',
        border: `1px solid ${filled || focused ? meta.brand : '#ece9ff'}`,
        borderRadius: 12,
        padding: '12px 14px',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: focused
          ? `0 0 0 3px ${meta.brand}22, 0 6px 16px ${meta.brand}1f`
          : filled
            ? `0 2px 10px ${meta.brand}18`
            : '0 1px 2px rgba(15,23,42,0.04)',
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
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{meta.label}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 999,
              background: filled ? '#dcfce7' : '#f1f5f9',
              color: filled ? '#15803d' : '#64748b',
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
              fontSize: 14, color: '#1a1a2e', padding: '2px 0', fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, paddingLeft: 46, fontWeight: 500 }}>
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
          background: '#fef9c3', border: '1px solid #fde047', color: '#713f12',
          padding: '12px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, lineHeight: 1.5,
        }}>
          <strong>Property saved, but:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Property name — hero input */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 700, marginBottom: 8, letterSpacing: '0.02em' }}>
          Property name <span style={{ color: '#dc2626' }}>*</span>
        </div>
        <div
          style={{
            position: 'relative',
            borderRadius: 12,
            padding: 2,
            background: nameFocused
              ? 'linear-gradient(135deg, #6c63ff, #ec4899, #10b981)'
              : '#ece9ff',
            transition: 'background 0.25s',
          }}
        >
          <input
            value={propertyName}
            onChange={e => setPropertyName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            required
            style={{
              width: '100%', padding: '14px 16px', fontSize: 16, fontWeight: 600,
              borderRadius: 10, border: 'none', background: '#fff', color: '#1a1a2e',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* OTA connections */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 700, letterSpacing: '0.02em' }}>
          Connect review channels
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: connectedCount > 0 ? '#10b981' : '#94a3b8',
          background: connectedCount > 0 ? '#dcfce7' : '#f1f5f9',
          padding: '3px 9px', borderRadius: 999, letterSpacing: '0.03em',
        }}>
          {connectedCount}/3 connected
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        <OTAField ota="booking" value={bookingInput} onChange={setBookingInput} />
        <OTAField ota="expedia" value={expediaInput} onChange={setExpediaInput} />
        <OTAField ota="google"  value={googleInput}  onChange={setGoogleInput}  />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
        fontSize: 12, color: '#475569', marginBottom: 16,
      }}>
        <span style={{ fontSize: 14 }}>💡</span>
        <span>OTA links are optional — connect any you have now, add the rest later from the sidebar.</span>
      </div>

      <button
        type="submit"
        disabled={submitting || !propertyName.trim()}
        style={{
          background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
          color: '#fff', border: 'none', padding: '13px 30px', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
          boxShadow: '0 3px 0 #1a1a2e, 0 6px 16px rgba(16,185,129,0.4)',
          opacity: submitting || !propertyName.trim() ? 0.6 : 1,
          transition: 'transform 0.1s, box-shadow 0.15s',
          letterSpacing: '0.01em',
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'translateY(2px)' }}
        onMouseUp={e => { e.currentTarget.style.transform = '' }}
        onMouseLeave={e => { e.currentTarget.style.transform = '' }}
      >
        {submitting ? 'Connecting…' : connectedCount > 0 ? `Connect property · ${connectedCount} channel${connectedCount > 1 ? 's' : ''} →` : 'Connect property →'}
      </button>
    </form>
  )
}

const FEATURES = [
  { icon: '⭐', title: 'Reviews', desc: 'Read & reply to guest reviews', href: '/reviews', color: '#fbbf24' },
  { icon: '💰', title: 'Rates',   desc: 'Live rate vs. competitors',   href: '/rates',    color: '#10b981' },
  { icon: '📅', title: 'Demand',  desc: 'Events, holidays, weather',  href: '/calendar', color: '#6c63ff' },
  { icon: '📊', title: 'Analytics', desc: 'Per-OTA scores & trends',   href: '/analytics', color: '#ec4899' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { properties, propertiesLoaded } = useProperty()

  const profileDone = !!user?.profile_completed
  const hasProperty = properties.length > 0
  const allReady = profileDone && hasProperty

  // Determine which step is currently active.
  const activeStep = !profileDone ? 1 : !hasProperty ? 2 : 3

  return (
    <>
      <div className="page-header">
        <h1>Welcome to reptruly{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</h1>
        <p>
          {allReady
            ? 'Your workspace is ready. Jump into any tool below or use the sidebar.'
            : 'Two quick steps and you\'re live with reviews + rates + demand.'}
        </p>
      </div>

      {/* Onboarding panels — collapsed once done */}
      {!allReady && (
        <div style={{
          background: 'linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 100%)',
          border: '1px solid #e9d5ff',
          borderRadius: 14,
          padding: 28,
          marginBottom: 24,
          boxShadow: '0 4px 14px rgba(192,132,252,0.10)',
        }}>
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
          <section style={{ paddingTop: 20, borderTop: profileDone ? '1px solid #e9d5ff' : 'none' }}>
            <StepHeader
              step={2}
              total={2}
              title="Add your first property"
              subtitle={hasProperty
                ? `${properties.length} property connected`
                : 'Paste any Booking.com, Expedia, or Google Maps URL — we\'ll sync the reviews automatically.'}
              done={hasProperty}
              active={activeStep === 2}
            />
            {profileDone && !hasProperty && propertiesLoaded && <AddPropertyForm />}
            {profileDone && !hasProperty && !propertiesLoaded && (
              <div style={{ color: '#1f2937', fontSize: 13 }}>Loading properties…</div>
            )}
            {!profileDone && (
              <div style={{ color: '#9ca3af', fontSize: 13, marginLeft: 44 }}>
                Finish step 1 first.
              </div>
            )}
          </section>
        </div>
      )}

      {/* Feature grid — visible always once a property exists, else hidden */}
      {allReady && (
        <div className="stats-grid">
          {FEATURES.map(f => (
            <Link key={f.title} to={f.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                className="stat-card"
                style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s' }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = `0 12px 28px ${f.color}30`
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.transform = ''
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 4 }}>{f.icon}</div>
                <div className="stat-label" style={{ color: f.color }}>{f.title}</div>
                <div className="stat-sub">{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Property summary card — visible when properties exist */}
      {allReady && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 15, color: '#1a1a2e' }}>
            Your properties ({properties.length})
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {properties.map(p => {
              const otas = [
                p.booking_hotel_id && 'Booking',
                p.expedia_property_id && 'Expedia',
                p.google_place_id && 'Google',
              ].filter(Boolean) as string[]
              return (
                <li key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderTop: '1px solid #f0f0f0',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{p.property_name}</div>
                    <div style={{ fontSize: 12, color: '#1f2937', marginTop: 2 }}>
                      {p.location || (otas.length ? otas.join(' · ') : 'No OTAs connected')}
                    </div>
                  </div>
                  <Link to="/reviews" style={{ fontSize: 12, color: '#6c63ff', fontWeight: 600, textDecoration: 'none' }}>
                    View reviews →
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
