import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useDocumentTitle from '../hooks/useDocumentTitle'

type Mode = 'login' | 'signup'

export default function Login() {
  useDocumentTitle('Sign in')
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await signup({ username, email, password, name: name || undefined })
      }
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Login failed' : 'Signup failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">rep<span>truly</span></div>
        <h1 className="login-headline">Reviews. Rates. Demand.<br />One workspace.</h1>
        <p className="login-sub">
          Aggregate reviews across Booking.com, Expedia, and Google.
          Track your rate vs. nearby competitors. See local events, holidays, and weather
          driving demand 12 months ahead. All in one place — refreshed every day.
        </p>
        <div className="app-preview">
          <div className="preview-bar">
            <span className="preview-dot red" />
            <span className="preview-dot yellow" />
            <span className="preview-dot green" />
            <span className="preview-url">reptruly.com/dashboard</span>
          </div>
          <div className="preview-body">
            <div className="preview-sidebar">
              <div className="preview-logo">rep<span>truly</span></div>
              <div className="preview-nav-item active-nav">⭐ Reviews</div>
              <div className="preview-nav-item">💰 Rates</div>
              <div className="preview-nav-item">📅 Demand</div>
              <div className="preview-nav-item">📊 Analytics</div>
            </div>
            <div className="preview-content">
              <div className="preview-stats">
                <div className="preview-stat">
                  <div className="preview-stat-val">247</div>
                  <div className="preview-stat-lbl">Reviews this mo.</div>
                </div>
                <div className="preview-stat">
                  <div className="preview-stat-val">8.4</div>
                  <div className="preview-stat-lbl">Avg score</div>
                </div>
                <div className="preview-stat">
                  <div className="preview-stat-val">$129</div>
                  <div className="preview-stat-lbl">Tonight's rate</div>
                </div>
                <div className="preview-stat">
                  <div className="preview-stat-val">3</div>
                  <div className="preview-stat-lbl">Events nearby</div>
                </div>
              </div>
              <div className="preview-table">
                <div className="preview-thead">
                  <span>Score</span><span>OTA</span><span>Review</span><span>Status</span>
                </div>
                {[
                  { score: '9.2', ota: 'Google', text: 'Amazing stay, highly recommend!', replied: true },
                  { score: '7.5', ota: 'Booking', text: 'Good location, some noise issues.', replied: false },
                  { score: '5.0', ota: 'Expedia', text: 'Room was smaller than expected...', replied: false },
                  { score: '9.8', ota: 'Google', text: 'Will return next year!', replied: true },
                  { score: '8.1', ota: 'Booking', text: 'Clean and comfortable, great value.', replied: true },
                ].map((r, i) => (
                  <div className="preview-row" key={i}>
                    <span className={`preview-score ${parseFloat(r.score) >= 8 ? 'ph' : parseFloat(r.score) >= 6 ? 'pm' : 'pl'}`}>{r.score}</span>
                    <span className={`preview-ota ota-${r.ota.toLowerCase()}`}>{r.ota}</span>
                    <span className="preview-text">{r.text}</span>
                    <span className={r.replied ? 'preview-replied' : 'preview-pending'}>
                      {r.replied ? '✓ Replied' : '· Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="login-social-proof">
          <div className="login-proof-item">
            <span className="login-proof-val">3</span>
            <span className="login-proof-lbl">OTA channels synced</span>
          </div>
          <div className="login-proof-item">
            <span className="login-proof-val">Daily</span>
            <span className="login-proof-lbl">Automatic refresh</span>
          </div>
          <div className="login-proof-item">
            <span className="login-proof-val">12 mo</span>
            <span className="login-proof-lbl">Demand outlook</span>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-box">
          <h2>{mode === 'login' ? 'Sign in to reptruly' : 'Create your reptruly account'}</h2>
          <p className="login-form-sub">
            {mode === 'login'
              ? 'Enter your credentials to access the portal'
              : 'Sign up and connect your first property in seconds'}
          </p>
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoFocus
              />
            </label>
            {mode === 'signup' && (
              <>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label>
                  Full name (optional)
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </label>
              </>
            )}
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={mode === 'signup' ? 8 : undefined}
                required
              />
            </label>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>
          <p className="login-hint">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <a
                  href="#signup"
                  onClick={e => { e.preventDefault(); setError(''); setMode('signup') }}
                >
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <a
                  href="#login"
                  onClick={e => { e.preventDefault(); setError(''); setMode('login') }}
                >
                  Sign in
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
