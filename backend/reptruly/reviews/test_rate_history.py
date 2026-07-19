"""Rate history snapshots + comp-set movement alerts."""
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.core import mail

from reptruly.billing.entitlements import PRO, STARTER
from reptruly.reviews.models import Property, RateSnapshot
from reptruly.reviews.rate_history import (
    SNAPSHOT_OFFSETS,
    detect_movements,
    run_rates_sync,
    snapshot_property_rates,
)
from reptruly.users.models import Preferences
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

TODAY = date.today()


def _prop(user, name="History Hotel", hotel_id="56110"):
    return Property.objects.create(
        user=user, property_name=name, booking_hotel_id=hotel_id, currency="USD"
    )


def _rates(user_rate=290.0, comps=(300.0, 400.0, 410.0), currency="USD"):
    competitors = [{"price": p, "is_user_property": False} for p in comps]
    competitors.append({"price": user_rate, "is_user_property": True})
    return {
        "user_rate": user_rate,
        "currency": currency,
        "competitors": competitors,
    }


def _snap(prop, days_ago, checkin, comp_avg, user_rate=290.0, comp_count=3):
    return RateSnapshot.objects.create(
        property=prop,
        snapshot_date=TODAY - timedelta(days=days_ago),
        checkin=checkin,
        user_rate=user_rate,
        comp_avg=comp_avg,
        comp_count=comp_count,
        currency="USD",
    )


class TestSnapshotPropertyRates:
    def test_writes_one_row_per_offset(self):
        prop = _prop(UserFactory())
        with patch(
            "reptruly.reviews.api.controllers.build_rates_data",
            return_value=_rates(),
        ):
            written = snapshot_property_rates(prop)

        assert written == len(SNAPSHOT_OFFSETS)
        snaps = RateSnapshot.objects.filter(property=prop)
        assert snaps.count() == len(SNAPSHOT_OFFSETS)
        assert {s.checkin for s in snaps} == {
            TODAY + timedelta(days=o) for o in SNAPSHOT_OFFSETS
        }
        one = snaps.get(checkin=TODAY + timedelta(days=7))
        assert one.snapshot_date == TODAY
        assert one.user_rate == 290.0
        # comp avg excludes the user's own property row
        assert one.comp_avg == round((300.0 + 400.0 + 410.0) / 3, 2)
        assert one.comp_count == 3
        assert one.currency == "USD"

    def test_unavailable_dates_are_skipped(self):
        from reptruly.reviews.api.controllers import RatesUnavailable

        prop = _prop(UserFactory())
        results = [_rates(), RatesUnavailable("nope"), _rates()]

        def fake(prop_, checkin, checkout, *a, **kw):
            r = results.pop(0)
            if isinstance(r, Exception):
                raise r
            return r

        with patch(
            "reptruly.reviews.api.controllers.build_rates_data", side_effect=fake
        ):
            written = snapshot_property_rates(prop)

        assert written == 2
        assert RateSnapshot.objects.filter(property=prop).count() == 2

    def test_rerun_same_day_updates_instead_of_duplicating(self):
        prop = _prop(UserFactory())
        with patch(
            "reptruly.reviews.api.controllers.build_rates_data",
            return_value=_rates(comps=(100.0, 200.0)),
        ):
            snapshot_property_rates(prop)
        with patch(
            "reptruly.reviews.api.controllers.build_rates_data",
            return_value=_rates(comps=(300.0, 500.0)),
        ):
            snapshot_property_rates(prop)

        snaps = RateSnapshot.objects.filter(property=prop)
        assert snaps.count() == len(SNAPSHOT_OFFSETS)
        assert all(s.comp_avg == 400.0 for s in snaps)


class TestDetectMovements:
    def test_movement_at_10_percent_or_more_triggers(self):
        prop = _prop(UserFactory())
        checkin = TODAY + timedelta(days=14)
        _snap(prop, days_ago=1, checkin=checkin, comp_avg=355.0)
        _snap(prop, days_ago=0, checkin=checkin, comp_avg=410.0)

        movements = detect_movements(prop)
        assert len(movements) == 1
        m = movements[0]
        assert m["checkin"] == checkin.isoformat()
        assert m["old_avg"] == 355.0
        assert m["new_avg"] == 410.0
        assert m["pct"] == pytest.approx(15.5, abs=0.1)
        assert m["user_rate"] == 290.0
        assert m["currency"] == "USD"

    def test_downward_movement_also_triggers(self):
        prop = _prop(UserFactory())
        checkin = TODAY + timedelta(days=7)
        _snap(prop, days_ago=2, checkin=checkin, comp_avg=400.0)
        _snap(prop, days_ago=0, checkin=checkin, comp_avg=340.0)

        movements = detect_movements(prop)
        assert len(movements) == 1
        assert movements[0]["pct"] == -15.0

    def test_below_threshold_does_not_trigger(self):
        prop = _prop(UserFactory())
        checkin = TODAY + timedelta(days=7)
        _snap(prop, days_ago=1, checkin=checkin, comp_avg=400.0)
        _snap(prop, days_ago=0, checkin=checkin, comp_avg=430.0)  # +7.5%

        assert detect_movements(prop) == []

    def test_uses_most_recent_earlier_snapshot(self):
        prop = _prop(UserFactory())
        checkin = TODAY + timedelta(days=30)
        _snap(prop, days_ago=5, checkin=checkin, comp_avg=200.0)
        _snap(prop, days_ago=1, checkin=checkin, comp_avg=395.0)
        _snap(prop, days_ago=0, checkin=checkin, comp_avg=400.0)

        # vs yesterday (+1.3%) not vs 5 days ago (+100%)
        assert detect_movements(prop) == []

    def test_missing_comp_avg_is_ignored(self):
        prop = _prop(UserFactory())
        checkin = TODAY + timedelta(days=7)
        _snap(prop, days_ago=1, checkin=checkin, comp_avg=None)
        _snap(prop, days_ago=0, checkin=checkin, comp_avg=400.0)

        assert detect_movements(prop) == []


class TestRunRatesSync:
    def _pro_user(self):
        user = UserFactory()
        prefs, _ = Preferences.objects.get_or_create(user=user)
        prefs.notify_rate_changes = True
        prefs.save()
        return user

    def test_one_email_per_user_listing_all_movements(self):
        user = self._pro_user()
        prop_a = _prop(user, name="Hotel A", hotel_id="1")
        prop_b = _prop(user, name="Hotel B", hotel_id="2")
        # Yesterday's snapshots that today's run will move against (>= 10%).
        for prop in (prop_a, prop_b):
            for offset in SNAPSHOT_OFFSETS:
                _snap(prop, days_ago=1, checkin=TODAY + timedelta(days=offset), comp_avg=300.0)

        with (
            patch("reptruly.reviews.rate_history.get_plan", return_value=PRO),
            patch(
                "reptruly.reviews.api.controllers.build_rates_data",
                return_value=_rates(comps=(350.0, 370.0)),  # avg 360 = +20%
            ),
        ):
            total = run_rates_sync()

        assert total == 2 * len(SNAPSHOT_OFFSETS)
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [user.email]
        assert "Comp-set rates moved on 6 upcoming dates" in msg.subject
        assert "comp average $300 → $360 (+20%)" in msg.body
        assert "your rate $290" in msg.body
        assert "Hotel A" in msg.body and "Hotel B" in msg.body

    def test_starter_users_are_skipped(self):
        user = self._pro_user()
        _prop(user)
        with (
            patch("reptruly.reviews.rate_history.get_plan", return_value=STARTER),
            patch(
                "reptruly.reviews.api.controllers.build_rates_data",
                return_value=_rates(),
            ) as fetch,
        ):
            total = run_rates_sync()

        assert total == 0
        assert fetch.call_count == 0
        assert RateSnapshot.objects.count() == 0
        assert mail.outbox == []

    def test_no_email_when_alerts_disabled(self):
        user = self._pro_user()
        prefs = Preferences.objects.get(user=user)
        prefs.notify_rate_changes = False
        prefs.save()
        prop = _prop(user)
        for offset in SNAPSHOT_OFFSETS:
            _snap(prop, days_ago=1, checkin=TODAY + timedelta(days=offset), comp_avg=300.0)

        with (
            patch("reptruly.reviews.rate_history.get_plan", return_value=PRO),
            patch(
                "reptruly.reviews.api.controllers.build_rates_data",
                return_value=_rates(comps=(350.0, 370.0)),
            ),
        ):
            total = run_rates_sync()

        assert total == len(SNAPSHOT_OFFSETS)  # snapshots still written
        assert mail.outbox == []

    def test_no_email_without_movements(self):
        user = self._pro_user()
        _prop(user)
        with (
            patch("reptruly.reviews.rate_history.get_plan", return_value=PRO),
            patch(
                "reptruly.reviews.api.controllers.build_rates_data",
                return_value=_rates(),
            ),
        ):
            total = run_rates_sync()

        assert total == len(SNAPSHOT_OFFSETS)
        assert mail.outbox == []
