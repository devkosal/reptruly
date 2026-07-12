import { ReactNode } from 'react'
import useDocumentTitle from '../hooks/useDocumentTitle'

interface ThemedPageProps {
  eyebrow?: string
  title: string
  subtitle?: string
  /** Optional right-aligned header content (primary action, filters). */
  actions?: ReactNode
  children: ReactNode
}

export default function ThemedPage({ eyebrow, title, subtitle, actions, children }: ThemedPageProps) {
  useDocumentTitle(eyebrow || title)
  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 28,
        paddingBottom: 20,
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          {eyebrow && (
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--accent)', marginBottom: 6,
            }}>
              {eyebrow}
            </div>
          )}
          <h1 style={{
            fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 14 }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}
