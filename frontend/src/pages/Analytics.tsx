import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProperty } from '../context/PropertyContext'
import SyncFooter from '../components/SyncFooter'
import ThemedPage from '../components/ThemedPage'
import UpgradeNotice, { isUpgradeBlocked } from '../components/UpgradeNotice'
import { fetchBillingStatus } from '../api/billing'

interface OTAStats {
  total: number
  avg_score: number | null
  replied: number
  pending_reply: number
  reply_rate: number | null
  score_distribution: Record<string, number>
}

interface AnalyticsData {
  total_reviews: number
  avg_score: number | null
  reviews_by_ota: Record<string, number>
  score_distribution: Record<string, number>
  replied: number
  pending_reply: number
  per_ota: Record<string, OTAStats>
}

interface OTATrends {
  weekly_avg_score: number | null
  monthly_avg_score: number | null
  weekly_count: number
  monthly_count: number
  monthly_volume: Record<string, number>
  monthly_avg: Record<string, number>
}

interface TrendsData extends OTATrends {
  per_ota: Record<string, OTATrends>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function PerOTAStat({
  label, value, sub, highlight = false,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}</div>
      <div style={{
        fontSize: highlight ? 18 : 15,
        fontWeight: highlight ? 700 : 600,
        color: 'var(--ink)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        {sub && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-faint)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function VerticalBarChart({
  data,
  color = 'var(--accent)',
  colors,
  unit = '',
  rotateLabels = false,
  barWidth = 36,
}: {
  data: Record<string, number>
  color?: string
  colors?: Record<string, string>
  unit?: string
  rotateLabels?: boolean
  barWidth?: number
}) {
  const max = Math.max(...Object.values(data), 1)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height: 200,
      paddingBottom: rotateLabels ? 40 : 28,
      paddingTop: 20,
      overflowX: 'auto',
    }}>
      {Object.entries(data).map(([label, value]) => {
        const barColor = colors?.[label] || color
        const pct = (value / max) * 100
        return (
          <div key={label} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: barWidth,
            flexShrink: 0,
            height: '100%',
            justifyContent: 'flex-end',
            position: 'relative',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {value > 0 ? (unit === '/10' ? value.toFixed(1) : value) : ''}
            </div>
            <div style={{
              width: '100%',
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              background: 'var(--surface-2)',
              borderRadius: 4,
            }}>
              <div style={{
                width: '100%',
                height: `${pct}%`,
                background: value > 0 ? barColor : 'transparent',
                borderRadius: 4,
                minHeight: value > 0 ? 4 : 0,
                transition: 'height 0.4s ease',
              }} />
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginTop: 6,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              ...(rotateLabels ? {
                transform: 'rotate(-45deg)',
                transformOrigin: 'top right',
                position: 'absolute',
                bottom: -2,
                right: '50%',
              } : {}),
            }}>
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface AISummaryData {
  positives: string
  problems: string
  review_count: number
}

function AISummaryCard({
  propertyName,
  fromDate,
  toDate,
}: {
  propertyName: string | null
  fromDate: string
  toDate: string
}) {
  const [summary, setSummary] = useState<AISummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const fetchedFor = useRef<string | null>(undefined)

  function fetchSummary() {
    const key = `${propertyName ?? '__all__'}|${fromDate}|${toDate}`
    if (fetchedFor.current === key) return
    setLoading(true)
    setError('')
    setUpgradeMsg('')
    setSummary(null)
    const params = new URLSearchParams()
    if (propertyName) params.set('property_name', propertyName)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    const qs = params.toString() ? `?${params}` : ''
    fetch(`/api/reviews/analytics/ai-summary${qs}`)
      .then(async r => {
        if (isUpgradeBlocked(r.status)) {
          const j = await r.json().catch(() => ({}))
          setUpgradeMsg(j.detail || j.message || 'AI summaries are a Pro feature.')
          return null
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { if (d) { setSummary(d); fetchedFor.current = key } })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  // Reset when property or date range changes — user must click Refresh to re-run the LLM call.
  useEffect(() => {
    setSummary(null)
    setError('')
    fetchedFor.current = undefined
  }, [propertyName, fromDate, toDate])

  return (
    <div className="card" style={{ gridColumn: '1 / -1', marginBottom: 0, borderLeft: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: summary || loading ? 16 : 0 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}>AI Review Summary</div>
          {!summary && !loading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>GPT-4o analysis of top positives and problems from guest reviews</p>
          )}
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={fetchSummary}
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? 'Analysing…' : summary ? 'Refresh' : 'Summarise reviews'}
        </button>
      </div>

      {upgradeMsg && <div style={{ marginTop: 8 }}><UpgradeNotice message={upgradeMsg} /></div>}
      {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}

      {loading && (
        <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          Analysing {propertyName ? `${propertyName}` : 'all properties'} reviews with GPT-4o…
        </div>
      )}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--good-soft)', border: '1px solid #c4ebda', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--good)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ✓ Top Positives
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary.positives}</div>
          </div>
          <div style={{ background: 'var(--bad-soft)', border: '1px solid #f6c9d3', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ✗ Top Problems
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{summary.problems}</div>
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
            Based on {summary.review_count} reviews · Powered by GPT-4o mini
          </div>
        </div>
      )}
    </div>
  )
}

type Priority = 'high' | 'medium' | 'low'

interface TopicScore {
  topic: string
  label: string
  score: number | null
  mentions: number
  note: string
  priority: Priority
}

// Semantic chips: high priority = needs attention (rose), medium = amber, low = fine (emerald).
function priorityChipClass(p: Priority): string {
  if (p === 'high') return 'chip chip-bad'
  if (p === 'medium') return 'chip chip-warn'
  return 'chip chip-good'
}

interface TopicScoresData {
  review_count: number
  topics: TopicScore[]
  cached: boolean
}

function topicBarStyle(score: number | null): { fill: string; track: string; text: string } {
  if (score === null) return { fill: 'var(--border-strong)', track: 'var(--surface-2)', text: 'var(--text-faint)' }
  if (score >= 8)  return { fill: 'var(--good)', track: 'var(--good-soft)', text: 'var(--good)' }
  if (score >= 6)  return { fill: 'var(--cyan)', track: 'rgba(8,145,178,0.12)', text: 'var(--cyan)' }
  if (score >= 4)  return { fill: 'var(--warn)', track: 'var(--warn-soft)', text: 'var(--warn)' }
  return                { fill: 'var(--bad)', track: 'var(--bad-soft)', text: 'var(--bad)' }
}

function TopicScoresCard({ propertyName, fromDate, toDate }: { propertyName: string | null; fromDate: string; toDate: string }) {
  const [data, setData] = useState<TopicScoresData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const fetchedFor = useRef<string | null>(undefined)

  function fetchTopics(force = false) {
    const key = `${propertyName ?? '__all__'}|${fromDate}|${toDate}`
    if (!force && fetchedFor.current === key) return
    setLoading(true)
    setError('')
    setUpgradeMsg('')
    setData(null)
    const params = new URLSearchParams()
    if (propertyName) params.set('property_name', propertyName)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    if (force) params.set('force_refresh', 'true')
    const qs = params.toString() ? `?${params}` : ''
    fetch(`/api/reviews/analytics/topics${qs}`)
      .then(async r => {
        if (isUpgradeBlocked(r.status)) {
          const j = await r.json().catch(() => ({}))
          setUpgradeMsg(j.detail || j.message || 'AI topic scores are a Pro feature.')
          return null
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.message || `HTTP ${r.status}`)
        }
        return r.json()
      })
      .then(d => { if (d) { setData(d); fetchedFor.current = key } })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  // Reset card when filters change — user re-runs by clicking Refresh.
  useEffect(() => {
    setData(null)
    setError('')
    fetchedFor.current = undefined
  }, [propertyName, fromDate, toDate])

  return (
    <div className="card" style={{ gridColumn: '1 / -1', marginTop: 16, borderLeft: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: data || loading ? 16 : 0 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}>Category Breakdown</div>
          {!data && !loading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Per-category sentiment with mentions, score and priority — cleanliness, housekeeping, staff, beds,
              breakfast, pool & amenities, maintenance, safety, location, value for money.
            </p>
          )}
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => fetchTopics(!!data)}
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? 'Scoring…' : data ? 'Refresh' : 'Run analysis'}
        </button>
      </div>

      {upgradeMsg && <div style={{ marginTop: 8 }}><UpgradeNotice message={upgradeMsg} /></div>}
      {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}

      {loading && (
        <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          Analysing {propertyName ? `${propertyName}'s` : 'all'} recent reviews with GPT-4o mini across 10 categories…
        </div>
      )}

      {data && (
        <div>
          {/* Priority counters at the top */}
          {(() => {
            const counts = { high: 0, medium: 0, low: 0 }
            data.topics.forEach(t => {
              counts[t.priority] = (counts[t.priority] || 0) + 1
            })
            return (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className={priorityChipClass('high')} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{counts.high} high</span>
                <span className={priorityChipClass('medium')} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{counts.medium} medium</span>
                <span className={priorityChipClass('low')} style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{counts.low} low</span>
              </div>
            )
          })()}

          {/* Table */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Score</th>
                  <th style={{ textAlign: 'right' }}>Mentions</th>
                  <th style={{ textAlign: 'center' }}>Priority</th>
                  <th>What guests say</th>
                </tr>
              </thead>
              <tbody>
                {[...data.topics]
                  .sort((a, b) => {
                    // High → Med → Low; within each, lowest score first (most painful at the top).
                    const rank = { high: 0, medium: 1, low: 2 } as const
                    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority]
                    const sa = a.score ?? 99, sb = b.score ?? 99
                    return sa - sb
                  })
                  .map(t => {
                    const colors = topicBarStyle(t.score)
                    const pct = t.score === null ? 0 : (t.score / 10) * 100
                    return (
                      <tr key={t.topic}>
                        <td style={{ fontWeight: 600, color: 'var(--ink)', verticalAlign: 'middle' }}>
                          {t.label}
                        </td>
                        <td style={{ verticalAlign: 'middle', minWidth: 160 }}>
                          {t.score === null ? (
                            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>—</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 750, color: colors.text, fontVariantNumeric: 'tabular-nums', minWidth: 30 }}>
                                {t.score.toFixed(1)}
                              </span>
                              <div style={{ flex: 1, height: 6, background: colors.track, borderRadius: 3, overflow: 'hidden', minWidth: 70 }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: colors.fill, borderRadius: 3 }} />
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text)', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums' }}>
                          {t.mentions}
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <span className={priorityChipClass(t.priority)} style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>{t.priority}</span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', lineHeight: 1.5, verticalAlign: 'middle' }}>
                          {t.note || <span style={{ color: 'var(--text-faint)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right', marginTop: 12 }}>
            Based on the latest {data.review_count} reviews{data.cached ? ' · cached' : ''} · Priority blends score and mention volume · Powered by GPT-4o mini
          </div>
        </div>
      )}
    </div>
  )
}

const OTA_COLORS: Record<string, string> = {
  Airbnb: '#ff5a5f',
  'Booking.com': '#003580',
  Expedia: '#f5a623',
  Google: '#34a853',
}

// Maps OTA names to the shared .ota-badge chip classes in styles.css.
const OTA_BADGE_CLASS: Record<string, string> = {
  Airbnb: 'ota-airbnb',
  'Booking.com': 'ota-booking',
  Expedia: 'ota-expedia',
  Google: 'ota-google',
}

interface AnalyticsView {
  total: number
  avg_score: number | null
  replied: number
  pending_reply: number
  reply_rate: number  // 0-100
  score_distribution: Record<string, number>
  weekly_avg_score: number | null
  monthly_avg_score: number | null
  weekly_count: number
  monthly_count: number
  monthly_volume: Record<string, number>
  monthly_avg: Record<string, number>
}

function buildAllOTAsView(data: AnalyticsData, trends: TrendsData): AnalyticsView {
  const replyRate = data.total_reviews > 0 ? Math.round((data.replied / data.total_reviews) * 100) : 0
  return {
    total: data.total_reviews,
    avg_score: data.avg_score,
    replied: data.replied,
    pending_reply: data.pending_reply,
    reply_rate: replyRate,
    score_distribution: data.score_distribution,
    weekly_avg_score: trends.weekly_avg_score,
    monthly_avg_score: trends.monthly_avg_score,
    weekly_count: trends.weekly_count,
    monthly_count: trends.monthly_count,
    monthly_volume: trends.monthly_volume,
    monthly_avg: trends.monthly_avg,
  }
}

function buildOTAView(ota: string, data: AnalyticsData, trends: TrendsData): AnalyticsView | null {
  const stats = data.per_ota?.[ota]
  const ot = trends.per_ota?.[ota]
  if (!stats || !ot) return null
  return {
    total: stats.total,
    avg_score: stats.avg_score,
    replied: stats.replied,
    pending_reply: stats.pending_reply,
    reply_rate: stats.reply_rate ?? 0,
    score_distribution: stats.score_distribution,
    weekly_avg_score: ot.weekly_avg_score,
    monthly_avg_score: ot.monthly_avg_score,
    weekly_count: ot.weekly_count,
    monthly_count: ot.monthly_count,
    monthly_volume: ot.monthly_volume,
    monthly_avg: ot.monthly_avg,
  }
}

type ViewMode = 'overview' | 'insights'

// Report time-period presets — drives the `days` param passed to the report page.
const REPORT_PERIODS: { value: string; label: string }[] = [
  { value: '1', label: 'Today (last 24h)' },
  { value: '2', label: 'Last 2 days' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days (weekly)' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days (monthly)' },
  { value: '90', label: 'Last 3 months' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months (yearly)' },
  { value: 'custom', label: 'Custom range…' },
]

function PropertyAnalytics({ propertyName }: { propertyName: string | null }) {
  const navigate = useNavigate()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // Top-level view selector — 'overview' (KPIs + per-OTA) or 'insights' (AI summary + category table).
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  // Active OTA tab — 'all' or an OTA name. Used inside Overview. Defaults to 'all'; resets when property changes.
  const [activeTab, setActiveTab] = useState<string>('all')
  // Date-range filter — applied to all analytics fetches (summary, trends, AI summary).
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  // Report time period — a preset number of days back, or 'custom' to use an explicit date range.
  const [reportDays, setReportDays] = useState('30')
  // Custom report range (only used when reportDays === 'custom').
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')
  // Whether the plan includes the AI sections of the report (Pro).
  const [aiLocked, setAiLocked] = useState(false)

  useEffect(() => {
    fetchBillingStatus()
      .then(s => { if (s) setAiLocked(!s.limits.ai_enabled) })
      .catch(() => {})
  }, [])

  // Only treat a date as "set" when it parses as a complete YYYY-MM-DD string. This stops
  // mid-typing partials (e.g. "2026-05-") from reaching the server and triggering bogus refetches.
  const isCompleteDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
  const fromParam = isCompleteDate(fromDate) ? fromDate : ''
  const toParam = isCompleteDate(toDate) ? toDate : ''

  useEffect(() => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (propertyName) params.set('property_name', propertyName)
    if (fromParam) params.set('from_date', fromParam)
    if (toParam) params.set('to_date', toParam)
    const qs = params.toString() ? `?${params}` : ''
    Promise.all([
      fetch(`/api/reviews/analytics/summary${qs}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch(`/api/reviews/analytics/trends${qs}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    ])
      .then(([summary, trendsData]) => { setData(summary); setTrends(trendsData) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [propertyName, fromParam, toParam])

  // Reset active tab when the property changes (date-range changes preserve the tab).
  useEffect(() => { setActiveTab('all') }, [propertyName])

  function openReviews(otaName: string | null) {
    const params = new URLSearchParams()
    if (propertyName) params.set('property_name', propertyName)
    if (otaName) params.set('ota_name', otaName)
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    const qs = params.toString() ? `?${params}` : ''
    navigate(`/reviews${qs}`)
  }

  // Initial load (no data yet) — show the loading placeholder. For subsequent refetches
  // (e.g. user typing into the date filter), keep the previous data on screen with a
  // subtle indicator so the date inputs don't unmount and lose focus.
  if (!data || !trends) {
    if (error) return <div className="error-msg">{error}</div>
    return <div className="loading">Loading analytics…</div>
  }

  const otaColors = OTA_COLORS

  const otaList = Object.entries(data.per_ota || {}).sort((a, b) => b[1].total - a[1].total)
  const isAllTab = activeTab === 'all'
  const view = isAllTab
    ? buildAllOTAsView(data, trends)
    : buildOTAView(activeTab, data, trends)

  // If the active tab no longer has data (e.g. property change wiped it), fall back to All.
  if (!view) {
    return null
  }

  const tabAccent = isAllTab ? 'var(--accent)' : (otaColors[activeTab] || 'var(--accent)')
  const replyRate = view.reply_rate

  const hasDateFilter = !!(fromDate || toDate)

  const isCustomReport = reportDays === 'custom'
  // For a custom range both dates must be complete before the report can be generated.
  const customReportReady = isCompleteDate(reportFrom) && isCompleteDate(reportTo) && reportFrom <= reportTo
  const reportReady = !isCustomReport || customReportReady

  const reportQuery = isCustomReport
    ? `from=${reportFrom}&to=${reportTo}`
    : `days=${reportDays}`
  const reportHref = propertyName
    ? `/analytics/report?${reportQuery}&property=${encodeURIComponent(propertyName)}`
    : `/analytics/report?${reportQuery}`

  const reportPeriodLabel = isCustomReport
    ? (customReportReady ? `${reportFrom} → ${reportTo}` : 'custom range')
    : (REPORT_PERIODS.find(p => p.value === reportDays)?.label ?? `last ${reportDays} days`)

  return (
    <>
      {/* Report CTA — generate a PDF spanning the selected period. */}
      <div className="card" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Analytics report</div>
            {aiLocked && (
              <span className="chip chip-accent" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI sections: Pro
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {aiLocked
              ? <>Property name, per-OTA stats, and trends — for the {reportPeriodLabel.toLowerCase()}. Downloads as PDF. Upgrade to Pro to add AI insights and topic scores.</>
              : <>Property name, per-OTA stats, AI insights, and topic scores — for the {reportPeriodLabel.toLowerCase()}. Downloads as PDF.</>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="report-period" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Period
          </label>
          <select
            id="report-period"
            className="filter-select"
            value={reportDays}
            onChange={e => setReportDays(e.target.value)}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 10px', cursor: 'pointer' }}
          >
            {REPORT_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {isCustomReport && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input
                type="date"
                aria-label="Report start date"
                className="filter-input"
                value={reportFrom}
                max={reportTo || undefined}
                onChange={e => setReportFrom(e.target.value)}
                style={{ padding: '7px 9px', fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>→</span>
              <input
                type="date"
                aria-label="Report end date"
                className="filter-input"
                value={reportTo}
                min={reportFrom || undefined}
                onChange={e => setReportTo(e.target.value)}
                style={{ padding: '7px 9px', fontSize: 12 }}
              />
            </div>
          )}
          {reportReady ? (
            <a
              href={reportHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-block' }}
            >
              Generate report →
            </a>
          ) : (
            <span
              title="Pick a valid start and end date"
              className="btn btn-secondary btn-sm"
              style={{ opacity: 0.5, cursor: 'not-allowed', whiteSpace: 'nowrap', display: 'inline-block' }}
            >
              Generate report →
            </span>
          )}
        </div>
      </div>

      {/* Date-range filter — applies to all analytics on this page */}
      <div className="filters">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Date range
        </span>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>From</label>
          <input
            type="date"
            className="filter-input"
            value={fromDate}
            max={toDate || undefined}
            onChange={e => setFromDate(e.target.value)}
            style={{ padding: '7px 10px', fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>To</label>
          <input
            type="date"
            className="filter-input"
            value={toDate}
            min={fromDate || undefined}
            onChange={e => setToDate(e.target.value)}
            style={{ padding: '7px 10px', fontSize: 13 }}
          />
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => { setFromDate(''); setToDate('') }}
          disabled={!hasDateFilter}
          style={{ alignSelf: 'flex-end' }}
        >
          Clear
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Refreshing…</span>}
          <span>Filters apply to KPIs, charts and AI summary</span>
        </div>
      </div>

      {/* View selector — switches between Overview (KPIs/charts/OTA tabs) and AI Insights */}
      <div className="seg" style={{ marginBottom: 18 }}>
        {([
          { key: 'overview' as ViewMode, label: 'Overview', sub: 'KPIs, trends, per-OTA' },
          { key: 'insights' as ViewMode, label: 'AI Insights', sub: 'Summary & category breakdown' },
        ]).map(v => (
          <button
            key={v.key}
            className={`seg-btn${viewMode === v.key ? ' active' : ''}`}
            onClick={() => setViewMode(v.key)}
            title={v.sub}
          >
            {v.label}
          </button>
        ))}
      </div>

      {viewMode === 'insights' && (
        <>
          <AISummaryCard propertyName={propertyName} fromDate={fromParam} toDate={toParam} />
          <TopicScoresCard propertyName={propertyName} fromDate={fromParam} toDate={toParam} />
        </>
      )}

      {viewMode === 'overview' && (
      <>
      {/* OTA Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginTop: 4,
        marginBottom: 16,
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        {[{ key: 'all', label: 'All OTAs', total: data.total_reviews }, ...otaList.map(([ota, stats]) => ({ key: ota, label: ota, total: stats.total }))].map(t => {
          const active = activeTab === t.key
          const color = t.key === 'all' ? 'var(--accent)' : (otaColors[t.key] || 'var(--accent)')
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? color : 'transparent'}`,
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                fontFamily: 'inherit',
                color: active ? color : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {t.key !== 'all' && <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />}
              {t.label}
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>({t.total})</span>
            </button>
          )
        })}
      </div>

      <div className="stats-grid">
        <StatCard label="Total Reviews" value={view.total} />
        <StatCard
          label="All-Time Avg Score"
          value={view.avg_score !== null ? `${view.avg_score} / 10` : '—'}
        />
        <StatCard
          label="This Week's Avg"
          value={view.weekly_avg_score !== null ? `${view.weekly_avg_score} / 10` : '—'}
          sub={`${view.weekly_count} review${view.weekly_count !== 1 ? 's' : ''} this week`}
        />
        <StatCard
          label="This Month's Avg"
          value={view.monthly_avg_score !== null ? `${view.monthly_avg_score} / 10` : '—'}
          sub={`${view.monthly_count} review${view.monthly_count !== 1 ? 's' : ''} this month`}
        />
        <StatCard
          label="Reply Rate"
          value={`${replyRate}%`}
          sub={`${view.replied} replied, ${view.pending_reply} pending`}
        />
        <StatCard label="Pending Replies" value={view.pending_reply} />
      </div>

      {/* Per-OTA breakdown — only on the "All OTAs" tab. Each card drills into the reviews list. */}
      {isAllTab && otaList.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>By OTA</div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>Click any card to view those reviews</p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${otaList.length + 1}, 1fr)`,
            gap: 12,
          }}>
            {/* "All" column — drills into all OTAs (no ota filter) */}
            <button
              type="button"
              onClick={() => openReviews(null)}
              title="View all reviews"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
                background: 'var(--surface-2)',
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
                transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span className="ota-badge ota-default">All OTAs</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>View →</span>
              </div>
              <PerOTAStat label="Reviews" value={data.total_reviews} />
              <PerOTAStat label="Avg score" value={data.avg_score !== null ? `${data.avg_score} / 10` : '—'} highlight />
              <PerOTAStat label="Replied" value={data.replied} sub={`${replyRate}%`} />
              <PerOTAStat label="Pending" value={data.pending_reply} />
            </button>

            {otaList.map(([ota, stats]) => (
              <button
                type="button"
                key={ota}
                onClick={() => openReviews(ota)}
                title={`View ${ota} reviews`}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 14,
                  background: 'var(--surface)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span className={`ota-badge ${OTA_BADGE_CLASS[ota] || 'ota-default'}`}>{ota}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>View →</span>
                </div>
                <PerOTAStat label="Reviews" value={stats.total} />
                <PerOTAStat label="Avg score" value={stats.avg_score !== null ? `${stats.avg_score} / 10` : '—'} highlight />
                <PerOTAStat
                  label="Replied"
                  value={stats.replied}
                  sub={stats.reply_rate !== null ? `${stats.reply_rate}%` : '—'}
                />
                <PerOTAStat label="Pending" value={stats.pending_reply} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="charts-grid">
        {isAllTab && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 2 }}>Reviews by OTA</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Volume per booking channel</p>
            {Object.keys(data.reviews_by_ota).length === 0 ? (
              <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No data yet</p>
            ) : (
              <VerticalBarChart data={data.reviews_by_ota} colors={otaColors} barWidth={52} />
            )}
          </div>
        )}

        <div className="card" style={isAllTab ? undefined : { gridColumn: '1 / -1' }}>
          <div className="section-title" style={{ marginBottom: 2 }}>
            Score Distribution{!isAllTab && ` — ${activeTab}`}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Reviews per score band (out of 10)</p>
          {Object.values(view.score_distribution).every(v => v === 0) ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No scored reviews yet</p>
          ) : (
            <VerticalBarChart data={view.score_distribution} color={tabAccent} barWidth={52} />
          )}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title" style={{ marginBottom: 2 }}>
            Monthly Review Volume{!isAllTab && ` — ${activeTab}`}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Number of reviews received — last 12 months</p>
          {Object.values(view.monthly_volume).every(v => v === 0) ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No data yet</p>
          ) : (
            <VerticalBarChart data={view.monthly_volume} color={tabAccent} rotateLabels barWidth={36} />
          )}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title" style={{ marginBottom: 2 }}>
            Monthly Avg Score{!isAllTab && ` — ${activeTab}`}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Average guest score per month (out of 10) — last 12 months</p>
          {Object.values(view.monthly_avg).every(v => v === 0) ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No scored reviews yet</p>
          ) : (
            <VerticalBarChart data={view.monthly_avg} color="var(--good)" unit="/10" rotateLabels barWidth={36} />
          )}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title" style={{ marginBottom: 2 }}>
            Reply Status{!isAllTab && ` — ${activeTab}`}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>How many reviews have received a response</p>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>Replied</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{view.replied}</span>
              </div>
              <div className="bar-track" style={{ height: 12 }}>
                <div className="bar-fill" style={{ width: `${replyRate}%`, background: 'var(--good)' }} />
              </div>
            </div>
            <div style={{
              fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              color: replyRate >= 80 ? 'var(--good)' : replyRate >= 50 ? 'var(--warn)' : 'var(--bad)',
            }}>
              {replyRate}%
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--good)', fontWeight: 600 }}>●</span> {view.replied} replied
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--bad)', fontWeight: 600 }}>●</span> {view.pending_reply} pending
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </>
  )
}

export default function Analytics() {
  const { selectedProperty } = useProperty()

  return (
    <ThemedPage
      eyebrow="AI Analytics"
      title={selectedProperty ? selectedProperty.property_name : 'Analytics'}
      subtitle={selectedProperty
        ? `${selectedProperty.location || 'Across all OTAs'} — per-OTA scores, trends, and AI summaries`
        : 'Aggregated insights across all properties'}
    >
      <PropertyAnalytics propertyName={selectedProperty?.property_name ?? null} />
      <SyncFooter domain="analytics" onDemand />
    </ThemedPage>
  )
}
