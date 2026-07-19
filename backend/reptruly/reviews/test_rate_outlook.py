"""Multi-night rate outlook: cache/snapshot merging and median math."""
from datetime import date, timedelta

import pytest
from django.core.cache import cache

from reptruly.reviews.api.controllers import _rates_cache_key
from reptruly.reviews.api.rate_outlook_controller import (
    OUTLOOK_NIGHTS,
    _median,
    build_outlook,
)
from reptruly.reviews.models import Property, RateSnapshot
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

TODAY = date.today()


def _prop(user, name="Outlook Hotel", hotel_id="77123"):
    return Property.objects.create(
        user=user, property_name=name, booking_hotel_id=hotel_id, currency="USD"
    )


def _cache_rates(prop, checkin, user_rate=120.0, comps=(100.0, 150.0, 200.0), adults=2):
    key = _rates_cache_key(
        prop.id, checkin.isoformat(), (checkin + timedelta(days=1)).isoformat(), adults
    )
    competitors = [
        {"hotel_name": f"Comp Hotel {i}", "price": p, "is_user_property": False}
        for i, p in enumerate(comps)
    ]
    competitors.append({"price": user_rate, "is_user_property": True})
    cache.set(key, {
        "user_rate": user_rate,
        "currency": "USD",
        "competitors": competitors,
    }, 60)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


class TestMedian:
    def test_empty_is_none(self):
        assert _median([]) is None

    def test_odd_count(self):
        assert _median([300.0, 100.0, 200.0]) == 200.0

    def test_even_count_averages_middle_pair(self):
        assert _median([100.0, 200.0, 300.0, 400.0]) == 250.0


class TestBuildOutlook:
    def test_covers_every_night_and_counts_missing(self):
        prop = _prop(UserFactory())
        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults=2)
        assert len(entries) == OUTLOOK_NIGHTS
        assert entries[0]["checkin"] == TODAY
        assert all(e.get("source") is None for e in entries)

    def test_live_cache_wins_and_computes_median(self):
        prop = _prop(UserFactory())
        night = TODAY + timedelta(days=1)
        _cache_rates(prop, night, user_rate=120.0, comps=(100.0, 150.0, 200.0))
        RateSnapshot.objects.create(
            property=prop, snapshot_date=TODAY, checkin=night,
            user_rate=999.0, comp_avg=999.0, comp_count=1, currency="USD",
        )
        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults=2)
        e = next(x for x in entries if x["checkin"] == night)
        assert e["source"] == "live"
        assert e["user_rate"] == 120.0
        assert e["market_median"] == 150.0
        assert e["market_avg"] == 150.0
        assert e["comp_count"] == 3
        # Live entries expose the per-comp prices so the client can re-filter.
        assert sorted(c["price"] for c in e["comps"]) == [100.0, 150.0, 200.0]
        assert all(c["name"].startswith("Comp Hotel") for c in e["comps"])

    def test_snapshot_fallback_uses_newest_snapshot(self):
        prop = _prop(UserFactory())
        night = TODAY + timedelta(days=7)
        RateSnapshot.objects.create(
            property=prop, snapshot_date=TODAY - timedelta(days=3), checkin=night,
            user_rate=90.0, comp_avg=180.0, comp_count=4, currency="USD",
        )
        RateSnapshot.objects.create(
            property=prop, snapshot_date=TODAY - timedelta(days=1), checkin=night,
            user_rate=95.0, comp_avg=200.0, comp_count=5, currency="USD",
        )
        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults=2)
        e = next(x for x in entries if x["checkin"] == night)
        assert e["source"] == "snapshot"
        assert e["user_rate"] == 95.0
        assert e["market_avg"] == 200.0
        assert e["as_of"] == TODAY - timedelta(days=1)

    def test_adults_is_part_of_the_cache_identity(self):
        prop = _prop(UserFactory())
        night = TODAY + timedelta(days=2)
        _cache_rates(prop, night, adults=2)
        entries = build_outlook(prop, OUTLOOK_NIGHTS, adults=4)
        e = next(x for x in entries if x["checkin"] == night)
        assert e.get("source") is None
