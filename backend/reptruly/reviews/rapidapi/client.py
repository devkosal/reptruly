import logging
import re
import time
from urllib.parse import parse_qs, urlparse

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

# RapidAPI's Booking.com proxy is flaky: identical requests intermittently come
# back as 400 (with no useful body), 5xx, or a dropped connection, then succeed
# seconds later. Retry those a few times with backoff before giving up. Real
# client errors (401/403 bad key, 404) are not retried.
_RETRY_STATUSES = frozenset({400, 429, 500, 502, 503, 504})
_RETRY_ATTEMPTS = 3
_RETRY_BASE_DELAY = 1.5  # seconds; grows 1.5s, 3s, 6s


def _rapidapi_get(url: str, *, headers: dict, params: dict, timeout: float = 30) -> httpx.Response:
    """httpx.get with retry on transient upstream failures.

    Raises httpx.HTTPStatusError (with the response body in the message) or the
    underlying transport error once attempts are exhausted.
    """
    last_exc: Exception | None = None
    for attempt in range(1, _RETRY_ATTEMPTS + 1):
        try:
            response = httpx.get(url, headers=headers, params=params, timeout=timeout)
        except httpx.TransportError as exc:
            last_exc = exc
        else:
            if response.status_code not in _RETRY_STATUSES:
                response.raise_for_status()
                return response
            body = response.text[:200].replace("\n", " ")
            last_exc = httpx.HTTPStatusError(
                f"{response.status_code} from {url.rsplit('/', 1)[-1]}: {body or '<empty body>'}",
                request=response.request,
                response=response,
            )
        if attempt < _RETRY_ATTEMPTS:
            delay = _RETRY_BASE_DELAY * (2 ** (attempt - 1))
            logger.warning(
                "RapidAPI %s attempt %d/%d failed (%s); retrying in %.1fs",
                url.rsplit("/", 1)[-1], attempt, _RETRY_ATTEMPTS, last_exc, delay,
            )
            time.sleep(delay)
    assert last_exc is not None
    raise last_exc


_BLOCK_ID_PARAMS = (
    "matching_block_id",
    "all_sr_blocks",
    "sr_pri_blocks",
    "highlighted_blocks",
)


# Expedia URLs put the hotel id in the path: ".../{slug}.h12345.Hotel-Information"
# Hotels.com URLs:                            ".../ho123456789/..."
_EXPEDIA_PATH_RE = re.compile(r"\.h(\d+)\.")
_HOTELS_DOTCOM_PATH_RE = re.compile(r"/ho(\d+)/")


def extract_expedia_property_id(value: str) -> str | None:
    """Resolve user input to an ID. Returns the ID found; the *source* (expedia vs hotels.com)
    is encoded into how downstream code handles it — see extract_expedia_input() for the
    richer parser used by the create-property endpoint.
    """
    info = extract_expedia_input(value)
    return info["id"] if info else None


def extract_expedia_input(value: str) -> dict | None:
    """Parse an Expedia/Hotels.com URL or numeric ID. Returns a dict with:
        - id: the numeric ID found
        - source: 'expedia' | 'hotels.com' | 'numeric'
        - latitude / longitude: extracted from the URL when present (Expedia URLs include latLong=)
        - hotel_name_hint: from the URL when present
    Returns None if nothing usable was found.
    """
    s = (value or "").strip()
    if not s:
        return None
    if s.isdigit():
        return {"id": s, "source": "numeric", "latitude": None, "longitude": None, "hotel_name_hint": ""}

    parsed = urlparse(s if "://" in s else f"https://{s}")
    host = (parsed.netloc or "").lower()
    path = parsed.path or ""
    qs = parse_qs(parsed.query or "")

    lat: float | None = None
    lng: float | None = None
    latlong_raw = (qs.get("latLong") or qs.get("latlong") or [""])[0]
    if latlong_raw and "," in latlong_raw:
        try:
            a, b = latlong_raw.split(",", 1)
            lat, lng = float(a), float(b)
        except ValueError:
            pass

    name_hint = (qs.get("hotelName") or qs.get("hotel_name") or [""])[0]

    if "expedia." in host:
        m = _EXPEDIA_PATH_RE.search(path)
        if m:
            return {
                "id": m.group(1),
                "source": "expedia",
                "latitude": lat,
                "longitude": lng,
                "hotel_name_hint": name_hint,
            }
    if "hotels.com" in host:
        m = _HOTELS_DOTCOM_PATH_RE.search(path)
        if m:
            return {
                "id": m.group(1),
                "source": "hotels.com",
                "latitude": lat,
                "longitude": lng,
                "hotel_name_hint": name_hint,
            }
    return None


def _candidates_from_block_id(block_id: str) -> list[str]:
    """Booking block IDs encode {hotel_id}{2-or-3-digit-room-suffix}. Strip the suffix."""
    head = block_id.split("_", 1)[0]
    if not head.isdigit() or len(head) < 5:
        return []
    return [head[:-2], head[:-3]] if len(head) > 5 else [head[:-2]]


def extract_booking_hotel_id(value: str) -> str | None:
    """Resolve user input (a numeric hotel ID or a Booking.com URL) to a hotel ID.

    For URLs, we read block-ID query params (Booking embeds the numeric hotel ID as the
    prefix of those) and validate each candidate via the RapidAPI hotel-name lookup.
    """
    s = (value or "").strip()
    if not s:
        return None
    if s.isdigit():
        return s

    parsed = urlparse(s if "://" in s else f"https://{s}")
    if "booking.com" not in (parsed.netloc or "").lower():
        return None

    qs = parse_qs(parsed.query)
    for direct in ("hotel_id", "b_hotel_id", "bbase_hotel_id"):
        if direct in qs and qs[direct] and qs[direct][0].isdigit():
            return qs[direct][0]

    candidates: list[str] = []
    seen: set[str] = set()
    for param in _BLOCK_ID_PARAMS:
        for raw in qs.get(param, []):
            for cand in _candidates_from_block_id(raw):
                if cand and cand not in seen:
                    seen.add(cand)
                    candidates.append(cand)

    if not candidates:
        return None

    client = BookingComClient()
    for cand in candidates:
        try:
            name = client.fetch_hotel_name(int(cand))
        except Exception:
            continue
        if name:
            return cand
    return None


class BookingComClient:
    """Client for Booking.com reviews via RapidAPI."""

    BASE_URL = "https://booking-com.p.rapidapi.com/v1"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.RAPIDAPI_KEY

    def _headers(self) -> dict:
        return {
            "x-rapidapi-host": "booking-com.p.rapidapi.com",
            "x-rapidapi-key": self.api_key,
            "Content-Type": "application/json",
        }

    def fetch_reviews(self, hotel_id: int, page_number: int = 0, locale: str = "en-gb") -> dict:
        """Fetch one page of reviews for a hotel.

        Sort is SORT_RECENT_DESC so newest reviews come first — this lets the sync task
        early-break once it hits already-stored reviews instead of paging to the very end.
        """
        response = _rapidapi_get(
            f"{self.BASE_URL}/hotels/reviews",
            headers=self._headers(),
            params={
                "hotel_id": hotel_id,
                "page_number": page_number,
                "locale": locale,
                "sort_type": "SORT_RECENT_DESC",
            },
        )
        return response.json()

    def fetch_hotel_name(self, hotel_id: int, locale: str = "en-gb") -> str:
        """Fetch the hotel display name."""
        return self.fetch_hotel_metadata(hotel_id, locale).get("name", "")

    def fetch_hotel_metadata(self, hotel_id: int, locale: str = "en-gb") -> dict:
        """Fetch name + lat/lng + currency + address. Returns the raw payload (or empty dict on miss)."""
        response = _rapidapi_get(
            f"{self.BASE_URL}/hotels/data",
            headers=self._headers(),
            params={"hotel_id": hotel_id, "locale": locale},
        )
        return response.json() or {}

    def fetch_hotel_rate(
        self,
        hotel_id: int,
        checkin_date: str,
        checkout_date: str,
        adults: int = 2,
        currency: str = "USD",
    ) -> dict | None:
        """Return the lowest available rate for a hotel on the given dates.

        Result shape: { 'price': float, 'currency': str, 'room_name': str } or None if sold out.
        """
        response = _rapidapi_get(
            f"{self.BASE_URL}/hotels/room-list",
            headers=self._headers(),
            params={
                "hotel_id": hotel_id,
                "checkin_date": checkin_date,
                "checkout_date": checkout_date,
                "adults_number_by_rooms": str(adults),
                "currency": currency,
                "locale": "en-gb",
                "units": "metric",
            },
        )
        payload = response.json()
        # API returns a list with a single object containing 'block'
        if isinstance(payload, list):
            payload = payload[0] if payload else {}
        blocks = payload.get("block", []) or []

        cheapest = None
        for block in blocks:
            pb = block.get("price_breakdown") or {}
            price = pb.get("gross_price") or pb.get("all_inclusive_price")
            if price is None:
                continue
            try:
                price_f = float(price)
            except (TypeError, ValueError):
                continue
            if cheapest is None or price_f < cheapest["price"]:
                cheapest = {
                    "price": price_f,
                    "currency": pb.get("currency") or payload.get("currency_code") or currency,
                    "room_name": block.get("name_without_policy") or block.get("name") or "",
                }
        return cheapest

    def fetch_nearby_with_rates(
        self,
        latitude: float,
        longitude: float,
        checkin_date: str,
        checkout_date: str,
        adults: int = 2,
        currency: str = "USD",
        order_by: str = "distance",
    ) -> list[dict]:
        """Search nearby hotels with available rates for the given dates."""
        response = _rapidapi_get(
            f"{self.BASE_URL}/hotels/search-by-coordinates",
            headers=self._headers(),
            params={
                "latitude": latitude,
                "longitude": longitude,
                "checkin_date": checkin_date,
                "checkout_date": checkout_date,
                "adults_number": str(adults),
                "room_number": "1",
                "filter_by_currency": currency,
                "order_by": order_by,
                "units": "metric",
                "locale": "en-gb",
                "page_number": "0",
            },
        )
        return (response.json() or {}).get("result", []) or []

    def fetch_all_reviews(
        self,
        hotel_id: int,
        locale: str = "en-gb",
        max_pages: int = 200,
        known_ids: set[str] | None = None,
    ) -> list:
        """Paginate newest-first. If `known_ids` is provided, stop as soon as a full
        page contains only review IDs we've already stored — that's the incremental
        path: on a daily run we typically pull 0-1 pages instead of 30+.

        Each id passed in `known_ids` should be the bare review_id (no prefix).
        """
        all_reviews: list = []
        for page in range(max_pages):
            data = self.fetch_reviews(hotel_id=hotel_id, page_number=page, locale=locale)
            reviews = data.get("result", [])
            if not reviews:
                break
            all_reviews.extend(reviews)
            if known_ids:
                page_ids = {
                    str(r.get("review_id") or r.get("review_hash") or "")
                    for r in reviews
                }
                page_ids.discard("")
                if page_ids and page_ids.issubset(known_ids):
                    break
        return all_reviews
