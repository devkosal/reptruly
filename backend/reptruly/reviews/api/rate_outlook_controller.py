"""Multi-night rate outlook — your rate vs the market for the next N nights.

Reading the outlook is free: it only combines the 24h rates cache with the
daily RateSnapshot rows. Filling the gaps costs upstream Booking.com calls,
so that is a separate explicit scan endpoint the UI drives in small batches.
"""
import logging
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from django.core.cache import cache
from ninja import Schema
from ninja.errors import HttpError
from ninja.responses import codes_4xx, codes_5xx
from ninja_extra import api_controller, http_get, http_post

from reptruly.billing.entitlements import require_feature
from reptruly.core.common.schema import Message
from reptruly.reviews.models import Property, RateSnapshot

logger = logging.getLogger(__name__)

OUTLOOK_NIGHTS = 14
# Upstream fetches per scan request; the UI loops until nothing is missing.
SCAN_BATCH_LIMIT = 4


class OutlookCompOut(Schema):
    name: str = ""
    price: float


class OutlookNightOut(Schema):
    checkin: date
    user_rate: Optional[float] = None
    market_median: Optional[float] = None
    market_avg: Optional[float] = None
    comp_count: int = 0
    currency: str = "USD"
    # 'live' (24h rates cache), 'snapshot' (daily sync), or null (no data yet)
    source: Optional[str] = None
    as_of: Optional[date] = None
    # Per-comp prices (live entries only) so the client can recompute the
    # median under its own comp-set filters (e.g. "hotels only").
    comps: list[OutlookCompOut] = []


class RateOutlookOut(Schema):
    property_id: UUID
    nights: int
    adults: int
    entries: list[OutlookNightOut]
    missing: int


def _median(nums: list[float]) -> Optional[float]:
    if not nums:
        return None
    s = sorted(nums)
    mid = len(s) // 2
    return round(s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2, 2)


def _entry_from_rates(checkin: date, rates: dict) -> dict:
    comps = [
        {"name": c.get("hotel_name") or "", "price": c["price"]}
        for c in rates.get("competitors", [])
        if c.get("price") is not None and not c.get("is_user_property")
    ]
    prices = [c["price"] for c in comps]
    return {
        "checkin": checkin,
        "user_rate": rates.get("user_rate"),
        "market_median": _median(prices),
        "market_avg": round(sum(prices) / len(prices), 2) if prices else None,
        "comp_count": len(prices),
        "currency": rates.get("currency") or "USD",
        "source": "live",
        "as_of": date.today(),
        "comps": comps,
    }


def build_outlook(prop: Property, nights: int, adults: int) -> list[dict]:
    """One entry per check-in night from cache/snapshots — no upstream calls."""
    from reptruly.reviews.api.controllers import _rates_cache_key

    today = date.today()
    # Newest snapshot per check-in in range: ascending order means later
    # snapshot_dates overwrite earlier ones in the dict.
    snaps: dict[date, RateSnapshot] = {}
    for s in (
        RateSnapshot.objects
        .filter(property=prop, checkin__gte=today, checkin__lt=today + timedelta(days=nights))
        .order_by("snapshot_date")
    ):
        snaps[s.checkin] = s

    entries: list[dict] = []
    for i in range(nights):
        ci = today + timedelta(days=i)
        key = _rates_cache_key(prop.id, ci.isoformat(), (ci + timedelta(days=1)).isoformat(), adults)
        cached = cache.get(key)
        if cached:
            entries.append(_entry_from_rates(ci, cached))
            continue
        snap = snaps.get(ci)
        if snap is not None and (snap.user_rate is not None or snap.comp_avg is not None):
            entries.append({
                "checkin": ci,
                "user_rate": snap.user_rate,
                "market_median": None,
                "market_avg": snap.comp_avg,
                "comp_count": snap.comp_count,
                "currency": snap.currency or (prop.currency or "USD").upper(),
                "source": "snapshot",
                "as_of": snap.snapshot_date,
            })
            continue
        entries.append({
            "checkin": ci,
            "currency": (prop.currency or "USD").upper(),
        })
    return entries


@api_controller("/rates-outlook")
class RateOutlookAPI:

    def _get_property(self, request, property_id: UUID) -> Property:
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        require_feature(request.user, "rate_shopping")
        try:
            return Property.objects.get(id=property_id, user=request.user)
        except Property.DoesNotExist:
            raise HttpError(404, "Property not found")

    @http_get("/{property_id}", response={200: RateOutlookOut, codes_4xx: Message})
    def get_outlook(self, request, property_id: UUID, adults: int = 2):
        """Your rate vs the market for the next 14 nights, from cached data only."""
        prop = self._get_property(request, property_id)
        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults)
        return 200, {
            "property_id": prop.id,
            "nights": OUTLOOK_NIGHTS,
            "adults": adults,
            "entries": entries,
            "missing": sum(1 for e in entries if e.get("source") is None),
        }

    @http_post("/{property_id}/scan", response={200: RateOutlookOut, codes_4xx: Message, codes_5xx: Message})
    def scan_outlook(self, request, property_id: UUID, adults: int = 2):
        """Fetch live rates for up to SCAN_BATCH_LIMIT nights that have no data yet.

        Each fetched night lands in the shared 24h rates cache. Call repeatedly
        until `missing` is 0 — the UI shows progress between batches.
        """
        from reptruly.reviews.api.controllers import RatesUnavailable, build_rates_data

        prop = self._get_property(request, property_id)
        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults)
        fetched = 0
        for e in entries:
            if e.get("source") is not None or fetched >= SCAN_BATCH_LIMIT:
                continue
            ci: date = e["checkin"]
            try:
                build_rates_data(prop, ci, ci + timedelta(days=1), adults)
            except RatesUnavailable as exc:
                logger.warning("Outlook scan failed for %s checkin %s: %s", prop.id, ci, exc)
                return 502, {"message": f"Could not fetch rates for {ci.isoformat()}: {exc}"}
            fetched += 1

        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults)
        return 200, {
            "property_id": prop.id,
            "nights": OUTLOOK_NIGHTS,
            "adults": adults,
            "entries": entries,
            "missing": sum(1 for e in entries if e.get("source") is None),
        }
