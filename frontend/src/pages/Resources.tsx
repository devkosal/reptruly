import TopNav from '../components/TopNav'
import PageContainer from '../components/PageContainer'
import useDocumentTitle from '../hooks/useDocumentTitle'

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 4 }}>{title}</h2>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{sub}</p>}
      <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

function Card({ tag, title, sub }: { tag: string; title: string; sub: string }) {
  return (
    <div style={{
      padding: 16,
      border: '1px solid var(--border)',
      borderRadius: 14,
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {tag}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{sub}</div>
    </div>
  )
}

export default function Resources() {
  useDocumentTitle('Resources')
  return (
    <>
      <TopNav />
      <PageContainer>

      <div style={{ marginBottom: 24, marginTop: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>
          Resources
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Guides, case studies, and the technical docs we use ourselves.
        </p>
      </div>

      <Section id="blog" title="Field notes" sub="Short observations from the data we work with — a full blog is coming">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <Card tag="Note" title="Why Expedia reviews skew lower than Booking" sub="Different traveler segments respond differently — factor it in before comparing scores across channels." />
          <Card tag="Note" title="Event weekends move rates days earlier than you think" sub="Comp sets around stadiums start climbing 10–14 days out. Watch the demand calendar, not the event date." />
          <Card tag="Note" title="The 5-review Google cap (and how to live with it)" sub="Google's public data only ever exposes 5 reviews. Daily syncing accumulates history as they rotate." />
        </div>
      </Section>

      <Section id="guides" title="Guides" sub="Practical playbooks — click to read">
        <Guide title="How to respond to a 1-star review">
          <ol style={{ paddingLeft: 20, display: 'grid', gap: 8 }}>
            <li><strong>Reply within 24 hours.</strong> Future guests read the response date. A fast, calm reply to an angry review often does more for bookings than ten 9.0 scores.</li>
            <li><strong>Thank, acknowledge, own.</strong> Open by thanking them for the feedback, name the specific problem ("you're right that the pool area closed early"), and own it without excuses. Never argue, never blame the guest — you're writing for the readers, not the reviewer.</li>
            <li><strong>Say what changed.</strong> One concrete sentence: "We've changed the pool schedule and retrained the evening desk team." Vague promises ("we'll do better") read as nothing.</li>
            <li><strong>Take it offline, then invite back.</strong> Offer a direct contact for unresolved issues and end with a genuine invitation to return. Keep the whole reply under 120 words.</li>
          </ol>
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
            In reptruly: the <strong>🔥 Negative &amp; unanswered</strong> triage chip in the review inbox surfaces these first,
            and the AI draft gives you a starting point in your configured tone.
          </p>
        </Guide>
        <Guide title="Catching pricing windows around local events">
          <ol style={{ paddingLeft: 20, display: 'grid', gap: 8 }}>
            <li><strong>Check "Dates worth acting on."</strong> The demand calendar's action strip lists the highest-demand upcoming dates with the event driving each one.</li>
            <li><strong>Click through to rates.</strong> Every flagged date has a "Check rates" shortcut that loads your comp set for that exact night — see what the market is already charging.</li>
            <li><strong>Scan the 14-night outlook.</strong> On the Rates page, green cells mean you're 10%+ below market for that night — those are your raise candidates.</li>
            <li><strong>Turn on rate movement alerts.</strong> Settings → Notifications → "Rate movement alerts" emails you when a competitor moves more than 10%, so you hear about the window even when you're not looking.</li>
          </ol>
        </Guide>
        <Guide title="OTA reply etiquette: Booking vs. Expedia vs. Google">
          <ul style={{ paddingLeft: 20, display: 'grid', gap: 8 }}>
            <li><strong>Booking.com</strong> guests are often repeat business travelers — keep replies factual and efficient. Scores here are dimension-based, so address the specific low dimension (cleanliness, staff) rather than the overall number.</li>
            <li><strong>Expedia</strong> skews leisure and family travel — a warmer, more personal tone lands better, and mentioning a specific detail from their stay goes a long way.</li>
            <li><strong>Google</strong> replies are the most public — they appear directly in Maps and Search results next to your name. Write them for a first-time searcher: short, gracious, zero defensiveness. This is your storefront window.</li>
            <li><strong>Everywhere:</strong> never paste the same reply twice in a row. Guests notice, and so do the OTA ranking systems.</li>
          </ul>
        </Guide>
      </Section>

      <Section id="api" title="API reference" sub="Read-only access to your data — included with Pro">
        <p style={{ marginBottom: 12 }}>
          Create a key in <strong>Settings → API keys</strong>, then send it in an{' '}
          <code style={codeStyle}>X-API-Key</code> header. All endpoints are read-only and scoped to your account.
        </p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          <ApiRow method="GET" path="/api/v1/properties" desc="Your connected properties with their channel IDs" />
          <ApiRow method="GET" path="/api/v1/reviews" desc="Reviews, paginated — filter by property_id, page, limit" />
          <ApiRow method="GET" path="/api/v1/analytics/summary" desc="Review totals, average score, and per-OTA breakdown" />
        </div>
        <pre style={{
          background: 'var(--ink)', color: '#e2e8f0', borderRadius: 10, padding: '14px 16px',
          fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto',
        }}>
{`curl -H "X-API-Key: rt_live_..." \\
  https://reptruly.com/api/v1/analytics/summary`}
        </pre>
      </Section>

      <Section id="cases" title="Case studies" sub="Coming from our first cohort">
        <div style={{
          border: '1px solid var(--border)', borderRadius: 14, padding: 20,
          background: 'var(--surface)', boxShadow: 'var(--shadow-sm)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              We're onboarding our first hotel groups now
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Run one property or a portfolio? Work directly with us during early access — and if reptruly
              moves your reply times or scores, we'll feature your story here (with your approval, real numbers only).
            </div>
          </div>
          <a href="/contact" className="btn btn-primary" style={{ textDecoration: 'none', flexShrink: 0 }}>
            Get early access →
          </a>
        </div>
      </Section>

      <Section id="changelog" title="Changelog" sub="What we shipped recently">
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {[
            { date: '2026-07-19', items: ['Self-serve Group plan — pick your portfolio size, checkout at volume pricing', 'Review inbox triage presets (negative & unanswered · oldest · positive to thank) with sort orders', '"Mark handled" for replies posted on the OTA side', 'Settings cleanup with sticky section navigation', 'Pricing & Help accuracy pass'] },
            { date: '2026-07-18', items: ['App shell redesign: properties sidebar + page tabs in the top bar', 'Dashboard property cards with per-property review stats and a tabbed property overview', '14-night rate outlook: your rate vs. market median per night', 'Demand calendar "Dates worth acting on" strip with rate check shortcuts', 'One period control on Analytics driving the page and the PDF report', 'Rates: market median, price-position insight, sortable comp table, hotels-only filter', 'Public read-only API with per-account keys'] },
            { date: '2026-07-12', items: ['Stripe billing: checkout, customer portal, per-property quantities', 'Transactional emails + monthly owner report emails', 'Embeddable live review-score badge', 'Design system refresh across the whole app'] },
            { date: '2026-05-24', items: ['Daily sync infrastructure for reviews, rates, and demand', 'Profile and settings UX'] },
            { date: '2026-04-26', items: ['Per-OTA analytics tabs (All / Booking / Expedia / Google)', 'Property edit + remove', 'Google reviews via Places API (New)'] },
            { date: '2026-04-25', items: ['Demand calendar with impact-weighted demand score (AI-classified events)', 'Expedia integration'] },
            { date: '2026-04-24', items: ['Rates page with comp-set comparison + 24h cached daily refresh'] },
          ].map(entry => (
            <li key={entry.date} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>{entry.date}</div>
              <ul style={{ paddingLeft: 20, lineHeight: 1.6, fontSize: 13, color: 'var(--text-muted)' }}>
                {entry.items.map(i => <li key={i}>{i}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
      </PageContainer>
    </>
  )
}

const codeStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '1px 6px',
  fontSize: 12.5,
}

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details style={{
      border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)',
      boxShadow: 'var(--shadow-sm)', padding: '0 16px', marginBottom: 10,
    }}>
      <summary style={{
        cursor: 'pointer', padding: '14px 0', fontSize: 14, fontWeight: 700,
        color: 'var(--ink)', listStyle: 'none', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', gap: 12,
      }}>
        {title}
        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>▼</span>
      </summary>
      <div style={{ padding: '0 0 16px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.65 }}>
        {children}
      </div>
    </details>
  )
}

function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
      background: 'var(--surface)',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: 'var(--good)', background: 'var(--good-soft)',
        borderRadius: 6, padding: '2px 8px', letterSpacing: '0.04em',
      }}>
        {method}
      </span>
      <code style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{path}</code>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{desc}</span>
    </div>
  )
}
