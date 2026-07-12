export interface NotificationSettings {
  email_override: string
  new_reviews: boolean
  negative_alerts: boolean
  daily_digest: boolean
  weekly_summary: boolean
  rate_changes: boolean
  sync_failures: boolean
  marketing: boolean
}

export async function fetchNotificationSettings(): Promise<NotificationSettings | null> {
  const res = await fetch('/api/auth/notifications', { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>,
): Promise<NotificationSettings | null> {
  const res = await fetch('/api/auth/notifications', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) return null
  return res.json()
}
