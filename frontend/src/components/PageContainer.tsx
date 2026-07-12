/**
 * Centered, max-width page wrapper for the constrained marketing pages
 * (Pricing, About, Resources, Help, Contact). Use inside MarketingLayout.
 */
export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 48px' }}>
      {children}
    </div>
  )
}
