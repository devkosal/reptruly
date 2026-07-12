"""Google Maps / Google Places API client for hotel reviews.

Free Google Places API caps reviews at 5 per place — that's a Google product limit, not
a tier limit. Higher review counts require either the Place Details (New) endpoint with
specific request masks, or third-party scraping providers on RapidAPI.

This module:
  - Extracts a Place ID from a wide range of Google Maps URLs.
  - Calls Google Places API when GOOGLE_PLACES_API_KEY is set.
  - Returns [] gracefully when the key is missing — sync flow stays alive, the property
    is connected, and reviews start flowing the moment the key is configured.

To enable real review fetching, set GOOGLE_PLACES_API_KEY in the backend env. Get a key at:
    https://console.cloud.google.com/apis/credentials  (enable "Places API")
"""

from __future__ import annotations

import logging
import re
from urllib.parse import parse_qs, urlparse

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


# A Google Place ID starts with one of: ChIJ, GhIJ, Ei, EkY, Ej... (~20-200 chars total).
_PLACE_ID_RE = re.compile(r"\b((?:ChIJ|GhIJ|Ei|EkY|Ej[A-Za-z0-9_-]{0,2})[A-Za-z0-9_-]{15,})")
# Matches the "0x...:0x..." hex CID pattern Google embeds in /place/ URLs. Note that a CID
# is NOT a Place ID — the Places API doesn't accept it as `place_id`. We only return the CID
# as a fallback when no real Place ID is found, and surface a clear error message later.
_HEX_CID_RE = re.compile(r"!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)")

_GOOGLE_SHORT_HOSTS = ("maps.app.goo.gl", "goo.gl", "g.co")


def _is_short_google_url(host: str) -> bool:
    h = host.lower()
    return any(h == s or h.endswith("." + s) for s in _GOOGLE_SHORT_HOSTS)


def _expand_google_url(url: str) -> str | None:
    """Follow redirects on a short URL (maps.app.goo.gl, goo.gl/maps, g.co/...).
    Returns the final URL or None on failure.
    """
    try:
        import httpx
        # HEAD first to avoid downloading the body.
        resp = httpx.head(url, follow_redirects=True, timeout=15)
        if resp.status_code < 400:
            return str(resp.url)
        # Some Google short URLs return 405/403 on HEAD — fall back to GET.
        resp = httpx.get(url, follow_redirects=True, timeout=20)
        if resp.status_code < 400:
            return str(resp.url)
    except Exception:
        return None
    return None


def _resolve_place_id_via_text_search(query: str) -> str | None:
    """Use Places API (New) Text Search to find the canonical Place ID for a hotel name.
    Returns None if no API key, or if no result. Avoids returning address-tier Place IDs
    that the page-HTML scrape sometimes picks up.
    """
    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    if not api_key or not query:
        return None
    try:
        resp = httpx.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "places.id,places.userRatingCount",
                "Content-Type": "application/json",
            },
            json={"textQuery": query, "maxResultCount": 5},
            timeout=15,
        )
        if resp.status_code >= 400:
            return None
        places = resp.json().get("places") or []
        # Prefer a result that has reviews (i.e. a real establishment, not a road/address).
        for p in places:
            if p.get("userRatingCount"):
                pid = p.get("id")
                if pid:
                    return pid
        # Fall back to the first result if no rated places — better than nothing.
        if places and places[0].get("id"):
            return places[0]["id"]
    except Exception:
        return None
    return None


def search_places(query: str, limit: int = 6) -> list[dict]:
    """Search Google Places (New) Text Search and return candidate hotels.

    Returns a list of {place_id, name, address, rating, user_rating_count} dicts so the
    frontend can show a pick-list. Returns [] when no API key is set or on any error —
    the caller surfaces a friendly "couldn't search" message rather than crashing.
    """
    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    query = (query or "").strip()
    if not api_key or not query:
        return []
    try:
        resp = httpx.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": (
                    "places.id,places.displayName,places.formattedAddress,"
                    "places.rating,places.userRatingCount"
                ),
                "Content-Type": "application/json",
            },
            json={"textQuery": query, "maxResultCount": max(1, min(limit, 10))},
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.warning("Places text search %s: %s", resp.status_code, resp.text[:200])
            return []
        places = resp.json().get("places") or []
    except Exception as exc:
        logger.warning("Places text search failed for %r: %s", query, exc)
        return []

    results: list[dict] = []
    for p in places[:limit]:
        pid = p.get("id")
        if not pid:
            continue
        name = ((p.get("displayName") or {}).get("text") or "").strip()
        results.append({
            "place_id": pid,
            "name": name or "(unnamed place)",
            "address": (p.get("formattedAddress") or "").strip(),
            "rating": p.get("rating"),
            "user_rating_count": p.get("userRatingCount"),
        })
    return results


def fetch_place_geo(place_id: str) -> dict:
    """Return {latitude, longitude, address} for a Place ID, or {} on any failure.

    Used to backfill coordinates for Google-connected properties so the Demand Calendar
    and Rates pages work even when there's no Booking.com link to source location from.
    """
    if not place_id:
        return {}
    client = GooglePlacesClient()
    if not client.is_configured():
        return {}
    try:
        details = client.fetch_place_details(place_id)
    except Exception as exc:
        logger.warning("Google geo lookup failed for %s: %s", place_id, exc)
        return {}
    loc = details.get("location") or {}
    lat, lng = loc.get("latitude"), loc.get("longitude")
    if lat is None or lng is None:
        return {}
    return {
        "latitude": lat,
        "longitude": lng,
        "address": (details.get("formattedAddress") or "").strip(),
    }


def _hotel_name_from_maps_path(path: str) -> str | None:
    """Decode the hotel-name segment of a /maps/place/Hotel+Slug/... URL."""
    import re as _re
    from urllib.parse import unquote_plus
    m = _re.search(r"/maps/place/([^/@]+)", path or "")
    if not m:
        return None
    raw = m.group(1)
    name = unquote_plus(raw).replace("+", " ").strip()
    # Strip trailing data-segment if present (rare).
    name = name.split("/")[0].strip()
    return name or None


def extract_google_place_id(value: str) -> str | None:
    """Resolve user input to a Google Place ID. Returns the Place ID, or None if we couldn't find one.

    Accepted inputs:
      - A bare Place ID like 'ChIJN1t_tDeuEmsRUsoyG83frY4' (best — instant)
      - A Google Maps URL with ?place_id=... query  (instant)
      - A short URL: maps.app.goo.gl/... or goo.gl/maps/... or g.co/... (we follow the redirect)
      - A full /maps/place/... URL — we fetch the page and grep for the Place ID as a last resort
    """
    s = (value or "").strip()
    if not s:
        return None

    # Already a place ID?
    m = _PLACE_ID_RE.match(s)
    if m and m.group(1) == s:
        return s

    parsed = urlparse(s if "://" in s else f"https://{s}")

    # Expand short URLs upfront so the rest of the parser sees the full URL.
    if _is_short_google_url(parsed.netloc):
        expanded = _expand_google_url(parsed.geturl())
        if expanded:
            parsed = urlparse(expanded)
        else:
            return None  # short URL we couldn't expand → no chance

    qs = parse_qs(parsed.query or "")

    # 1. ?place_id=ChIJ...
    if "place_id" in qs and qs["place_id"]:
        candidate = qs["place_id"][0]
        if _PLACE_ID_RE.match(candidate):
            return candidate

    # 2. Place ID anywhere in the URL (covers many Google Maps query strings)
    full = parsed.geturl()
    m = _PLACE_ID_RE.search(full)
    if m:
        return m.group(1)

    # 3. /maps/place/Hotel+Name/... URLs: decode the hotel name from the path and use
    #    Places API (New) Text Search to find the canonical Place ID. This is much more
    #    reliable than scraping the HTML, which often returns an address-tier Place ID
    #    (no reviews) instead of the hotel's establishment-tier Place ID.
    if "google." in (parsed.netloc or "") and ("/maps" in (parsed.path or "")):
        hotel_name = _hotel_name_from_maps_path(parsed.path)
        if hotel_name:
            place_id = _resolve_place_id_via_text_search(hotel_name)
            if place_id:
                return place_id

    return None


class GoogleNotConfiguredError(RuntimeError):
    """Raised when GOOGLE_PLACES_API_KEY isn't set."""


class GooglePlacesClient:
    """Uses Places API (New) — the supported path going forward.

    Endpoint:
        GET https://places.googleapis.com/v1/places/{place_id}
        Header X-Goog-Api-Key: <key>
        Header X-Goog-FieldMask: <comma-separated fields>

    Field mask is required — without it the request is rejected. We ask for the minimum
    needed for hotel review tracking.
    """

    BASE_URL = "https://places.googleapis.com/v1/places"

    # Field mask for the Place Details (New) call — names use camelCase, NOT snake_case.
    DETAIL_FIELDS = (
        "id,displayName,rating,userRatingCount,reviews,location,formattedAddress"
    )

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or getattr(settings, "GOOGLE_PLACES_API_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def fetch_place_details(self, place_id: str) -> dict:
        if not self.is_configured():
            raise GoogleNotConfiguredError(
                "GOOGLE_PLACES_API_KEY is not set. Get a key at https://console.cloud.google.com "
                "(enable Places API (New)) and add GOOGLE_PLACES_API_KEY=... to backend/.envs/.local/.django."
            )
        try:
            resp = httpx.get(
                f"{self.BASE_URL}/{place_id}",
                headers={
                    "X-Goog-Api-Key": self.api_key,
                    "X-Goog-FieldMask": self.DETAIL_FIELDS,
                },
                timeout=30,
            )
        except Exception as exc:
            raise RuntimeError(f"Google Places (New) request failed: {exc}") from exc
        if resp.status_code == 403:
            raise RuntimeError(
                f"Google Places (New) 403: {resp.text[:200]}. "
                "Likely causes: API not enabled, billing not active on project, or key restricted."
            )
        resp.raise_for_status()
        return resp.json() or {}

    def fetch_all_reviews(self, place_id: str) -> list[dict]:
        """Returns up to 5 reviews — Google's hard cap on Place Details, including the New API."""
        try:
            details = self.fetch_place_details(place_id)
        except GoogleNotConfiguredError:
            logger.info("Skipping Google review fetch for %s — no API key configured.", place_id)
            return []
        return list(details.get("reviews") or [])


def normalize_google_review(raw: dict) -> dict | None:
    """Map a Place Details (New) review payload into our internal Review fields.

    Real shape (Places API New):
        {
          "name": "places/<placeid>/reviews/<id>",
          "relativePublishTimeDescription": "a year ago",
          "rating": 1,
          "text": {"text": "...", "languageCode": "en"},
          "originalText": {...},
          "authorAttribution": {"displayName": "John", "uri": "...", "photoUri": "..."},
          "publishTime": "2024-08-13T18:35:21.872103Z"
        }
    """
    import hashlib
    from datetime import datetime

    text_obj = raw.get("text") or {}
    if isinstance(text_obj, str):
        body = text_obj
    else:
        body = (text_obj.get("text") or "").strip() if isinstance(text_obj, dict) else ""
    body = (body or "").strip()

    rating = raw.get("rating")
    if not body and rating is None:
        return None

    # The "name" field is the canonical id (places/.../reviews/...). Hash to keep it short + stable.
    name = raw.get("name") or ""
    if name:
        review_id = hashlib.sha1(name.encode("utf-8")).hexdigest()[:24]
    else:
        seed = f"{raw.get('publishTime','')}|{(raw.get('authorAttribution') or {}).get('displayName','')}|{rating}|{body[:60]}"
        review_id = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:24]

    score = None
    if rating is not None:
        try:
            # Google ratings are 1-5; convert to 0-10 to match Booking display.
            score = round(float(rating) * 2, 1)
        except (TypeError, ValueError):
            score = None

    reviewer = ""
    author = raw.get("authorAttribution")
    if isinstance(author, dict):
        reviewer = (author.get("displayName") or "").strip()

    reviewed_at = None
    ts = raw.get("publishTime")
    if isinstance(ts, str):
        try:
            # Drop trailing 'Z' or fractional zeros for fromisoformat compatibility.
            cleaned = ts.replace("Z", "+00:00")
            reviewed_at = datetime.fromisoformat(cleaned)
        except ValueError:
            reviewed_at = None

    return {
        "external_id": review_id,
        "content": body,
        "overall_score": score,
        "reviewer_name": reviewer,
        "reviewed_at": reviewed_at.isoformat() if reviewed_at else None,
        "has_reply": False,  # Places API (New) doesn't expose hotelier responses on this endpoint.
        "reply": "",
        "raw_data": raw,
    }
