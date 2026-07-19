import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProperty } from '../context/PropertyContext'
import SyncFooter from '../components/SyncFooter'
import ThemedPage from '../components/ThemedPage'
import UpgradeNotice, { isUpgradeBlocked } from '../components/UpgradeNotice'

interface CompetitorRate {
  hotel_id: string
  hotel_name: string
  distance_km: number | null
  star_rating: number | null
  review_score: number | null
  price: number | null
  currency: string
  is_user_property: boolean
}

interface RatesResponse {
  property_id: string
  property_name: string
  checkin: string
  checkout: string
  nights: number
  currency: string
  user_rate: number | null
  user_room_name: string | null
  user_vs_avg_pct: number | null
  competitors: CompetitorRate[]
  fetched_at: string
  cached: boolean
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function defaultCheckin(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return isoDate(d)
}

function defaultCheckout(checkin: string): string {
  const d = new Date(checkin)
  d.setDate(d.getDate() + 1)
  return isoDate(d)
}

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(price)
  } catch {
    return `${currency} ${price.toFixed(0)}`
  }
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Booking.com comp results mix real hotels with condos, private rooms, and
// vacation rentals whose prices skew the market read for a hotel. Name-based
// heuristic — deliberately narrow so "Inn & Suites"-style hotel names pass.
const RENTAL_RE = /#\s?\d|\bcondos?\b|\bapartments?\b|\bapt\b|\bstudios?\b|\bvillas?\b|\bcottages?\b|\bbungalows?\b|\brooms?\b|\bsuite at\b|\bhomes?\b|\bhouses?\b|\blofts?\b|\bcabins?\b/i
function looksLikeRental(name: string): boolean {
  return RENTAL_RE.test(name)
}

type SortKey = 'rate' | 'distance' | 'stars' | 'review' | 'vs'

// ---------- Multi-night outlook ----------

interface OutlookNight {
  checkin: string
  user_rate: number | null
  market_median: number | null
  market_avg: number | null
  comp_count: number
  currency: string
  source: 'live' | 'snapshot' | null
  as_of: string | null
}

interface OutlookResponse {
  nights: number
  entries: OutlookNight[]
  missing: number
}

// ---------- Rate history (daily snapshots from the rates sync) ----------

interface RateSnapshotRow {
  snapshot_date: string
  checkin: string
  user_rate: number | null
  comp_avg: number | null
  comp_count: number
  currency: string
}

interface RateHistoryResponse {
  property_id: string
  snapshots: RateSnapshotRow[]
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Fewer than this many snapshots and a "trend line" is just dots — show the
// building-history panel instead of a chart.
const MIN_TREND_POINTS = 3

function RateHistorySparse({ rows, currency }: { rows: RateSnapshotRow[]; currency: string }) {
  const latest = rows[rows.length - 1]
  return (
    <div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="stat-label">Your rate</div>
          <div style={{ fontSize: 22, fontWeight: 750, color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatPrice(latest.user_rate, currency)}
          </div>
        </div>
        <div>
          <div className="stat-label">Comp-set average</div>
          <div style={{ fontSize: 22, fontWeight: 750, color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatPrice(latest.comp_avg, currency)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>
            {latest.comp_count} hotel{latest.comp_count === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', gap: 5 }}>
          {Array.from({ length: MIN_TREND_POINTS }, (_, i) => (
            <span
              key={i}
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: i < rows.length ? 'var(--accent)' : 'var(--surface-2)',
                border: `1px solid ${i < rows.length ? 'var(--accent)' : 'var(--border-strong)'}`,
              }}
            />
          ))}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Day {rows.length} of tracking (since {shortDate(rows[0].snapshot_date)}) — the trend chart
          appears after {MIN_TREND_POINTS} daily snapshots.
        </span>
      </div>
    </div>
  )
}

function RateHistoryChart({ rows, currency }: { rows: RateSnapshotRow[]; currency: string }) {
  const W = 720
  const H = 220
  const PAD = { top: 18, right: 64, bottom: 28, left: 52 }

  const values = rows
    .flatMap(r => [r.user_rate, r.comp_avg])
    .filter((v): v is number => v !== null)
  if (values.length === 0) return null

  if (rows.length < MIN_TREND_POINTS) {
    return <RateHistorySparse rows={rows} currency={currency} />
  }

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 10
    max += 10
  }
  const headroom = (max - min) * 0.12
  min -= headroom
  max += headroom

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i * plotW) / (rows.length - 1)
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH

  const points = (get: (r: RateSnapshotRow) => number | null) =>
    rows
      .map((r, i) => {
        const v = get(r)
        return v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`
      })
      .filter((p): p is string => p !== null)
      .join(' ')

  const compPoints = points(r => r.comp_avg)
  const userPoints = points(r => r.user_rate)
  const first = rows[0]
  const last = rows[rows.length - 1]
  const mid = rows[Math.floor((rows.length - 1) / 2)]

  // Recessive horizontal gridlines with price labels.
  const ticks = [0, 1, 2, 3].map(i => min + ((max - min) * i) / 3)

  // "Gap to market" summary — only when both series exist at both ends.
  const gapSummary = (() => {
    if (first.user_rate === null || first.comp_avg === null) return null
    if (last.user_rate === null || last.comp_avg === null) return null
    const gapNow = last.comp_avg - last.user_rate
    const gapFirst = first.comp_avg - first.user_rate
    const delta = gapNow - gapFirst
    const position = gapNow >= 0 ? 'below' : 'above'
    const trend = Math.abs(delta) < 1
      ? 'unchanged'
      : `${Math.abs(gapNow) > Math.abs(gapFirst) ? 'widened' : 'narrowed'} ${formatPrice(Math.abs(delta), currency)}`
    return `You're ${formatPrice(Math.abs(gapNow), currency)} ${position} the comp-set average — gap ${trend} since ${shortDate(first.snapshot_date)}.`
  })()

  const endLabel = (v: number | null) =>
    v === null ? null : (
      <text
        x={W - PAD.right + 8}
        y={y(v) + 4}
        fontSize={11}
        fontWeight={600}
        fill="var(--text-muted)"
      >
        {formatPrice(v, currency)}
      </text>
    )

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Your rate vs comp-set average over time"
      >
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)}
              stroke="var(--border)" strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(t) + 3.5} fontSize={10.5} fill="var(--text-faint)" textAnchor="end">
              {formatPrice(t, currency)}
            </text>
          </g>
        ))}
        {compPoints && (
          <polyline
            points={compPoints}
            fill="none"
            stroke="var(--cyan)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {userPoints && (
          <polyline
            points={userPoints}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {rows.map((r, i) => (
          <g key={r.snapshot_date}>
            {r.comp_avg !== null && (
              <circle cx={x(i)} cy={y(r.comp_avg)} r={3} fill="var(--cyan)" stroke="var(--surface)" strokeWidth={1.5} />
            )}
            {r.user_rate !== null && (
              <circle cx={x(i)} cy={y(r.user_rate)} r={3} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
            )}
            {/* One generous invisible hit target per day, carrying the tooltip for both series. */}
            <rect
              x={x(i) - plotW / (rows.length - 1) / 2}
              y={PAD.top}
              width={plotW / (rows.length - 1)}
              height={plotH}
              fill="transparent"
            >
              <title>
                {`${shortDate(r.snapshot_date)}\nYour rate: ${formatPrice(r.user_rate, currency)}\nComp-set avg: ${formatPrice(r.comp_avg, currency)} (${r.comp_count} hotels)`}
              </title>
            </rect>
          </g>
        ))}
        {endLabel(last.user_rate)}
        {last.comp_avg !== null && last.user_rate !== null && Math.abs(y(last.comp_avg) - y(last.user_rate)) < 14
          ? null
          : endLabel(last.comp_avg)}
        <text x={PAD.left} y={H - 8} fontSize={11} fill="var(--text-faint)">
          {shortDate(first.snapshot_date)}
        </text>
        {rows.length > 2 && mid.snapshot_date !== first.snapshot_date && mid.snapshot_date !== last.snapshot_date && (
          <text x={x(rows.indexOf(mid))} y={H - 8} fontSize={11} fill="var(--text-faint)" textAnchor="middle">
            {shortDate(mid.snapshot_date)}
          </text>
        )}
        <text x={W - PAD.right} y={H - 8} fontSize={11} fill="var(--text-faint)" textAnchor="end">
          {shortDate(last.snapshot_date)}
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
          Your rate{last.user_rate !== null && <strong style={{ color: 'var(--text)' }}> {formatPrice(last.user_rate, currency)}</strong>}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--cyan)' }} />
          Comp-set average{last.comp_avg !== null && <strong style={{ color: 'var(--text)' }}> {formatPrice(last.comp_avg, currency)}</strong>}
        </span>
      </div>
      {gapSummary && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text)', background: 'var(--accent-soft)', border: '1px solid #dcdffc', borderRadius: 9, padding: '8px 12px', display: 'inline-block' }}>
          {gapSummary}
        </div>
      )}
    </div>
  )
}

// ---------- Bucket definitions ----------

type StarBucket = '1' | '2' | '3' | '4' | '5' | 'unrated'
const STAR_OPTIONS: { value: StarBucket; label: string }[] = [
  { value: '1', label: '1★' },
  { value: '2', label: '2★' },
  { value: '3', label: '3★' },
  { value: '4', label: '4★' },
  { value: '5', label: '5★' },
  { value: 'unrated', label: 'Unrated' },
]

function starBucketFor(star: number | null): StarBucket {
  if (star === null || star === undefined) return 'unrated'
  return String(Math.max(1, Math.min(5, Math.round(star)))) as StarBucket
}

type DistanceBucket = '<1' | '1-3' | '3-5' | '5-10' | '>10' | 'unknown'
const DISTANCE_OPTIONS: { value: DistanceBucket; label: string }[] = [
  { value: '<1', label: '< 1 mi' },
  { value: '1-3', label: '1–3 mi' },
  { value: '3-5', label: '3–5 mi' },
  { value: '5-10', label: '5–10 mi' },
  { value: '>10', label: '> 10 mi' },
  { value: 'unknown', label: 'Unknown' },
]

const KM_TO_MI = 0.621371

function distanceBucketFor(km: number | null): DistanceBucket {
  if (km === null || km === undefined) return 'unknown'
  const mi = km * KM_TO_MI
  if (mi < 1) return '<1'
  if (mi < 3) return '1-3'
  if (mi < 5) return '3-5'
  if (mi < 10) return '5-10'
  return '>10'
}

type ReviewBucket = '9+' | '8-9' | '7-8' | '6-7' | '<6' | 'none'
const REVIEW_OPTIONS: { value: ReviewBucket; label: string }[] = [
  { value: '9+', label: '9.0+ (excellent)' },
  { value: '8-9', label: '8.0–9.0 (very good)' },
  { value: '7-8', label: '7.0–8.0 (good)' },
  { value: '6-7', label: '6.0–7.0 (pleasant)' },
  { value: '<6', label: '< 6.0' },
  { value: 'none', label: 'No reviews' },
]

function reviewBucketFor(score: number | null): ReviewBucket {
  if (score === null || score === undefined) return 'none'
  if (score >= 9) return '9+'
  if (score >= 8) return '8-9'
  if (score >= 7) return '7-8'
  if (score >= 6) return '6-7'
  return '<6'
}

type RateBucket = '<50' | '50-100' | '100-150' | '150-200' | '200-300' | '300+' | 'none'
const RATE_OPTIONS: { value: RateBucket; label: string }[] = [
  { value: '<50', label: '< $50' },
  { value: '50-100', label: '$50–100' },
  { value: '100-150', label: '$100–150' },
  { value: '150-200', label: '$150–200' },
  { value: '200-300', label: '$200–300' },
  { value: '300+', label: '$300+' },
  { value: 'none', label: 'No rate' },
]

function rateBucketFor(price: number | null): RateBucket {
  if (price === null || price === undefined) return 'none'
  if (price < 50) return '<50'
  if (price < 100) return '50-100'
  if (price < 150) return '100-150'
  if (price < 200) return '150-200'
  if (price < 300) return '200-300'
  return '300+'
}

// ---------- Multi-select dropdown component ----------

interface MultiSelectDropdownProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  selected: Set<T>
  onChange: (next: Set<T>) => void
}

function MultiSelectDropdown<T extends string>({ label, options, selected, onChange }: MultiSelectDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const totalCount = options.length
  const selectedCount = selected.size
  const summary =
    selectedCount === 0
      ? 'None'
      : selectedCount === totalCount
        ? 'All'
        : `${selectedCount} of ${totalCount}`

  function toggle(v: T) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="filter-select"
        style={{
          minWidth: 150,
          cursor: 'pointer',
          fontSize: 13,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>
          <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
          <strong style={{ color: 'var(--text)' }}>{summary}</strong>
        </span>
        <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md)',
            zIndex: 10,
            padding: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px 6px', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => onChange(new Set(options.map(o => o.value)))}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: 0 }}
            >
              Select all
            </button>
            <button
              onClick={() => onChange(new Set())}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: 0 }}
            >
              Clear
            </button>
          </div>
          {options.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: 13,
                borderRadius: 6,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Page ----------

export default function Rates() {
  const { properties, selectedProperty, setSelectedProperty } = useProperty()
  const [searchParams] = useSearchParams()
  const initialCheckin = searchParams.get('checkin') || defaultCheckin()
  const initialCheckout = searchParams.get('checkout') || defaultCheckout(initialCheckin)
  const [checkin, setCheckin] = useState(initialCheckin)
  const [checkout, setCheckout] = useState(initialCheckout)
  const [adults, setAdults] = useState(2)
  const [data, setData] = useState<RatesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const [history, setHistory] = useState<RateSnapshotRow[]>([])

  // null = "not yet defaulted for this dataset"; once data lands we seed defaults.
  const [starFilter, setStarFilter] = useState<Set<StarBucket> | null>(null)
  const [distanceFilter, setDistanceFilter] = useState<Set<DistanceBucket> | null>(null)
  const [reviewFilter, setReviewFilter] = useState<Set<ReviewBucket> | null>(null)
  const [rateFilter, setRateFilter] = useState<Set<RateBucket> | null>(null)
  // Hide condos / private rooms / vacation rentals from the comp set by default.
  const [hotelsOnly, setHotelsOnly] = useState(true)
  // Multi-night outlook: your rate vs the market for the next 14 nights.
  const [outlook, setOutlook] = useState<OutlookNight[] | null>(null)
  const [outlookMissing, setOutlookMissing] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [outlookError, setOutlookError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rate')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 1 ? -1 : 1))
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  // Default to first property if nothing selected
  useEffect(() => {
    if (!selectedProperty && properties.length > 0) {
      setSelectedProperty(properties[0])
    }
  }, [properties, selectedProperty, setSelectedProperty])

  // Reset filters when switching property — defaults will re-seed from new data.
  useEffect(() => {
    setStarFilter(null)
    setDistanceFilter(null)
    setReviewFilter(null)
    setRateFilter(null)
  }, [selectedProperty?.id])

  // Seed filters once data lands.
  useEffect(() => {
    if (!data) return

    if (starFilter === null) {
      // Default: user's own star + 1 below.
      const userStar = data.competitors.find(c => c.is_user_property)?.star_rating ?? null
      const defaults = new Set<StarBucket>()
      if (userStar === null) {
        STAR_OPTIONS.forEach(o => defaults.add(o.value))
      } else {
        const own = Math.max(1, Math.min(5, Math.round(userStar)))
        defaults.add(String(own) as StarBucket)
        if (own > 1) defaults.add(String(own - 1) as StarBucket)
      }
      setStarFilter(defaults)
    }

    if (distanceFilter === null) {
      setDistanceFilter(new Set(DISTANCE_OPTIONS.map(o => o.value)))
    }
    if (reviewFilter === null) {
      setReviewFilter(new Set(REVIEW_OPTIONS.map(o => o.value)))
    }
    if (rateFilter === null) {
      setRateFilter(new Set(RATE_OPTIONS.map(o => o.value)))
    }
  }, [data, starFilter, distanceFilter, reviewFilter, rateFilter])

  async function fetchRates(forceRefresh = false) {
    if (!selectedProperty) return
    if (new Date(checkout) <= new Date(checkin)) {
      setError('Check-out must be after check-in')
      return
    }
    setLoading(true)
    setError('')
    setUpgradeMsg('')
    setData(null)
    try {
      const params = new URLSearchParams({ checkin, checkout, adults: String(adults) })
      if (forceRefresh) params.set('force_refresh', 'true')
      const res = await fetch(`/api/rates/${selectedProperty.id}?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (isUpgradeBlocked(res.status)) {
        setUpgradeMsg(json.detail || json.message || 'Rate shopping is a Pro feature.')
        return
      }
      if (!res.ok) throw new Error(json.message || json.detail || 'Failed to load rates')
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Failed to load rates')
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch when property/dates change (uses cache; pull is daily)
  useEffect(() => {
    if (selectedProperty) fetchRates(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty?.id, checkin, checkout, adults])

  // Multi-night outlook — cached/snapshot data only; the scan button fills gaps.
  useEffect(() => {
    if (!selectedProperty) {
      setOutlook(null)
      return
    }
    let cancelled = false
    setOutlook(null)
    setOutlookMissing(0)
    setOutlookError('')
    fetch(`/api/rates-outlook/${selectedProperty.id}?adults=${adults}`, { credentials: 'include' })
      .then(res => (res.ok ? (res.json() as Promise<OutlookResponse>) : null))
      .then(json => {
        if (!cancelled && json) {
          setOutlook(json.entries)
          setOutlookMissing(json.missing)
        }
      })
      .catch(() => { /* outlook simply stays hidden */ })
    return () => {
      cancelled = true
    }
  }, [selectedProperty?.id, adults])

  // Fetch missing nights in small batches until the outlook is complete.
  async function scanOutlook() {
    if (!selectedProperty || scanning) return
    setScanning(true)
    setOutlookError('')
    const total = outlook?.length ?? 14
    try {
      let missing = outlookMissing
      while (missing > 0) {
        setScanProgress(`Fetching… ${total - missing} of ${total} nights loaded`)
        const res = await fetch(
          `/api/rates-outlook/${selectedProperty.id}/scan?adults=${adults}`,
          { method: 'POST', credentials: 'include' },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.message || json.detail || 'Scan failed')
        setOutlook(json.entries)
        setOutlookMissing(json.missing)
        missing = json.missing
      }
    } catch (e: any) {
      setOutlookError(e.message || 'Scan failed')
    } finally {
      setScanning(false)
      setScanProgress('')
    }
  }

  // Rate history snapshots (written by the daily rates sync)
  useEffect(() => {
    if (!selectedProperty) {
      setHistory([])
      return
    }
    let cancelled = false
    fetch(`/api/rates-history/${selectedProperty.id}`, { credentials: 'include' })
      .then(res => (res.ok ? (res.json() as Promise<RateHistoryResponse>) : null))
      .then(json => {
        if (!cancelled) setHistory(json?.snapshots ?? [])
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedProperty?.id])

  // Apply all filters; the user's own property is always included regardless of filters.
  const rentalsHidden = data && hotelsOnly
    ? data.competitors.filter(c => !c.is_user_property && looksLikeRental(c.hotel_name)).length
    : 0
  const filteredCompetitors = data
    ? data.competitors.filter(c => {
        if (c.is_user_property) return true
        if (hotelsOnly && looksLikeRental(c.hotel_name)) return false
        if (starFilter && !starFilter.has(starBucketFor(c.star_rating))) return false
        if (distanceFilter && !distanceFilter.has(distanceBucketFor(c.distance_km))) return false
        if (reviewFilter && !reviewFilter.has(reviewBucketFor(c.review_score))) return false
        if (rateFilter && !rateFilter.has(rateBucketFor(c.price))) return false
        return true
      })
    : []

  const userPriceFromComps = data?.competitors.find(c => c.is_user_property)?.price ?? data?.user_rate ?? null

  const sortValue = (c: CompetitorRate): number | null => {
    switch (sortKey) {
      case 'rate': return c.price
      case 'distance': return c.distance_km
      case 'stars': return c.star_rating
      case 'review': return c.review_score
      case 'vs': return c.price !== null && userPriceFromComps !== null ? c.price - userPriceFromComps : null
    }
  }
  // Nulls always sort last, whatever the direction.
  const sortedCompetitors = filteredCompetitors
    .filter(c => c.price !== null)
    .sort((a, b) => {
      const va = sortValue(a)
      const vb = sortValue(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * sortDir
    })

  // Market read from the filtered set, so the verdict matches what the user
  // sees. Median headline (robust to one $700 outlier); average as context.
  const compPrices = filteredCompetitors
    .filter(c => !c.is_user_property && c.price !== null)
    .map(c => c.price as number)
  const filteredAvg = compPrices.length ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length : null
  const filteredMedian = median(compPrices)
  const filteredVsMedianPct =
    userPriceFromComps !== null && filteredMedian
      ? ((userPriceFromComps - filteredMedian) / filteredMedian) * 100
      : null

  // Semantic tint only: cheaper than market = good, pricier = bad, on par = accent.
  const positionVerdict = (() => {
    if (filteredVsMedianPct === null) return null
    const pct = filteredVsMedianPct
    if (pct < -10) return { label: 'Below market', color: 'var(--good)', chip: 'chip-good' }
    if (pct > 10) return { label: 'Above market', color: 'var(--bad)', chip: 'chip-bad' }
    return { label: 'On par with market', color: 'var(--accent)', chip: 'chip-accent' }
  })()

  // Price position + the actionable take-away: where you rank by price and how
  // much headroom you have before overtaking the next hotel up.
  const priceInsight = (() => {
    if (userPriceFromComps === null || compPrices.length === 0 || !data) return null
    const sorted = [...compPrices].sort((a, b) => a - b)
    const cheaperCount = sorted.filter(p => p < userPriceFromComps).length
    const rank = cheaperCount + 1
    const total = sorted.length + 1
    const nextUp = sorted.find(p => p > userPriceFromComps) ?? null
    let takeaway: string
    if (rank === 1 && nextUp !== null) {
      takeaway = `Next-cheapest is ${formatPrice(nextUp, data.currency)} — room to raise ${formatPrice(nextUp - userPriceFromComps, data.currency)}`
    } else if (nextUp === null) {
      takeaway = filteredMedian !== null
        ? `Priciest in the set — market median is ${formatPrice(filteredMedian, data.currency)}`
        : 'Priciest in the comp set'
    } else {
      takeaway = `${formatPrice(nextUp - userPriceFromComps, data.currency)} below the next hotel up`
    }
    return { rank, total, takeaway }
  })()

  // History for the tracked check-in matching the selected stay: prefer a
  // tracked check-in inside [checkin, checkout), else the nearest one.
  const trackedCheckins = Array.from(new Set(history.map(h => h.checkin))).sort()
  const inRange = trackedCheckins.filter(c => c >= checkin && c < checkout)
  const historyCheckin =
    inRange[0] ??
    (trackedCheckins.length
      ? trackedCheckins.reduce((best, c) =>
          Math.abs(new Date(c).getTime() - new Date(checkin).getTime()) <
          Math.abs(new Date(best).getTime() - new Date(checkin).getTime())
            ? c
            : best
        )
      : null)
  const historyRows = historyCheckin
    ? history
        .filter(h => h.checkin === historyCheckin)
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    : []

  return (
    <ThemedPage
      eyebrow="Rate shopping"
      title={selectedProperty ? selectedProperty.property_name : 'Rates'}
      subtitle={selectedProperty
        ? 'Your nightly rate vs. nearby competitors on Booking.com'
        : 'Connect a property to see rates'}
      actions={
        <button className="btn btn-primary" onClick={() => fetchRates(true)} disabled={loading || !selectedProperty}>
          {loading ? 'Loading…' : '↻ Force refresh'}
        </button>
      }
    >

      {/* One filters row: stay controls plus comp-set filters once data lands.
          (The property itself is picked in the sidebar.) */}
      <div className="filters">
        <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          Check-in
          <input
            className="filter-input"
            type="date"
            value={checkin}
            onChange={e => {
              setCheckin(e.target.value)
              if (new Date(e.target.value) >= new Date(checkout)) {
                setCheckout(defaultCheckout(e.target.value))
              }
            }}
            style={{ width: 150 }}
          />
        </label>

        <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          Check-out
          <input
            className="filter-input"
            type="date"
            value={checkout}
            onChange={e => setCheckout(e.target.value)}
            style={{ width: 150 }}
          />
        </label>

        <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          Adults
          <input
            className="filter-input"
            type="number"
            min="1"
            max="6"
            value={adults}
            onChange={e => setAdults(Number(e.target.value) || 2)}
            style={{ width: 70 }}
          />
        </label>

        {data && (
          <>
            <MultiSelectDropdown<DistanceBucket>
              label="Distance"
              options={DISTANCE_OPTIONS}
              selected={distanceFilter ?? new Set<DistanceBucket>()}
              onChange={setDistanceFilter}
            />
            <MultiSelectDropdown<StarBucket>
              label="Stars"
              options={STAR_OPTIONS}
              selected={starFilter ?? new Set<StarBucket>()}
              onChange={setStarFilter}
            />
            <MultiSelectDropdown<ReviewBucket>
              label="Review"
              options={REVIEW_OPTIONS}
              selected={reviewFilter ?? new Set<ReviewBucket>()}
              onChange={setReviewFilter}
            />
            <MultiSelectDropdown<RateBucket>
              label="Rate"
              options={RATE_OPTIONS}
              selected={rateFilter ?? new Set<RateBucket>()}
              onChange={setRateFilter}
            />
            <label
              title="Hide condos, apartments, private rooms, and vacation rentals from the comp set"
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex',
                alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={hotelsOnly}
                onChange={e => setHotelsOnly(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              Hotels only
              {hotelsOnly && rentalsHidden > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-faint)' }}>
                  ({rentalsHidden} rental{rentalsHidden === 1 ? '' : 's'} hidden)
                </span>
              )}
            </label>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStarFilter(new Set(STAR_OPTIONS.map(o => o.value)))
                setDistanceFilter(new Set(DISTANCE_OPTIONS.map(o => o.value)))
                setReviewFilter(new Set(REVIEW_OPTIONS.map(o => o.value)))
                setRateFilter(new Set(RATE_OPTIONS.map(o => o.value)))
                setHotelsOnly(false)
              }}
              style={{ marginLeft: 'auto' }}
            >
              Reset filters
            </button>
          </>
        )}
      </div>

      {upgradeMsg && <div style={{ marginBottom: 14 }}><UpgradeNotice message={upgradeMsg} /></div>}
      {error && <div className="error-msg">{error}</div>}

      {!selectedProperty && (
        <div className="empty-state">
          <h3>No property selected</h3>
          <p>Add a property from the sidebar to start tracking rates.</p>
        </div>
      )}

      {selectedProperty && loading && !data && (
        <div className="loading">Fetching rates from Booking.com…</div>
      )}

      {data && (
        <>
          {/* Headline cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Your rate ({data.nights} night{data.nights > 1 ? 's' : ''})</div>
              <div className="stat-value">{formatPrice(data.user_rate, data.currency)}</div>
              {data.user_room_name && (
                <div className="stat-sub" title={data.user_room_name}>
                  {data.user_room_name.length > 50 ? data.user_room_name.slice(0, 50) + '…' : data.user_room_name}
                </div>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-label">Vs. market median</div>
              <div className="stat-value" style={{ color: positionVerdict?.color }}>
                {filteredVsMedianPct === null
                  ? '—'
                  : `${filteredVsMedianPct > 0 ? '+' : ''}${filteredVsMedianPct.toFixed(1)}%`}
              </div>
              <div className="stat-sub" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {positionVerdict
                  ? <span className={`chip ${positionVerdict.chip}`}>{positionVerdict.label}</span>
                  : 'No competitor data'}
                {filteredMedian !== null && (
                  <span>
                    median {formatPrice(filteredMedian, data.currency)}
                    {filteredAvg !== null && ` · avg ${formatPrice(filteredAvg, data.currency)}`}
                  </span>
                )}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Price position</div>
              <div className="stat-value">
                {priceInsight ? `#${priceInsight.rank}` : '—'}
                {priceInsight && (
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-faint)' }}> of {priceInsight.total}</span>
                )}
              </div>
              <div className="stat-sub">
                {priceInsight ? priceInsight.takeaway : 'No competitor data'}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Competitors compared</div>
              <div className="stat-value">{compPrices.length}</div>
              <div className="stat-sub">with live rates for these dates</div>
            </div>
          </div>

          {/* Comp set table — click column headers to sort */}
          <div className="table-wrapper table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hotel</th>
                  {([
                    { key: 'distance' as SortKey, label: 'Distance' },
                    { key: 'stars' as SortKey, label: 'Stars' },
                    { key: 'review' as SortKey, label: 'Review' },
                    { key: 'rate' as SortKey, label: 'Rate' },
                    { key: 'vs' as SortKey, label: 'Vs. you' },
                  ]).map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      title={`Sort by ${col.label.toLowerCase()}`}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      {col.label}
                      <span style={{ marginLeft: 4, fontSize: 9, color: sortKey === col.key ? 'var(--accent)' : 'var(--text-faint)' }}>
                        {sortKey === col.key ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCompetitors.map((c, i) => {
                  const delta = !c.is_user_property && c.price !== null && userPriceFromComps !== null
                    ? c.price - userPriceFromComps
                    : null
                  const deltaPct = delta !== null && userPriceFromComps
                    ? (delta / userPriceFromComps) * 100
                    : null
                  return (
                    <tr
                      key={c.hotel_id}
                      style={{
                        background: c.is_user_property ? 'var(--accent-soft)' : undefined,
                        fontWeight: c.is_user_property ? 600 : undefined,
                      }}
                    >
                      <td>{i + 1}</td>
                      <td>
                        {c.hotel_name}
                        {c.is_user_property && (
                          <span className="chip chip-accent" style={{ marginLeft: 8 }}>
                            You
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {c.distance_km !== null ? `${(c.distance_km * KM_TO_MI).toFixed(1)} mi` : '—'}
                      </td>
                      <td>{c.star_rating !== null ? `${c.star_rating.toFixed(0)}★` : '—'}</td>
                      <td>{c.review_score !== null ? c.review_score.toFixed(1) : '—'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatPrice(c.price, c.currency || data.currency)}
                      </td>
                      <td style={{
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        // A pricier competitor is good for you (green); one undercutting you is red.
                        color: delta === null ? 'var(--text-faint)' : delta >= 0 ? 'var(--good)' : 'var(--bad)',
                        fontWeight: c.is_user_property ? 600 : 500,
                      }}>
                        {c.is_user_property
                          ? '—'
                          : delta === null
                            ? '—'
                            : `${delta >= 0 ? '+' : '−'}${formatPrice(Math.abs(delta), c.currency || data.currency)}${deltaPct !== null ? ` (${delta >= 0 ? '+' : '−'}${Math.abs(deltaPct).toFixed(0)}%)` : ''}`}
                      </td>
                    </tr>
                  )
                })}
                {sortedCompetitors.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      {data.competitors.some(c => c.price !== null)
                        ? 'No competitors match the current filters.'
                        : 'No rates available for these dates.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            Last updated <strong>{new Date(data.fetched_at).toLocaleString()}</strong>
            {data.cached && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 600 }}>· from cache</span>}
            <span> · </span>
            Rates refresh once per day; click <em>Force refresh</em> to pull live now. Showing the cheapest room
            at each hotel for {adults} adult{adults > 1 ? 's' : ''}, 1 room.
          </p>
        </>
      )}
      {/* 14-night outlook — which upcoming nights are mispriced */}
      {selectedProperty && !upgradeMsg && outlook && (
        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>14-night outlook</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Your rate vs. the market median for each of the next 14 nights — click a night to inspect it above.
              </div>
            </div>
            {outlookMissing > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {scanning && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{scanProgress}</span>}
                <button className="btn btn-secondary btn-sm" onClick={scanOutlook} disabled={scanning}>
                  {scanning ? 'Scanning…' : `Fetch ${outlookMissing} missing night${outlookMissing === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </div>
          {outlookError && <div className="error-msg" style={{ marginBottom: 10 }}>{outlookError}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {outlook.map(n => {
              const dt = new Date(n.checkin + 'T00:00:00')
              const market = n.market_median ?? n.market_avg
              const deltaPct = n.user_rate !== null && market
                ? ((n.user_rate - market) / market) * 100
                : null
              const deltaColors = deltaPct === null
                ? { bg: 'var(--surface-2)', fg: 'var(--text-faint)' }
                : deltaPct < -10
                  ? { bg: 'var(--good-soft)', fg: 'var(--good)' }
                  : deltaPct > 10
                    ? { bg: 'var(--bad-soft)', fg: 'var(--bad)' }
                    : { bg: 'var(--accent-soft)', fg: 'var(--accent)' }
              const isSelected = n.checkin === checkin
              const hasData = n.source !== null
              const tooltip = hasData
                ? `${n.checkin} — you ${formatPrice(n.user_rate, n.currency)} · market ${formatPrice(market, n.currency)} (${n.comp_count} comps${n.source === 'snapshot' ? `, snapshot from ${n.as_of}` : ''})`
                : `${n.checkin} — no data yet; use "Fetch missing nights"`
              return (
                <button
                  key={n.checkin}
                  onClick={() => {
                    setCheckin(n.checkin)
                    setCheckout(defaultCheckout(n.checkin))
                  }}
                  title={tooltip}
                  style={{
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    boxShadow: isSelected ? '0 0 0 2px rgba(79,70,229,0.15)' : 'none',
                    borderRadius: 10,
                    background: hasData ? 'var(--surface)' : 'var(--surface-2)',
                    padding: '8px 6px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'center',
                    minWidth: 0,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {dt.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 1 }}>
                    {dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  {hasData ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
                        {formatPrice(n.user_rate, n.currency)}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        mkt {formatPrice(market, n.currency)}
                      </div>
                      <div style={{
                        display: 'inline-block', marginTop: 4, padding: '1px 7px', borderRadius: 999,
                        fontSize: 10, fontWeight: 700, background: deltaColors.bg, color: deltaColors.fg,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {deltaPct === null ? '—' : `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%`}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10, marginBottom: 8 }}>
                      No data
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
            Green = you're priced 10%+ below the market for that night (room to raise) · red = 10%+ above.
            Data comes from today's cached lookups and daily snapshots; fetching missing nights pulls live
            from Booking.com (a few seconds per night, then cached for 24h).
          </div>
        </div>
      )}

      {selectedProperty && !upgradeMsg && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="section-title">Rate history</div>
          {historyRows.length > 0 ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Daily snapshots of your rate vs. the comp-set average for check-in{' '}
                <strong style={{ color: 'var(--text)' }}>{historyCheckin}</strong> (1 night).
              </p>
              <RateHistoryChart
                rows={historyRows}
                currency={historyRows[historyRows.length - 1].currency || data?.currency || 'USD'}
              />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: 'var(--accent-soft)', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                📈
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--ink)' }}>No snapshots yet for this property.</strong>{' '}
                Each daily rates sync records your rate and the comp-set average, and the trend
                appears here after a few days. Use <em>Sync rates now</em> below to record the first one.
              </div>
            </div>
          )}
        </div>
      )}
      <SyncFooter domain="rates" />
    </ThemedPage>
  )
}
