import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProperty } from '../context/PropertyContext'
import SyncFooter from '../components/SyncFooter'
import ThemedPage from '../components/ThemedPage'

interface Review {
  id: string
  channex_id: string
  property_id: string
  property_name: string
  ota_name: string
  reviewer_name: string
  content: string
  overall_score: number | null
  has_reply: boolean
  reply: string
  reservation_id: string
  reviewed_at: string | null
}

interface ReviewListResponse {
  data: Review[]
  total: number
  page: number
  limit: number
}

const PAGE_LIMIT = 20

const THEME = {
  pageBg: 'linear-gradient(180deg, #fff7fb 0%, #faf5ff 60%, #f5f3ff 100%)',
  cardBg: '#ffffff',
  cardBorder: '#f3e8ff',
  cardBorderHover: '#d8b4fe',
  primaryText: '#1a1a2e',
  mutedText: '#6b7280',
  accentPurple: '#7c3aed',
  accentPink: '#db2777',
  accentDeep: '#6d28d9',
  pillBg: 'linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%)',
  pillBorder: '#e9d5ff',
  inputBorder: '#e9d5ff',
  inputBorderFocus: '#a855f7',
  shadowSoft: '0 1px 3px rgba(168,85,247,0.06), 0 4px 12px rgba(192,132,252,0.10)',
  shadowHover: '0 8px 24px rgba(192,132,252,0.20)',
  gradientText: 'linear-gradient(90deg, #db2777 0%, #a855f7 55%, #6d28d9 100%)',
}

function scoreStyle(score: number | null): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 44, height: 44, borderRadius: 10, fontWeight: 800, fontSize: 15,
    border: '2px solid', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  }
  if (score === null) return { ...base, background: '#f3f4f6', color: '#9ca3af', borderColor: '#e5e7eb' }
  if (score >= 8) return { ...base, background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', color: '#065f46', borderColor: '#6ee7b7' }
  if (score >= 6) return { ...base, background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', color: '#92400e', borderColor: '#fcd34d' }
  return { ...base, background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', color: '#991b1b', borderColor: '#fca5a5' }
}

function otaPillStyle(ota: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block', padding: '4px 10px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
    border: '1px solid',
  }
  const name = ota.toLowerCase()
  if (name.includes('booking')) return { ...base, background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' }
  if (name.includes('expedia')) return { ...base, background: '#fef3c7', color: '#854d0e', borderColor: '#fde047' }
  if (name.includes('google')) return { ...base, background: '#dcfce7', color: '#166534', borderColor: '#86efac' }
  if (name.includes('airbnb')) return { ...base, background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }
  return { ...base, background: '#f3e8ff', color: '#6d28d9', borderColor: '#d8b4fe' }
}

function formatDate(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function bookingExtranetUrl(hotelId: string) {
  return `https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/guest_reviews.html?hotel_id=${encodeURIComponent(hotelId)}`
}
function expediaPartnerCentralUrl() { return 'https://apps.expediapartnercentral.com/lodging/reviews' }
function googleBusinessProfileUrl() { return 'https://business.google.com/reviews' }

function replyUrlForReview(otaName: string, propertyId: string): string | null {
  const ota = otaName.toLowerCase()
  if (ota.includes('booking')) return bookingExtranetUrl(propertyId)
  if (ota.includes('expedia') || ota.includes('hotels.com')) return expediaPartnerCentralUrl()
  if (ota.includes('google')) return googleBusinessProfileUrl()
  return null
}

function replyButtonLabel(otaName: string): string {
  return otaName ? `Reply on ${otaName} ↗` : 'Reply ↗'
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: 13,
  borderRadius: 8,
  border: `1px solid ${THEME.inputBorder}`,
  background: '#fff',
  color: THEME.primaryText,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
}

function focusRing(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = THEME.inputBorderFocus
  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(168,85,247,0.15)`
}
function blurRing(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = THEME.inputBorder
  e.currentTarget.style.boxShadow = 'none'
}

export default function Reviews() {
  const { selectedProperty } = useProperty()
  // URL search params let other pages (Analytics drill-down) link straight into a pre-filtered view.
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviews, setReviews] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters — initialised from URL params so drill-down links work on first render.
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [otaFilter, setOtaFilter] = useState(() => searchParams.get('ota_name') ?? '')
  const [replyFilter, setReplyFilter] = useState(() => searchParams.get('has_reply') ?? '')
  const [minScore, setMinScore] = useState(() => searchParams.get('min_score') ?? '')
  const [maxScore, setMaxScore] = useState(() => searchParams.get('max_score') ?? '')
  const [fromDate, setFromDate] = useState(() => searchParams.get('from_date') ?? '')
  const [toDate, setToDate] = useState(() => searchParams.get('to_date') ?? '')

  // Re-sync state when the URL changes (e.g. user clicks another drill-down link from Analytics).
  useEffect(() => {
    setSearch(searchParams.get('search') ?? '')
    setOtaFilter(searchParams.get('ota_name') ?? '')
    setReplyFilter(searchParams.get('has_reply') ?? '')
    setMinScore(searchParams.get('min_score') ?? '')
    setMaxScore(searchParams.get('max_score') ?? '')
    setFromDate(searchParams.get('from_date') ?? '')
    setToDate(searchParams.get('to_date') ?? '')
  }, [searchParams])

  // Detail modal
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)

  async function fetchReviews(p = 1) {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('limit', String(PAGE_LIMIT))
    if (selectedProperty) params.set('property_name', selectedProperty.property_name)
    if (search) params.set('search', search)
    if (otaFilter) params.set('ota_name', otaFilter)
    if (replyFilter !== '') params.set('has_reply', replyFilter)
    if (minScore) params.set('min_score', minScore)
    if (maxScore) params.set('max_score', maxScore)
    // Only send dates that fully parse as YYYY-MM-DD — stops mid-typing partials reaching the server.
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) params.set('from_date', fromDate)
    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) params.set('to_date', toDate)

    try {
      const res = await fetch(`/api/reviews?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ReviewListResponse = await res.json()
      setReviews(json.data)
      setTotal(json.total)
      setPage(p)
    } catch (e: any) {
      setError(e.message || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  // Use validated date params in the dependency array so partial date strings don't trigger refetches.
  const fromDateParam = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : ''
  const toDateParam = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : ''
  useEffect(() => { fetchReviews(1) }, [selectedProperty, search, otaFilter, replyFilter, minScore, maxScore, fromDateParam, toDateParam])

  const totalPages = Math.ceil(total / PAGE_LIMIT)
  const hasActiveFilters = !!(search || otaFilter || replyFilter || minScore || maxScore || fromDate || toDate)

  return (
    <ThemedPage
      eyebrow="⭐ Review Inbox"
      title={selectedProperty ? selectedProperty.property_name : 'All properties'}
      subtitle={selectedProperty
        ? `${selectedProperty.location || 'Booking · Expedia · Google'} — guest reviews in one timeline`
        : 'Every guest review from Booking, Expedia, and Google in one timeline.'}
    >
      {/* Filters card */}
      <div style={{
        background: THEME.cardBg,
        border: `1px solid ${THEME.cardBorder}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        boxShadow: THEME.shadowSoft,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        alignItems: 'end',
      }}>
        <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: THEME.accentPurple, marginBottom: -4 }}>
          Filter
        </div>

        <select style={inputStyle} onFocus={focusRing} onBlur={blurRing} value={otaFilter} onChange={e => setOtaFilter(e.target.value)}>
          <option value="">All OTAs</option>
          <option value="Booking.com">Booking.com</option>
          <option value="Expedia">Expedia</option>
          <option value="Google">Google</option>
          <option value="Airbnb">Airbnb</option>
        </select>

        <select style={inputStyle} onFocus={focusRing} onBlur={blurRing} value={replyFilter} onChange={e => setReplyFilter(e.target.value)}>
          <option value="">Any status</option>
          <option value="false">Needs reply</option>
          <option value="true">Replied</option>
        </select>

        <input
          style={inputStyle} onFocus={focusRing} onBlur={blurRing}
          type="number" placeholder="Min score" min="0" max="10" step="0.5"
          value={minScore} onChange={e => setMinScore(e.target.value)}
        />
        <input
          style={inputStyle} onFocus={focusRing} onBlur={blurRing}
          type="number" placeholder="Max score" min="0" max="10" step="0.5"
          value={maxScore} onChange={e => setMaxScore(e.target.value)}
        />

        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: THEME.accentDeep, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>From</label>
          <input
            style={{ ...inputStyle, width: '100%' }} onFocus={focusRing} onBlur={blurRing}
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            max={toDate || undefined}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: THEME.accentDeep, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>To</label>
          <input
            style={{ ...inputStyle, width: '100%' }} onFocus={focusRing} onBlur={blurRing}
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            min={fromDate || undefined}
          />
        </div>

        <input
          style={{ ...inputStyle, gridColumn: 'span 2' }} onFocus={focusRing} onBlur={blurRing}
          type="text" placeholder="Search review text…"
          value={search} onChange={e => setSearch(e.target.value)}
        />

        <button
          onClick={() => {
            setSearch(''); setOtaFilter(''); setReplyFilter('')
            setMinScore(''); setMaxScore(''); setFromDate(''); setToDate('')
            // Also drop URL params so the URL doesn't lie about the active filter set.
            setSearchParams({})
          }}
          disabled={!hasActiveFilters}
          style={{
            padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
            border: `1px solid ${hasActiveFilters ? '#d8b4fe' : '#e5e7eb'}`,
            background: hasActiveFilters ? 'linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%)' : '#f9fafb',
            color: hasActiveFilters ? THEME.accentDeep : '#9ca3af',
            cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          Clear filters
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
          padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13,
        }}>{error}</div>
      )}

      {/* Reviews list */}
      <div>
        {loading ? (
          <div style={{
            background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: 14,
            padding: 60, textAlign: 'center', color: THEME.accentPurple, fontSize: 14, fontWeight: 600,
            boxShadow: THEME.shadowSoft,
          }}>
            Loading reviews…
          </div>
        ) : reviews.length === 0 ? (
          <div style={{
            background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: 14,
            padding: 60, textAlign: 'center', boxShadow: THEME.shadowSoft,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: THEME.primaryText, margin: '0 0 6px' }}>
              No reviews match these filters
            </h3>
            <p style={{ color: THEME.mutedText, fontSize: 13, margin: 0 }}>
              {hasActiveFilters ? 'Try clearing filters or expanding the date range.' : 'Connect a property to start syncing reviews.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedReview(r)}
                style={{
                  background: THEME.cardBg,
                  border: `1px solid ${THEME.cardBorder}`,
                  borderRadius: 14,
                  padding: '18px 20px',
                  cursor: 'pointer',
                  boxShadow: THEME.shadowSoft,
                  transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = THEME.shadowHover
                  e.currentTarget.style.borderColor = THEME.cardBorderHover
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = THEME.shadowSoft
                  e.currentTarget.style.borderColor = THEME.cardBorder
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'start' }}>
                  {/* Score column */}
                  <div style={scoreStyle(r.overall_score)}>
                    {r.overall_score !== null ? r.overall_score.toFixed(1) : '—'}
                  </div>

                  {/* Content column */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={otaPillStyle(r.ota_name)}>{r.ota_name || 'Other'}</span>
                      {r.property_name && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: THEME.primaryText }}>{r.property_name}</span>
                      )}
                      {r.reviewer_name && (
                        <span style={{ fontSize: 12, color: THEME.accentDeep, fontWeight: 500 }}>· {r.reviewer_name}</span>
                      )}
                      <span style={{ fontSize: 12, color: THEME.mutedText, marginLeft: 'auto' }}>
                        {formatDate(r.reviewed_at)}
                      </span>
                    </div>

                    <div style={{
                      fontSize: 14, lineHeight: 1.55, color: '#1f2937',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {r.content || <em style={{ color: '#9ca3af' }}>No review text</em>}
                    </div>

                    {r.reply && (
                      <div style={{
                        marginTop: 10, padding: '8px 12px',
                        background: 'linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%)',
                        borderLeft: `3px solid ${THEME.accentPurple}`,
                        borderRadius: 6, fontSize: 12.5, color: THEME.accentDeep, lineHeight: 1.5,
                        fontWeight: 500,
                      }}>
                        ↳ {r.reply.length > 140 ? r.reply.slice(0, 140) + '…' : r.reply}
                      </div>
                    )}
                  </div>

                  {/* Status / action column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 110 }}>
                    {r.has_reply ? (
                      <span style={{
                        background: '#dcfce7', color: '#166534',
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        border: '1px solid #86efac',
                      }}>✓ Replied</span>
                    ) : (
                      <span style={{
                        background: '#fef3c7', color: '#92400e',
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        border: '1px solid #fcd34d',
                      }}>Pending</span>
                    )}
                    {!r.has_reply && r.property_id && (() => {
                      const href = replyUrlForReview(r.ota_name, r.property_id)
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title={`Opens the ${r.ota_name} partner extranet in a new tab`}
                          style={{
                            background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                            color: '#fff',
                            padding: '7px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                            boxShadow: '0 2px 8px rgba(168,85,247,0.35)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {replyButtonLabel(r.ota_name)}
                        </a>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && total > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 20, padding: '12px 4px',
          }}>
            <span style={{ fontSize: 13, color: THEME.mutedText }}>
              Showing <strong style={{ color: THEME.accentDeep }}>{(page - 1) * PAGE_LIMIT + 1}–{Math.min(page * PAGE_LIMIT, total)}</strong> of <strong style={{ color: THEME.accentDeep }}>{total}</strong> reviews
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={page === 1}
                onClick={() => fetchReviews(page - 1)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: `1px solid ${page === 1 ? '#e5e7eb' : '#d8b4fe'}`,
                  background: page === 1 ? '#f9fafb' : '#fff',
                  color: page === 1 ? '#9ca3af' : THEME.accentDeep,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >← Prev</button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchReviews(page + 1)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: '1px solid transparent',
                  background: page >= totalPages ? '#f9fafb' : 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                  color: page >= totalPages ? '#9ca3af' : '#fff',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  boxShadow: page >= totalPages ? 'none' : '0 2px 8px rgba(168,85,247,0.30)',
                }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedReview && (
        <div
          onClick={() => setSelectedReview(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(45, 27, 78, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, maxWidth: 580, width: '100%',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(109, 40, 217, 0.30)',
              border: `1px solid ${THEME.cardBorder}`,
            }}
          >
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%)',
              borderBottom: `1px solid ${THEME.cardBorder}`,
              borderRadius: '16px 16px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ ...scoreStyle(selectedReview.overall_score), minWidth: 56, height: 56, fontSize: 18 }}>
                  {selectedReview.overall_score !== null ? selectedReview.overall_score.toFixed(1) : '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={otaPillStyle(selectedReview.ota_name)}>{selectedReview.ota_name || 'Other'}</span>
                  <div style={{ fontSize: 14, color: THEME.primaryText, marginTop: 6, fontWeight: 600 }}>
                    {selectedReview.property_name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: THEME.mutedText, marginTop: 2 }}>
                    {formatDate(selectedReview.reviewed_at)}
                    {selectedReview.reviewer_name && <span style={{ color: THEME.accentDeep, fontWeight: 500 }}> · {selectedReview.reviewer_name}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{
                background: '#faf5ff', borderRadius: 10, padding: '14px 16px',
                marginBottom: 16, fontSize: 14, lineHeight: 1.7, color: '#1f2937',
                border: `1px solid ${THEME.cardBorder}`,
              }}>
                {selectedReview.content || <em style={{ color: '#9ca3af' }}>No review text</em>}
              </div>

              {selectedReview.reply && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: THEME.accentPurple,
                    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Hotelier response
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #fdf2f8 0%, #f3e8ff 100%)',
                    borderLeft: `3px solid ${THEME.accentPurple}`,
                    padding: '12px 16px', borderRadius: 8,
                    fontSize: 14, lineHeight: 1.6, color: THEME.accentDeep,
                  }}>
                    {selectedReview.reply}
                  </div>
                </div>
              )}

              {!selectedReview.has_reply && (
                <p style={{ fontSize: 12, color: THEME.mutedText, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                  Replies must be posted from the OTA's partner extranet — they don't allow third-party reply write-back.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setSelectedReview(null)}
                  style={{
                    padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                    border: '1px solid #e9d5ff', background: '#fff', color: THEME.accentDeep,
                    cursor: 'pointer',
                  }}
                >Close</button>
                {!selectedReview.has_reply && selectedReview.property_id && (() => {
                  const href = replyUrlForReview(selectedReview.ota_name, selectedReview.property_id)
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                        color: '#fff',
                        padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                        textDecoration: 'none',
                        boxShadow: '0 2px 8px rgba(168,85,247,0.35)',
                      }}
                    >{replyButtonLabel(selectedReview.ota_name)}</a>
                  ) : null
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      <SyncFooter domain="reviews" />
    </ThemedPage>
  )
}
