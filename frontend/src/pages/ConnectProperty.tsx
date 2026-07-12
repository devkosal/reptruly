import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ThemedPage from '../components/ThemedPage'
import { ApiError, useProperty } from '../context/PropertyContext'
import UpgradeNotice from '../components/UpgradeNotice'

/* ---------- shared little pieces (visual only) ---------- */

function StepBadge({ n }: { n: number }) {
  return (
    <span style={{
      flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
      background: 'var(--accent-soft)', color: 'var(--accent)',
      fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>{n}</span>
  )
}

function SectionHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <StepBadge n={n} />
      <div>
        <div className="section-title" style={{ marginBottom: 0 }}>Step {n} — {title}</div>
        {hint && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function HowTo({ children }: { children: ReactNode }) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        How do I find this?
      </summary>
      <div style={{
        marginTop: 8, padding: '12px 14px', borderRadius: 10,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65,
      }}>
        {children}
      </div>
    </details>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 9, marginBottom: 6 }}>
      <span style={{
        flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1,
        background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <span>{children}</span>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code style={{
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4,
      padding: '1px 5px', fontSize: 11.5, color: 'var(--accent)',
    }}>{children}</code>
  )
}

/** Status pill shown next to each channel when editing. */
function ChannelStatus({ linked }: { linked: boolean }) {
  return linked
    ? <span className="chip chip-good">Connected</span>
    : <span className="chip">Not linked</span>
}

/** One channel per row inside the "Connect channels" card. */
function ChannelRow({
  name, dotColor, helper, isEdit, linked, onRemove, first, children,
}: {
  name: string
  dotColor: string
  helper: string
  isEdit: boolean
  linked: boolean
  onRemove?: () => void
  first?: boolean
  children: ReactNode
}) {
  return (
    <div style={{
      paddingTop: first ? 0 : 16,
      marginTop: first ? 0 : 16,
      borderTop: first ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
          {isEdit && <ChannelStatus linked={linked} />}
        </div>
        {isEdit && linked && onRemove && (
          <button type="button" onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--bad)', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            Remove link
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{helper}</div>
      {children}
    </div>
  )
}

type PlaceResult = {
  place_id: string
  name: string
  address: string
  rating: number | null
  user_rating_count: number | null
}

/** In-app Google place picker: type a hotel name, pick the right result, and we
 *  store its Place ID. Replaces the old "go find a Place ID yourself" flow. */
function GooglePlacePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [manual, setManual] = useState(false)
  const [selectedName, setSelectedName] = useState('')

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      setSearched(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/properties/google/search?q=${encodeURIComponent(q)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (!cancelled) {
          setResults(data.results || [])
          setSearched(true)
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  function pick(p: PlaceResult) {
    onChange(p.place_id)
    setSelectedName(p.name)
    setResults([])
    setQuery('')
    setSearched(false)
  }

  function clearSelection() {
    onChange('')
    setSelectedName('')
  }

  // A Place ID is selected (either via search this session, or pre-filled when editing).
  if (value) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '11px 13px', borderRadius: 10,
        border: '1px solid #c4ebda', background: 'var(--good-soft)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>
            ✓ {selectedName || 'Google place linked'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </div>
        </div>
        <button type="button" onClick={clearSelection} style={{ flexShrink: 0, background: 'transparent', border: 'none', color: 'var(--bad)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          Change
        </button>
      </div>
    )
  }

  if (manual) {
    // Pre-fill Google Maps' search with whatever the user typed in the search box,
    // so the "open Google Maps" link lands directly on their hotel.
    const mapsSearchUrl = query.trim()
      ? `https://www.google.com/maps/search/${encodeURIComponent(query.trim())}`
      : 'https://www.google.com/maps'
    return (
      <div>
        <div style={{
          padding: '12px 14px', borderRadius: 10, marginBottom: 10,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Get your hotel's Google link in 3 steps</div>
          <Step n={1}>
            Open{' '}
            <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Google Maps ↗
            </a>
            {query.trim()
              ? <> — it opens pre-searched for <Code>{query.trim()}</Code>.</>
              : <>, then type your hotel's name in the search box at the top-left.</>}
          </Step>
          <Step n={2}>Click your hotel in the results so its page opens on the left.</Step>
          <Step n={3}>
            Copy the full web address from your browser's address bar — it looks like{' '}
            <Code>https://www.google.com/maps/place/Your+Hotel+Name/@40.7…</Code> — and paste it below.
          </Step>
          <div style={{ marginTop: 8 }}>
            We read the hotel name out of that link and resolve the Place ID for you. Already have a
            Place ID (starts with <Code>ChIJ</Code>)? Paste that instead.
          </div>
        </div>
        <input
          type="text"
          className="filter-input"
          value={value}
          placeholder="Paste the Google Maps link (or a ChIJ… Place ID) here"
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%' }}
        />
        <button
          type="button"
          onClick={() => setManual(false)}
          style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          ← Search by hotel name instead (easier)
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="filter-input"
          value={query}
          placeholder="Search your hotel by name, e.g. The Taj Mahal Palace, Mumbai"
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%' }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-faint)' }}>
            searching…
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: 8, border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {results.map((p, i) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => pick(p)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '10px 13px', background: 'var(--surface)', border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
              {p.address && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{p.address}</div>}
              {p.rating != null && (
                <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 2 }}>
                  ★ {p.rating}{p.user_rating_count ? ` · ${p.user_rating_count.toLocaleString()} reviews` : ''}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          No matches. Try adding the city, or{' '}
          <button type="button" onClick={() => setManual(true)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 }}>
            paste a Place ID / Maps URL
          </button>.
        </div>
      )}

      <button
        type="button"
        onClick={() => setManual(true)}
        style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        Prefer to paste a Place ID or Maps URL? →
      </button>
    </div>
  )
}

export default function ConnectProperty() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const { properties, addProperty, updateProperty, removeProperty } = useProperty()
  const editing = editId ? properties.find(p => p.id === editId) || null : null
  const isEdit = !!editing

  const [propertyName, setPropertyName] = useState(editing?.property_name || '')
  const [bookingInput, setBookingInput] = useState(editing?.booking_hotel_id || '')
  const [expediaInput, setExpediaInput] = useState(editing?.expedia_property_id || '')
  const [googleInput, setGoogleInput] = useState(editing?.google_place_id || '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  // PropertyContext loads asynchronously — when editing a property that wasn't
  // in memory at first render, populate the form once it becomes available.
  useEffect(() => {
    if (editing) {
      setPropertyName(editing.property_name || '')
      setBookingInput(editing.booking_hotel_id || '')
      setExpediaInput(editing.expedia_property_id || '')
      setGoogleInput(editing.google_place_id || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setUpgradeMsg('')
    setWarnings([])
    const name = propertyName.trim()
    if (!name) {
      setError('Property name is required.')
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && editing) {
        const updated = await updateProperty(editing.id, {
          property_name: name,
          booking_hotel_id: bookingInput.trim(),
          expedia_property_id: expediaInput.trim(),
          google_place_id: googleInput.trim(),
        })
        if (updated.sync_warnings?.length) {
          setWarnings(updated.sync_warnings)
        } else {
          navigate('/reviews')
        }
      } else {
        const created = await addProperty({
          property_name: name,
          booking_hotel_id: bookingInput.trim() || undefined,
          expedia_property_id: expediaInput.trim() || undefined,
          google_place_id: googleInput.trim() || undefined,
        })
        if (created.sync_warnings?.length) {
          setWarnings(created.sync_warnings)
        } else {
          navigate('/reviews')
        }
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 402) {
        setUpgradeMsg(err.message)
      } else {
        setError(err.message || 'Could not save property')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete() {
    if (!editing) return
    if (!confirm(`Remove "${editing.property_name}" and its synced reviews?`)) return
    try {
      await removeProperty(editing.id)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Could not remove property')
    }
  }

  return (
    <ThemedPage
      eyebrow="Properties"
      title={isEdit ? `Edit ${editing?.property_name}` : 'Connect a property'}
      subtitle={isEdit
        ? 'Add or remove OTA links. Removing a link also deletes its synced reviews.'
        : 'Name your property, then link Booking.com, Expedia, and Google. Each link starts syncing as soon as you save.'}
    >
      <div style={{ maxWidth: 680 }}>
        {upgradeMsg && <div style={{ marginBottom: 14 }}><UpgradeNotice message={upgradeMsg} /></div>}
        {error && <div className="error-msg" style={{ marginBottom: 14 }}>{error}</div>}

        {warnings.length > 0 && (
          <div style={{
            background: 'var(--warn-soft)', border: '1px solid #f5e0b8', color: 'var(--warn)',
            padding: '14px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13, lineHeight: 1.55,
          }}>
            <strong>Saved, but a couple of things need attention:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
            </ul>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/reviews')}
              >
                Got it — go to reviews
              </button>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit}>
          {/* Step 1 — Property details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <SectionHeader n={1} title="Property details" hint="What we should call this property across the app." />
            <label style={{ display: 'block' }}>
              <FieldLabel>Property name <span style={{ color: 'var(--bad)' }}>*</span></FieldLabel>
              <input
                type="text"
                className="filter-input"
                value={propertyName}
                onChange={e => setPropertyName(e.target.value)}
                autoFocus
                required
                style={{ width: '100%' }}
              />
            </label>
          </div>

          {/* Step 2 — Connect channels */}
          <div className="card" style={{ marginBottom: 16 }}>
            <SectionHeader
              n={2}
              title="Connect channels"
              hint="All three are optional — connect what you have now and add the rest later."
            />

            <ChannelRow
              first
              name="Booking.com"
              dotColor="#1e5aa7"
              helper="Paste your hotel's page URL or its numeric hotel ID."
              isEdit={isEdit}
              linked={!!bookingInput}
              onRemove={() => setBookingInput('')}
            >
              <input
                type="text"
                className="filter-input"
                value={bookingInput}
                onChange={e => setBookingInput(e.target.value)}
                style={{ width: '100%' }}
              />
              <HowTo>
                <Step n={1}>Go to <Code>booking.com</Code> and open your hotel's page.</Step>
                <Step n={2}>Copy the full page URL from your browser's address bar.</Step>
                <Step n={3}>Paste it here — we'll pull out the hotel ID automatically.</Step>
                <div style={{ marginTop: 8 }}>
                  Already know the numeric ID (e.g. <Code>58310</Code>)? Just paste that.
                </div>
              </HowTo>
            </ChannelRow>

            <ChannelRow
              name="Expedia"
              dotColor="#b07207"
              helper="Paste your hotel's page URL or its property ID."
              isEdit={isEdit}
              linked={!!expediaInput}
              onRemove={() => setExpediaInput('')}
            >
              <input
                type="text"
                className="filter-input"
                value={expediaInput}
                onChange={e => setExpediaInput(e.target.value)}
                style={{ width: '100%' }}
              />
              <HowTo>
                <Step n={1}>Open your hotel's page on <Code>expedia.com</Code>.</Step>
                <Step n={2}>Look at the URL — the property ID is the number in the <Code>.h12345.</Code> segment.</Step>
                <Step n={3}>Paste the whole URL, or just that number (e.g. <Code>888691</Code>).</Step>
                <div style={{
                  marginTop: 8, padding: '8px 10px', background: 'var(--warn-soft)',
                  border: '1px solid #f5e0b8', borderRadius: 8, color: 'var(--warn)',
                }}>
                  Expedia's ID is <strong>different</strong> from your Booking.com ID — don't reuse the same number.
                </div>
              </HowTo>
            </ChannelRow>

            <ChannelRow
              name="Google"
              dotColor="#237a3c"
              helper="Search by hotel name and pick the right match — we store the Place ID for you."
              isEdit={isEdit}
              linked={!!googleInput}
            >
              <GooglePlacePicker value={googleInput} onChange={setGoogleInput} />
            </ChannelRow>

            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              Google's API only returns the latest 5 reviews; Booking &amp; Expedia sync full history.
            </div>
          </div>

          {/* Step 3 — Review & save */}
          <div className="card">
            <SectionHeader
              n={3}
              title={isEdit ? 'Save changes' : 'Review & connect'}
              hint={isEdit
                ? 'Saving re-syncs any changed links right away.'
                : 'Syncing starts as soon as you save — reviews usually appear within a minute.'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              {isEdit ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={onDelete}
                  disabled={submitting}
                >
                  Delete property
                </button>
              ) : <span />}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !propertyName.trim()}
                >
                  {submitting
                    ? (isEdit ? 'Saving…' : 'Connecting…')
                    : (isEdit ? 'Save changes' : 'Connect & sync')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </ThemedPage>
  )
}
