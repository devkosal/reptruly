import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  SyncDomain, SyncStatusRow, fetchAllSyncStatus, formatRelative, triggerSync,
} from '../api/sync'
import ThemedPage from '../components/ThemedPage'
import { useAuth } from '../context/AuthContext'

interface SettingsState {
  notifications: {
    email_override: string
    new_reviews: boolean
    negative_alerts: boolean
    daily_digest: boolean
    weekly_summary: boolean
    rate_changes: boolean
    sync_failures: boolean
    marketing: boolean
  }
  reply: {
    tone: 'professional' | 'warm' | 'concise' | 'playful'
    language: string
    auto_suggest: boolean
    auto_send_5_star: boolean
    signature: string
  }
  workspace: {
    currency: string
    timezone: string
    date_format: '24h' | '12h'
    sync_frequency: 'realtime' | 'hourly' | '6h' | 'daily'
    compact_density: boolean
  }
  security: {
    two_factor: boolean
  }
}

const DEFAULT_SETTINGS: SettingsState = {
  notifications: {
    email_override: '',
    new_reviews: true,
    negative_alerts: true,
    daily_digest: false,
    weekly_summary: true,
    rate_changes: true,
    sync_failures: true,
    marketing: false,
  },
  reply: {
    tone: 'warm',
    language: 'en',
    auto_suggest: true,
    auto_send_5_star: false,
    signature: '',
  },
  workspace: {
    currency: 'USD',
    timezone: 'America/New_York',
    date_format: '12h',
    sync_frequency: 'daily',
    compact_density: false,
  },
  security: {
    two_factor: false,
  },
}

const STORAGE_KEY = 'reptruly_settings'

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
]

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'America/Honolulu', 'America/Toronto',
  'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Istanbul',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok',
  'Asia/Singapore', 'Asia/Jakarta', 'Asia/Hong_Kong', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Manila',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Pacific/Auckland',
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
    const merged: SettingsState = {
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
      reply: { ...DEFAULT_SETTINGS.reply, ...(parsed.reply || {}) },
      workspace: { ...DEFAULT_SETTINGS.workspace, ...(parsed.workspace || {}) },
      security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
    }
    // Old default of 'hourly' didn't reflect reality — backend syncs daily.
    // Snap legacy values to 'daily' on read.
    if (merged.workspace.sync_frequency === 'hourly') {
      merged.workspace.sync_frequency = 'daily'
    }
    return merged
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: SettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// ---------- Reusable bits ----------

function Section({ title, icon, description, children }: {
  title: string; icon: string; description?: string; children: ReactNode
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f3e8ff', borderRadius: 16, padding: 22,
      boxShadow: '0 1px 3px rgba(168,85,247,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, background: '#faf5ff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
        }}>{icon}</span>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.01em' }}>
            {title}
          </h3>
          {description && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{description}</p>
          )}
        </div>
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
      padding: '12px 0', borderBottom: '1px solid #f5f3ff', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{label}</span>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 999, background: '#fef3c7', color: '#92400e',
            }}>{badge}</span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        style={{
          width: 44, height: 24, borderRadius: 999,
          background: checked ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : '#e5e7eb',
          border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
          padding: 0, transition: 'background 0.18s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
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
      padding: '12px 0', borderBottom: '1px solid #f5f3ff', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{description}</div>
        )}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 220, padding: '8px 32px 8px 12px', fontSize: 13, borderRadius: 8,
          border: '1px solid #e9d5ff', background: '#fff', color: '#1a1a2e',
          outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%237c3aed' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
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
              cursor: 'pointer', letterSpacing: '0.02em',
              border: active ? '1px solid transparent' : '1px solid #e9d5ff',
              background: active
                ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                : '#fff',
              color: active ? '#fff' : '#6b21a8',
              boxShadow: active ? '0 4px 10px rgba(168,85,247,0.3)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {o.emoji && <span style={{ marginRight: 5 }}>{o.emoji}</span>}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Main page ----------

export default function Settings() {
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState<SettingsState>(loadSettings)
  const [savedFlash, setSavedFlash] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Auto-save on any change, with a tiny "Saved" flash.
  useEffect(() => {
    saveSettings(settings)
    setSavedFlash(true)
    const t = setTimeout(() => setSavedFlash(false), 1100)
    return () => clearTimeout(t)
  }, [settings])

  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' }
  }, [])

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
      eyebrow="⚙️ Settings"
      title="Settings"
      subtitle="Tune your workspace, alerts, and reply assistant."
    >
      {/* Save flash */}
      <div style={{
        position: 'fixed', top: 24, right: 24,
        background: '#10b981', color: '#fff', padding: '8px 14px', borderRadius: 999,
        fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
        boxShadow: '0 6px 16px rgba(16,185,129,0.3)',
        opacity: savedFlash ? 1 : 0,
        transform: savedFlash ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.2s, transform 0.2s',
        pointerEvents: 'none', zIndex: 100,
      }}>
        ✓ Saved
      </div>

      <div style={{ display: 'grid', gap: 18, maxWidth: 820 }}>

        {/* Notifications */}
        <Section
          title="Notifications"
          icon="🔔"
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

        {/* Review Reply Assistant */}
        <Section
          title="AI Reply Assistant"
          icon="✨"
          description="How we draft and suggest replies to guest reviews."
        >
          <div style={{ padding: '12px 0', borderBottom: '1px solid #f5f3ff' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>
              Reply tone
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              Sets the personality of suggested replies.
            </div>
            <ChipGroup
              value={settings.reply.tone}
              onChange={(t) => patch('reply', { tone: t })}
              options={[
                { value: 'professional', label: 'Professional', emoji: '🤝' },
                { value: 'warm', label: 'Warm', emoji: '💛' },
                { value: 'concise', label: 'Concise', emoji: '⚡' },
                { value: 'playful', label: 'Playful', emoji: '✨' },
              ]}
            />
            <div style={{
              marginTop: 14, padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 100%)',
              border: '1px solid #f3e8ff', fontSize: 13, color: '#4c1d95', lineHeight: 1.55,
              fontStyle: 'italic',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#7c3aed', marginBottom: 6, fontStyle: 'normal',
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

          <ToggleRow
            label="Auto-send for 5★ reviews"
            description="Send a thank-you automatically when a review is 5 stars. Off by default."
            checked={settings.reply.auto_send_5_star}
            onChange={v => patch('reply', { auto_send_5_star: v })}
            badge="Pro"
          />

          <div style={{ padding: '14px 0 4px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 6 }}>
              Reply signature
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Appended to the bottom of every reply.
            </div>
            <textarea
              value={settings.reply.signature}
              onChange={e => patch('reply', { signature: e.target.value })}
              placeholder="— The team at [Hotel Name]"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8,
                border: '1px solid #e9d5ff', background: '#fff', color: '#1a1a2e',
                outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
        </Section>

        {/* Workspace */}
        <Section
          title="Workspace"
          icon="🌐"
          description="Region, currency, and how data refreshes."
        >
          <SelectRow
            label="Currency"
            description="Used for rates, revenue, and competitor comparisons."
            value={settings.workspace.currency}
            onChange={v => patch('workspace', { currency: v })}
            options={CURRENCIES.map(c => ({ value: c.code, label: c.label }))}
          />
          <SelectRow
            label="Timezone"
            description={browserTz ? `Detected from your browser: ${browserTz}` : 'Used for digests and alert timing.'}
            value={settings.workspace.timezone}
            onChange={v => patch('workspace', { timezone: v })}
            options={TIMEZONES.map(t => ({ value: t, label: t.replace('_', ' ') }))}
          />
          <SelectRow
            label="Time format"
            value={settings.workspace.date_format}
            onChange={v => patch('workspace', { date_format: v as '12h' | '24h' })}
            options={[
              { value: '12h', label: '12-hour (3:30 PM)' },
              { value: '24h', label: '24-hour (15:30)' },
            ]}
          />
          <SelectRow
            label="Sync frequency"
            description="Reviews, rates, calendar, and analytics all refresh once a day at 03:00 UTC. Faster intervals are on the roadmap."
            value={settings.workspace.sync_frequency}
            onChange={v => patch('workspace', { sync_frequency: v as SettingsState['workspace']['sync_frequency'] })}
            options={[
              { value: 'daily', label: 'Once a day (current)' },
              { value: '6h', label: 'Every 6 hours (coming soon)' },
              { value: 'hourly', label: 'Every hour (coming soon)' },
              { value: 'realtime', label: 'Real-time (Pro · coming soon)' },
            ]}
          />
          <ToggleRow
            label="Compact density"
            description="Tighter spacing in tables and lists. Good for big screens."
            checked={settings.workspace.compact_density}
            onChange={v => patch('workspace', { compact_density: v })}
          />
        </Section>

        {/* Manual sync */}
        <ManualSyncSection />

        {/* Security */}
        <Section
          title="Security"
          icon="🔒"
          description="Keep your account safe."
        >
          <ToggleRow
            label="Two-factor authentication"
            description="Require a one-time code from an authenticator app at sign-in."
            checked={settings.security.two_factor}
            onChange={v => patch('security', { two_factor: v })}
            badge="Recommended"
          />
          <ActionRow
            label="Change password"
            description="Last changed: a while ago."
            buttonLabel="Update"
            onClick={() => alert('Password change flow coming soon.')}
          />
          <ActionRow
            label="Active sessions"
            description="See devices currently signed in to your account."
            buttonLabel="Manage"
            onClick={() => alert('Session manager coming soon.')}
          />
          <ActionRow
            label="Sign out everywhere"
            description="Revoke every active session and force re-login on all devices."
            buttonLabel="Sign out all"
            danger
            onClick={() => { if (confirm('Sign out of all devices?')) logout() }}
          />
        </Section>

        {/* Data & privacy */}
        <Section
          title="Data & privacy"
          icon="🛡️"
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
          <div style={{
            padding: '14px 0', borderTop: '1px solid #fecaca', marginTop: 8,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#b91c1c', marginBottom: 10,
            }}>Danger zone</div>
            <div style={{
              border: '1px solid #fecaca', borderRadius: 12, padding: 16, background: '#fef2f2',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Delete account</div>
                <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 3 }}>
                  Permanently remove your account, properties, and review history. This cannot be undone.
                </div>
              </div>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5',
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Delete account
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb',
                      padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Account deletion requires support — coming soon.')}
                    style={{
                      background: '#dc2626', color: '#fff', border: 'none',
                      padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Confirm delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>
    </ThemedPage>
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
    const domains: SyncDomain[] = ['reviews', 'rates', 'calendar', 'analytics']
    setBusy({ reviews: true, rates: true, calendar: true, analytics: true })
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

  const domains: Array<{ key: SyncDomain; label: string; icon: string }> = [
    { key: 'reviews',   label: 'Reviews',   icon: '⭐' },
    { key: 'rates',     label: 'Rates',     icon: '💰' },
    { key: 'calendar',  label: 'Calendar',  icon: '📅' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
  ]

  return (
    <Section
      title="Manual sync"
      icon="🔄"
      description="Force a refresh now. All four normally sync once a day at 03:00 UTC."
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Trigger an individual refresh, or fire all four at once.
        </div>
        <button
          type="button"
          onClick={runAll}
          disabled={!!anyRunning || Object.values(busy).some(Boolean)}
          style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
            color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(168,85,247,0.3)',
            opacity: (anyRunning || Object.values(busy).some(Boolean)) ? 0.6 : 1,
          }}
        >
          Sync all
        </button>
      </div>

      {domains.map(d => {
        const row = byDomain[d.key]
        const running = row?.status === 'running' || busy[d.key]
        const failed = row?.status === 'failed'
        const dotColor = failed ? '#ef4444' : running ? '#f59e0b' : row?.last_synced_at ? '#10b981' : '#cbd5e1'
        return (
          <div key={d.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0', borderBottom: '1px solid #f5f3ff', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 9, background: '#faf5ff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}>{d.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                  {d.label}
                  {row?.last_record_count !== undefined && row.last_record_count > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#6b21a8', fontWeight: 600 }}>
                      {row.last_record_count} record{row.last_record_count === 1 ? '' : 's'} last run
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
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
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3 }}>
                    {row.last_error.slice(0, 160)}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => runOne(d.key)}
              disabled={running}
              style={{
                background: running ? '#f3f4f6' : '#fff',
                color: running ? '#9ca3af' : '#7c3aed',
                border: running ? '1px solid #e5e7eb' : '1px solid #e9d5ff',
                padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                cursor: running ? 'wait' : 'pointer', flexShrink: 0,
              }}
            >
              {running ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        )
      })}
      {error && (
        <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{error}</div>
      )}
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
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
      padding: 14, marginBottom: 10, borderRadius: 12,
      background: 'linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 100%)',
      border: '1px solid #f3e8ff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: editing ? 10 : 0 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, background: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0, boxShadow: '0 1px 3px rgba(168,85,247,0.15)',
        }}>📧</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#7c3aed', marginBottom: 2,
          }}>
            Alerts will be sent to
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#1a1a2e',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {effective || 'No email on file'}
          </div>
          {override && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: 600 }}>
              Override of your account email ({accountEmail}).
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setEditing(e => !e); setDraft(override || accountEmail); setError('') }}
          style={{
            background: '#fff', color: '#7c3aed', border: '1px solid #e9d5ff',
            padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            cursor: 'pointer', flexShrink: 0, letterSpacing: '0.03em',
          }}
        >
          {editing ? 'Cancel' : override ? 'Edit' : 'Change'}
        </button>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={draft}
            onChange={e => { setDraft(e.target.value); setError('') }}
            placeholder="alerts@yourhotel.com"
            style={{
              flex: 1, minWidth: 220, padding: '9px 12px', fontSize: 13, borderRadius: 8,
              border: `1px solid ${error ? '#fca5a5' : '#e9d5ff'}`, background: '#fff',
              color: '#1a1a2e', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={save}
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Save
          </button>
          {override && (
            <button
              type="button"
              onClick={clearOverride}
              style={{
                background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb',
                padding: '9px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Use account email
            </button>
          )}
          {error && (
            <div style={{ width: '100%', fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
              {error}
            </div>
          )}
        </div>
      )}
      {!editing && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
          Want alerts to go to a shared inbox (e.g. <code style={{ background: '#fff', padding: '1px 4px', borderRadius: 4 }}>alerts@hotel.com</code>)? Use "Change" above.
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
      padding: '12px 0', borderBottom: '1px solid #f5f3ff', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onClick}
        style={{
          background: danger ? '#fff' : 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          color: danger ? '#b91c1c' : '#fff',
          border: danger ? '1px solid #fca5a5' : 'none',
          padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.02em', flexShrink: 0,
          boxShadow: danger ? 'none' : '0 3px 10px rgba(168,85,247,0.3)',
        }}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
