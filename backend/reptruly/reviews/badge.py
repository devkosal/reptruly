"""Embeddable review-score badge (SVG).

Public by design: the property UUID is unguessable, the numbers are already
public on the OTAs, and every embed carries "powered by reptruly" — the badge
is the growth loop. Served as a self-contained SVG so it works in any site
builder with a plain <img> tag.
"""
from xml.sax.saxutils import escape

from django.core.cache import cache

from reptruly.reviews.models import Property, Review

BADGE_CACHE_TTL = 3600  # stats behind the badge refresh hourly

_THEMES = {
    "dark": {
        "bg": "#0b1220",
        "border": "rgba(255,255,255,0.14)",
        "text": "#ffffff",
        "muted": "rgba(255,255,255,0.55)",
        "brand": "#a5b4fc",
    },
    "light": {
        "bg": "#ffffff",
        "border": "#d5dae6",
        "text": "#0b1220",
        "muted": "#5b6472",
        "brand": "#4f46e5",
    },
}

_SCORE_COLORS = {"good": "#34d399", "mid": "#fbbf24", "bad": "#fb7185"}


def badge_stats(prop: Property) -> dict:
    """Average score / review count / channel list, cached for an hour."""
    key = f"badge-stats:{prop.id}"
    cached = cache.get(key)
    if cached:
        return cached
    ids = [
        pid
        for pid in (prop.booking_hotel_id, prop.expedia_property_id, prop.google_place_id)
        if pid
    ]
    reviews = Review.objects.filter(property_id__in=ids) if ids else Review.objects.none()
    scores = [s for s in reviews.values_list("overall_score", flat=True) if s is not None]
    otas = sorted({o for o in reviews.values_list("ota_name", flat=True) if o})
    stats = {
        "avg": round(sum(scores) / len(scores), 1) if scores else None,
        "count": len(scores),
        "otas": otas,
    }
    cache.set(key, stats, BADGE_CACHE_TTL)
    return stats


def render_badge_svg(prop: Property, theme: str = "light") -> str:
    colors = _THEMES.get(theme, _THEMES["light"])
    stats = badge_stats(prop)
    avg = stats["avg"]
    score_text = f"{avg}" if avg is not None else "–"
    score_color = (
        _SCORE_COLORS["good"] if avg and avg >= 8
        else _SCORE_COLORS["mid"] if avg and avg >= 6
        else _SCORE_COLORS["bad"] if avg
        else colors["muted"]
    )
    count_line = (
        f"{stats['count']:,} reviews" if stats["count"] else "Guest reviews"
    )
    otas_line = " · ".join(o.replace(".com", "") for o in stats["otas"][:3]) or "Verified stays"
    name = escape(prop.property_name[:30])

    detail_line = f"{count_line} · {otas_line}"

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="320" height="76" role="img" aria-label="{name}: rated {score_text} out of 10">
  <rect x="0.5" y="0.5" width="319" height="75" rx="12" fill="{colors['bg']}" stroke="{colors['border']}"/>
  <text x="20" y="47" font-family="-apple-system,Segoe UI,sans-serif" font-size="26" font-weight="800" fill="{score_color}">{score_text}<tspan font-size="12" font-weight="600" fill="{colors['muted']}">/10</tspan></text>
  <text x="98" y="30" font-family="-apple-system,Segoe UI,sans-serif" font-size="11.5" font-weight="700" fill="{colors['text']}">{name}</text>
  <text x="98" y="47" font-family="-apple-system,Segoe UI,sans-serif" font-size="9.5" fill="{colors['muted']}">{escape(detail_line)}</text>
  <text x="304" y="64" font-family="-apple-system,Segoe UI,sans-serif" font-size="9" fill="{colors['muted']}" text-anchor="end">powered by <tspan font-weight="700" fill="{colors['brand']}">reptruly</tspan></text>
</svg>"""
