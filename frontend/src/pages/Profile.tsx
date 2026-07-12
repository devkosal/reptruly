import { FormEvent, useEffect, useMemo, useState } from 'react'
import PhoneField from '../components/PhoneField'
import ThemedPage from '../components/ThemedPage'
import { useAuth } from '../context/AuthContext'
import { useProperty } from '../context/PropertyContext'
import { COUNTRIES, citiesFor, dialCodeFor, statesFor } from '../data/locations'

function initialsOf(name: string, fallback: string): string {
  const source = name?.trim() || fallback || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>{title}</div>
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
      padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 14,
    }}>
      <div style={{
        color: 'var(--text-faint)', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ color: 'var(--text)', fontWeight: 500 }}>{value || <span style={{ color: 'var(--text-faint)' }}>—</span>}</div>
      {copyable && value && (
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch {}
          }}
          style={{
            background: copied ? 'var(--good-soft)' : 'var(--accent-soft)',
            color: copied ? 'var(--good)' : 'var(--accent)',
            border: 'none', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.03em', fontFamily: 'inherit',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div style={{
      fontSize: 11, color: 'var(--text-faint)', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', marginBottom: 6,
    }}>
      {label}{required && <span style={{ color: 'var(--bad)', marginLeft: 4 }}>*</span>}
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        className="filter-input"
        style={{ width: '100%' }}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
      />
    </label>
  )
}

const selectExtraStyle: React.CSSProperties = {
  width: '100%',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%235b6472' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
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
      <FieldLabel label={label} required={required} />
      <select
        className="filter-select"
        style={selectExtraStyle}
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

function ProgressRing({ percent }: { percent: number }) {
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
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
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
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>COMPLETE</div>
      </div>
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
      eyebrow="Account"
      title="Your profile"
      subtitle="The face of your reptruly workspace."
    >
      {/* Hero card */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        padding: 28,
        marginBottom: 24,
        background: 'radial-gradient(ellipse at top left, rgba(79,70,229,0.25), transparent 55%), var(--grad-dark)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        color: 'rgba(255,255,255,0.92)',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24,
            background: 'var(--grad-accent)',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em',
            color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)', marginBottom: 4,
            }}>
              Account holder
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#fff' }}>
              {user?.name || user?.username || 'Welcome'}
            </h2>
            <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
              {user?.email || '—'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.03em', color: 'rgba(255,255,255,0.85)',
              }}>
                @{user?.username || 'user'}
              </span>
              {user?.company_name && (
                <span style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.03em', color: 'rgba(255,255,255,0.85)',
                }}>
                  {user.company_name}
                </span>
              )}
              {(user?.city || user?.state || user?.country) && (
                <span style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  padding: '4px 11px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.03em', color: 'rgba(255,255,255,0.85)',
                }}>
                  {[user?.city, user?.state, user?.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>

          <ProgressRing percent={completionPct} />
        </div>

        {/* Stat row */}
        <div style={{
          position: 'relative',
          marginTop: 22, paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        }}>
          <Stat label="Properties" value={String(properties.length)} />
          <Stat label="Profile fields" value={`${filledCount}/${totalFields}`} />
          <Stat label="Status" value={user?.profile_completed ? 'Active' : 'Setup' } />
        </div>
      </div>

      {/* Two columns: details + actions */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 820 }}>
        {!editing && (
          <>
            <Section
              title="About you"
              action={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={startEdit}
                >
                  Edit profile
                </button>
              }
            >
              <ReadRow label="Display name" value={user?.name || ''} />
              <ReadRow label="Username" value={user?.username || ''} copyable />
              <ReadRow label="Email" value={user?.email || ''} copyable />
            </Section>

            <Section title="Business">
              <ReadRow label="Company" value={user?.company_name || ''} />
              <ReadRow label="Phone" value={user?.phone || ''} copyable />
            </Section>

            <Section title="Location">
              <ReadRow label="Address" value={user?.address || ''} />
              <ReadRow label="City" value={user?.city || ''} />
              <ReadRow label="State / Province" value={user?.state || ''} />
              <ReadRow label="Country" value={user?.country || ''} />
            </Section>
          </>
        )}

        {editing && (
          <Section title="Edit profile">
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
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: -2, marginBottom: 8 }}>
                <span style={{ color: 'var(--bad)' }}>*</span> Required
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ cursor: saving ? 'wait' : 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditing(false)}
                  disabled={saving}
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
      <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-0.02em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)', marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  )
}
