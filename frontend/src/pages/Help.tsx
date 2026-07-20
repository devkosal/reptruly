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
        a: <>Google itself caps the number of reviews available per property to 5 in their public data feed — no tool can pull more. We fetch the latest 5 every day, and since those rotate as new reviews come in, your account naturally accumulates Google review history over time.</>,
      },
      {
        q: 'Can I reply to reviews from inside reptruly?',
        a: <>No — none of the OTAs expose a programmatic reply API to non-channel-manager partners. The Reply button deep-links you to each OTA's own extranet (Booking partner, Expedia Partner Central, Google Business Profile) where you can post your reply.</>,
      },
      {
        q: 'How do AI reply drafts work?',
        a: <>On Pro, every review gets an <strong>AI draft</strong> button, and with "Suggest replies automatically" on, drafts are pre-generated during the nightly sync (you'll see a "Draft ready" chip). Set the tone, language, and signature in Settings → AI replies. Edit the draft, then <em>Copy &amp; open</em> jumps you to the OTA's reply page with the text on your clipboard.</>,
      },
      {
        q: 'What does "Mark handled" do?',
        a: <>It tells reptruly you already replied on the OTA's site. The review immediately leaves the "Needs reply" pile and the triage counts, and shows a ☑ Handled chip until the next sync confirms the reply on the OTA's side. Undo it anytime from the Any-status view.</>,
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
      {
        q: 'Where does the 14-night rate outlook get its data?',
        a: <>From data you already have: today's cached rate lookups plus the daily snapshots the rates sync records — showing the outlook costs nothing. Nights with no data yet show a <em>Fetch missing nights</em> button that pulls them live from Booking.com (a few seconds per night, then cached for 24 hours). The market median honors the "Hotels only" filter.</>,
      },
    ],
  },
  {
    section: 'Reports & sharing',
    items: [
      {
        q: 'How do I get a PDF report?',
        a: <>On the Analytics page, pick a period and click <strong>Hotel analytics report (PDF)</strong>. It covers the selected property (or all properties) for that exact period: review volumes, average scores and trends per OTA — plus AI insights and topic scores on Pro.</>,
      },
      {
        q: 'What is the monthly owner report?',
        a: <>An email on the 1st of each month with last month's numbers per property and a link to the printable report — handy for owners and investors. Toggle it in Settings → Notifications.</>,
      },
      {
        q: 'What is the website badge?',
        a: <>A live review-score badge you can embed on your own site — it updates automatically as reviews sync. Grab the embed code in Settings → Badge; it works anywhere an image tag works (Wix, Squarespace, WordPress, plain HTML).</>,
      },
    ],
  },
  {
    section: 'Account & billing',
    items: [
      {
        q: 'How does pricing work?',
        a: <>Every account starts with a free 7-day Starter trial on one property — no card required. After that, Pro is $29.99 per property per month (up to 10 properties), or ≈$24.99/mo when billed annually. Group pricing is volume-discounted for 10+ properties — see <a href="/pricing" style={linkStyle}>Pricing</a>.</>,
      },
      {
        q: 'What happens when my trial ends?',
        a: <>Nothing is deleted. Your synced reviews and analytics stay readable — syncing and gated features simply pause until you upgrade to Pro.</>,
      },
      {
        q: 'Can I export my review data?',
        a: <>Yes, two ways. <strong>Export CSV</strong> at the top of the review inbox downloads whatever the current filters show. For programmatic access, Pro plans include a read-only API: create a key in Settings → API keys and send it in an <code>X-API-Key</code> header to pull your properties, reviews, and analytics.</>,
      },
      {
        q: 'What if I want to cancel?',
        a: <>Cancel anytime from Settings → Billing (the Stripe portal). Your plan runs to the end of the current billing period, and your data stays in your account — readable even after the plan lapses. Want everything erased? <a href="/contact" style={linkStyle}>Contact us</a> and we'll delete your account and data.</>,
      },
    ],
  },
]

export default function Help() {
  useDocumentTitle('Help')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visibleFaqs = FAQS
    .map(g => ({ ...g, items: q ? g.items.filter(it => it.q.toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length > 0)

  return (
    <>
      <TopNav />
      <PageContainer>

      <div style={{ marginBottom: 24, marginTop: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>
          Help center
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Quick answers to the most common questions. Can't find what you need?{' '}
          <a href="/contact" style={linkStyle}>Talk to us</a>.
        </p>
      </div>

      <input
        type="search"
        className="filter-input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Type to filter questions… (e.g. Google, cancel, PDF)"
        style={{ width: '100%', maxWidth: 480, marginBottom: 28, fontSize: 14 }}
      />

      {visibleFaqs.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
          No questions match "{query}" — try another word or{' '}
          <a href="/contact" style={linkStyle}>ask us directly</a>.
        </p>
      )}

      {visibleFaqs.map(group => (
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
