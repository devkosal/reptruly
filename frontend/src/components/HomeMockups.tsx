/**
 * Inline CSS/SVG mockup widgets that stand in for real screenshots on the marketing
 * Home page. Each one is small, stylized, token-coloured, and crisp at any zoom.
 * Colors follow docs/design-system.md — no pastels, semantic tints only.
 */

const cardChrome: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 10,
  border: '1px solid var(--border)',
  padding: 12,
  boxShadow: 'var(--shadow-md)',
  fontSize: 10,
  color: 'var(--text)',
}

function WindowDots() {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff5f57' }} />
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffbd2e' }} />
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#28c840' }} />
    </div>
  )
}

// ---------------- REVIEW INBOX ----------------
export function ReviewInboxMockup({ accent = '#4f46e5' }: { accent?: string }) {
  const rows = [
    { score: '9.2', ota: 'Booking', otaBg: '#1e5aa7', text: 'Spotless room, friendly staff. Will be back.' },
    { score: '4.0', ota: 'Expedia', otaBg: '#b07207', text: 'Bathroom needs an upgrade.' },
    { score: '8.5', ota: 'Google', otaBg: '#237a3c', text: 'Quiet and comfortable.' },
    { score: '6.0', ota: 'Booking', otaBg: '#1e5aa7', text: 'AC was loud at night.' },
  ]
  return (
    <div style={cardChrome}>
      <WindowDots />
      <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        ★ Reviews · This week
      </div>
      {rows.map((r, i) => {
        const sb = parseFloat(r.score)
        const bg = sb >= 8 ? 'var(--good-soft)' : sb >= 6 ? 'var(--warn-soft)' : 'var(--bad-soft)'
        const fg = sb >= 8 ? 'var(--good)' : sb >= 6 ? 'var(--warn)' : 'var(--bad)'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <span style={{ background: bg, color: fg, fontWeight: 700, fontSize: 9, padding: '2px 6px', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}>{r.score}</span>
            <span style={{ background: r.otaBg, color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>
              {r.ota}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {r.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------- LIVE RATE SHOPPING ----------------
export function RateShoppingMockup({ accent = '#059669' }: { accent?: string }) {
  const rows = [
    { name: 'Studio 6', price: '$83', isUser: false },
    { name: 'Travelodge ⭐', price: '$92', isUser: true },
    { name: 'Royal Inn', price: '$104', isUser: false },
    { name: 'Speedway Inn', price: '$197', isUser: false },
  ]
  return (
    <div style={cardChrome}>
      <WindowDots />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          $ Rate vs comp set
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>tonight</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 6px', borderRadius: 4,
          background: r.isUser ? 'var(--good-soft)' : 'transparent',
          fontWeight: r.isUser ? 700 : 500,
          color: r.isUser ? 'var(--good)' : 'var(--text)',
          fontSize: 10,
        }}>
          <span>{r.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.price}</span>
        </div>
      ))}
      <div style={{
        marginTop: 8, padding: '6px 8px', borderTop: '1px dashed var(--border-strong)', fontSize: 9,
        color: 'var(--good)', fontWeight: 700,
      }}>
        ↘ You're 11% below market
      </div>
    </div>
  )
}

// ---------------- DEMAND CALENDAR ----------------
export function DemandCalendarMockup({ accent = '#7c3aed' }: { accent?: string }) {
  // 7-col mini calendar — demand shown as an indigo intensity scale
  const cells = [
    [0, 1, 2, 3, 1, 0, 0],
    [1, 2, 1, 1, 2, 4, 5],  // weekend spike with major event
    [0, 0, 1, 0, 1, 3, 3],
    [0, 1, 2, 1, 1, 4, 4],
  ]
  const colorFor = (s: number) => {
    if (s >= 4) return 'var(--grad-accent)'
    if (s >= 3) return '#c7cdfa'
    if (s >= 2) return '#dfe3fc'
    if (s >= 1) return 'var(--accent-soft)'
    return 'var(--surface-2)'
  }
  const text = (s: number) => {
    if (s >= 4) return '#fff'
    if (s >= 2) return 'var(--accent-strong)'
    if (s >= 1) return 'var(--accent)'
    return 'var(--text-faint)'
  }
  return (
    <div style={cardChrome}>
      <WindowDots />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📅 May 2026
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 600 }}>🎯 Indy 500 wknd</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 7, fontWeight: 700, color: 'var(--text-faint)', textAlign: 'center' }}>{d}</div>
        ))}
        {cells.flat().map((s, i) => (
          <div key={i} style={{
            background: colorFor(s), color: text(s),
            fontSize: 9, fontWeight: 700,
            aspectRatio: '1 / 1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 3,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- AI ANALYTICS ----------------
export function AnalyticsMockup({ accent = '#4f46e5' }: { accent?: string }) {
  const bars = [4, 6, 5, 8, 7, 9, 10]
  return (
    <div style={cardChrome}>
      <WindowDots />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📊 Avg score · 7d trend
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          8.4<span style={{ fontSize: 8, color: 'var(--text-muted)' }}>/10</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56, marginBottom: 8 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, background: 'var(--grad-accent)', opacity: 0.55 + (h / 10) * 0.45,
            height: `${h * 10}%`, borderRadius: 2, minHeight: 4,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 9 }}>
        <span style={{ background: 'var(--good-soft)', color: 'var(--good)', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>
          ✨ AI: cleanliness +12%
        </span>
        <span style={{ background: 'var(--bad-soft)', color: 'var(--bad)', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>
          ⚠ noise -8%
        </span>
      </div>
    </div>
  )
}

// ---------------- HERO COMPOSITE ----------------
// All four mockups arranged as overlapping cards. Designed for the right-hand
// column of the dark hero — each card gets a hairline light outline + --shadow-lg.
const heroCardWrap: React.CSSProperties = {
  borderRadius: 10,
  boxShadow: 'var(--shadow-lg)',
  outline: '1px solid rgba(255,255,255,0.14)',
  outlineOffset: -1,
}

export function HeroComposite() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 380 }}>
      {/* Reviews — main card, slight rotation */}
      <div style={{
        ...heroCardWrap,
        position: 'absolute', top: 0, left: 0, width: '78%', zIndex: 3,
        transform: 'rotate(-2deg)',
      }}>
        <ReviewInboxMockup accent="#4f46e5" />
      </div>

      {/* Demand Calendar — bottom-right, behind reviews */}
      <div style={{
        ...heroCardWrap,
        position: 'absolute', bottom: 0, right: 0, width: '60%', zIndex: 2,
        transform: 'rotate(2deg)',
      }}>
        <DemandCalendarMockup accent="#7c3aed" />
      </div>

      {/* Rate shopping — middle-right, layered between */}
      <div style={{
        ...heroCardWrap,
        position: 'absolute', top: '32%', right: '-4%', width: '52%', zIndex: 4,
        transform: 'rotate(1deg)',
      }}>
        <RateShoppingMockup accent="#059669" />
      </div>

      {/* Analytics — bottom-left, behind reviews card */}
      <div style={{
        ...heroCardWrap,
        position: 'absolute', bottom: '8%', left: '6%', width: '48%', zIndex: 1,
        transform: 'rotate(-3deg)',
      }}>
        <AnalyticsMockup accent="#4f46e5" />
      </div>
    </div>
  )
}
