# reptruly design system

The visual language for the whole frontend. Every page (marketing and app) must use these
tokens — no ad-hoc pinks/pastels. Tokens are defined as CSS variables in
`frontend/src/styles.css` under `:root`; prefer `var(--x)` in inline styles.

## Direction

Premium, modern SaaS ("Linear / Stripe" feel): calm neutral surfaces, one confident
indigo→violet accent, deep-ink dark surfaces, hairline borders, soft layered shadows,
tight typography. No pastel-pink gradients, no emoji-heavy chrome, no hard black
"cartoon" borders/drop shadows.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0b1220` | Darkest surfaces (sidebar, hero), headline text on light |
| `--ink-2` | `#101a30` | Raised dark surfaces / gradients with --ink |
| `--text` | `#111827` | Body text on light |
| `--text-muted` | `#5b6472` | Secondary text |
| `--text-faint` | `#8a93a3` | Tertiary text, labels |
| `--bg` | `#f6f7fb` | App background |
| `--surface` | `#ffffff` | Cards |
| `--surface-2` | `#f3f5fa` | Table heads, subtle wells, hover fills |
| `--border` | `#e6e9f2` | Hairline borders |
| `--border-strong` | `#d5dae6` | Input borders, emphasized dividers |
| `--accent` | `#4f46e5` | Primary actions, links, active states (indigo-600) |
| `--accent-strong` | `#4338ca` | Hover on primary |
| `--violet` | `#7c3aed` | Gradient partner for accent |
| `--accent-soft` | `#eef0fe` | Accent tint fills (active nav, selected chips) |
| `--cyan` | `#0891b2` | Secondary data accent (charts, links on dark) — sparing |
| `--good` | `#059669` | Positive (emerald-600); tint `#e7f6f0` |
| `--warn` | `#d97706` | Caution (amber-600); tint `#fdf3e3` |
| `--bad` | `#e11d48` | Negative (rose-600); tint `#fdecef` |

Gradients:
- Primary CTA / brand: `linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)`
- Dark hero/sidebar: `linear-gradient(180deg, #0b1220 0%, #101a30 100%)` with an optional
  subtle radial glow `radial-gradient(ellipse at top left, rgba(79,70,229,0.25), transparent 55%)`.

On dark surfaces: text `rgba(255,255,255,0.92)`, muted `rgba(255,255,255,0.55)`,
faint `rgba(255,255,255,0.35)`, hairlines `rgba(255,255,255,0.08)`.

## Typography

- Font: `Inter` (loaded in styles.css via @import), fallback to system stack.
- Headings: weight 700–800, letter-spacing `-0.02em`, solid `--ink` color.
  No gradient text except at most ONE brand word in the marketing hero.
- Eyebrow labels: 11px, weight 700, uppercase, letter-spacing `0.1em`, color `--accent`.
- Body 14px / muted 13px. Numbers in stats: 28–32px, weight 750, `--ink`,
  `font-variant-numeric: tabular-nums`.

## Shape & elevation

- Radius: 10px (inputs, buttons), 14px (cards), 18px (hero panels/modals).
- Cards: `background: var(--surface); border: 1px solid var(--border);
  box-shadow: var(--shadow-sm)`. Never a shadow without a border.
- `--shadow-sm: 0 1px 2px rgba(16,24,40,0.04), 0 1px 6px rgba(16,24,40,0.04)`
- `--shadow-md: 0 2px 4px rgba(16,24,40,0.05), 0 12px 28px rgba(16,24,40,0.08)`
- `--shadow-lg: 0 24px 60px rgba(11,18,32,0.35)` (dark hero mockups only)

## Components (classes already in styles.css — use them)

- `.card`, `.stat-card` (+`.stat-label`, `.stat-value`, `.stat-sub`)
- `.btn .btn-primary|btn-secondary|btn-ghost|btn-danger`, `.btn-sm`
- `.filter-select`, `.filter-input`, `.filters`
- `.table-wrapper` + plain `<table>`
- `.score-badge` + `.score-high|mid|low`, `.ota-badge ota-*`
- `.chip` (neutral pill), `.chip-accent`, `.chip-good`, `.chip-warn`, `.chip-bad`
- `.section-title` (13px uppercase card section headings)
- `.empty-state`, `.loading`, `.error-msg`, `.modal-overlay`, `.modal`
- `.seg` + `.seg-btn` (+`.active`) — segmented control for tab-like switches

## Rules for page work

1. Replace every pink/pastel/purple-tint (`#fbcfe8`, `#f3e8ff`, `#fdf2f8`, `#a855f7`,
   `#ec4899`, `#db2777`, `#6c63ff`, `#fff7fb`…) with tokens above.
2. Prefer the shared classes over bespoke inline styles; where inline styles remain,
   use `var(--…)` tokens.
3. Organize pages: one clear header row (title + primary action, right-aligned), then
   stat summary row (if any), then filters, then content. Group related controls in
   cards with `.section-title` headings. Consistent 16/24px spacing rhythm.
4. Status/semantic colors only via `--good/--warn/--bad` and their tints.
5. Keep ALL existing behavior, props, API calls, routes, and data logic unchanged —
   this is a visual/organizational pass only.

## Responsive

The app shell collapses at **900px**: the fixed sidebar becomes a slide-in drawer
(`.sidebar.open` + `.sidebar-overlay`), a fixed `.mobile-topbar` (hamburger + logo)
appears, and `.main` drops its left margin. The marketing `TopNav` collapses at
**800px** into a hamburger with a stacked link panel. Use the `.table-scroll`
utility (`overflow-x: auto`) around any wide table or grid so it scrolls
horizontally on phones instead of breaking the page; fixed inline grid templates
get a className + `!important` media override in `styles.css` (e.g.
`.onboarding-grid`, `.form-grid-2`, `.home-footer-grid`, `.headline-stats`).
