import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import UpgradeNotice from '../components/UpgradeNotice'
import useDocumentTitle from '../hooks/useDocumentTitle'

interface OTAStats {
  total: number
  avg_score: number | null
  replied: number
  pending_reply: number
  reply_rate: number | null
  score_distribution: Record<string, number>
}

interface Analytics {
  total_reviews: number
  avg_score: number | null
  reviews_by_ota: Record<string, number>
  score_distribution: Record<string, number>
  replied: number
  pending_reply: number
  per_ota: Record<string, OTAStats>
}

interface Trends {
  weekly_avg_score: number | null
  monthly_avg_score: number | null
  weekly_count: number
  monthly_count: number
  monthly_volume: Record<string, number>
  monthly_avg: Record<string, number>
  per_ota: Record<string, {
    weekly_avg_score: number | null
    monthly_avg_score: number | null
    weekly_count: number
    monthly_count: number
    monthly_volume: Record<string, number>
    monthly_avg: Record<string, number>
  }>
}

interface AISummary {
  positives: string
  problems: string
  review_count: number
}

interface TopicScore {
  topic: string
  label: string
  score: number | null
  mentions: number
  note: string
  priority: 'high' | 'medium' | 'low'
}

interface TopicScores {
  review_count: number
  topics: TopicScore[]
  cached?: boolean
}

interface PeriodData {
  analytics: Analytics | null
  trends: Trends | null
  ai: AISummary | null
  topics: TopicScores | null
  errors: string[]
  /** True when AI endpoints returned 402 — the account's plan doesn't include them. */
  proLocked: boolean
}

function fmtScore(s: number | null | undefined, digits = 1): string {
  if (s === null || s === undefined) return '—'
  return s.toFixed(digits)
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(0)}%`
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Friendly label for a "last N days" window.
function periodLabel(days: number): string {
  if (days === 1) return 'Today'
  if (days === 7) return 'Last 7 days'
  if (days === 365) return 'Last 12 months'
  if (days % 365 === 0) return `Last ${days / 365} years`
  if (days >= 60 && days % 30 === 0) return `Last ${days / 30} months`
  return `Last ${days} days`
}

async function loadPeriod(propertyName: string | null, fromDate: string, toDate: string): Promise<PeriodData> {
  const qs = new URLSearchParams()
  if (propertyName) qs.set('property_name', propertyName)
  qs.set('from_date', fromDate)
  qs.set('to_date', toDate)
  const suffix = `?${qs.toString()}`

  const errors: string[] = []
  let proLocked = false
  async function safe<T>(label: string, url: string): Promise<T | null> {
    try {
      const r = await fetch(url, { credentials: 'include' })
      if (r.status === 402) { proLocked = true; return null }
      if (!r.ok) { errors.push(`${label}: HTTP ${r.status}`); return null }
      return await r.json()
    } catch (e: any) {
      errors.push(`${label}: ${e.message || e}`)
      return null
    }
  }

  const [analytics, trends, ai, topics] = await Promise.all([
    safe<Analytics>('summary', `/api/reviews/analytics/summary${suffix}`),
    safe<Trends>('trends', `/api/reviews/analytics/trends${suffix}`),
    safe<AISummary>('ai-summary', `/api/reviews/analytics/ai-summary${suffix}`),
    safe<TopicScores>('topics', `/api/reviews/analytics/topics${suffix}`),
  ])

  return { analytics, trends, ai, topics, errors, proLocked }
}

// ---------- Sub-components ----------

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)',
  fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
  color: 'var(--text-faint)',
}

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
  border: '1px solid var(--border)',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="report-section-title" style={{
      fontSize: 12, fontWeight: 700, color: 'var(--text-faint)',
      margin: '0 0 12px',
      padding: '0 0 8px', borderBottom: '1px solid var(--border)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>{children}</h3>
  )
}

function HeadlineStats({ data }: { data: Analytics | null }) {
  if (!data) return <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>No data.</p>
  const replyRate = data.total_reviews > 0 ? Math.round((data.replied / data.total_reviews) * 100) : null
  const items: Array<{ label: string; value: string; sub?: string }> = [
    { label: 'Total reviews', value: String(data.total_reviews) },
    { label: 'Average score', value: fmtScore(data.avg_score), sub: '/ 10' },
    { label: 'Replied', value: `${data.replied}`, sub: replyRate !== null ? `(${replyRate}%)` : '' },
    { label: 'Awaiting reply', value: String(data.pending_reply) },
  ]
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14,
    }}>
      {items.map(it => (
        <div key={it.label} style={{
          border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
          background: 'var(--surface-2)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}>{it.label}</div>
          <div style={{ fontSize: 20, fontWeight: 750, color: 'var(--ink)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {it.value}{it.sub && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 600 }}>{it.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function OTATable({ data }: { data: Analytics | null }) {
  if (!data || Object.keys(data.per_ota).length === 0) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>No OTA data in this period.</p>
  }
  const otas = Object.entries(data.per_ota).sort((a, b) => b[1].total - a[1].total)
  return (
    <table style={tableStyle}>
      <thead>
        <tr style={{ background: 'var(--surface-2)' }}>
          {['OTA', 'Reviews', 'Avg score', 'Replied', 'Pending', 'Reply rate'].map(h => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {otas.map(([name, s]) => (
          <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--ink)' }}>{name}</td>
            <td style={{ padding: '7px 10px' }}>{s.total}</td>
            <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmtScore(s.avg_score)} <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>/10</span></td>
            <td style={{ padding: '7px 10px' }}>{s.replied}</td>
            <td style={{ padding: '7px 10px', color: s.pending_reply > 0 ? 'var(--warn)' : 'var(--text)' }}>{s.pending_reply}</td>
            <td style={{ padding: '7px 10px' }}>{fmtPct(s.reply_rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AIInsightsBlock({ data }: { data: AISummary | null }) {
  if (!data || (!data.positives && !data.problems)) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>Not enough review text for AI insights in this period.</p>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{
        border: '1px solid #c4ebda', borderRadius: 10, padding: '12px 14px',
        background: 'var(--good-soft)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--good)', marginBottom: 8,
        }}>Top positives</div>
        <pre style={{
          margin: 0, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6,
          color: 'var(--text)', whiteSpace: 'pre-wrap',
        }}>{data.positives || '—'}</pre>
      </div>
      <div style={{
        border: '1px solid #f6c9d3', borderRadius: 10, padding: '12px 14px',
        background: 'var(--bad-soft)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--bad)', marginBottom: 8,
        }}>Top problems</div>
        <pre style={{
          margin: 0, fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6,
          color: 'var(--text)', whiteSpace: 'pre-wrap',
        }}>{data.problems || '—'}</pre>
      </div>
    </div>
  )
}

function TopicsTable({ data }: { data: TopicScores | null }) {
  if (!data || data.topics.length === 0) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>No topic scores available for this period.</p>
  }
  const priorityColor: Record<TopicScore['priority'], { bg: string; fg: string }> = {
    high: { bg: 'var(--bad-soft)', fg: 'var(--bad)' },
    medium: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
    low: { bg: 'var(--good-soft)', fg: 'var(--good)' },
  }
  return (
    <table style={tableStyle}>
      <thead>
        <tr style={{ background: 'var(--surface-2)' }}>
          {['Topic', 'Score', 'Mentions', 'Priority', 'AI insight'].map(h => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.topics.map(t => {
          const pc = priorityColor[t.priority] || priorityColor.low
          return (
            <tr key={t.topic} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--ink)' }}>{t.label}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmtScore(t.score)} <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>/10</span></td>
              <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{t.mentions}</td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 999, background: pc.bg, color: pc.fg,
                }}>{t.priority}</span>
              </td>
              <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text)' }}>{t.note || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TrendsBlock({ data }: { data: Trends | null }) {
  if (!data) return null
  const otas = Object.keys(data.per_ota)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', background: 'var(--surface)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>Last 7 days</div>
        <div style={{ fontSize: 22, fontWeight: 750, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtScore(data.weekly_avg_score)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>/ 10</span></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{data.weekly_count} review{data.weekly_count === 1 ? '' : 's'}</div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', background: 'var(--surface)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 6 }}>Last 30 days</div>
        <div style={{ fontSize: 22, fontWeight: 750, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtScore(data.monthly_avg_score)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>/ 10</span></div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{data.monthly_count} review{data.monthly_count === 1 ? '' : 's'}</div>
      </div>
      {otas.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['OTA', '7-day avg', '7-day count', '30-day avg', '30-day count'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {otas.map(name => {
                const o = data.per_ota[name]
                return (
                  <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--ink)' }}>{name}</td>
                    <td style={{ padding: '7px 10px' }}>{fmtScore(o.weekly_avg_score)} <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>/10</span></td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{o.weekly_count}</td>
                    <td style={{ padding: '7px 10px' }}>{fmtScore(o.monthly_avg_score)} <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>/10</span></td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{o.monthly_count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PeriodBlock({
  title, badge, data, fromDate, toDate, includeTrends,
}: {
  title: string; badge: string; data: PeriodData; fromDate: string; toDate: string; includeTrends: boolean
}) {
  return (
    <section className="report-period" style={{
      pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: 28,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
          {title}
        </h2>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '4px 10px', borderRadius: 999,
          background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid #dcdffc',
        }}>{badge}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        {fromDate} → {toDate}
      </div>

      <div style={{ marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <SectionTitle>Headline numbers</SectionTitle>
        <HeadlineStats data={data.analytics} />
      </div>

      <div style={{ marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <SectionTitle>Per-OTA breakdown</SectionTitle>
        <OTATable data={data.analytics} />
      </div>

      {includeTrends && (
        <div style={{ marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <SectionTitle>Recent trends</SectionTitle>
          <TrendsBlock data={data.trends} />
        </div>
      )}

      {data.proLocked ? (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <SectionTitle>AI insights &amp; topic scores</SectionTitle>
          <UpgradeNotice message="AI insights and topic scores are generated on the Pro plan. Everything above reflects your live review data." />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <SectionTitle>AI insights</SectionTitle>
            <AIInsightsBlock data={data.ai} />
          </div>

          <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <SectionTitle>Topic scores</SectionTitle>
            <TopicsTable data={data.topics} />
          </div>
        </>
      )}

      {data.errors.length > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--warn-soft)',
          border: '1px solid #f5e0b8', color: 'var(--warn)', fontSize: 11,
        }}>
          Partial data: {data.errors.join(' · ')}
        </div>
      )}
    </section>
  )
}

// ---------- Page ----------

interface ReportPeriod {
  title: string
  badge: string
  data: PeriodData
  fromDate: string
  toDate: string
  includeTrends: boolean
}

export default function AnalyticsReport() {
  useDocumentTitle('Analytics report')
  const [params] = useSearchParams()
  const propertyName = params.get('property') || null

  // Three modes, in priority order:
  //  1. explicit `from`/`to` dates → one block for that exact range
  //  2. `days` preset → one block for the last N days
  //  3. neither → original two-period report (last 30 days + last 12 months)
  const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const hasCustomRange = isDate(fromParam) && isDate(toParam) && fromParam <= toParam

  const daysParam = params.get('days')
  const customDays = daysParam && /^\d+$/.test(daysParam) ? Math.max(1, parseInt(daysParam, 10)) : null

  const [periods, setPeriods] = useState<ReportPeriod[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = useMemo(() => new Date(), [])

  // Build the list of windows to render. A window is either an explicit {fromDate,toDate}
  // range or a "last N days" lookback resolved against today.
  const windows = useMemo<{ title: string; badge: string; days?: number; fromDate?: string; toDate?: string; includeTrends: boolean }[]>(() => {
    if (hasCustomRange) {
      return [{ title: `${fromParam} → ${toParam}`, badge: 'Custom', fromDate: fromParam!, toDate: toParam!, includeTrends: true }]
    }
    if (customDays !== null) {
      return [{ title: periodLabel(customDays), badge: 'Report', days: customDays, includeTrends: true }]
    }
    return [
      { title: 'Last 30 days', badge: 'Recent', days: 30, includeTrends: true },
      { title: 'Last 12 months', badge: 'Year', days: 365, includeTrends: false },
    ]
  }, [hasCustomRange, fromParam, toParam, customDays])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError('')
      try {
        const results = await Promise.all(
          windows.map(async w => {
            const toDate = w.toDate ?? isoDate(today)
            let fromDate = w.fromDate
            if (!fromDate) {
              const from = new Date(today); from.setDate(from.getDate() - (w.days ?? 30))
              fromDate = isoDate(from)
            }
            const data = await loadPeriod(propertyName, fromDate, toDate)
            return { title: w.title, badge: w.badge, includeTrends: w.includeTrends, data, fromDate, toDate }
          }),
        )
        if (cancelled) return
        setPeriods(results)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Could not load report data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [propertyName, today, windows])

  const coverageLabel = hasCustomRange
    ? `${fromParam} → ${toParam}`
    : customDays !== null
      ? periodLabel(customDays).toLowerCase()
      : 'last 30 days + last 12 months'

  function downloadPdf() {
    window.print()
  }

  const generatedAt = useMemo(() => new Date().toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }), [])

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm 14mm; }
          html, body { background: #fff !important; }
          .report-toolbar { display: none !important; }
          .report-page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
          .report-period { page-break-inside: avoid; }
        }
        body.report-mode { background: var(--bg); }
      `}</style>

      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        padding: '24px 16px',
      }}>
        {/* Toolbar — hidden in print */}
        <div className="report-toolbar" style={{
          maxWidth: 920, margin: '0 auto 16px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <Link to="/analytics" style={{
            fontSize: 13, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none',
          }}>← Back to Analytics</Link>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={downloadPdf}
              disabled={loading}
              style={{ cursor: loading ? 'wait' : undefined }}
            >
              Download PDF
            </button>
          </div>
        </div>

        {/* Page */}
        <div
          className="report-page"
          style={{
            maxWidth: 920, margin: '0 auto', background: 'var(--surface)',
            borderRadius: 14, padding: '36px 42px',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <header style={{
            paddingBottom: 18, marginBottom: 22, borderBottom: '2px solid var(--ink)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--accent)', marginBottom: 6,
            }}>
              reptruly · Analytics report
            </div>
            <h1 style={{
              fontSize: 32, fontWeight: 800, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em',
            }}>
              {propertyName || 'All properties'}
            </h1>
            <div style={{
              marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)',
              flexWrap: 'wrap',
            }}>
              <span>Generated {generatedAt}</span>
              <span>Covering {coverageLabel}</span>
            </div>
          </header>

          {loading && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
              Building report — pulling analytics, trends, AI insights, and topic scores…
            </div>
          )}

          {!loading && error && (
            <div style={{
              padding: 14, borderRadius: 10, background: 'var(--bad-soft)',
              border: '1px solid #f6c9d3', color: 'var(--bad)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {!loading && !error && periods && periods.map((p, i) => (
            <div key={p.title}>
              {i > 0 && <div style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 0 }} />}
              <PeriodBlock
                title={p.title}
                badge={p.badge}
                data={p.data}
                fromDate={p.fromDate}
                toDate={p.toDate}
                includeTrends={p.includeTrends}
              />
            </div>
          ))}

          {/* Footer */}
          <footer style={{
            marginTop: 32, paddingTop: 14, borderTop: '1px solid var(--border)',
            fontSize: 10, color: 'var(--text-faint)', display: 'flex',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <span>Generated by reptruly · reviews, rates, demand for hotels</span>
            <span>AI insights powered by OpenAI · sourced from connected OTAs</span>
          </footer>
        </div>
      </div>
    </>
  )
}
