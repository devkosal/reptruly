import { useState } from 'react'
import TopNav from '../components/TopNav'
import PageContainer from '../components/PageContainer'
import useDocumentTitle from '../hooks/useDocumentTitle'

interface FAQ { q: string; a: React.ReactNode }

const linkStyle: React.CSSProperties = { color: 'var(--accent)', fontWeight: 600 }

const FAQS: { section: string; items: FAQ[] }[] = [
  {
    section: 'Getting started',
    items: [
      {
        q: 'How do I add my first property?',
        a: <>Click <strong>+ Add</strong> in the Properties sidebar. Give the property a name, then paste in any combination of Booking.com, Expedia, and Google links — at least one is enough to start syncing reviews.</>,
      },
      {
        q: 'Where does my Booking.com hotel ID come from?',
        a: <>It's the numeric ID in any Booking.com URL. We accept the full URL too — just copy the page URL of your hotel from Booking.com and paste it; we extract the ID for you.</>,
      },
      {
        q: 'Do I need to set anything up to get reviews flowing?',
        a: <>No. We handle every OTA integration for you — Booking.com, Expedia, and Google. Sign up, paste your property's link from any of those sites, and reviews start syncing within seconds. No API keys, no developer setup.</>,
      },
    ],
  },
  {
    section: 'Reviews & syncing',
    items: [
      {
        q: 'How often do reviews sync?',
        a: <>Once a day at 03:00 UTC, automatically. Each daily sync only pulls reviews posted since the last refresh, so new guest feedback shows up the morning after it's posted with no manual work from you. You can also force a refresh anytime from Settings → Manual sync.</>,
      },
      {
        q: 'Why am I only getting 5 Google reviews?',
        a: <>Google itself caps the number of reviews available per property to 5 in their public data feed. We pull the latest 5 every day, and since the "latest 5" rotate as new reviews come in, your account naturally accumulates more over time. If you need a full historical backfill of every Google review your property has ever received, that's available on the Pro and Group plans — <a href="/contact" style={linkStyle}>contact us</a> to enable it.</>,
      },
      {
        q: 'Can I reply to reviews from inside reptruly?',
        a: <>No — none of the OTAs expose a programmatic reply API to non-channel-manager partners. The Reply button deep-links you to each OTA's own extranet (Booking partner, Expedia Partner Central, Google Business Profile) where you can post your reply.</>,
      },
    ],
  },
  {
    section: 'Rates & demand',
    items: [
      {
        q: 'How fresh is the rate data?',
        a: <>Each unique date+property combination is cached for 24 hours. The first view of a date pulls live from Booking; subsequent views within 24 hours are instant. Click <em>Force refresh</em> to pull live again immediately.</>,
      },
      {
        q: 'How is the "demand score" calculated?',
        a: <>It combines weekend (+1), public holiday (+2), and event impact (+1 to +3). Each event near your property is automatically classified by AI as Local / Regional / Major / Destination based on artist or team notoriety, venue size, and event type. So a Taylor Swift stadium concert raises the score; a local school play doesn't.</>,
      },
      {
        q: 'Why does weather show "n/a" past two weeks?',
        a: <>Open-Meteo (our weather provider, free) only forecasts ~16 days into the future. Holidays and events still populate further out, but weather will be blank.</>,
      },
    ],
  },
  {
    section: 'Account & billing',
    items: [
      {
        q: 'How does pricing work?',
        a: <>Every account starts with a free 7-day Starter trial on one property — no card required. After that, Pro is $29.99 per property per month (up to 10 properties), or $24.99/mo billed annually. Group pricing is volume-discounted — see <a href="/pricing" style={linkStyle}>Pricing</a>.</>,
      },
      {
        q: 'Can I export my review data?',
        a: <>Yes — use the <strong>Export CSV</strong> button at the top of your review inbox. It downloads whatever the current filters show (property, channel, score range, dates). Need programmatic access instead? <a href="/contact" style={linkStyle}>Contact us</a> — we'd love to hear your use case.</>,
      },
      {
        q: 'What if I want to cancel?',
        a: <>Cancel anytime from Settings → Billing. Your data stays in our DB for 30 days after cancellation in case you change your mind, then is permanently deleted.</>,
      },
    ],
  },
]

export default function Help() {
  useDocumentTitle('Help')
  const [openKey, setOpenKey] = useState<string | null>(null)

  return (
    <>
      <TopNav />
      <PageContainer>

      <div style={{ marginBottom: 32, marginTop: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>
          Help center
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Quick answers to the most common questions. Can't find what you need?{' '}
          <a href="/contact" style={linkStyle}>Talk to us</a>.
        </p>
      </div>

      {FAQS.map(group => (
        <div key={group.section} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            {group.section}
          </h2>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {group.items.map((item, i) => {
              const key = `${group.section}-${i}`
              const isOpen = openKey === key
              return (
                <div key={key} style={{ borderBottom: i === group.items.length - 1 ? 'none' : '1px solid var(--border)' }}>
                  <button
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                      padding: '16px 20px', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'inherit',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    {item.q}
                    <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 20px 20px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{
        background: [
          'radial-gradient(ellipse 60% 70% at 50% 0%, rgba(79,70,229,0.3), transparent 60%)',
          'var(--grad-dark)',
        ].join(', '),
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '32px 24px',
        textAlign: 'center',
        marginTop: 24,
        boxShadow: 'var(--shadow-md)',
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.92)', marginBottom: 6 }}>
          Still stuck?
        </h3>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
          Email <a href="mailto:hello@reptruly.com" style={{ color: '#818cf8', fontWeight: 600 }}>hello@reptruly.com</a> or open the contact form. We reply within 24 hours.
        </p>
        <a
          href="/contact"
          style={{
            display: 'inline-block',
            background: 'var(--grad-accent)',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(79,70,229,0.35), 0 8px 20px rgba(79,70,229,0.35)',
          }}
        >
          Contact support
        </a>
      </div>
      </PageContainer>
    </>
  )
}
