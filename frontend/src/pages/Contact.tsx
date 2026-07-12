import { FormEvent, useState } from 'react'
import TopNav from '../components/TopNav'
import PageContainer from '../components/PageContainer'
import useDocumentTitle from '../hooks/useDocumentTitle'

export default function Contact() {
  useDocumentTitle('Contact')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('Sales')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Front-end-only stub. A real implementation would POST to an inbox endpoint.
    setSubmitted(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 10,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 6,
  }

  const mailLink: React.CSSProperties = {
    color: 'var(--accent)',
    fontWeight: 600,
    textDecoration: 'none',
  }

  return (
    <>
      <TopNav />
      <PageContainer>

      <div style={{ marginBottom: 24, marginTop: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>
          Get in touch
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Sales, support, partnerships, careers — same form, different routing.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, boxShadow: 'var(--shadow-sm)' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', marginBottom: 8 }}>Thanks — we'll be in touch</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                We typically reply within one business day. If your question is urgent, email{' '}
                <a href="mailto:hello@reptruly.com" style={mailLink}>hello@reptruly.com</a> directly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Your name</label>
                  <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Topic</label>
                <select style={inputStyle} value={topic} onChange={e => setTopic(e.target.value)}>
                  <option>Sales</option>
                  <option>Support</option>
                  <option>Partnership</option>
                  <option>Press</option>
                  <option>Careers</option>
                  <option>Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Message</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                Send message
              </button>
            </form>
          )}
        </div>

        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="section-title" style={{ marginBottom: 12 }}>Direct contacts</h3>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.9 }}>
              <li><strong style={{ color: 'var(--text)' }}>Sales:</strong> <a href="mailto:sales@reptruly.com" style={mailLink}>sales@reptruly.com</a></li>
              <li><strong style={{ color: 'var(--text)' }}>Support:</strong> <a href="mailto:hello@reptruly.com" style={mailLink}>hello@reptruly.com</a></li>
              <li><strong style={{ color: 'var(--text)' }}>Press:</strong> <a href="mailto:press@reptruly.com" style={mailLink}>press@reptruly.com</a></li>
              <li><strong style={{ color: 'var(--text)' }}>Partnerships:</strong> <a href="mailto:partners@reptruly.com" style={mailLink}>partners@reptruly.com</a></li>
            </ul>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="section-title" style={{ marginBottom: 12 }}>Office hours</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              Monday–Friday, 9am–6pm GMT. Weekends and holidays are slower but we still read everything.
            </p>
          </div>
        </div>
      </div>
      </PageContainer>
    </>
  )
}
