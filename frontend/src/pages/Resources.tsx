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

      <Section id="blog" title="Blog" sub="Hospitality reputation insights, written by the team">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <Card tag="2026-04-22" title="Why Expedia reviews skew lower than Booking" sub="Different traveler segments respond differently — and what to do about it." />
          <Card tag="2026-04-08" title="Indy 500 weekend: what hotels are charging" sub="Pulled rate data from 20 properties around the Speedway over a 7-day window." />
          <Card tag="2026-03-19" title="The 5-review Google cap (and how to live with it)" sub="Google's Place Details API only returns 5 reviews. Here's the workflow that still works." />
        </div>
      </Section>

      <Section id="guides" title="Guides" sub="Practical playbooks">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <Card tag="Guide" title="How to respond to a 1-star review" sub="A four-step template, and three real examples we'd never use." />
          <Card tag="Guide" title="Setting up rate alerts during local events" sub="Wire the demand calendar to your inbox so you never miss a pricing window." />
          <Card tag="Guide" title="OTA reply etiquette across Booking, Expedia, Google" sub="Response styles vary by channel. Here's what works on each." />
        </div>
      </Section>

      <Section id="cases" title="Case studies" sub="How real hoteliers use reptruly">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <Card tag="Case study" title="Garnet Inn Group: 3 properties, one inbox" sub="How a Florida-NC family operation cut review-response time from 3 days to 4 hours." />
          <Card tag="Case study" title="Trident Inn: turning Booking from 6.0 to 7.4 in nine months" sub="Reply rate, sentiment categorization, and what the AI summaries surfaced." />
        </div>
      </Section>

      <Section id="changelog" title="Changelog" sub="What we shipped recently">
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {[
            { date: '2026-05-02', items: ['Added top navigation bar with Products/Pricing/Resources/Company menus', 'Built Pricing, Resources, About, Help, Contact pages'] },
            { date: '2026-04-26', items: ['Per-OTA analytics tabs (All / Booking / Expedia / Google)', 'Reply button auto-labels by OTA', 'Property edit modal + remove links', 'Google reviews via Places API (New)'] },
            { date: '2026-04-25', items: ['Demand calendar with month-by-month lazy loading + impact-weighted demand score (OpenAI-classified)', 'Expedia integration via Hotels.com Provider'] },
            { date: '2026-04-24', items: ['Rates page with comp-set comparison + 24h cached daily refresh', 'Multi-select dropdown filters'] },
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
