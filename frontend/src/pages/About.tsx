import TopNav from '../components/TopNav'
import PageContainer from '../components/PageContainer'
import useDocumentTitle from '../hooks/useDocumentTitle'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 16 }}>{title}</h2>
      <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

export default function About() {
  useDocumentTitle('About')
  return (
    <>
      <TopNav />
      <PageContainer>

      <div style={{ marginBottom: 24, marginTop: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>
          About reptruly
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          A reputation and revenue workspace for independent hoteliers — reviews,
          rates, and demand signals from every channel in one place.
        </p>
      </div>

      <Section id="story" title="Why we're building this">
        <p style={{ marginBottom: 10 }}>
          Running a small hotel means living in four browser tabs and a spreadsheet: Booking's
          extranet for reviews, Expedia's for more reviews, Google for the ones that show up in
          search, and someone's rate-shopping notes for what the hotel across the street charges
          tonight. The tools that solve this properly are built for chains — $200 per property per
          month, annual contracts, and onboarding calls before you see a screen.
        </p>
        <p>
          reptruly is the simpler version: paste your OTA links, and reviews, comp-set rates, and
          local demand start syncing the same day. Priced per property, cancel anytime, no sales
          call required. It's early — the <a href="/resources#changelog" style={{ color: 'var(--accent)', fontWeight: 600 }}>changelog</a> shows
          exactly what ships and when.
        </p>
      </Section>

      <Section id="careers" title="Careers">
        <p>
          No open roles right now — we're keeping the team tiny while the product finds its shape.
          That said, if you live and breathe hospitality tech, OTA data, or revenue management and
          want to be first in line when that changes, <a href="/contact" style={{ color: 'var(--accent)', fontWeight: 600 }}>introduce yourself</a> —
          we read everything.
        </p>
      </Section>

      <Section id="media" title="Media & press">
        <p style={{ marginBottom: 16 }}>
          For press inquiries, partnership stories, or brand assets:
        </p>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <strong style={{ color: 'var(--ink)' }}>Press contact:</strong> hello@reptruly.com<br />
          <strong style={{ color: 'var(--ink)' }}>Brand assets:</strong> logo + color palette download — <a href="/contact" style={{ color: 'var(--accent)', fontWeight: 600 }}>request access</a>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Recent coverage is added here as it happens. No coverage yet — we're focused on building.
        </p>
      </Section>

      <Section id="partners" title="Integrations & data sources">
        <p style={{ marginBottom: 12 }}>
          reptruly is built on the data sources hoteliers actually use:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { name: 'Booking.com', via: 'Reviews & rates via RapidAPI' },
            { name: 'Expedia / Hotels.com', via: 'Reviews via Hotels.com Provider' },
            { name: 'Google', via: 'Reviews via Places API (New)' },
            { name: 'Ticketmaster', via: 'Events for the demand calendar' },
            { name: 'Open-Meteo', via: 'Weather forecast' },
            { name: 'OpenAI', via: 'Summaries, reply drafts, event impact' },
          ].map(p => (
            <div key={p.name} style={{
              padding: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-sm)',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', fontSize: 14 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{p.via}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="security" title="Security">
        <p style={{ marginBottom: 12 }}>
          We hold OTA API keys on your behalf and run review pulls on your account. What we actually do:
        </p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: 'var(--text-muted)' }}>
          <li>Provider API keys live in environment variables — never in source control or logs.</li>
          <li>Every review, rate, and analytics query is scoped to the account that connected the property — no cross-tenant access.</li>
          <li>Passwords hashed with Argon2; server-side sessions you can revoke from Settings ("Sign out everywhere").</li>
          <li>HTTPS-only in production with HSTS preload.</li>
          <li>Payments are handled entirely by Stripe — card details never touch our servers.</li>
          <li>No formal certifications yet (we're early) — ask us anything specific and we'll answer plainly.</li>
        </ul>
      </Section>
      </PageContainer>
    </>
  )
}
