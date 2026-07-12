import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProperty } from '../context/PropertyContext'
import SyncFooter from '../components/SyncFooter'
import ThemedPage from '../components/ThemedPage'
import UpgradeNotice, { isUpgradeBlocked } from '../components/UpgradeNotice'

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
  ota_counts?: Record<string, number>
}

const PAGE_LIMIT = 20

function scoreBadgeClass(score: number | null): string {
  if (score === null) return 'score-badge'
  if (score >= 8) return 'score-badge score-high'
  if (score >= 6) return 'score-badge score-mid'
  return 'score-badge score-low'
}

// Neutral look for reviews without a numeric score (the class only covers high/mid/low).
const noScoreStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  color: 'var(--text-faint)',
  boxShadow: 'inset 0 0 0 1px var(--border)',
}

function otaBadgeClass(ota: string): string {
  const name = ota.toLowerCase()
  if (name.includes('booking')) return 'ota-badge ota-booking'
  if (name.includes('expedia')) return 'ota-badge ota-expedia'
  if (name.includes('google')) return 'ota-badge ota-google'
  if (name.includes('airbnb')) return 'ota-badge ota-airbnb'
  return 'ota-badge ota-default'
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

export default function Reviews() {
  const { selectedProperty } = useProperty()
  // URL search params let other pages (Analytics drill-down) link straight into a pre-filtered view.
  const [searchParams, setSearchParams] = useSearchParams()
  const [reviews, setReviews] = useState<Review[]>([])
  const [otaCounts, setOtaCounts] = useState<Record<string, number>>({})
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

  // AI draft reply state — only one open at a time.
  const [aiDraftFor, setAiDraftFor] = useState<string | null>(null)
  const [aiDraftText, setAiDraftText] = useState('')
  const [aiDraftLoading, setAiDraftLoading] = useState(false)
  const [aiDraftError, setAiDraftError] = useState('')
  const [aiUpgradeMsg, setAiUpgradeMsg] = useState('')
  const [aiCopied, setAiCopied] = useState(false)

  function readReplyPrefs() {
    try {
      const raw = localStorage.getItem('reptruly_settings')
      if (!raw) return { tone: 'warm', language: 'en', signature: '' }
      const parsed = JSON.parse(raw)
      const reply = parsed?.reply || {}
      return {
        tone: reply.tone || 'warm',
        language: reply.language || 'en',
        signature: reply.signature || '',
      }
    } catch {
      return { tone: 'warm', language: 'en', signature: '' }
    }
  }

  async function fetchAIDraft(reviewId: string) {
    setAiDraftLoading(true)
    setAiDraftError('')
    setAiUpgradeMsg('')
    setAiCopied(false)
    const prefs = readReplyPrefs()
    try {
      const res = await fetch(`/api/reviews/${reviewId}/draft-reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (isUpgradeBlocked(res.status)) {
        const body = await res.json().catch(() => ({}))
        setAiUpgradeMsg(body.detail || body.message || 'AI reply drafting is a Pro feature.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || body.detail || `Draft failed (${res.status})`)
      }
      const data = await res.json()
      setAiDraftText(data.draft || '')
    } catch (e: any) {
      setAiDraftError(e.message || 'Could not generate draft')
    } finally {
      setAiDraftLoading(false)
    }
  }

  function openAIDraft(reviewId: string) {
    setAiDraftFor(reviewId)
    setAiDraftText('')
    setAiDraftError('')
    setAiUpgradeMsg('')
    setAiCopied(false)
    fetchAIDraft(reviewId)
  }

  function closeAIDraft() {
    setAiDraftFor(null)
    setAiDraftText('')
    setAiDraftError('')
    setAiUpgradeMsg('')
    setAiCopied(false)
  }

  async function copyAndOpen(reviewId: string, otaName: string, propertyId: string) {
    try {
      await navigator.clipboard.writeText(aiDraftText)
      setAiCopied(true)
    } catch {
      // Clipboard API failed (insecure context, etc.) — fall through to opening the tab anyway.
    }
    const href = replyUrlForReview(otaName, propertyId)
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
    // Keep the panel open briefly so the user sees the "copied" state.
    setTimeout(() => {
      if (aiDraftFor === reviewId) setAiCopied(false)
    }, 2500)
  }

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
      setOtaCounts(json.ota_counts || {})
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

  // CSV download honoring the current filters (same params as fetchReviews, minus paging).
  const exportParams = new URLSearchParams()
  if (selectedProperty) exportParams.set('property_name', selectedProperty.property_name)
  if (search) exportParams.set('search', search)
  if (otaFilter) exportParams.set('ota_name', otaFilter)
  if (replyFilter !== '') exportParams.set('has_reply', replyFilter)
  if (minScore) exportParams.set('min_score', minScore)
  if (maxScore) exportParams.set('max_score', maxScore)
  if (fromDateParam) exportParams.set('from_date', fromDateParam)
  if (toDateParam) exportParams.set('to_date', toDateParam)
  const exportHref = `/api/reviews/export/csv${exportParams.toString() ? `?${exportParams}` : ''}`

  return (
    <ThemedPage
      eyebrow="Review inbox"
      title={selectedProperty ? selectedProperty.property_name : 'All properties'}
      subtitle={selectedProperty
        ? `${selectedProperty.location || 'Booking · Expedia · Google'} — guest reviews in one timeline`
        : 'Every guest review from Booking, Expedia, and Google in one timeline.'}
      actions={
        <a
          href={exportHref}
          download
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none' }}
          title={hasActiveFilters ? 'Downloads the currently filtered reviews' : 'Downloads all reviews'}
        >
          ↓ Export CSV
        </a>
      }
    >
      {/* Filters — per-OTA count chips + all filter controls in one row */}
      <div className="filters">
        {/* Per-OTA count chips — one tap to see e.g. Google reviews that would otherwise
            be buried under thousands of Booking.com reviews in the date-sorted list. */}
        {Object.keys(otaCounts).length > 0 && (() => {
          const allTotal = Object.values(otaCounts).reduce((a, b) => a + b, 0)
          const chip = (label: string, value: string, count: number, active: boolean) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setOtaFilter(value)}
              className={active ? 'chip chip-accent' : 'chip'}
              style={{ cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {label}
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
                {count.toLocaleString()}
              </span>
            </button>
          )
          return [
            chip('All', '', allTotal, otaFilter === ''),
            ...Object.entries(otaCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => chip(name, name, count, otaFilter.toLowerCase() === name.toLowerCase())),
          ]
        })()}

        <select className="filter-select" value={otaFilter} onChange={e => setOtaFilter(e.target.value)}>
          <option value="">All OTAs</option>
          <option value="Booking.com">Booking.com</option>
          <option value="Expedia">Expedia</option>
          <option value="Google">Google</option>
          <option value="Airbnb">Airbnb</option>
        </select>

        {/* Reply status — small exclusive toggle, so a segmented control */}
        <div className="seg">
          <button type="button" className={`seg-btn${replyFilter === '' ? ' active' : ''}`} onClick={() => setReplyFilter('')}>
            Any status
          </button>
          <button type="button" className={`seg-btn${replyFilter === 'false' ? ' active' : ''}`} onClick={() => setReplyFilter('false')}>
            Needs reply
          </button>
          <button type="button" className={`seg-btn${replyFilter === 'true' ? ' active' : ''}`} onClick={() => setReplyFilter('true')}>
            Replied
          </button>
        </div>

        <input
          className="filter-input" style={{ width: 100 }}
          type="number" placeholder="Min score" min="0" max="10" step="0.5"
          value={minScore} onChange={e => setMinScore(e.target.value)}
        />
        <input
          className="filter-input" style={{ width: 100 }}
          type="number" placeholder="Max score" min="0" max="10" step="0.5"
          value={maxScore} onChange={e => setMaxScore(e.target.value)}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
          From
          <input
            className="filter-input"
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            max={toDate || undefined}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
          To
          <input
            className="filter-input"
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            min={fromDate || undefined}
          />
        </label>

        <input
          className="filter-input" style={{ flex: '1 1 200px', minWidth: 180 }}
          type="text" placeholder="Search review text…"
          value={search} onChange={e => setSearch(e.target.value)}
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSearch(''); setOtaFilter(''); setReplyFilter('')
            setMinScore(''); setMaxScore(''); setFromDate(''); setToDate('')
            // Also drop URL params so the URL doesn't lie about the active filter set.
            setSearchParams({})
          }}
          disabled={!hasActiveFilters}
        >
          Clear filters
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Reviews list */}
      <div>
        {loading ? (
          <div className="loading">Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">
            <h3>No reviews match these filters</h3>
            <p>
              {hasActiveFilters ? 'Try clearing filters or expanding the date range.' : 'Connect a property to start syncing reviews.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedReview(r)}
                className="card"
                style={{
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.borderColor = ''
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'start' }}>
                  {/* Score column */}
                  <div className={scoreBadgeClass(r.overall_score)} style={r.overall_score === null ? noScoreStyle : undefined}>
                    {r.overall_score !== null ? r.overall_score.toFixed(1) : '—'}
                  </div>

                  {/* Content column */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className={otaBadgeClass(r.ota_name)}>{r.ota_name || 'Other'}</span>
                      {r.property_name && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.property_name}</span>
                      )}
                      {r.reviewer_name && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {r.reviewer_name}</span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                        {formatDate(r.reviewed_at)}
                      </span>
                    </div>

                    <div style={{
                      fontSize: 14, lineHeight: 1.55, color: 'var(--text)',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {r.content || <em style={{ color: 'var(--text-faint)' }}>No review text</em>}
                    </div>

                    {r.reply && (
                      <div style={{
                        marginTop: 10, padding: '8px 12px',
                        background: 'var(--surface-2)',
                        borderLeft: '3px solid var(--accent)',
                        borderRadius: 6, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5,
                      }}>
                        ↳ {r.reply.length > 140 ? r.reply.slice(0, 140) + '…' : r.reply}
                      </div>
                    )}
                  </div>

                  {/* Status / action column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 110 }}>
                    {r.has_reply ? (
                      <span className="chip chip-good">✓ Replied</span>
                    ) : (
                      <span className="chip chip-warn">Pending</span>
                    )}
                    {!r.has_reply && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={e => { e.stopPropagation(); openAIDraft(r.id) }}
                        disabled={aiDraftFor === r.id && aiDraftLoading}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        AI draft
                      </button>
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
                          className="btn btn-primary btn-sm"
                          style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          {replyButtonLabel(r.ota_name)}
                        </a>
                      ) : null
                    })()}
                  </div>
                </div>

                {/* AI draft panel — inline editor for the active review */}
                {aiDraftFor === r.id && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 16,
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 10,
                    }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'var(--accent)',
                      }}>
                        AI-drafted reply
                      </div>
                      <button
                        type="button"
                        onClick={closeAIDraft}
                        style={{
                          background: 'transparent', color: 'var(--text-faint)', border: 'none',
                          padding: '4px 6px', fontSize: 16, cursor: 'pointer', lineHeight: 1,
                        }}
                        aria-label="Close"
                      >×</button>
                    </div>

                    {aiDraftLoading && (
                      <div style={{
                        padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)',
                        fontSize: 13, fontWeight: 600,
                      }}>
                        Drafting a reply… <span style={{ opacity: 0.7 }}>(usually ~2s)</span>
                      </div>
                    )}

                    {!aiDraftLoading && aiUpgradeMsg && (
                      <UpgradeNotice message={aiUpgradeMsg} />
                    )}

                    {!aiDraftLoading && aiDraftError && (
                      <div className="error-msg" style={{ marginBottom: 0 }}>
                        {aiDraftError}
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => fetchAIDraft(r.id)}
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    )}

                    {!aiDraftLoading && !aiDraftError && !aiUpgradeMsg && (
                      <>
                        <textarea
                          value={aiDraftText}
                          onChange={e => { setAiDraftText(e.target.value); setAiCopied(false) }}
                          rows={5}
                          style={{
                            width: '100%', padding: '11px 13px', fontSize: 13.5,
                            lineHeight: 1.55, borderRadius: 10,
                            border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)',
                            outline: 'none', fontFamily: 'inherit', resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{
                          marginTop: 6, fontSize: 11, color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        }}>
                          <span>Tone & language from your <a href="/settings" style={{ color: 'var(--accent)', fontWeight: 600 }}>Settings</a>.</span>
                          <span style={{ color: 'var(--text-faint)' }}>· Edit freely before sending.</span>
                        </div>
                        <div style={{
                          marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap',
                          alignItems: 'center',
                        }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => copyAndOpen(r.id, r.ota_name, r.property_id)}
                            disabled={!aiDraftText.trim()}
                            style={aiCopied ? { background: 'var(--good)', boxShadow: 'none' } : undefined}
                          >
                            {aiCopied
                              ? '✓ Copied — opening tab'
                              : `Copy & open ${r.ota_name || 'OTA'} ↗`}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => fetchAIDraft(r.id)}
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(aiDraftText); setAiCopied(true); setTimeout(() => setAiCopied(false), 1800) } catch {}
                            }}
                            disabled={!aiDraftText.trim()}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Copy only
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && total > 0 && (
          <div
            className="pagination"
            style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-sm)' }}
          >
            <span className="pagination-info">
              Showing <strong style={{ color: 'var(--text)' }}>{(page - 1) * PAGE_LIMIT + 1}–{Math.min(page * PAGE_LIMIT, total)}</strong> of <strong style={{ color: 'var(--text)' }}>{total}</strong> reviews
            </span>
            <div className="pagination-btns">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => fetchReviews(page - 1)}
              >← Prev</button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => fetchReviews(page + 1)}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedReview && (
        <div className="modal-overlay" onClick={() => setSelectedReview(null)} style={{ padding: 16 }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ padding: 0, maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{
              padding: '20px 24px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              borderRadius: '18px 18px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  className={scoreBadgeClass(selectedReview.overall_score)}
                  style={{
                    width: 56, height: 56, fontSize: 18,
                    ...(selectedReview.overall_score === null ? noScoreStyle : undefined),
                  }}
                >
                  {selectedReview.overall_score !== null ? selectedReview.overall_score.toFixed(1) : '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className={otaBadgeClass(selectedReview.ota_name)}>{selectedReview.ota_name || 'Other'}</span>
                  <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 6, fontWeight: 600 }}>
                    {selectedReview.property_name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatDate(selectedReview.reviewed_at)}
                    {selectedReview.reviewer_name && <span> · {selectedReview.reviewer_name}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{
                background: 'var(--surface-2)', borderRadius: 10, padding: '14px 16px',
                marginBottom: 16, fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
                border: '1px solid var(--border)',
              }}>
                {selectedReview.content || <em style={{ color: 'var(--text-faint)' }}>No review text</em>}
              </div>

              {selectedReview.reply && (
                <div style={{ marginBottom: 16 }}>
                  <div className="section-title" style={{ marginBottom: 6 }}>
                    Hotelier response
                  </div>
                  <div style={{
                    background: 'var(--accent-soft)',
                    borderLeft: '3px solid var(--accent)',
                    padding: '12px 16px', borderRadius: 8,
                    fontSize: 14, lineHeight: 1.6, color: 'var(--text)',
                  }}>
                    {selectedReview.reply}
                  </div>
                </div>
              )}

              {!selectedReview.has_reply && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                  Replies must be posted from the OTA's partner extranet — they don't allow third-party reply write-back.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedReview(null)}
                >Close</button>
                {!selectedReview.has_reply && selectedReview.property_id && (() => {
                  const href = replyUrlForReview(selectedReview.ota_name, selectedReview.property_id)
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ textDecoration: 'none' }}
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
