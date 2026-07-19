export interface PlanLimits {
  max_properties: number
  allowed_otas: string[]
  ai_enabled: boolean
  rate_shopping: boolean
}

export interface BillingStatus {
  has_pro: boolean
  plan: string
  price: number | null
  /** Billed units — one per connected property. */
  quantity: number
  currency: string
  interval: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trialing: boolean
  trial_end: string | null
  /** Days left in the 7-day Starter trial (null once subscribed or expired). */
  trial_days_left: number | null
  limits: PlanLimits
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return data?.detail || fallback
  } catch {
    return fallback
  }
}

export async function fetchBillingStatus(): Promise<BillingStatus | null> {
  const res = await fetch('/api/billing/status', { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(await parseError(res, `Failed to load billing status (${res.status})`))
  return res.json()
}

export type BillingInterval = 'month' | 'year'

/** Create a Stripe Checkout session and return its URL to redirect to. */
export async function startCheckout(interval: BillingInterval = 'month'): Promise<string> {
  const res = await fetch(`/api/billing/checkout?interval=${interval}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res, `Checkout failed (${res.status})`))
  const data = await res.json()
  return data.url
}

/** Sync the subscription after Stripe redirects back with a session_id. */
export async function confirmCheckout(sessionId: string): Promise<BillingStatus> {
  const res = await fetch('/api/billing/confirm', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })
  if (!res.ok) throw new Error(await parseError(res, `Failed to confirm checkout (${res.status})`))
  return res.json()
}

/** Create a Stripe customer portal session and return its URL. */
export async function openBillingPortal(): Promise<string> {
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res, `Failed to open billing portal (${res.status})`))
  const data = await res.json()
  return data.url
}

export function formatPrice(status: BillingStatus): string {
  if (status.price == null) return ''
  const currency = status.currency?.toUpperCase() || 'USD'
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: 'currency', currency })
  const qty = status.quantity || 1
  const total = fmt(status.price * qty)
  const suffix = status.interval ? ` / ${status.interval}` : ''
  if (qty > 1) {
    return `${total}${suffix} (${fmt(status.price)} × ${qty} properties)`
  }
  return `${total}${suffix}`
}
