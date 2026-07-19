import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  SyncDomain, SyncStatusRow, fetchAllSyncStatus, formatRelative, triggerSync,
} from '../api/sync'
import {
  BillingStatus, confirmCheckout, fetchBillingStatus, formatPrice,
  openBillingPortal, startCheckout,
} from '../api/billing'
import {
  fetchNotificationSettings, updateNotificationSettings,
} from '../api/notifications'
import { fetchReplyPrefs, updateReplyPrefs } from '../api/replyPrefs'
import ThemedPage from '../components/ThemedPage'
import { useAuth } from '../context/AuthContext'
import { useProperty } from '../context/PropertyContext'

interface SettingsState {
  notifications: {
    email_override: string
    new_reviews: boolean
    negative_alerts: boolean
    daily_digest: boolean
    weekly_summary: boolean
    monthly_report: boolean
    rate_changes: boolean
    sync_failures: boolean
    marketing: boolean
  }
  reply: {
    tone: 'professional' | 'warm' | 'concise' | 'playful'
    language: string
    auto_suggest: boolean
    signature: string
  }
}

const DEFAULT_SETTINGS: SettingsState = {
  notifications: {
    email_override: '',
    new_reviews: true,
    negative_alerts: true,
    daily_digest: false,
    weekly_summary: true,
    monthly_report: true,
    rate_changes: true,
    sync_failures: true,
    marketing: false,
  },
  reply: {
    tone: 'warm',
    language: 'en',
    auto_suggest: true,
    signature: '',
  },
}

const STORAGE_KEY = 'reptruly_settings'

// Anchor nav — ordered by how often each section is actually visited.
const SECTION_LINKS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'ai-replies', label: 'AI replies' },
  { id: 'sync', label: 'Sync' },
  { id: 'billing', label: 'Billing' },
  { id: 'badge', label: 'Badge' },
  { id: 'api-keys', label: 'API keys' },
  { id: 'security', label: 'Security' },
  { id: 'data', label: 'Data & privacy' },
]

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' }, { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' }, { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' }, { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' }, { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' }, { code: 'hi', label: 'Hindi' },
  { code: 'th', label: 'Thai' }, { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
]

const TONE_SAMPLES: Record<SettingsState['reply']['tone'], string> = {
  professional: 'Dear guest, thank you for taking the time to share your feedback. We deeply value your stay and your insights help us continually refine our service.',
  warm: 'Hi Sarah! Thank you so much for the lovely review — we\'re thrilled you enjoyed your stay and we\'d love to welcome you back any time. 💛',
  concise: 'Thanks for the kind words — we\'re glad you enjoyed your stay and hope to see you again soon.',
  playful: 'Sarah! 🌟 Reading this made our whole front desk smile. Come back anytime — we\'ll have the good room waiting.',
}

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
      reply: { ...DEFAULT_SETTINGS.reply, ...(parsed.reply || {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: SettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// ---------- Reusable bits ----------

function Section({ title, description, children }: {
  title: string; description?: string; children: ReactNode
}) {
  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: description ? 4 : 0 }}>{title}</div>
        {description && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange, badge }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
  badge?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
          {badge && (
            <span
              className={badge === 'Pro' ? 'chip chip-accent' : 'chip chip-good'}
              style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px' }}
            >{badge}</span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 44, height: 24, borderRadius: 999,
          background: checked ? 'var(--accent)' : 'var(--border-strong)',
          border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
          padding: 0, transition: 'background 0.18s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(16,24,40,0.25)',
          transition: 'left 0.18s',
        }} />
      </button>
    </div>
  )
}

function SelectRow({ label, description, value, onChange, options }: {
  label: string; description?: string; value: string; onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{description}</div>
        )}
      </div>
      <select
        className="filter-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 220, fontSize: 13, cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%235b6472' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          paddingRight: 32,
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ChipGroup<T extends string>({ value, options, onChange }: {
  value: T; options: Array<{ value: T; label: string; emoji?: string }>; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.02em', fontFamily: 'inherit',
              border: active ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
              background: active ? 'var(--accent)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Main page ----------

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<SettingsState>(loadSettings)
  const [savedFlash, setSavedFlash] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notifLoaded, setNotifLoaded] = useState(false)
  const [replyLoaded, setReplyLoaded] = useState(false)

  // Auto-save on any change, with a tiny "Saved" flash.
  useEffect(() => {
    saveSettings(settings)
    setSavedFlash(true)
    const t = setTimeout(() => setSavedFlash(false), 1100)
    return () => clearTimeout(t)
  }, [settings])

  // Notification prefs live server-side (they drive real emails) — load them
  // on mount, then persist changes back. Other sections stay local-only.
  useEffect(() => {
    fetchNotificationSettings()
      .then(data => {
        if (data) setSettings(s => ({ ...s, notifications: { ...s.notifications, ...data } }))
      })
      .catch(() => {})
      .finally(() => setNotifLoaded(true))
  }, [])

  useEffect(() => {
    if (!notifLoaded) return
    const t = setTimeout(() => {
      updateNotificationSettings(settings.notifications).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [settings.notifications, notifLoaded])

  // Reply Studio prefs also live server-side (they drive pre-generated AI
  // drafts during syncs) — same load-then-persist pattern as notifications.
  // localStorage stays as a fallback for Reviews.tsx.
  useEffect(() => {
    fetchReplyPrefs()
      .then(data => {
        if (data) {
          setSettings(s => ({
            ...s,
            reply: {
              ...s.reply,
              tone: (data.tone as SettingsState['reply']['tone']) || s.reply.tone,
              language: data.language || s.reply.language,
              signature: data.signature,
              auto_suggest: data.auto_suggest,
            },
          }))
        }
      })
      .catch(() => {})
      .finally(() => setReplyLoaded(true))
  }, [])

  useEffect(() => {
    if (!replyLoaded) return
    const t = setTimeout(() => {
      const { tone, language, signature, auto_suggest } = settings.reply
      updateReplyPrefs({ tone, language, signature, auto_suggest }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [settings.reply, replyLoaded])

  // Scrollspy for the sticky section nav.
  const [activeSection, setActiveSection] = useState(SECTION_LINKS[0].id)
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      // Consider a section "active" while its top is in the upper part of the viewport.
      { rootMargin: '-120px 0px -55% 0px' },
    )
    SECTION_LINKS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  function patch<K extends keyof SettingsState>(section: K, partial: Partial<SettingsState[K]>) {
    setSettings(s => ({ ...s, [section]: { ...s[section], ...partial } }))
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ user, settings }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reptruly-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ThemedPage
      eyebrow="Settings"
      title="Account & workspace"
      subtitle="Tune your alerts, reply assistant, syncs, and account."
    >
      {/* Save flash */}
      <div style={{
        position: 'fixed', top: 24, right: 24,
        background: 'var(--good)', color: '#fff', padding: '8px 14px', borderRadius: 999,
        fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
        boxShadow: '0 6px 16px rgba(5,150,105,0.3)',
        opacity: savedFlash ? 1 : 0,
        transform: savedFlash ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.2s, transform 0.2s',
        pointerEvents: 'none', zIndex: 100,
      }}>
        ✓ Saved
      </div>

      {/* Sticky section nav — anchors with scrollspy highlight */}
      <div style={{
        position: 'sticky', top: 66, zIndex: 50,
        background: 'var(--bg)', padding: '6px 0 10px', marginBottom: 8,
        display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 820,
      }}>
        {SECTION_LINKS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(s.id)}
            className={activeSection === s.id ? 'chip chip-accent' : 'chip'}
            style={{ cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>

        {/* Notifications */}
        <div id="notifications" style={{ scrollMarginTop: 130 }}>
        <Section
          title="Notifications"
          description="Choose what we ping you about. You can change these anytime."
        >
          <NotificationEmail
            accountEmail={user?.email || ''}
            override={settings.notifications.email_override}
            onChange={v => patch('notifications', { email_override: v })}
          />
          <ToggleRow
            label="New reviews"
            description="Email me when a new review lands across any channel."
            checked={settings.notifications.new_reviews}
            onChange={v => patch('notifications', { new_reviews: v })}
          />
          <ToggleRow
            label="Urgent: negative reviews"
            description="Instant alert for 1- and 2-star reviews so you can respond fast."
            checked={settings.notifications.negative_alerts}
            onChange={v => patch('notifications', { negative_alerts: v })}
            badge="Recommended"
          />
          <ToggleRow
            label="Daily digest"
            description="One email at 9am with overnight reviews + key metrics."
            checked={settings.notifications.daily_digest}
            onChange={v => patch('notifications', { daily_digest: v })}
          />
          <ToggleRow
            label="Weekly summary"
            description="Monday morning recap of last week's performance."
            checked={settings.notifications.weekly_summary}
            onChange={v => patch('notifications', { weekly_summary: v })}
          />
          <ToggleRow
            label="Monthly owner report"
            description="On the 1st: last month's numbers per property, with a link to the printable report."
            checked={settings.notifications.monthly_report}
            onChange={v => patch('notifications', { monthly_report: v })}
          />
          <ToggleRow
            label="Rate movement alerts"
            description="Notify when a competitor changes their rate by more than 10%."
            checked={settings.notifications.rate_changes}
            onChange={v => patch('notifications', { rate_changes: v })}
          />
          <ToggleRow
            label="Sync failures"
            description="Tell me when an OTA sync fails so I can re-authorize."
            checked={settings.notifications.sync_failures}
            onChange={v => patch('notifications', { sync_failures: v })}
          />
          <ToggleRow
            label="Product updates & tips"
            description="Occasional emails about new features and best practices."
            checked={settings.notifications.marketing}
            onChange={v => patch('notifications', { marketing: v })}
          />
        </Section>
        </div>

        {/* Review Reply Assistant */}
        <div id="ai-replies" style={{ scrollMarginTop: 130 }}>
        <Section
          title="AI Reply Assistant"
          description="How we draft and suggest replies to guest reviews."
        >
          <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Reply tone
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Sets the personality of suggested replies.
            </div>
            <ChipGroup
              value={settings.reply.tone}
              onChange={(t) => patch('reply', { tone: t })}
              options={[
                { value: 'professional', label: 'Professional' },
                { value: 'warm', label: 'Warm' },
                { value: 'concise', label: 'Concise' },
                { value: 'playful', label: 'Playful' },
              ]}
            />
            <div style={{
              marginTop: 14, padding: '14px 16px', borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55,
              fontStyle: 'italic',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--accent)', marginBottom: 6, fontStyle: 'normal',
              }}>Preview</div>
              "{TONE_SAMPLES[settings.reply.tone]}"
            </div>
          </div>

          <SelectRow
            label="Default reply language"
            description="If a review's language isn't detected, we'll reply in this one."
            value={settings.reply.language}
            onChange={v => patch('reply', { language: v })}
            options={LANGUAGES.map(l => ({ value: l.code, label: l.label }))}
          />

          <ToggleRow
            label="Suggest replies automatically"
            description="Pre-draft a response on every new review — you still approve it."
            checked={settings.reply.auto_suggest}
            onChange={v => patch('reply', { auto_suggest: v })}
          />

          <div style={{ padding: '14px 0 4px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Reply signature
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Appended to the bottom of every reply.
            </div>
            <textarea
              value={settings.reply.signature}
              onChange={e => patch('reply', { signature: e.target.value })}
              placeholder="— The team at [Hotel Name]"
              rows={2}
              className="filter-input"
              style={{ width: '100%', fontSize: 13, resize: 'vertical' }}
            />
          </div>
        </Section>
        </div>

        {/* Manual sync */}
        <div id="sync" style={{ scrollMarginTop: 130 }}>
          <ManualSyncSection />
        </div>

        <div id="billing" style={{ scrollMarginTop: 130 }}>
          <BillingSection />
        </div>

        <div id="badge" style={{ scrollMarginTop: 130 }}>
          <BadgeSection />
        </div>

        <div id="api-keys" style={{ scrollMarginTop: 130 }}>
          <ApiKeysSection />
        </div>

        {/* Security */}
        <div id="security" style={{ scrollMarginTop: 130 }}>
          <SecuritySection />
        </div>

        {/* Data & privacy */}
        <div id="data" style={{ scrollMarginTop: 130 }}>
        <Section
          title="Data & privacy"
          description="Your data is yours. Export it or delete it anytime."
        >
          <ActionRow
            label="Export your data"
            description="Download a JSON snapshot of your profile and settings."
            buttonLabel="Download"
            onClick={exportData}
          />
          <ActionRow
            label="Reset preferences"
            description="Restore all settings on this page to their defaults."
            buttonLabel="Reset"
            onClick={() => {
              if (confirm('Restore default settings? Your profile data is unaffected.')) {
                setSettings(DEFAULT_SETTINGS)
              }
            }}
          />
          <div style={{ padding: '14px 0' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--bad)', marginBottom: 10,
            }}>Danger zone</div>
            <div style={{
              border: '1px solid #f6c9d3', borderRadius: 10, padding: 16, background: 'var(--bad-soft)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--bad)' }}>Delete account</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Permanently remove your account, properties, and review history. This cannot be undone.
                </div>
              </div>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmDelete(true)}
                  style={{ flexShrink: 0, background: 'var(--surface)' }}
                >
                  Delete account
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => alert('Account deletion requires support — coming soon.')}
                    style={{ background: 'var(--bad)', color: '#fff' }}
                  >
                    Confirm delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </Section>
        </div>
      </div>
    </ThemedPage>
  )
}

interface ApiKeyRow {
  prefix: string
  label: string
  created_at: string | null
  expires_at: string | null
  revoked: boolean
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null)
  const [label, setLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/keys', { credentials: 'include' })
      if (res.ok) setKeys(await res.json())
    } catch { /* section stays in loading state; retry on next visit */ }
  }, [])

  useEffect(() => { load() }, [load])

  async function createKey() {
    if (!label.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.message || `Failed (${res.status})`)
      }
      const data = await res.json()
      setNewKey(data.key)
      setLabel('')
      await load()
    } catch (e: any) {
      setError(e.message || 'Could not create key')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(prefix: string) {
    if (!confirm(`Revoke API key ${prefix}…? Requests using it will stop working immediately.`)) return
    setError('')
    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(prefix)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      await load()
    } catch (e: any) {
      setError(e.message || 'Could not revoke key')
    }
  }

  const active = (keys || []).filter(k => !k.revoked)

  return (
    <Section
      title="API keys"
      description="Programmatic read access to your properties, reviews, and analytics. Send the key in an X-API-Key header."
    >
      {newKey && (
        <div style={{
          background: 'var(--good-soft)', border: '1px solid #c4ebda', borderRadius: 10,
          padding: '12px 14px', marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--good)', marginBottom: 6 }}>
            Key created — copy it now, it won't be shown again
          </div>
          <code style={{
            display: 'block', fontSize: 12, padding: '8px 10px', borderRadius: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            wordBreak: 'break-all', userSelect: 'all',
          }}>
            {newKey}
          </code>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => { navigator.clipboard?.writeText(newKey).catch(() => {}); setNewKey('') }}
          >
            Copy & dismiss
          </button>
        </div>
      )}

      {active.length > 0 ? (
        active.map(k => (
          <div key={k.prefix} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{k.label || 'Unnamed key'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {k.prefix}…{k.created_at ? ` · created ${new Date(k.created_at).toLocaleDateString()}` : ''}
              </div>
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => revoke(k.prefix)}>
              Revoke
            </button>
          </div>
        ))
      ) : keys !== null ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
          No API keys yet.
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input
          className="filter-input"
          placeholder="Key label (e.g. Reporting script)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={createKey}
          disabled={busy || !label.trim()}
        >
          {busy ? 'Creating…' : 'Create key'}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 8 }}>{error}</div>}
    </Section>
  )
}


function BadgeSection() {
  const { properties } = useProperty()
  const [propId, setPropId] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [copied, setCopied] = useState(false)
  // The badge is cached for an hour; bust it once per page visit so the
  // preview always reflects the latest sync.
  const previewBuster = useMemo(() => Date.now(), [])

  const selected = properties.find(p => p.id === propId) || properties[0]
  if (!selected) {
    return (
      <Section
        title="Website badge"
        description="Show your live review score on your own website."
      >
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Connect a property first — then you'll get an embeddable badge here.
        </p>
      </Section>
    )
  }

  const origin = window.location.origin
  const badgeUrl = `${origin}/api/badge/${selected.id}/badge.svg?theme=${theme}`
  const previewUrl = `${badgeUrl}&_=${previewBuster}`
  const embedCode =
    `<a href="https://reptruly.com" target="_blank" rel="noopener">\n` +
    `  <img src="${badgeUrl}" alt="${selected.property_name} guest review score" width="320" height="76" />\n` +
    `</a>`

  async function copy() {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable — user can select the code manually */
    }
  }

  return (
    <Section
      title="Website badge"
      description="A live review-score badge for your own website — updates automatically as reviews come in."
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {properties.length > 1 && (
          <select
            className="filter-select"
            value={selected.id}
            onChange={e => setPropId(e.target.value)}
            style={{ fontSize: 13 }}
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
        )}
        <div className="seg">
          <button
            type="button"
            className={`seg-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={`seg-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>

      <div style={{
        padding: 20, borderRadius: 12, marginBottom: 14,
        background: theme === 'dark' ? 'var(--ink)' : 'var(--surface-2)',
        border: '1px solid var(--border)', display: 'flex', justifyContent: 'center',
      }}>
        <img
          key={previewUrl}
          src={previewUrl}
          alt={`${selected.property_name} review badge preview`}
          width={320}
          height={76}
        />
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        Paste this into your website
      </div>
      <textarea
        readOnly
        value={embedCode}
        onFocus={e => e.currentTarget.select()}
        style={{
          width: '100%', minHeight: 76, resize: 'vertical',
          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5,
          border: '1px solid var(--border-strong)', borderRadius: 10, padding: 10,
          color: 'var(--text)', background: 'var(--surface-2)', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          {copied ? '✓ Copied' : 'Copy embed code'}
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
          Works anywhere an image tag works — Wix, Squarespace, WordPress, plain HTML.
        </span>
      </div>
    </Section>
  )
}


function BillingSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const fromCheckout = params.get('billing') === 'success' && !!sessionId

    async function init() {
      try {
        if (fromCheckout) {
          const s = await confirmCheckout(sessionId!)
          setStatus(s)
          if (s.has_pro) setNotice('🎉 Welcome to Pro — your subscription is active.')
          window.history.replaceState({}, '', '/settings')
        } else {
          setStatus(await fetchBillingStatus())
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load billing status')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function upgrade() {
    setBusy(true)
    setError('')
    try {
      window.location.href = await startCheckout()
    } catch (e: any) {
      setError(e.message || 'Checkout failed')
      setBusy(false)
    }
  }

  async function manage() {
    setBusy(true)
    setError('')
    try {
      window.location.href = await openBillingPortal()
    } catch (e: any) {
      setError(e.message || 'Failed to open billing portal')
      setBusy(false)
    }
  }

  const hasPro = !!status?.has_pro

  return (
    <Section
      title="Billing & plan"
      description="Your subscription, payment method, and invoices."
    >
      {notice && (
        <div style={{
          background: 'var(--good-soft)', border: '1px solid #c4ebda', color: 'var(--good)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14,
        }}>
          {notice}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
              {loading ? 'Loading plan…' : `${status?.plan ?? 'Starter'} plan`}
            </span>
            <span
              className={
                hasPro
                  ? 'chip chip-accent'
                  : status?.plan === 'Trial ended'
                    ? 'chip chip-warn'
                    : 'chip'
              }
              style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px' }}
            >
              {loading
                ? '…'
                : status?.trialing
                  ? 'Trial'
                  : hasPro
                    ? 'Active'
                    : status?.plan === 'Trial ended'
                      ? 'Trial ended'
                      : 'Free trial'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
            {loading
              ? ' '
              : hasPro
                ? [
                    status ? formatPrice(status) : '',
                    status?.trialing && status.trial_end
                      ? `trial ends ${new Date(status.trial_end).toLocaleDateString()}${status.cancel_at_period_end ? ', then cancels' : ', then billing starts'}`
                      : status?.current_period_end
                        ? `${status.cancel_at_period_end ? 'ends' : 'renews'} ${new Date(status.current_period_end).toLocaleDateString()}`
                        : '',
                  ].filter(Boolean).join(' · ')
                : status?.plan === 'Trial ended'
                  ? 'Your 7-day free trial has ended. Upgrade to Pro to keep syncing reviews and unlock all features.'
                  : `Free trial — ${status?.trial_days_left ?? 7} day${(status?.trial_days_left ?? 7) !== 1 ? 's' : ''} left. 1 property, Booking.com sync, daily refresh.`}
          </div>
        </div>
        <button
          type="button"
          className={hasPro ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
          onClick={hasPro ? manage : upgrade}
          disabled={busy || loading}
          style={{ flexShrink: 0, cursor: busy ? 'wait' : undefined }}
        >
          {busy ? 'Redirecting…' : hasPro ? 'Manage billing' : 'Upgrade to Pro'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 8 }}>{error}</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
        Payments are processed by Stripe. Cancel anytime from the billing portal.
      </div>
    </Section>
  )
}

function ManualSyncSection() {
  const [rows, setRows] = useState<SyncStatusRow[] | null>(null)
  const [busy, setBusy] = useState<Record<SyncDomain, boolean>>({
    reviews: false, rates: false, calendar: false, analytics: false,
  })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await fetchAllSyncStatus())
    } catch (e: any) {
      setError(e.message || 'Failed to load sync status')
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll while anything is running.
  const anyRunning = rows?.some(r => r.status === 'running')
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [anyRunning, load])

  async function runOne(domain: SyncDomain) {
    setBusy(b => ({ ...b, [domain]: true }))
    setError('')
    try {
      await triggerSync(domain)
      await load()
    } catch (e: any) {
      setError(e.message || `Failed to start ${domain} sync`)
    } finally {
      setBusy(b => ({ ...b, [domain]: false }))
    }
  }

  async function runAll() {
    setError('')
    // Only reviews + rates have real scheduled syncs; calendar/analytics
    // compute on demand.
    const domains: SyncDomain[] = ['reviews', 'rates']
    setBusy({ reviews: true, rates: true, calendar: false, analytics: false })
    try {
      await Promise.all(domains.map(d => triggerSync(d)))
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to start syncs')
    } finally {
      setBusy({ reviews: false, rates: false, calendar: false, analytics: false })
    }
  }

  const byDomain: Record<SyncDomain, SyncStatusRow | undefined> = useMemo(() => {
    const map: Partial<Record<SyncDomain, SyncStatusRow>> = {}
    for (const r of rows || []) map[r.domain] = r
    return map as Record<SyncDomain, SyncStatusRow | undefined>
  }, [rows])

  const domains: Array<{ key: SyncDomain; label: string; onDemand?: boolean }> = [
    { key: 'reviews',   label: 'Reviews' },
    { key: 'rates',     label: 'Rates' },
    { key: 'calendar',  label: 'Calendar',  onDemand: true },
    { key: 'analytics', label: 'Analytics', onDemand: true },
  ]

  return (
    <Section
      title="Manual sync"
      description="Reviews and rates sync once a day at 03:00 UTC. Calendar and analytics compute on demand with a 24-hour cache."
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Trigger an individual refresh, or fire both syncs at once.
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={runAll}
          disabled={!!anyRunning || Object.values(busy).some(Boolean)}
        >
          Sync all
        </button>
      </div>

      {domains.filter(d => !d.onDemand).map(d => {
        const row = byDomain[d.key]
        const running = row?.status === 'running' || busy[d.key]
        const failed = row?.status === 'failed'
        const dotColor = failed ? 'var(--bad)' : running ? 'var(--warn)' : row?.last_synced_at ? 'var(--good)' : 'var(--border-strong)'
        return (
          <div key={d.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 16,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {d.label}
                {row?.last_record_count !== undefined && row.last_record_count > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                    {row.last_record_count} record{row.last_record_count === 1 ? '' : 's'} last run
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {failed
                    ? 'Last run failed'
                    : running
                      ? 'Syncing now…'
                      : row?.last_synced_at
                        ? `Updated ${formatRelative(row.last_synced_at)}`
                        : 'Never synced'}
                </span>
              </div>
              {failed && row?.last_error && (
                <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 3 }}>
                  {row.last_error.slice(0, 160)}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => runOne(d.key)}
              disabled={running}
              style={{ flexShrink: 0, cursor: running ? 'wait' : undefined }}
            >
              {running ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        )
      })}
      {domains.filter(d => d.onDemand).map(d => (
        <div key={d.key} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 16,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{d.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Computed on demand · cached 24h
              </span>
            </div>
          </div>
          <span className="chip" style={{ flexShrink: 0, fontSize: 11 }}>
            Refresh from its page
          </span>
        </div>
      ))}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 8 }}>{error}</div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
        Tip: real-time and sub-daily intervals are on the roadmap.
      </div>
    </Section>
  )
}

function NotificationEmail({ accountEmail, override, onChange }: {
  accountEmail: string; override: string; onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(!!override)
  const [draft, setDraft] = useState(override)
  const [error, setError] = useState('')
  const effective = override.trim() || accountEmail

  function save() {
    const v = draft.trim()
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError('That doesn\'t look like a valid email.')
      return
    }
    setError('')
    onChange(v)
    setEditing(!!v)
  }

  function clearOverride() {
    setDraft('')
    onChange('')
    setEditing(false)
    setError('')
  }

  return (
    <div style={{
      padding: 14, marginBottom: 10, borderRadius: 10,
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: editing ? 10 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-faint)', marginBottom: 2,
          }}>
            Alerts will be sent to
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {effective || 'No email on file'}
          </div>
          {override && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
              Override of your account email ({accountEmail}).
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setEditing(e => !e); setDraft(override || accountEmail); setError('') }}
          style={{ flexShrink: 0 }}
        >
          {editing ? 'Cancel' : override ? 'Edit' : 'Change'}
        </button>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email"
            className="filter-input"
            value={draft}
            onChange={e => { setDraft(e.target.value); setError('') }}
            placeholder="alerts@yourhotel.com"
            style={{
              flex: 1, minWidth: 220, fontSize: 13,
              borderColor: error ? 'var(--bad)' : undefined,
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            style={{ flexShrink: 0 }}
          >
            Save
          </button>
          {override && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={clearOverride}
              style={{ flexShrink: 0 }}
            >
              Use account email
            </button>
          )}
          {error && (
            <div style={{ width: '100%', fontSize: 11, color: 'var(--bad)', marginTop: 2 }}>
              {error}
            </div>
          )}
        </div>
      )}
      {!editing && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Want alerts to go to a shared inbox (e.g. <code style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 4 }}>alerts@hotel.com</code>)? Use "Change" above.
        </div>
      )}
    </div>
  )
}

function ActionRow({ label, description, buttonLabel, onClick, danger }: {
  label: string; description?: string; buttonLabel: string; onClick: () => void; danger?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{description}</div>
        )}
      </div>
      <button
        type="button"
        className={danger ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm'}
        onClick={onClick}
        style={{ flexShrink: 0 }}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function SecuritySection() {
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [signOutMsg, setSignOutMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/sessions', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data) setSessionCount(data.active_sessions) })
      .catch(() => {})
  }, [])

  function closePasswordForm() {
    setPwOpen(false)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setPwError('')
  }

  async function submitPassword() {
    setPwError('')
    if (!currentPw || !newPw) { setPwError('All fields are required'); return }
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    setPwSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      if (res.ok) {
        closePasswordForm()
        setPwSuccess(true)
        setTimeout(() => setPwSuccess(false), 4000)
      } else {
        const body = await res.json().catch(() => null)
        setPwError(body?.detail || 'Could not update password')
      }
    } catch {
      setPwError('Network error — try again')
    } finally {
      setPwSaving(false)
    }
  }

  async function signOutEverywhere() {
    if (!confirm('Sign out of all other devices?')) return
    try {
      const res = await fetch('/api/auth/logout-everywhere', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setSignOutMsg(`✓ Signed out ${data.revoked} other device${data.revoked === 1 ? '' : 's'}`)
        setSessionCount(1)
      }
    } catch { /* network hiccup — leave the row as-is */ }
  }

  const inputStyle = { width: '100%', marginBottom: 8 }

  return (
    <Section title="Security" description="Keep your account safe.">
      {/* Change password */}
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Change password</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {pwSuccess ? '✓ Password updated' : 'Use at least 8 characters.'}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ flexShrink: 0 }}
            onClick={() => (pwOpen ? closePasswordForm() : setPwOpen(true))}
          >
            {pwOpen ? 'Cancel' : 'Update'}
          </button>
        </div>
        {pwOpen && (
          <form
            onSubmit={e => { e.preventDefault(); submitPassword() }}
            style={{ marginTop: 12, maxWidth: 360 }}
          >
            <input
              type="password"
              className="filter-input"
              style={inputStyle}
              placeholder="Current password"
              autoComplete="current-password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
            />
            <input
              type="password"
              className="filter-input"
              style={inputStyle}
              placeholder="New password (min 8 characters)"
              autoComplete="new-password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
            />
            <input
              type="password"
              className="filter-input"
              style={inputStyle}
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
            />
            {pwError && (
              <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 8 }}>{pwError}</div>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={pwSaving}>
              {pwSaving ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>

      {/* Active sessions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 0', borderBottom: '1px solid var(--border)', gap: 16,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Active sessions</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {sessionCount === null
              ? 'Checking…'
              : `${sessionCount} active session${sessionCount === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* Sign out everywhere */}
      <ActionRow
        label="Sign out everywhere"
        description={signOutMsg || 'Revoke every other active session and force re-login on those devices.'}
        buttonLabel="Sign out all"
        danger
        onClick={signOutEverywhere}
      />
    </Section>
  )
}
