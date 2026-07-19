"""Calendar (demand outlook) building, shared by the API and scheduled tasks.

Results are cached 24h per (property, window, radius) — the API endpoint and
the rate-alert task hit the same cache, so neither pays twice.
"""
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

import holidays as holidays_lib
from django.core.cache import cache
from django.utils import timezone

from reptruly.core.common.utils import get_logger
from reptruly.events.classifier import annotate_events_with_impact
from reptruly.events.clients import OpenMeteoClient, TicketmasterClient, describe_weather_code
from reptruly.reviews.models import Property

logger = get_logger()

CALENDAR_CACHE_TTL = 24 * 60 * 60  # 24h


class CalendarUnavailable(Exception):
    """The property has no resolvable coordinates."""


def _calendar_cache_key(property_id: UUID, start: str, end: str, radius: int) -> str:
    return f"calendar:v2:{property_id}:{start}:{end}:{radius}"


# OTA metadata reports full country names; the holidays lib wants ISO codes.
_COUNTRY_CODES = {
    "UNITED STATES": "US", "USA": "US",
    "UNITED KINGDOM": "GB", "UK": "GB", "ENGLAND": "GB", "SCOTLAND": "GB", "WALES": "GB",
    "CANADA": "CA", "MEXICO": "MX", "BRAZIL": "BR", "ARGENTINA": "AR",
    "FRANCE": "FR", "GERMANY": "DE", "SPAIN": "ES", "ITALY": "IT",
    "PORTUGAL": "PT", "NETHERLANDS": "NL", "BELGIUM": "BE", "SWITZERLAND": "CH",
    "AUSTRIA": "AT", "IRELAND": "IE", "GREECE": "GR", "TURKEY": "TR", "TÜRKIYE": "TR",
    "POLAND": "PL", "CZECH REPUBLIC": "CZ", "CZECHIA": "CZ", "SWEDEN": "SE",
    "NORWAY": "NO", "DENMARK": "DK", "FINLAND": "FI",
    "INDIA": "IN", "CHINA": "CN", "JAPAN": "JP", "SOUTH KOREA": "KR",
    "THAILAND": "TH", "VIETNAM": "VN", "INDONESIA": "ID", "MALAYSIA": "MY",
    "SINGAPORE": "SG", "PHILIPPINES": "PH", "UNITED ARAB EMIRATES": "AE",
    "SAUDI ARABIA": "SA", "ISRAEL": "IL", "EGYPT": "EG", "MOROCCO": "MA",
    "SOUTH AFRICA": "ZA", "KENYA": "KE", "NIGERIA": "NG",
    "AUSTRALIA": "AU", "NEW ZEALAND": "NZ",
}


def _country_for_property(prop: Property) -> str:
    """Best-effort country code lookup. Defaults to 'US' if we can't tell."""
    # Preferred: the country the OTA reported at connect time.
    stored = (prop.country or "").strip().upper()
    if len(stored) == 2:
        return stored
    if stored in _COUNTRY_CODES:
        return _COUNTRY_CODES[stored]

    # Legacy fallback: substring-match the location string.
    loc = (prop.location or "").upper()
    for name, code in _COUNTRY_CODES.items():
        if f", {name}" in loc:
            return code
    return "US"


def _demand_score(holiday: Optional[str], events: list[dict], is_weekend: bool) -> int:
    """Weight events by their estimated hotel-demand impact instead of raw count.

    A single Taylor Swift stadium concert (impact 3) outscores ten small local shows
    (impact 0 each). The weighted impact is bucketed to keep the final score on a 0-5 scale.
    """
    score = 0
    if is_weekend:
        score += 1
    if holiday:
        score += 2

    weighted = sum(int(e.get("impact_score", 0)) for e in events)
    if weighted >= 5:        # e.g. one destination event + a major draw, OR multiple major draws
        score += 3
    elif weighted >= 3:      # e.g. one destination event, or one major + one regional
        score += 2
    elif weighted >= 1:      # at least some out-of-town pull
        score += 1

    return min(score, 5)


def get_calendar_data(
    prop: Property,
    start: date,
    end: date,
    radius_miles: int = 25,
    force_refresh: bool = False,
) -> dict:
    """Per-day overlays (events, weather, holidays, demand score) for a window.

    Raises CalendarUnavailable when the property has no coordinates.
    """
    cache_key = _calendar_cache_key(prop.id, start.isoformat(), end.isoformat(), radius_miles)
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            cached["cached"] = True
            return cached

    if prop.latitude is None or prop.longitude is None:
        # Self-heal: pull coordinates from Booking.com or Google before giving up.
        from reptruly.reviews.api.controllers import _backfill_property_geo
        _backfill_property_geo(prop)
        prop.refresh_from_db()
    if prop.latitude is None or prop.longitude is None:
        raise CalendarUnavailable(
            "Property is missing coordinates — we couldn't resolve a location "
            "for this property from its connected OTAs."
        )

    # Events
    tm = TicketmasterClient()
    events_by_date: dict[str, list[dict]] = defaultdict(list)
    if tm.is_configured():
        try:
            events = tm.fetch_events_near(prop.latitude, prop.longitude, start, end, radius_miles)
            # Score each event for likely hotel-demand impact (cached + LLM-classified).
            # The property's location string is the best city hint we have.
            city_hint = prop.location or prop.property_name
            annotate_events_with_impact(events, city_hint)
            for e in events:
                events_by_date[e["date"]].append(e)
        except Exception as exc:
            logger.error("Ticketmaster fetch failed for %s: %s", prop.id, exc)

    # Weather: Open-Meteo only forecasts ~16 days, so cap the request window.
    # Days beyond get null weather fields and the UI shows "n/a".
    weather_end = min(end, start + timedelta(days=15))
    try:
        weather_by_date = OpenMeteoClient().fetch_daily(prop.latitude, prop.longitude, start, weather_end)
    except Exception as exc:
        logger.error("Open-Meteo fetch failed for %s: %s", prop.id, exc)
        weather_by_date = {}

    # Holidays
    country = _country_for_property(prop)
    try:
        holidays_for_year = holidays_lib.country_holidays(country, years=[start.year, end.year])
    except Exception:
        holidays_for_year = {}

    days_out: list[dict] = []
    cursor = start
    while cursor <= end:
        iso = cursor.isoformat()
        day_events = events_by_date.get(iso, [])
        holiday_name = holidays_for_year.get(cursor) if holidays_for_year else None
        weather = weather_by_date.get(iso, {})
        wsum, wemoji = describe_weather_code(weather.get("weather_code"))
        is_weekend = cursor.weekday() >= 5
        days_out.append({
            "date": iso,
            "is_weekend": is_weekend,
            "holiday": holiday_name,
            "events": day_events,
            "event_count": len(day_events),
            "weather_temp_high": weather.get("temp_high"),
            "weather_temp_low": weather.get("temp_low"),
            "weather_summary": wsum,
            "weather_emoji": wemoji,
            "precip_in": weather.get("precip_in"),
            "demand_score": _demand_score(holiday_name, day_events, is_weekend),
        })
        cursor += timedelta(days=1)

    result = {
        "property_id": prop.id,
        "property_name": prop.property_name,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "radius_miles": radius_miles,
        "ticketmaster_configured": tm.is_configured(),
        "days": days_out,
        "fetched_at": timezone.now(),
        "cached": False,
    }
    cache.set(cache_key, result, CALENDAR_CACHE_TTL)
    return result
