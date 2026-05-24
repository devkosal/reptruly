import { FormEvent, useEffect, useMemo, useState } from 'react'
import PhoneField from '../components/PhoneField'
import ThemedPage from '../components/ThemedPage'
import { useAuth } from '../context/AuthContext'
import { useProperty } from '../context/PropertyContext'
import { COUNTRIES, citiesFor, dialCodeFor, statesFor } from '../data/locations'

const editableInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid #e9d5ff',
  background: '#fff',
  color: '#1a1a2e',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function initialsOf(name: string, fallback: string): string {
  const source = name?.trim() || fallback || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function gradientFor(seed: string): string {
  const palettes = [
    ['#f472b6', '#a855f7', '#6366f1'],
    ['#fb923c', '#ec4899', '#8b5cf6'],
    ['#34d399', '#06b6d4', '#6366f1'],
    ['#fbbf24', '#f97316', '#ef4444'],
    ['#60a5fa', '#a855f7', '#ec4899'],
  ]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const p = palettes[h % palettes.length]!
  return `linear-gradient(135deg, ${p[0]} 0%, ${p[1]} 55%, ${p[2]} 100%)`
}

function Section({ title, icon, action, children }: {
  title: string; icon: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #f3e8ff',
      borderRadius: 16,
      padding: 22,
      boxShadow: '0 1px 3px rgba(168,85,247,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 30, height: 30, borderRadius: 9, background: '#faf5ff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>{icon}</span>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.01em' }}>
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function ReadRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 1fr auto', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '1px solid #f5f3ff', fontSize: 14,
    }}>
      <div style={{
        color: '#7c3aed', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ color: '#1f2937', fontWeight: 500 }}>{value || <span style={{ color: '#cbd5e1' }}>—</span>}</div>
      {copyable && value && (
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch {}
          }}
          style={{
            background: copied ? '#dcfce7' : '#faf5ff',
            color: copied ? '#15803d' : '#7c3aed',
            border: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.03em',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{
        fontSize: 11, color: '#7c3aed', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      <input type={type} style={editableInputStyle} value={value} onChange={e => onChange(e.target.value)} required={required} />
    </label>
  )
}

const selectStyle: React.CSSProperties = {
  ...editableInputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%237c3aed' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 36,
  cursor: 'pointer',
}

function SelectField({ label, value, onChange, options, placeholder, disabled, required }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12, opacity: disabled ? 0.55 : 1 }}>
      <div style={{
        fontSize: 11, color: '#7c3aed', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      <select
        style={selectStyle}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        <option value="">{placeholder || 'Select…'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function ComboField({ label, value, onChange, options, listId, placeholder, disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  listId: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12, opacity: disabled ? 0.55 : 1 }}>
      <div style={{
        fontSize: 11, color: '#7c3aed', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      <input
        style={selectStyle}
        value={value}
        onChange={e => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </label>
  )
}

function ProgressRing({ percent, gradient }: { percent: number; gradient: string }) {
  const size = 88
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (percent / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{percent}%</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.85 }}>COMPLETE</div>
      </div>
      <div style={{ display: 'none' }}>{gradient}</div>
    </div>
  )
}

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const { properties } = useProperty()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(user?.name || '')
  const [companyName, setCompanyName] = useState(user?.company_name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState(user?.address || '')
  const [country, setCountry] = useState(user?.country || '')
  const [stateVal, setStateVal] = useState(user?.state || '')
  const [city, setCity] = useState(user?.city || '')

  const stateOptions = useMemo(() => statesFor(country), [country])
  const cityOptions = useMemo(() => citiesFor(country, stateVal), [country, stateVal])
  const stateLocked = !country || stateOptions.length === 0
  const cityLocked = !country
  const phoneDefaultCode = useMemo(() => dialCodeFor(country), [country])

  useEffect(() => {
    if (stateOptions.length > 0 && stateVal && !stateOptions.includes(stateVal)) {
      setStateVal('')
    }
    if (stateOptions.length === 0 && stateVal) {
      // Country has no state cascade — keep whatever the user typed.
    }
  }, [country, stateOptions, stateVal])

  const initials = initialsOf(user?.name || '', user?.username || user?.email || '')
  const avatarGradient = useMemo(
    () => gradientFor(user?.username || user?.email || 'reptruly'),
    [user?.username, user?.email],
  )

  const totalFields = 8
  const filledCount = useMemo(() => {
    return [user?.name, user?.email, user?.company_name, user?.phone, user?.address, user?.city, user?.state, user?.country]
      .filter(v => (v || '').trim().length > 0).length
  }, [user])
  const completionPct = Math.round((filledCount / totalFields) * 100)

  function startEdit() {
    setName(user?.name || '')
    setCompanyName(user?.company_name || '')
    setPhone(user?.phone || '')
    setAddress(user?.address || '')
    setCountry(user?.country || '')
    setStateVal(user?.state || '')
    setCity(user?.city || '')
    setError('')
    setEditing(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Display name is required.')
      return
    }
    if (!country.trim()) {
      setError('Country is required.')
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
        state: stateVal.trim(),
        country: country.trim(),
      })
      setEditing(false)
    } catch (err: any) {
      setError(err.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ThemedPage
      eyebrow="👤 Profile"
      title="Your profile"
      subtitle="The face of your reptruly workspace."
    >
      {/* Hero card */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        padding: 28,
        marginBottom: 22,
        background: avatarGradient,
        boxShadow: '0 12px 36px rgba(168,85,247,0.25)',
        color: '#fff',
      }}>
        {/* Decorative blurred orbs */}
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)', filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -50, width: 220, height: 220, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)', filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em',
            color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.15)',
            flexShrink: 0,
          }}>
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
              opacity: 0.85, marginBottom: 4,
            }}>
              Account holder
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {user?.name || user?.username || 'Welcome'}
            </h2>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.92, fontWeight: 500 }}>
              {user?.email || '—'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
                padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.03em',
              }}>
                @{user?.username || 'user'}
              </span>
              {user?.company_name && (
                <span style={{
                  background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
                  padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.03em',
                }}>
                  🏢 {user.company_name}
                </span>
              )}
              {(user?.city || user?.state || user?.country) && (
                <span style={{
                  background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
                  padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.03em',
                }}>
                  📍 {[user?.city, user?.state, user?.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>

          <ProgressRing percent={completionPct} gradient={avatarGradient} />
        </div>

        {/* Stat row */}
        <div style={{
          position: 'relative',
          marginTop: 22, paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.25)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        }}>
          <Stat label="Properties" value={String(properties.length)} />
          <Stat label="Profile fields" value={`${filledCount}/${totalFields}`} />
          <Stat label="Status" value={user?.profile_completed ? 'Active' : 'Setup' } />
        </div>
      </div>

      {/* Two columns: details + actions */}
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 820 }}>
        {!editing && (
          <>
            <Section
              title="About you"
              icon="✨"
              action={
                <button
                  type="button"
                  onClick={startEdit}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em',
                    boxShadow: '0 3px 10px rgba(168,85,247,0.35)',
                  }}
                >
                  ✏️ Edit profile
                </button>
              }
            >
              <ReadRow label="Display name" value={user?.name || ''} />
              <ReadRow label="Username" value={user?.username || ''} copyable />
              <ReadRow label="Email" value={user?.email || ''} copyable />
            </Section>

            <Section title="Business" icon="🏢">
              <ReadRow label="Company" value={user?.company_name || ''} />
              <ReadRow label="Phone" value={user?.phone || ''} copyable />
            </Section>

            <Section title="Location" icon="📍">
              <ReadRow label="Address" value={user?.address || ''} />
              <ReadRow label="City" value={user?.city || ''} />
              <ReadRow label="State / Province" value={user?.state || ''} />
              <ReadRow label="Country" value={user?.country || ''} />
            </Section>
          </>
        )}

        {editing && (
          <Section title="Edit profile" icon="✏️">
            <form onSubmit={onSubmit}>
              {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <EditField label="Display name" value={name} onChange={setName} required />
                <EditField label="Company / hotel group" value={companyName} onChange={setCompanyName} />
              </div>
              <EditField label="Address" value={address} onChange={setAddress} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <SelectField
                  label="Country"
                  value={country}
                  onChange={v => { setCountry(v); setStateVal(''); setCity('') }}
                  options={COUNTRIES}
                  placeholder="Select country"
                  required
                />
                {stateOptions.length > 0 ? (
                  <SelectField
                    label="State / Province"
                    value={stateVal}
                    onChange={v => { setStateVal(v); setCity('') }}
                    options={stateOptions}
                    placeholder={country ? 'Select state' : 'Pick country first'}
                    disabled={stateLocked}
                  />
                ) : (
                  <EditField
                    label="State / Province"
                    value={stateVal}
                    onChange={setStateVal}
                  />
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {cityOptions.length > 0 ? (
                  <SelectField
                    label="City"
                    value={city}
                    onChange={setCity}
                    options={cityOptions}
                    placeholder={country ? 'Select city' : 'Pick country first'}
                    disabled={cityLocked}
                  />
                ) : (
                  <EditField label="City" value={city} onChange={setCity} />
                )}
                <PhoneField
                  label="Phone"
                  value={phone}
                  defaultCode={phoneDefaultCode}
                  onChange={setPhone}
                />
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -2, marginBottom: 8 }}>
                <span style={{ color: '#dc2626' }}>*</span> Required
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                    color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                    boxShadow: '0 3px 12px rgba(16,185,129,0.35)',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  style={{
                    background: '#fff', color: '#6b21a8', border: '1px solid #e9d5ff',
                    padding: '11px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Section>
        )}
      </div>
    </ThemedPage>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        opacity: 0.85, marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  )
}
