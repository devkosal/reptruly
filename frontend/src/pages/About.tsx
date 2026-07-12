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
          The team behind reptruly
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          We're building the modern reputation OS for independent hoteliers — pulling reviews,
          rates, and demand signals from every channel into one workspace.
        </p>
      </div>

      <Section id="story" title="Our story">
        <p>
          reptruly started in 2026 after one of our founders watched her family's three-property
          hotel group try to keep up with reviews across Booking.com, Expedia, Google, and TripAdvisor
          using four different browser tabs and a spreadsheet. The big SaaS competitors charged $200/month
          per property and required a 12-month commitment. We thought it could be simpler and cheaper,
          built around a hotelier's actual workflow.
        </p>
      </Section>

      <Section id="careers" title="Careers">
        <p style={{ marginBottom: 12 }}>
          We're a small team and hire carefully. If you've worked in hospitality tech, OTA APIs,
          or revenue management, we'd love to hear from you.
        </p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {[
            { title: 'Senior Backend Engineer', loc: 'Remote · Full-time', desc: 'Django + Celery + PostgreSQL. Lead the data pipeline.' },
            { title: 'Product Designer', loc: 'Remote · Full-time', desc: 'Take our brutalist dashboard from "works great" to "feels great".' },
            { title: 'Hospitality Partnerships Lead', loc: 'Hybrid (London) · Full-time', desc: 'Build relationships with PMS, channel manager, and OTA partners.' },
          ].map(j => (
            <li key={j.title} style={{
              padding: 16,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-sm)',
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}>
              <div>
                <div style={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{j.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{j.loc}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{j.desc}</div>
              </div>
              <a href="/contact" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                Apply →
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="media" title="Media & press">
        <p style={{ marginBottom: 16 }}>
          For press inquiries, partnership stories, or brand assets:
        </p>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <strong style={{ color: 'var(--ink)' }}>Press contact:</strong> press@reptruly.com<br />
          <strong style={{ color: 'var(--ink)' }}>Brand assets:</strong> logo + color palette download — <a href="/contact" style={{ color: 'var(--accent)', fontWeight: 600 }}>request access</a>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Recent coverage is added here as it happens. No coverage yet — we're focused on building.
        </p>
      </Section>

      <Section id="partners" title="Partners">
        <p style={{ marginBottom: 12 }}>
          reptruly integrates with the data sources hoteliers actually use:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { name: 'Booking.com', via: 'via RapidAPI' },
            { name: 'Expedia / Hotels.com', via: 'via Hotels.com Provider' },
            { name: 'Google', via: 'via Places API (New)' },
            { name: 'Ticketmaster', via: 'Demand calendar' },
            { name: 'Open-Meteo', via: 'Weather forecast' },
            { name: 'OpenAI', via: 'Review summaries' },
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
          We hold OTA API keys on your behalf and run review pulls on your account. Some commitments:
        </p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: 'var(--text-muted)' }}>
          <li>API keys stored in environment variables, never in source control or logs.</li>
          <li>All review data scoped to the user who connected the property — no cross-tenant leaks.</li>
          <li>Sessions use Django's signed cookies; passwords hashed with Argon2.</li>
          <li>HTTPS-only in production; CSP and same-origin policies enforced.</li>
          <li>SOC 2 Type II audit is on the roadmap for 2026 — talk to us if it's a procurement requirement.</li>
        </ul>
      </Section>
      </PageContainer>
    </>
  )
}
