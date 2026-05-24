import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProperty } from '../context/PropertyContext'
import SyncFooter from '../components/SyncFooter'
import ThemedPage from '../components/ThemedPage'

interface CalendarEvent {
  name: string
  date: string
  start_time: string | null
  venue: string
  venue_distance_miles: number | null
  classification: string
  url: string | null
  impact_score: number
  impact_label: string
  impact_emoji: string
}

interface CalendarDay {
  date: string
  is_weekend: boolean
  holiday: string | null
  events: CalendarEvent[]
  event_count: number
  weather_temp_high: number | null
  weather_temp_low: number | null
  weather_summary: string
  weather_emoji: string
  precip_in: number | null
  demand_score: number
}

interface CalendarResponse {
  property_id: string
  property_name: string
  start_date: string
  end_date: string
  radius_miles: number
  ticketmaster_configured: boolean
  days: CalendarDay[]
  fetched_at: string
  cached: boolean
}

interface MonthData {
  days: CalendarDay[]
  fetched_at: string
  cached: boolean
  ticketmaster_configured: boolean
  radius_miles: number
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December']

function demandColor(score: number): { bg: string; text: string } {
  if (score >= 4) return { bg: '#fee2e2', text: '#991b1b' }
  if (score >= 3) return { bg: '#ffedd5', text: '#9a3412' }
  if (score >= 2) return { bg: '#fef9c3', text: '#854d0e' }
  if (score >= 1) return { bg: '#ecfccb', text: '#365314' }
  return { bg: '#f8f8f8', text: '#777' }
}

function demandLabel(score: number): string {
  if (score >= 4) return 'Very high'
  if (score >= 3) return 'High'
  if (score >= 2) return 'Moderate'
  if (score >= 1) return 'Low'
  return 'Quiet'
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// Compute the request window for a given month, clamped to [today, today + 365 days].
function monthRange(year: number, month: number): { start: string; end: string } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxEnd = new Date(today)
  maxEnd.setDate(maxEnd.getDate() + 365)

  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0) // last day of the month

  // Whole month is in the past — nothing to fetch.
  if (monthEnd < today) return null
  // Whole month is past the +365 horizon — nothing to fetch.
  if (monthStart > maxEnd) return null

  const start = monthStart < today ? today : monthStart
  const end = monthEnd > maxEnd ? maxEnd : monthEnd
  return { start: isoDate(start), end: isoDate(end) }
}

export default function Calendar() {
  const { properties, selectedProperty, setSelectedProperty } = useProperty()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  // Per-month cache: monthKey -> MonthData
  const [monthsLoaded, setMonthsLoaded] = useState<Map<string, MonthData>>(new Map())
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set())

  // Month being viewed
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Reset cache when property changes
  useEffect(() => {
    setMonthsLoaded(new Map())
    setLoadingMonths(new Set())
    setExpandedDate(null)
    setError('')
  }, [selectedProperty?.id])

  useEffect(() => {
    if (!selectedProperty && properties.length > 0) {
      setSelectedProperty(properties[0])
    }
  }, [properties, selectedProperty, setSelectedProperty])

  const propertyIdRef = useRef<string | null>(null)
  propertyIdRef.current = selectedProperty?.id ?? null

  const fetchMonth = useCallback(async (year: number, month: number, forceRefresh = false) => {
    const key = monthKey(year, month)
    const propertyId = propertyIdRef.current
    if (!propertyId) return
    if (!forceRefresh && monthsLoaded.has(key)) return
    if (loadingMonths.has(key)) return

    const range = monthRange(year, month)
    if (!range) return // out of supported window

    setLoadingMonths(prev => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    setError('')
    try {
      const params = new URLSearchParams({ start_date: range.start, end_date: range.end })
      if (forceRefresh) params.set('force_refresh', 'true')
      const res = await fetch(`/api/calendar/${propertyId}?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || json.detail || `Failed to load ${MONTH_NAMES[month]} ${year}`)

      // Discard the response if the user has switched property since we kicked off the request.
      if (propertyIdRef.current !== propertyId) return

      const monthData: MonthData = {
        days: (json as CalendarResponse).days,
        fetched_at: json.fetched_at,
        cached: json.cached,
        ticketmaster_configured: json.ticketmaster_configured,
        radius_miles: json.radius_miles,
      }
      setMonthsLoaded(prev => {
        const next = new Map(prev)
        next.set(key, monthData)
        return next
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load month')
    } finally {
      setLoadingMonths(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [monthsLoaded, loadingMonths])

  // Whenever the viewed month changes (or property changes), make sure that month is loaded.
  useEffect(() => {
    if (selectedProperty) fetchMonth(viewYear, viewMonth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty?.id, viewYear, viewMonth])

  const currentMonthKey = monthKey(viewYear, viewMonth)
  const currentMonthData = monthsLoaded.get(currentMonthKey) ?? null
  const currentMonthLoading = loadingMonths.has(currentMonthKey)

  // Index days by ISO date for fast lookup (only the currently-viewed month)
  const daysByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>()
    if (currentMonthData) {
      for (const d of currentMonthData.days) map.set(d.date, d)
    }
    return map
  }, [currentMonthData])

  // Boundaries: can navigate from today's month to today's month + 12 (so 13 months total).
  const todayMonthKey = monthKey(today.getFullYear(), today.getMonth())
  const maxNavDate = new Date(today.getFullYear(), today.getMonth() + 12, 1)
  const maxMonthKey = monthKey(maxNavDate.getFullYear(), maxNavDate.getMonth())
  const canGoBack = currentMonthKey > todayMonthKey
  const canGoForward = currentMonthKey < maxMonthKey

  function nextMonth() {
    if (!canGoForward) return
    setExpandedDate(null)
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  function prevMonth() {
    if (!canGoBack) return
    setExpandedDate(null)
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function goToToday() {
    setExpandedDate(null)
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  function jumpToRates(d: string) {
    const checkout = new Date(d + 'T00:00:00')
    checkout.setDate(checkout.getDate() + 1)
    const co = isoDate(checkout)
    navigate(`/rates?checkin=${d}&checkout=${co}`)
  }

  // Build the month grid: leading blanks for offset + days of month + trailing blanks to fill weeks.
  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startWeekday = firstOfMonth.getDay() // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    type Cell = { iso: string; dayNum: number; inMonth: boolean }
    const cells: Cell[] = []
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i)
      cells.push({ iso: isoDate(d), dayNum: d.getDate(), inMonth: false })
    }
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(viewYear, viewMonth, dayNum)
      cells.push({ iso: isoDate(d), dayNum, inMonth: true })
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]
      const lastD = new Date(last.iso + 'T00:00:00')
      lastD.setDate(lastD.getDate() + 1)
      cells.push({ iso: isoDate(lastD), dayNum: lastD.getDate(), inMonth: false })
    }
    return cells
  }, [viewYear, viewMonth])

  const isoTodayStr = isoDate(today)

  return (
    <ThemedPage
      eyebrow="📅 Demand Calendar"
      title={selectedProperty ? selectedProperty.property_name : 'Demand Calendar'}
      subtitle={selectedProperty
        ? `${selectedProperty.property_name} — events, weather, and holidays driving demand`
        : 'Connect a property to see the demand calendar'}
    >

      {/* Top controls */}
      <div className="filters">
        <select
          className="filter-select"
          value={selectedProperty?.id || ''}
          onChange={e => {
            const p = properties.find(x => x.id === e.target.value) || null
            setSelectedProperty(p)
          }}
          style={{ minWidth: 240 }}
        >
          <option value="" disabled>Select a property…</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.property_name}</option>
          ))}
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchMonth(viewYear, viewMonth, true)}
          disabled={currentMonthLoading || !selectedProperty}
        >
          {currentMonthLoading ? 'Loading…' : '↻ Force refresh this month'}
        </button>

        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          Demand:
          {[0, 1, 2, 3, 4, 5].map(s => (
            <span key={s} style={{
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 11,
              background: demandColor(s).bg,
              color: demandColor(s).text,
            }}>
              {demandLabel(s)}
            </span>
          ))}
        </span>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {!selectedProperty && (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📅</div>
          <p>Add a property from the sidebar to start tracking demand drivers.</p>
        </div>
      )}

      {selectedProperty && (
        <>
          {/* Month navigation header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={prevMonth}
              disabled={!canGoBack}
              title={canGoBack ? 'Previous month' : 'Cannot view past months'}
            >
              ← Prev month
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </h2>
              {currentMonthKey !== todayMonthKey && (
                <button
                  onClick={goToToday}
                  style={{
                    background: 'transparent',
                    border: '1px solid #6c63ff',
                    color: '#6c63ff',
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Today
                </button>
              )}
              {currentMonthLoading && (
                <span style={{ fontSize: 12, color: '#888' }}>Loading…</span>
              )}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={nextMonth}
              disabled={!canGoForward}
              title={canGoForward ? 'Next month' : 'Reached 12-month horizon'}
            >
              Next month →
            </button>
          </div>

          {currentMonthData && !currentMonthData.ticketmaster_configured && (
            <div className="error-msg" style={{ background: '#fef9c3', border: '1px solid #fde047', color: '#713f12' }}>
              <strong>Events not connected.</strong> Set <code>TICKETMASTER_API_KEY</code> in your backend env (free key at{' '}
              <a href="https://developer.ticketmaster.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#713f12' }}>
                developer.ticketmaster.com
              </a>
              ). Weather and holidays still work without it.
            </div>
          )}

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map(w => (
              <div key={w} style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', textAlign: 'center', padding: '6px 0' }}>
                {w}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, position: 'relative', minHeight: 200 }}>
            {!currentMonthData && currentMonthLoading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.7)', borderRadius: 6, zIndex: 1,
              }}>
                <span style={{ color: '#666', fontSize: 14 }}>Loading {MONTH_NAMES[viewMonth]} {viewYear}…</span>
              </div>
            )}
            {monthGrid.map(cell => {
              const day = daysByDate.get(cell.iso)
              const isPast = cell.iso < isoTodayStr
              const isToday = cell.iso === isoTodayStr
              const isExpanded = expandedDate === cell.iso

              if (!cell.inMonth) {
                return <div key={cell.iso + '-out'} style={{ minHeight: 110, padding: 8, color: '#ccc', fontSize: 12 }}>{cell.dayNum}</div>
              }

              if (!day) {
                return (
                  <div key={cell.iso} style={{
                    minHeight: 110,
                    padding: 8,
                    background: isPast ? '#fafafa' : '#fff',
                    border: `1px solid ${isToday ? '#6c63ff' : '#eee'}`,
                    borderRadius: 6,
                    color: '#bbb',
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600 }}>{cell.dayNum}</div>
                    <div style={{ fontSize: 10, marginTop: 4 }}>
                      {isPast ? '(past)' : currentMonthLoading ? '…' : ''}
                    </div>
                  </div>
                )
              }

              const c = demandColor(day.demand_score)
              return (
                <div
                  key={cell.iso}
                  onClick={() => setExpandedDate(isExpanded ? null : cell.iso)}
                  style={{
                    minHeight: 110,
                    padding: 8,
                    background: c.bg,
                    border: `1px solid ${isToday ? '#6c63ff' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11,
                    transition: 'transform 0.1s',
                    position: 'relative',
                    boxShadow: isExpanded ? '0 4px 12px rgba(108,99,255,0.25)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#222' }}>{cell.dayNum}</span>
                    {day.is_weekend && (
                      <span style={{ fontSize: 9, color: '#6c63ff', fontWeight: 700 }}>WKND</span>
                    )}
                  </div>

                  {day.holiday && (
                    <div style={{ color: '#6b21a8', fontWeight: 500, marginTop: 2, lineHeight: 1.2 }} title={day.holiday}>
                      🎌 {day.holiday.length > 18 ? day.holiday.slice(0, 18) + '…' : day.holiday}
                    </div>
                  )}

                  {day.weather_temp_high !== null && (
                    <div style={{ color: '#444', marginTop: 2 }}>
                      {day.weather_emoji} {Math.round(day.weather_temp_high)}°
                    </div>
                  )}

                  {day.event_count > 0 && (() => {
                    const topImpact = day.events.reduce((max, e) => Math.max(max, e.impact_score), 0)
                    return (
                      <div style={{ marginTop: 4, color: c.text, fontWeight: 600 }}>
                        🎟️ {day.event_count} event{day.event_count > 1 ? 's' : ''}
                        {topImpact >= 2 && (
                          <span title="Highest event impact on this day">
                            {' '}{topImpact === 3 ? '🎯' : '✈️'}
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  <div style={{
                    position: 'absolute',
                    bottom: 4,
                    left: 8,
                    right: 8,
                    fontSize: 9,
                    color: c.text,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                  }}>
                    {demandLabel(day.demand_score)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Expanded day details */}
          {expandedDate && daysByDate.get(expandedDate) && currentMonthData && (() => {
            const d = daysByDate.get(expandedDate)!
            const dDate = new Date(expandedDate + 'T00:00:00')
            return (
              <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      {dDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                      <span style={{ color: demandColor(d.demand_score).text, fontWeight: 600 }}>
                        {demandLabel(d.demand_score)} demand
                      </span>
                      {d.holiday && <span> · 🎌 {d.holiday}</span>}
                      {d.weather_temp_high !== null && (
                        <span> · {d.weather_emoji} {Math.round(d.weather_temp_high)}°/{Math.round(d.weather_temp_low ?? 0)}°F · {d.weather_summary}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => jumpToRates(expandedDate)}
                    className="btn btn-primary btn-sm"
                  >
                    Check rates →
                  </button>
                </div>

                {d.event_count > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {d.event_count} event{d.event_count > 1 ? 's' : ''} within {currentMonthData.radius_miles} mi
                      <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                        — sorted by likely hotel impact
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                      {[...d.events]
                        .sort((a, b) => b.impact_score - a.impact_score)
                        .map((e, i) => {
                          const impactBg = e.impact_score >= 3 ? '#fee2e2'
                            : e.impact_score >= 2 ? '#ffedd5'
                            : e.impact_score >= 1 ? '#fef9c3'
                            : '#f1f5f9'
                          const impactText = e.impact_score >= 3 ? '#991b1b'
                            : e.impact_score >= 2 ? '#9a3412'
                            : e.impact_score >= 1 ? '#854d0e'
                            : '#475569'
                          return (
                            <div key={i} style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #eee' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                <div style={{ flex: 1 }}>
                                  {e.classification && (
                                    <div style={{ fontSize: 10, color: '#6c63ff', fontWeight: 600, textTransform: 'uppercase' }}>
                                      {e.classification}
                                    </div>
                                  )}
                                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{e.name}</div>
                                </div>
                                {e.impact_label && (
                                  <span
                                    title={`Estimated hotel-demand impact: ${e.impact_label}`}
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      background: impactBg,
                                      color: impactText,
                                      padding: '2px 6px',
                                      borderRadius: 10,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {e.impact_emoji} {e.impact_label}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                                {e.venue}
                                {e.venue_distance_miles !== null && ` · ${e.venue_distance_miles.toFixed(1)} mi`}
                                {e.start_time && ` · ${e.start_time.slice(0, 5)}`}
                              </div>
                              {e.url && (
                                <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#6c63ff' }}>
                                  View on Ticketmaster ↗
                                </a>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#888', fontSize: 13 }}>
                    {currentMonthData.ticketmaster_configured ? 'No events listed for this day.' : 'Connect Ticketmaster to see events.'}
                  </div>
                )}
              </div>
            )
          })()}

          {currentMonthData && (
            <p style={{ fontSize: 12, color: '#888', marginTop: 16, lineHeight: 1.5 }}>
              {MONTH_NAMES[viewMonth]} {viewYear} loaded <strong>{new Date(currentMonthData.fetched_at).toLocaleString()}</strong>
              {currentMonthData.cached && <span style={{ marginLeft: 6, color: '#6c63ff' }}>· from cache</span>}
              <span> · </span>
              Months load on demand as you navigate. Events from Ticketmaster within {currentMonthData.radius_miles} mi · weather forecast covers
              ~16 days from today (Open-Meteo) · holidays detected for the property's country.
            </p>
          )}
        </>
      )}
      <SyncFooter domain="calendar" />
    </ThemedPage>
  )
}
