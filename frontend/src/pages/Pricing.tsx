import { CSSProperties, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import PageContainer from '../components/PageContainer'
import { useAuth } from '../context/AuthContext'
import { BillingInterval, BillingStatus, fetchBillingStatus, startCheckout } from '../api/billing'
import useDocumentTitle from '../hooks/useDocumentTitle'

interface Tier {
  name: string
  price: string
  cadence: string
  description: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  checkout?: boolean
  highlight?: boolean
  /** Fine print rendered under the CTA button. */
  ctaNote?: string
  /** Displayed instead of price/cadence when annual billing is selected. */
  priceAnnual?: string
  cadenceAnnual?: string
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$0',
    cadence: 'for 7 days',
    description: 'Try reptruly on one property — free for 7 days, no card required.',
    features: [
      '1 property',
      'Booking.com review sync',
      'Daily review refresh',
      'Reply deep-links to OTA extranets',
      'Basic analytics (per-OTA scores)',
      'Demand calendar (events + weather + holidays)',
    ],
    ctaLabel: 'Start 7-day free trial',
    ctaHref: '/login',
    ctaNote: 'No card required · upgrade to Pro anytime',
  },
  {
    name: 'Pro',
    price: '$29.99',
    cadence: 'per property / month',
    priceAnnual: '≈$24.99',
    cadenceAnnual: 'per property / month · $299.90 billed yearly',
    description: 'For independent hoteliers running 2–10 properties.',
    features: [
      'Up to 10 properties',
      'Booking + Expedia + Google review sync',
      'AI reply drafting for every review',
      'Per-OTA analytics, AI summaries & PDF reports',
      'Rate shopping + 14-night rate outlook',
      'Rate movement & demand alerts',
      'Monthly owner report emails',
      'Embeddable review badge',
      'API access & CSV export',
      'Priority email support',
    ],
    ctaLabel: 'Upgrade to Pro',
    ctaHref: '/contact',
    checkout: true,
    highlight: true,
    ctaNote: 'Billed today · cancel anytime',
  },
  {
    name: 'Group',
    price: 'From $15',
    cadence: 'per property / month',
    description: 'For chains and management companies running 10+ properties.',
    features: [
      'Everything in Pro',
      'More than 10 properties',
      'Volume pricing — the more properties, the less per property',
      'Priority onboarding for your portfolio',
      'Invoice billing available',
    ],
    ctaLabel: 'Contact sales',
    ctaHref: '/contact',
  },
]

function TierCta({ tier, interval, status }: {
  tier: Tier
  interval: BillingInterval
  status: BillingStatus | null
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'center',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'inherit',
    textDecoration: 'none',
    cursor: busy ? 'wait' : 'pointer',
    marginBottom: 24,
    transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
    ...(tier.highlight
      ? {
          background: 'var(--grad-accent)',
          color: '#fff',
          border: '1px solid transparent',
          fontWeight: 700,
          boxShadow: '0 1px 2px rgba(79,70,229,0.35), 0 8px 20px rgba(79,70,229,0.35)',
        }
      : {
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border-strong)',
          fontWeight: 600,
        }),
    opacity: busy ? 0.7 : 1,
  }

  const note = tier.ctaNote ? (
    <p style={{
      fontSize: 11, textAlign: 'center', marginTop: -16, marginBottom: 20,
      color: tier.highlight ? 'rgba(255,255,255,0.45)' : 'var(--text-faint)',
    }}>
      {tier.ctaNote}
    </p>
  ) : null

  const isPro = !!status?.has_pro

  // Plan-aware states for signed-in users.
  if (tier.name === 'Pro' && isPro) {
    return (
      <>
        <div style={{
          ...style,
          background: 'rgba(16,185,129,0.16)',
          border: '1px solid rgba(110,231,183,0.4)',
          color: '#6ee7b7',
          fontWeight: 700,
          cursor: 'default',
          boxShadow: 'none',
        }}>
          ✓ Your current plan
        </div>
        <p style={{
          fontSize: 11, textAlign: 'center', marginTop: -16, marginBottom: 20,
          color: 'rgba(255,255,255,0.45)',
        }}>
          {status?.quantity ? `${status.quantity} propert${status.quantity === 1 ? 'y' : 'ies'} billed · ` : ''}
          <Link to="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Manage billing in Settings</Link>
        </p>
      </>
    )
  }
  if (tier.name === 'Starter' && user && status) {
    if (isPro) {
      return (
        <div style={{
          ...style,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-faint)',
          cursor: 'default',
        }}>
          Covered by your Pro plan
        </div>
      )
    }
    return (
      <>
        <div style={{
          ...style,
          background: 'var(--accent-soft)',
          border: '1px solid #dcdffc',
          color: 'var(--accent)',
          fontWeight: 700,
          cursor: 'default',
        }}>
          ✓ Your current plan
        </div>
        {status.trial_days_left !== null && (
          <p style={{ fontSize: 11, textAlign: 'center', marginTop: -16, marginBottom: 20, color: 'var(--text-faint)' }}>
            {status.trial_days_left} day{status.trial_days_left === 1 ? '' : 's'} left in your trial
          </p>
        )}
      </>
    )
  }

  if (!tier.checkout) {
    return <><a href={tier.ctaHref} style={style}>{tier.ctaLabel}</a>{note}</>
  }

  async function onClick() {
    if (!user) {
      navigate('/login')
      return
    }
    setBusy(true)
    setError('')
    try {
      window.location.href = await startCheckout(interval)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setBusy(false)
    }
  }

  return (
    <>
      <button onClick={onClick} disabled={busy} style={style}>
        {busy ? 'Redirecting…' : tier.ctaLabel}
      </button>
      {note}
      {error && (
        <p style={{ color: tier.highlight ? '#fda4af' : 'var(--bad)', fontSize: 12, marginTop: -16, marginBottom: 16 }}>{error}</p>
      )}
    </>
  )
}

export default function Pricing() {
  useDocumentTitle('Pricing')
  const { user } = useAuth()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month')
  const [status, setStatus] = useState<BillingStatus | null>(null)

  // Signed-in visitors see their actual plan state on the cards.
  useEffect(() => {
    if (!user) {
      setStatus(null)
      return
    }
    let cancelled = false
    fetchBillingStatus()
      .then(s => { if (!cancelled && s) setStatus(s) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])
  return (
    <>
      <TopNav />
      <PageContainer>

      <div style={{ textAlign: 'center', marginBottom: 28, marginTop: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Simple, per-property pricing
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
          No setup fees. No per-review fees. Cancel any time. Pay annually for 2 months free.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <div className="seg">
          <button
            type="button"
            className={`seg-btn ${billingInterval === 'month' ? 'active' : ''}`}
            onClick={() => setBillingInterval('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`seg-btn ${billingInterval === 'year' ? 'active' : ''}`}
            onClick={() => setBillingInterval('year')}
          >
            Annual — 2 months free
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 40,
      }}>
        {TIERS.map(t => (
          <div
            key={t.name}
            style={t.highlight ? {
              background: [
                'radial-gradient(ellipse 80% 55% at 20% 0%, rgba(79,70,229,0.35), transparent 60%)',
                'var(--grad-dark)',
              ].join(', '),
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              padding: 28,
              position: 'relative',
              boxShadow: 'var(--shadow-md)',
            } : {
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 28,
              position: 'relative',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {t.highlight && (
              <div style={{
                position: 'absolute',
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--grad-accent)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
              }}>
                Most popular
              </div>
            )}
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.01em', color: t.highlight ? 'rgba(255,255,255,0.92)' : 'var(--ink)' }}>{t.name}</h3>
            <p style={{ color: t.highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>{t.description}</p>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: t.highlight ? '#fff' : 'var(--ink)' }}>
                {billingInterval === 'year' && t.priceAnnual ? t.priceAnnual : t.price}
              </span>
              <span style={{ color: t.highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)', fontSize: 14, marginLeft: 6 }}>
                {billingInterval === 'year' && t.cadenceAnnual ? t.cadenceAnnual : t.cadence}
              </span>
            </div>
            <TierCta tier={t} interval={billingInterval} status={status} />
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {t.features.map(f => (
                <li key={f} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: t.highlight ? 'rgba(255,255,255,0.75)' : 'var(--text)' }}>
                  <span style={{ color: t.highlight ? '#34d399' : 'var(--good)', flexShrink: 0, fontWeight: 700 }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 24,
        textAlign: 'center',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          Frequently asked
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>What counts as a "property"?</strong> One physical hotel, regardless of how many OTAs it's listed on.
          A property with Booking + Expedia + Google still counts as one.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600, margin: '12px auto 0', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>How does setup work?</strong> Sign up, add your property by pasting the Booking, Expedia, or
          Google link, and reviews start syncing instantly. We handle every integration for you — no API keys, no
          configuration, no developer time required.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600, margin: '12px auto 0', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Can I cancel anytime?</strong> Yes. Cancel from the billing portal and your plan
          runs until the end of the current billing period — no further charges after that.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600, margin: '12px auto 0', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>What happens when my trial ends?</strong> Nothing is deleted. Your synced reviews and
          analytics stay readable — syncing and gated features simply pause until you upgrade to Pro.
        </p>
      </div>
      </PageContainer>
    </>
  )
}
