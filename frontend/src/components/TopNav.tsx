import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  label: string
  href?: string
  external?: boolean
  description?: string
}

interface NavMenu {
  label: string
  href?: string
  items?: NavItem[]
}

const MENUS: NavMenu[] = [
  {
    label: 'Products',
    items: [
      { label: 'Review Inbox', href: '/reviews', description: 'Read and respond to every guest review in one place' },
      { label: 'Rate Shopping', href: '/rates', description: 'Track your nightly rate vs. nearby competitors' },
      { label: 'Demand Calendar', href: '/calendar', description: 'Events, holidays and weather driving local demand' },
      { label: 'Analytics', href: '/analytics', description: 'Per-OTA scores, trends, AI summaries' },
    ],
  },
  {
    label: 'Pricing',
    href: '/pricing',
  },
  {
    label: 'Resources',
    items: [
      { label: 'Blog', href: '/resources#blog', description: 'Hospitality reputation insights' },
      { label: 'Guides', href: '/resources#guides', description: 'How to respond to negative reviews, etc.' },
      { label: 'Case studies', href: '/resources#cases', description: 'Hoteliers using reptruly' },
      { label: 'Changelog', href: '/resources#changelog', description: 'What we shipped recently' },
    ],
  },
  {
    label: 'Company',
    items: [
      { label: 'About us', href: '/about', description: 'Our story and mission' },
      { label: 'Careers', href: '/about#careers', description: 'Join the team' },
      { label: 'Media', href: '/about#media', description: 'Press & brand assets' },
      { label: 'Partners', href: '/about#partners', description: 'Integration partners' },
      { label: 'Security', href: '/about#security', description: 'How we protect your data' },
    ],
  },
  {
    label: 'Help',
    href: '/help',
  },
  {
    label: 'Contact',
    href: '/contact',
  },
]

export default function TopNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSubItemClick(href: string) {
    setOpenMenu(null)
    if (href.includes('#')) {
      const [path, anchor] = href.split('#')
      if (path) navigate(path)
      // Scroll after route change has rendered.
      setTimeout(() => {
        const el = document.getElementById(anchor)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    } else {
      navigate(href)
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 12,
        zIndex: 100,
        margin: '12px 12px 16px',
      }}
    >
    <div style={{
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginRight: 24 }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          rep<span style={{
            background: 'var(--grad-accent)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>truly</span>
        </span>
      </Link>

      <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
        {MENUS.map(menu => {
          const isOpen = openMenu === menu.label
          const hasItems = !!menu.items?.length
          return (
            <div
              key={menu.label}
              style={{ position: 'relative' }}
              onMouseEnter={() => hasItems && setOpenMenu(menu.label)}
              onMouseLeave={() => hasItems && setOpenMenu(null)}
            >
              {hasItems ? (
                <button
                  type="button"
                  onClick={() => setOpenMenu(isOpen ? null : menu.label)}
                  style={{
                    background: isOpen ? 'var(--surface-2)' : 'transparent',
                    border: 'none',
                    color: isOpen ? 'var(--ink)' : 'var(--text-muted)',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {menu.label}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                </button>
              ) : (
                <Link
                  to={menu.href!}
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    fontWeight: 600,
                    padding: '8px 14px',
                    textDecoration: 'none',
                    borderRadius: 8,
                    display: 'inline-block',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {menu.label}
                </Link>
              )}

              {hasItems && isOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    paddingTop: 6,
                    minWidth: 300,
                  }}
                >
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      boxShadow: 'var(--shadow-md)',
                      padding: 8,
                    }}
                  >
                    {menu.items!.map(item => (
                      <button
                        key={item.label}
                        onClick={() => handleSubItemClick(item.href!)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'block',
                          fontFamily: 'inherit',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--accent-soft)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.005em' }}>{item.label}</div>
                        {item.description && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.45, fontWeight: 500 }}>{item.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {user ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>
              Hi, <strong style={{ color: 'var(--ink)' }}>{user.name || user.username}</strong>
            </span>
            <Link
              to="/dashboard"
              style={{
                background: 'var(--grad-accent)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(79,70,229,0.35)',
              }}
            >
              Go to Dashboard
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                padding: '8px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid var(--border-strong)',
              }}
            >
              Sign in
            </Link>
            <Link
              to="/contact"
              style={{
                background: 'var(--grad-accent)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(79,70,229,0.35)',
              }}
            >
              Book a demo
            </Link>
          </>
        )}
      </div>
    </div>
    </div>
  )
}
