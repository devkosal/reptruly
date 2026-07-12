"""Demand-based rate opportunity alerts.

Daily scan: for each Pro user with rate alerts on, look at the demand outlook
for the next few weeks; on very-high-demand dates, compare the property's
Booking.com rate to its comp set and email when it sits well below market.

Both the calendar and rates lookups go through the same 24h caches the UI
uses, so this costs at most a handful of upstream calls per property per day.
"""
import logging
from datetime import date, timedelta

from django.core.cache import cache

from reptruly.billing.entitlements import get_plan
from reptruly.events.calendar import CalendarUnavailable, get_calendar_data
from reptruly.reviews.models import Property
from reptruly.users.emails import send_rate_opportunity_email
from reptruly.users.models import Preferences

logger = logging.getLogger(__name__)

LOOKAHEAD_DAYS = 21          # scan the next three weeks
DEMAND_ALERT_MIN = 4         # "Very high" in the demand calendar UI (0-5 scale)
MAX_DATES_PER_PROPERTY = 3   # bound upstream rate lookups per property per run
UNDERPRICED_PCT = -10.0      # alert when >= 10% below comp-set average
RESEND_TTL = 7 * 24 * 3600   # don't re-alert the same property+date within a week


def _sent_key(prop_id, iso_date: str) -> str:
    return f"rate-alert-sent:{prop_id}:{iso_date}"


def _top_event_name(events: list[dict]) -> str:
    if not events:
        return ""
    best = max(events, key=lambda e: int(e.get("impact_score", 0)))
    return best.get("name") or ""


def _demand_drivers(day: dict) -> str:
    bits = []
    if day.get("holiday"):
        bits.append(day["holiday"])
    top = _top_event_name(day.get("events") or [])
    if top:
        count = day.get("event_count") or 0
        bits.append(f"{top}{f' + {count - 1} more events' if count > 1 else ''}")
    if day.get("is_weekend"):
        bits.append("weekend")
    return " · ".join(bits) or "high local demand"


def find_opportunities(prop: Property) -> list[dict]:
    """Very-high-demand dates in the lookahead window where the property's
    rate is >= 10% below the comp-set average. At most MAX_DATES_PER_PROPERTY
    rate lookups per run; dates already alerted this week are skipped."""
    from reptruly.reviews.api.controllers import RatesUnavailable, build_rates_data

    today = date.today()
    try:
        calendar = get_calendar_data(prop, today + timedelta(days=1), today + timedelta(days=LOOKAHEAD_DAYS))
    except CalendarUnavailable:
        return []

    candidates = [
        d for d in calendar.get("days", [])
        if d.get("demand_score", 0) >= DEMAND_ALERT_MIN
        and not cache.get(_sent_key(prop.id, d["date"]))
    ]
    candidates.sort(key=lambda d: (-d["demand_score"], d["date"]))

    opportunities = []
    for day in candidates[:MAX_DATES_PER_PROPERTY]:
        checkin = date.fromisoformat(day["date"])
        try:
            rates = build_rates_data(prop, checkin, checkin + timedelta(days=1))
        except RatesUnavailable:
            continue
        user_rate = rates.get("user_rate")
        vs_avg = rates.get("user_vs_avg_pct")
        if user_rate is None or vs_avg is None or vs_avg > UNDERPRICED_PCT:
            continue
        comp_prices = [
            c["price"] for c in rates.get("competitors", [])
            if c.get("price") is not None and not c.get("is_user_property")
        ]
        opportunities.append({
            "property_id": str(prop.id),
            "property_name": prop.property_name,
            "date": day["date"],
            "demand_score": day["demand_score"],
            "drivers": _demand_drivers(day),
            "user_rate": user_rate,
            "comp_avg": round(sum(comp_prices) / len(comp_prices), 2) if comp_prices else None,
            "vs_avg_pct": vs_avg,
            "currency": rates.get("currency") or "USD",
        })
    return opportunities


def send_rate_opportunity_alerts() -> dict:
    """Implementation behind the daily celery task (see reviews/tasks.py)."""
    sent = 0
    for prefs in Preferences.objects.filter(notify_rate_changes=True).select_related("user"):
        user = prefs.user
        if not prefs.alert_recipient:
            continue
        if not get_plan(user).rate_shopping:
            continue  # rate shopping (and thus rate alerts) is a Pro feature
        opportunities: list[dict] = []
        for prop in user.properties.exclude(booking_hotel_id=""):
            try:
                opportunities.extend(find_opportunities(prop))
            except Exception:
                logger.exception("Rate-alert scan failed for property %s", prop.id)
        if not opportunities:
            continue
        send_rate_opportunity_email(user, prefs.alert_recipient, opportunities)
        for opp in opportunities:
            cache.set(_sent_key(opp["property_id"], opp["date"]), True, RESEND_TTL)
        sent += 1
    logger.info("Rate opportunity alerts sent: %d", sent)
    return {"sent": sent}
