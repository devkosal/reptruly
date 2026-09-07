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

interface FeaturePill {
  abbr: string
  name: string
  tagline: string
}

const FEATURE_PILLS: FeaturePill[] = [
  {
    abbr: 'RVI', name: 'Review Inbox',
    tagline: 'Every guest review from every OTA in one timeline.',
  },
  {
    abbr: 'REP', name: 'Reply Studio',
    tagline: 'AI drafts replies in your voice.',
  },
  {
    abbr: 'CMP', name: 'Comp Set',
    tagline: 'Your nightly rate vs. every nearby competitor.',
  },
  {
    abbr: 'DMC', name: 'Demand Calendar',
    tagline: '12 months of demand laid out by day.',
  },
  {
    abbr: 'EVT', name: 'Event Radar',
    tagline: 'Concerts, sports, and shows within your radius.',
  },
  {
    abbr: 'WX', name: 'Weather Lens',
    tagline: '16-day weather forecast for your address.',
  },
  {
    abbr: 'HOL', name: 'Holiday Map',
    tagline: 'National and regional holidays auto-detected.',
  },
  {
    abbr: 'AIS', name: 'AI Summaries',
    tagline: 'Plain-English digest of your review batch.',
  },
  {
    abbr: 'TRD', name: 'Trend Lines',
    tagline: 'Weekly and monthly score trends per OTA.',
  },
  {
    abbr: 'OTA', name: 'OTA Sync',
    tagline: 'Reviews refresh automatically — no setup.',
  },
  {
    abbr: 'TAG', name: 'Auto-Tags',
    tagline: 'Reviews tagged by topic, automatically.',
  },
  {
    abbr: 'SEN', name: 'Sentiment',
    tagline: 'Positive / neutral / negative scoring per review.',
  },
  {
    abbr: 'SLA', name: 'Reply SLA',
    tagline: 'Track how fast your team replies.',
  },
  {
    abbr: 'KPI', name: 'KPI Cards',
    tagline: 'The numbers that matter, at a glance.',
  },
  {
    abbr: 'DST', name: 'Score Bands',
    tagline: 'See how reviews stack across 0–10 bands.',
  },
  {
    abbr: 'SRC', name: 'Search & Filter',
    tagline: 'Full-text search across every review.',
  },
  {
    abbr: 'EXP', name: 'CSV Export',
    tagline: 'Download filtered reviews as CSV.',
  },
  {
    abbr: 'MPR', name: 'Multi-Property',
    tagline: 'Run several properties under one login.',
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

      {/* EVERYTHING INCLUDED — compact list on light background */}
      <section style={{
        padding: '72px 32px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={eyebrow}>
              Everything included
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              Ships on day one. No add-ons.
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
              Every feature below is part of the workspace, not an upsell.
            </p>
          </div>
          <ul style={{
            listStyle: 'none', margin: 0, padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            columnGap: 32, rowGap: 14,
          }}>
            {FEATURE_PILLS.map(f => (
              <li key={f.abbr} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                <span aria-hidden style={{
                  flex: 'none', marginTop: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--grad-accent)',
                }} />
                <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{f.name}</span>
                  {' — '}{f.tagline}
                </span>
              </li>
            ))}
          </ul>
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
