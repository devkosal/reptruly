import { useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../context/AuthContext'
import {
  AnalyticsMockup,
  DemandCalendarMockup,
  HeroComposite,
  RateShoppingMockup,
  ReviewInboxMockup,
} from '../components/HomeMockups'
import useDocumentTitle from '../hooks/useDocumentTitle'

const FEATURES = [
  {
    icon: '⭐',
    title: 'Review Inbox',
    desc: 'Every Booking, Expedia, and Google review in one timeline. Filter by score, OTA, or reply status. Reply via the OTA extranet in one click.',
    href: '/reviews',
    accent: '#4f46e5',
    Mockup: ReviewInboxMockup,
  },
  {
    icon: '💰',
    title: 'Live Rate Shopping',
    desc: 'See your nightly rate next to every nearby competitor. Spot when you\'re leaving money on the table — or undercutting yourself.',
    href: '/rates',
    accent: '#059669',
    Mockup: RateShoppingMockup,
  },
  {
    icon: '📅',
    title: 'Demand Calendar',
    desc: 'Concerts, sports, holidays and weather laid out 12 months ahead. Each event is impact-scored — Taylor Swift counts more than a school play.',
    href: '/calendar',
    accent: '#7c3aed',
    Mockup: DemandCalendarMockup,
  },
  {
    icon: '📊',
    title: 'AI Analytics',
    desc: 'Per-OTA scores, monthly trends, reply rate, and AI-summarised highlights. Drill into one channel or compare them side-by-side.',
    href: '/analytics',
    accent: '#0891b2',
    Mockup: AnalyticsMockup,
  },
]

const STATS = [
  { number: '3', label: 'OTAs connected per property', sub: 'Booking · Expedia · Google' },
  { number: '1 min', label: 'Setup time', sub: 'Paste a link — reviews start syncing' },
  { number: '24h', label: 'Daily auto-refresh', sub: 'Every channel, every morning' },
  { number: '12mo', label: 'Demand calendar horizon', sub: 'Events · weather · holidays' },
]

interface FeaturePill {
  abbr: string
  name: string
  tagline: string
  bullets: string[]
}

const FEATURE_PILLS: FeaturePill[] = [
  {
    abbr: 'RVI', name: 'Review Inbox',
    tagline: 'Every guest review from every OTA in one timeline.',
    bullets: ['Booking, Expedia, and Google in one inbox', 'Filter by score, OTA, date, or reply status', 'One-click jump to the OTA extranet to reply'],
  },
  {
    abbr: 'REP', name: 'Reply Studio',
    tagline: 'AI drafts replies in your voice.',
    bullets: ['Tone-matched to each reviewer', 'Edit before posting — never auto-sent', 'Templates for 1-star, 5-star, and edge cases'],
  },
  {
    abbr: 'CMP', name: 'Comp Set',
    tagline: 'Your nightly rate vs. every nearby competitor.',
    bullets: ['Live Booking.com prices around your radius', 'Distance, star rating, and review score side-by-side', 'Spot when you\'re leaving money on the table'],
  },
  {
    abbr: 'DMC', name: 'Demand Calendar',
    tagline: '12 months of demand laid out by day.',
    bullets: ['Events, holidays, and weather in one grid', 'Each day scored 0–10 for demand impact', 'Heat map shows the busy weekends ahead'],
  },
  {
    abbr: 'EVT', name: 'Event Radar',
    tagline: 'Concerts, sports, and shows within your radius.',
    bullets: ['Pulled from Ticketmaster automatically', 'Impact-scored — Taylor Swift > school play', 'Linked to the official event page'],
  },
  {
    abbr: 'WX', name: 'Weather Lens',
    tagline: '16-day weather forecast for your address.',
    bullets: ['Highs, lows, and precipitation per day', 'Powered by Open-Meteo', 'Price ahead of storms or heatwaves'],
  },
  {
    abbr: 'HOL', name: 'Holiday Map',
    tagline: 'National and regional holidays auto-detected.',
    bullets: ['Country-specific from your property\'s coordinates', 'Federal, state, and observance days', 'Surfaced on the demand calendar'],
  },
  {
    abbr: 'AIS', name: 'AI Summaries',
    tagline: 'Plain-English digest of your review batch.',
    bullets: ['Top complaints and top compliments', 'Themes broken out per OTA', 'Refreshes whenever new reviews land'],
  },
  {
    abbr: 'TRD', name: 'Trend Lines',
    tagline: 'Weekly and monthly score trends per OTA.',
    bullets: ['Spot dips before they become patterns', 'Compare 7-day vs 30-day deltas', 'Per-channel and combined view'],
  },
  {
    abbr: 'OTA', name: 'OTA Sync',
    tagline: 'Reviews refresh automatically — no setup.',
    bullets: ['Daily 24h sync on every plan', 'Force a refresh anytime', 'No API keys, no IT involvement'],
  },
  {
    abbr: 'TAG', name: 'Auto-Tags',
    tagline: 'Reviews tagged by topic, automatically.',
    bullets: ['Cleanliness, staff, AC, breakfast, parking…', 'Filter the inbox by any tag', 'Per-topic sentiment trend'],
  },
  {
    abbr: 'SEN', name: 'Sentiment',
    tagline: 'Positive / neutral / negative scoring per review.',
    bullets: ['Score-based, language-aware', 'Topic-level breakdown', 'Powers the AI summary digest'],
  },
  {
    abbr: 'SLA', name: 'Reply SLA',
    tagline: 'Track how fast your team replies.',
    bullets: ['Median time-to-reply per OTA', 'Set a target, see who\'s behind', 'Per-property and per-user breakdown'],
  },
  {
    abbr: 'KPI', name: 'KPI Cards',
    tagline: 'The numbers that matter, at a glance.',
    bullets: ['Average score, reply rate, weekly volume', 'One property or all combined', 'Color-coded against your targets'],
  },
  {
    abbr: 'DST', name: 'Score Bands',
    tagline: 'See how reviews stack across 0–10 bands.',
    bullets: ['Distribution histogram per OTA', 'Catch high-volume 6s hiding in averages', 'Drill into any band to read those reviews'],
  },
  {
    abbr: 'SRC', name: 'Search & Filter',
    tagline: 'Full-text search across every review.',
    bullets: ['Combine with date, OTA, score, reply filters', 'Saved filters per user', 'Instant results — no rebuild step'],
  },
  {
    abbr: 'EXP', name: 'CSV Export',
    tagline: 'Download filtered reviews as CSV.',
    bullets: ['Open in Excel, Sheets, or Notion', 'Useful for board reports', 'Includes scores, replies, and timestamps'],
  },
  {
    abbr: 'MPR', name: 'Multi-Property',
    tagline: 'Run several properties under one login.',
    bullets: ['Switch context with one click', 'All-properties roll-up dashboard', 'Per-property permissions on Pro+'],
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Paste a link',
    desc: 'Copy any Booking.com, Expedia, or Google Maps URL of your hotel and paste it into reptruly. We extract the property automatically.',
  },
  {
    n: '02',
    title: 'Reviews flow in',
    desc: 'Within seconds, every existing guest review appears in your inbox. Sorted, scored, filterable. Tagged by OTA so you never lose context.',
  },
  {
    n: '03',
    title: 'Run your day',
    desc: 'Reply to flagged reviews from one screen. Watch your rate vs. comp set. Lift prices when local demand is high.',
  },
]

// Shared button styles — one accent gradient for primary, ghost hairline for secondary
const btnPrimary: React.CSSProperties = {
  background: 'var(--grad-accent)',
  color: '#fff',
  padding: '13px 28px',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 700,
  textDecoration: 'none',
  boxShadow: '0 1px 2px rgba(79,70,229,0.35), 0 8px 24px rgba(79,70,229,0.35)',
}

const btnGhostDark: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.92)',
  padding: '13px 28px',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.14)',
  backdropFilter: 'blur(4px)',
}

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 10,
}

export default function Home() {
  useDocumentTitle('')
  const { user } = useAuth()
  const [activePill, setActivePill] = useState<string>(FEATURE_PILLS[0].abbr)
  const activeFeature = FEATURE_PILLS.find(f => f.abbr === activePill) || FEATURE_PILLS[0]

  return (
    <>
      <TopNav />

      {/* HERO — full-bleed deep-ink with subtle radial indigo glows */}
      <section style={{
        background: [
          'radial-gradient(ellipse 70% 55% at 18% 0%, rgba(79,70,229,0.28), transparent 60%)',
          'radial-gradient(ellipse 55% 45% at 92% 90%, rgba(124,58,237,0.18), transparent 60%)',
          'var(--grad-dark)',
        ].join(', '),
        color: '#fff',
        padding: '88px 32px 104px',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 0,
      }}>
        <div className="home-hero-grid" style={{
          position: 'relative', maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center',
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              background: 'rgba(79,70,229,0.18)', color: '#c7d2fe',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '6px 14px', borderRadius: 999, marginBottom: 24,
              border: '1px solid rgba(129,140,248,0.3)',
            }}>
              {user ? 'Welcome back' : '✨ Hotel intel, simplified'}
            </div>
            <h1 className="home-hero-title" style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1.06, marginBottom: 20,
              letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.92)',
            }}>
              Every review.<br />Every rate.<br /><span style={{
                background: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>One workspace.</span>
            </h1>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: 28, maxWidth: 520 }}>
              Every guest review, every competitor's rate, every weekend's demand — handled
              before your coffee gets cold. Paste a link, skip the API keys, win back an hour a day.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {user ? (
                <Link to="/reviews" style={btnPrimary}>
                  Open Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/login" style={btnPrimary}>
                    Start 7-day free trial →
                  </Link>
                  <Link to="/contact" style={btnGhostDark}>
                    Book a demo
                  </Link>
                </>
              )}
            </div>
            <div style={{ marginTop: 28, fontSize: 12, color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 16, flexWrap: 'wrap', fontWeight: 500 }}>
              <span>✓ No credit card</span>
              <span>✓ 60-second setup</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>

          {/* Hero composite — overlapping mockups for all four tools */}
          <HeroComposite />
        </div>
      </section>

      {/* STATS STRIP — light band */}
      <section style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '40px 32px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 750, color: 'var(--ink)', lineHeight: 1, marginBottom: 8, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.number}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES — white section, alternating text/mockup cards */}
      <section style={{ padding: '88px 32px', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={eyebrow}>
              What's inside
            </div>
            <h2 style={{ fontSize: 38, fontWeight: 800, marginBottom: 14, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Four tools, one workspace
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 620, margin: '0 auto', lineHeight: 1.65 }}>
              Built for independent hoteliers and small chains who don't have time to log into 5 different dashboards.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            {FEATURES.map((f, idx) => {
              const reverse = idx % 2 === 1  // alternate text-left / image-left
              return (
                <Link key={f.title} to={f.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                      e.currentTarget.style.borderColor = 'var(--border-strong)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = ''
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    {/* text column */}
                    <div style={{ padding: 32, gridColumn: reverse ? 2 : 1, gridRow: 1 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 12, background: `${f.accent}14`,
                        border: `1px solid ${f.accent}26`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, marginBottom: 16,
                      }}>{f.icon}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 18 }}>
                        {f.desc}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Open {f.title} →</div>
                    </div>
                    {/* mockup column */}
                    <div style={{
                      padding: 24, gridColumn: reverse ? 1 : 2, gridRow: 1,
                      background: 'var(--surface-2)',
                      borderLeft: reverse ? 'none' : '1px solid var(--border)',
                      borderRight: reverse ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: '100%', maxWidth: 320 }}>
                        <f.Mockup accent={f.accent} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — full-bleed dark ink band */}
      <section style={{
        background: [
          'radial-gradient(ellipse 60% 50% at 85% 0%, rgba(79,70,229,0.22), transparent 60%)',
          'var(--grad-dark)',
        ].join(', '),
        padding: '88px 32px',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ ...eyebrow, color: '#818cf8' }}>
              How it works
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: 'rgba(255,255,255,0.92)', marginBottom: 12, letterSpacing: '-0.02em' }}>
              Guests talk. We listen. You win.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 580, margin: '0 auto', lineHeight: 1.6 }}>
              Reviews flowing in 60 seconds. No installs, no API keys — just paste a link.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '36px 28px 28px', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: -18, left: 24,
                  background: 'var(--grad-accent)', color: '#fff',
                  width: 40, height: 40, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14,
                  boxShadow: '0 8px 20px rgba(79,70,229,0.45)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{s.n}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: 8, letterSpacing: '-0.01em' }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE PILLS — interactive grid on light background */}
      <section style={{
        padding: '88px 32px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={eyebrow}>
              Everything inside
            </div>
            <h2 style={{ fontSize: 38, fontWeight: 800, marginBottom: 14, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              See everything, miss nothing
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 620, margin: '0 auto', lineHeight: 1.65 }}>
              {FEATURE_PILLS.length} superpowers, one workspace. Tap any tile to see what it does — everything ships on day one, no add-ons, no upsell.
            </p>
          </div>

          {/* Pills grid — full feature name in the chip; click to view its description */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            marginBottom: 24,
          }}>
            {FEATURE_PILLS.map(f => {
              const isActive = activePill === f.abbr
              return (
                <button
                  key={f.abbr}
                  onClick={() => setActivePill(f.abbr)}
                  style={{
                    background: isActive ? 'var(--grad-accent)' : 'var(--surface)',
                    border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                    borderRadius: 12,
                    padding: '16px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isActive
                      ? '0 8px 20px rgba(79,70,229,0.35)'
                      : 'var(--shadow-sm)',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                    fontFamily: 'inherit',
                    minHeight: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    }
                  }}
                >
                  <span style={{
                    fontSize: 14, fontWeight: 700, lineHeight: 1.2,
                    letterSpacing: '-0.005em',
                    color: isActive ? '#fff' : 'var(--ink)',
                  }}>
                    {f.name}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Detail card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '28px 32px',
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                {activeFeature.name}
              </h3>
              <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.55, margin: '0 0 14px', fontWeight: 500 }}>
                {activeFeature.tagline}
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeFeature.bullets.map(b => (
                  <li key={b} style={{
                    fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55,
                    paddingLeft: 22, position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', left: 0, top: 7,
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--grad-accent)',
                    }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL — white section, deep-ink quote card */}
      <section style={{ padding: '88px 32px', background: 'var(--surface)' }}>
        <div style={{
          maxWidth: 880, margin: '0 auto', textAlign: 'center',
          background: [
            'radial-gradient(ellipse 60% 70% at 85% 0%, rgba(124,58,237,0.25), transparent 60%)',
            'var(--grad-dark)',
          ].join(', '),
          color: '#fff', padding: '48px 40px', borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 44, color: '#818cf8', marginBottom: 16, lineHeight: 1, fontWeight: 800 }}>"</div>
            <p style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.45, marginBottom: 24, letterSpacing: '-0.01em' }}>
              We cut review-response time from 3 days to 4 hours.
              The Demand Calendar paid for itself the first weekend a Morgan Wallen show came to town.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--grad-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800,
              }}>JG</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>Jamie Garrett</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>GM · Garnet Inn Group · 3 properties</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BIG CTA — full-bleed deep ink with indigo glow */}
      <section style={{
        background: [
          'radial-gradient(ellipse 55% 65% at 50% 0%, rgba(79,70,229,0.32), transparent 65%)',
          'var(--grad-dark)',
        ].join(', '),
        padding: '72px 32px', color: '#fff', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
          Ready to take an hour back per day?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginBottom: 28, maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.6 }}>
          Connect your first property in under a minute. No credit card required.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={user ? '/reviews' : '/login'} style={btnPrimary}>
            {user ? 'Open Dashboard →' : 'Start 7-day free trial →'}
          </Link>
          <Link to="/contact" style={btnGhostDark}>
            Book a demo
          </Link>
        </div>
      </section>

      {/* FOOTER — full-bleed ink band */}
      <footer style={{ background: 'var(--ink)', color: 'rgba(255,255,255,0.55)', padding: '48px 32px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="home-footer-grid" style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 32, fontSize: 13,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.5px' }}>
              rep<span style={{
                background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>truly</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontSize: 12 }}>
              Hotel reputation, rates, and demand — in one workspace.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 12 }}>
              © 2026 reptruly. All rights reserved.
            </p>
          </div>
          {[
            { title: 'Product', items: [['Reviews', '/reviews'], ['Rates', '/rates'], ['Demand Calendar', '/calendar'], ['Analytics', '/analytics'], ['Pricing', '/pricing']] },
            { title: 'Resources', items: [['Blog', '/resources#blog'], ['Guides', '/resources#guides'], ['Case studies', '/resources#cases'], ['Changelog', '/resources#changelog']] },
            { title: 'Company', items: [['About', '/about'], ['Careers', '/about#careers'], ['Media', '/about#media'], ['Partners', '/about#partners'], ['Security', '/about#security']] },
            { title: 'Support', items: [['Help center', '/help'], ['Contact', '/contact'], ['hello@reptruly.com', 'mailto:hello@reptruly.com']] },
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginBottom: 12 }}>{col.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, lineHeight: 2 }}>
                {col.items.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('mailto:') ? (
                      <a href={href} style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>{label}</a>
                    ) : (
                      <Link to={href} style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </>
  )
}
