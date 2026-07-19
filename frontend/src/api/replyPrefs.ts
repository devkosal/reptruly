export interface ReplyPrefs {
  tone: string
  language: string
  signature: string
  auto_suggest: boolean
}

export async function fetchReplyPrefs(): Promise<ReplyPrefs | null> {
  const res = await fetch('/api/auth/reply-prefs', { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

export async function updateReplyPrefs(
  prefs: Partial<ReplyPrefs>,
): Promise<ReplyPrefs | null> {
  const res = await fetch('/api/auth/reply-prefs', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  })
  if (!res.ok) return null
  return res.json()
}
