"""External clients for the Calendar overlay (events + weather).

- Ticketmaster Discovery API for concerts, sports, theater (free tier; requires API key).
- Open-Meteo for weather (no API key required, free).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import httpx
from django.conf import settings


class TicketmasterClient:
    BASE_URL = "https://app.ticketmaster.com/discovery/v2"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.TICKETMASTER_API_KEY

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def fetch_events_near(
        self,
        latitude: float,
        longitude: float,
        start_date: date,
        end_date: date,
        radius_miles: int = 25,
        page_size: int = 200,
        max_pages: int = 25,  # 25 * 200 = 5000 event ceiling per call
    ) -> list[dict]:
        """Return a flat list of event dicts in [start, end] within radius_miles, paginated."""
        if not self.is_configured():
            return []

        events: list[dict] = []
        for page in range(max_pages):
            params = {
                "apikey": self.api_key,
                "latlong": f"{latitude},{longitude}",
                "radius": str(radius_miles),
                "unit": "miles",
                "startDateTime": f"{start_date.isoformat()}T00:00:00Z",
                "endDateTime": f"{end_date.isoformat()}T23:59:59Z",
                "size": str(min(page_size, 200)),
                "page": str(page),
                "sort": "date,asc",
            }
            try:
                resp = httpx.get(f"{self.BASE_URL}/events.json", params=params, timeout=30)
                resp.raise_for_status()
                payload = resp.json() or {}
            except Exception:
                break

            embedded = payload.get("_embedded") or {}
            page_events = embedded.get("events") or []
            for raw in page_events:
                event = _normalize_ticketmaster_event(raw)
                if event:
                    events.append(event)

            # Stop if we got fewer than a full page back (last page) or hit Ticketmaster's
            # hard 1000-event cap for this query (totalElements - we'd need more granular
            # date-window queries to fetch beyond, which is overkill for a calendar view).
            page_info = payload.get("page") or {}
            total_pages = page_info.get("totalPages", 0)
            if not page_events or page + 1 >= total_pages:
                break

        return events


def _normalize_ticketmaster_event(raw: dict) -> dict | None:
    name = raw.get("name")
    if not name:
        return None
    dates = raw.get("dates", {}) or {}
    start = dates.get("start", {}) or {}
    local_date = start.get("localDate")
    if not local_date:
        return None
    classifications = raw.get("classifications") or []
    classification = ""
    if classifications:
        seg = (classifications[0] or {}).get("segment") or {}
        classification = seg.get("name") or ""
    venue_name = ""
    venue_distance: float | None = None
    embedded = raw.get("_embedded") or {}
    venues = embedded.get("venues") or []
    if venues:
        v0 = venues[0] or {}
        venue_name = v0.get("name") or ""
        dist = v0.get("distance")
        try:
            venue_distance = float(dist) if dist is not None else None
        except (TypeError, ValueError):
            venue_distance = None
    return {
        "name": name,
        "date": local_date,
        "start_time": start.get("localTime"),
        "venue": venue_name,
        "venue_distance_miles": venue_distance,
        "classification": classification,  # e.g. "Music", "Sports"
        "url": raw.get("url"),
    }


class OpenMeteoClient:
    """Free, no-key weather API. Returns daily forecast up to ~16 days out."""

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def fetch_daily(
        self,
        latitude: float,
        longitude: float,
        start_date: date,
        end_date: date,
    ) -> dict[str, dict]:
        """Return {ISO-date: {temp_high, temp_low, weather_code, precip_mm}}."""
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": "auto",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }
        try:
            resp = httpx.get(self.BASE_URL, params=params, timeout=30)
            resp.raise_for_status()
            payload = resp.json() or {}
        except Exception:
            return {}

        daily = payload.get("daily") or {}
        dates = daily.get("time") or []
        out: dict[str, dict] = {}
        for i, d in enumerate(dates):
            out[d] = {
                "temp_high": _safe_float(daily.get("temperature_2m_max", []), i),
                "temp_low": _safe_float(daily.get("temperature_2m_min", []), i),
                "weather_code": _safe_int(daily.get("weather_code", []), i),
                "precip_in": _safe_float(daily.get("precipitation_sum", []), i),
            }
        return out


def _safe_float(arr: list[Any], i: int) -> float | None:
    try:
        v = arr[i]
        return float(v) if v is not None else None
    except (IndexError, TypeError, ValueError):
        return None


def _safe_int(arr: list[Any], i: int) -> int | None:
    try:
        v = arr[i]
        return int(v) if v is not None else None
    except (IndexError, TypeError, ValueError):
        return None


# WMO weather codes (https://open-meteo.com/en/docs) → human-readable summary + emoji.
_WEATHER_LOOKUP: dict[int, tuple[str, str]] = {
    0: ("Clear", "☀️"),
    1: ("Mostly clear", "🌤️"),
    2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Fog", "🌫️"),
    48: ("Fog", "🌫️"),
    51: ("Drizzle", "🌦️"),
    53: ("Drizzle", "🌦️"),
    55: ("Drizzle", "🌦️"),
    61: ("Light rain", "🌧️"),
    63: ("Rain", "🌧️"),
    65: ("Heavy rain", "🌧️"),
    71: ("Light snow", "🌨️"),
    73: ("Snow", "🌨️"),
    75: ("Heavy snow", "❄️"),
    80: ("Showers", "🌦️"),
    81: ("Showers", "🌦️"),
    82: ("Heavy showers", "⛈️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm", "⛈️"),
    99: ("Thunderstorm", "⛈️"),
}


def describe_weather_code(code: int | None) -> tuple[str, str]:
    if code is None:
        return ("", "")
    return _WEATHER_LOOKUP.get(code, ("", ""))
