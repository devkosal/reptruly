/**
 * Wrapper for the public-facing pages. No sidebar, no max-width.
 * Each page controls its own width — typically full-bleed background sections
 * with a constrained inner content area.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {children}
    </div>
  )
}
