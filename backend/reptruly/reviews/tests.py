"""Demand-based rate opportunity alerts."""
from unittest.mock import patch

import pytest
from django.core import mail
from django.core.cache import cache

from reptruly.billing.entitlements import PRO, STARTER
from reptruly.reviews.models import Property, Review
from reptruly.reviews.rate_alerts import (
    _sent_key,
    find_opportunities,
    send_rate_opportunity_alerts,
)
from reptruly.users.models import Preferences
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _prop(user):
    return Property.objects.create(
        user=user, property_name="Alert Hotel", booking_hotel_id="777"
    )


def _calendar(days):
    return {"days": days}


def _day(iso, score, holiday=None, events=None):
    return {
        "date": iso,
        "demand_score": score,
        "holiday": holiday,
        "events": events or [],
        "event_count": len(events or []),
        "is_weekend": False,
    }


def _rates(user_rate, vs_avg_pct, comps=(300.0, 400.0)):
    return {
        "user_rate": user_rate,
        "user_vs_avg_pct": vs_avg_pct,
        "currency": "USD",
        "competitors": [
            {"price": p, "is_user_property": False} for p in comps
        ],
    }


class TestFindOpportunities:
    def setup_method(self):
        cache.clear()

    def test_underpriced_high_demand_date_is_flagged(self):
        prop = _prop(UserFactory())
        days = [_day("2026-08-14", 5, holiday="Some Holiday")]
        with (
            patch("reptruly.reviews.rate_alerts.get_calendar_data", return_value=_calendar(days)),
            patch("reptruly.reviews.api.controllers.build_rates_data", return_value=_rates(290.0, -18.3)),
        ):
            opps = find_opportunities(prop)
        assert len(opps) == 1
        opp = opps[0]
        assert opp["date"] == "2026-08-14"
        assert opp["user_rate"] == 290.0
        assert opp["comp_avg"] == 350.0
        assert "Some Holiday" in opp["drivers"]

    def test_low_demand_days_are_ignored(self):
        prop = _prop(UserFactory())
        days = [_day("2026-08-14", 3)]
        with (
            patch("reptruly.reviews.rate_alerts.get_calendar_data", return_value=_calendar(days)),
            patch("reptruly.reviews.api.controllers.build_rates_data") as rates_mock,
        ):
            assert find_opportunities(prop) == []
        rates_mock.assert_not_called()

    def test_fairly_priced_dates_are_ignored(self):
        prop = _prop(UserFactory())
        days = [_day("2026-08-14", 5)]
        with (
            patch("reptruly.reviews.rate_alerts.get_calendar_data", return_value=_calendar(days)),
            patch("reptruly.reviews.api.controllers.build_rates_data", return_value=_rates(340.0, -3.0)),
        ):
            assert find_opportunities(prop) == []

    def test_already_alerted_dates_are_skipped(self):
        prop = _prop(UserFactory())
        cache.set(_sent_key(prop.id, "2026-08-14"), True, 60)
        days = [_day("2026-08-14", 5)]
        with (
            patch("reptruly.reviews.rate_alerts.get_calendar_data", return_value=_calendar(days)),
            patch("reptruly.reviews.api.controllers.build_rates_data") as rates_mock,
        ):
            assert find_opportunities(prop) == []
        rates_mock.assert_not_called()

    def test_rate_lookups_capped_at_three_dates(self):
        prop = _prop(UserFactory())
        days = [_day(f"2026-08-{14 + i}", 5) for i in range(5)]
        with (
            patch("reptruly.reviews.rate_alerts.get_calendar_data", return_value=_calendar(days)),
            patch(
                "reptruly.reviews.api.controllers.build_rates_data",
                return_value=_rates(290.0, -18.3),
            ) as rates_mock,
        ):
            opps = find_opportunities(prop)
        assert rates_mock.call_count == 3
        assert len(opps) == 3


class TestBadge:
    def setup_method(self):
        cache.clear()

    def _prop_with_reviews(self):
        prop = Property.objects.create(
            user=UserFactory(),
            property_name="Badge & Hotel <NYC>",
            booking_hotel_id="b1",
        )
        for i, score in enumerate([9.0, 8.0]):
            Review.objects.create(
                channex_id=f"badge_{i}",
                property_id="b1",
                property_name=prop.property_name,
                ota_name="Booking.com",
                overall_score=score,
            )
        return prop

    def test_badge_is_public_and_renders_stats(self, client):
        prop = self._prop_with_reviews()
        res = client.get(f"/api/badge/{prop.id}/badge.svg")
        assert res.status_code == 200
        assert res["Content-Type"] == "image/svg+xml"
        assert res["Cache-Control"] == "public, max-age=3600"
        svg = res.content.decode()
        assert ">8.5<" in svg
        assert "2 reviews" in svg
        assert "powered by" in svg
        # XML-escaped property name — no raw < or & from user data.
        assert "Badge &amp; Hotel &lt;NYC&gt;" in svg

    def test_dark_theme_and_bad_theme_fallback(self, client):
        prop = self._prop_with_reviews()
        dark = client.get(f"/api/badge/{prop.id}/badge.svg?theme=dark").content.decode()
        assert "#0b1220" in dark.split(">")[1]  # dark background rect
        weird = client.get(f"/api/badge/{prop.id}/badge.svg?theme=neon")
        assert weird.status_code == 200

    def test_no_reviews_shows_placeholder(self, client):
        prop = Property.objects.create(
            user=UserFactory(), property_name="Fresh Hotel", booking_hotel_id="b2"
        )
        svg = client.get(f"/api/badge/{prop.id}/badge.svg").content.decode()
        assert "–" in svg and "Guest reviews" in svg

    def test_unknown_property_404(self, client):
        res = client.get("/api/badge/00000000-0000-0000-0000-000000000000/badge.svg")
        assert res.status_code == 404


class TestSendRateOpportunityAlerts:
    def setup_method(self):
        cache.clear()

    def _pro_user_with_pref(self):
        user = UserFactory(email="owner@example.com")
        Preferences.objects.create(user=user, notify_rate_changes=True)
        _prop(user)
        return user

    def test_sends_email_and_sets_resend_guard(self):
        user = self._pro_user_with_pref()
        opp = {
            "property_id": str(user.properties.first().id),
            "property_name": "Alert Hotel",
            "date": "2026-08-14",
            "demand_score": 5,
            "drivers": "Some Holiday",
            "user_rate": 290.0,
            "comp_avg": 350.0,
            "vs_avg_pct": -18.3,
            "currency": "USD",
        }
        with (
            patch("reptruly.reviews.rate_alerts.get_plan", return_value=PRO),
            patch("reptruly.reviews.rate_alerts.find_opportunities", return_value=[opp]),
        ):
            result = send_rate_opportunity_alerts()
        assert result == {"sent": 1}
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == ["owner@example.com"]
        assert "Pricing opportunity" in msg.subject
        assert "$290" in msg.body and "$350" in msg.body
        assert cache.get(_sent_key(opp["property_id"], "2026-08-14"))

    def test_starter_users_are_skipped(self):
        self._pro_user_with_pref()
        with (
            patch("reptruly.reviews.rate_alerts.get_plan", return_value=STARTER),
            patch("reptruly.reviews.rate_alerts.find_opportunities") as find_mock,
        ):
            result = send_rate_opportunity_alerts()
        assert result == {"sent": 0}
        find_mock.assert_not_called()
        assert len(mail.outbox) == 0

    def test_pref_off_is_skipped(self):
        user = UserFactory()
        Preferences.objects.create(user=user, notify_rate_changes=False)
        _prop(user)
        with patch("reptruly.reviews.rate_alerts.get_plan", return_value=PRO):
            result = send_rate_opportunity_alerts()
        assert result == {"sent": 0}


class TestMarkHandled:
    """The 'I replied on the OTA already' mark."""

    def _setup(self, client, score=3.0):
        user = UserFactory()
        Property.objects.create(
            user=user, property_name="Handled Hotel", booking_hotel_id="9001"
        )
        review = Review.objects.create(
            channex_id=f"handled-{Review.objects.count()}",
            property_id="9001",
            property_name="Handled Hotel",
            ota_name="Booking.com",
            has_reply=False,
            overall_score=score,
        )
        client.force_login(user)
        return user, review

    def test_mark_and_unmark(self, client):
        _, review = self._setup(client)
        res = client.patch(
            f"/api/reviews/{review.id}/handled",
            data='{"handled": true}',
            content_type="application/json",
        )
        assert res.status_code == 200
        review.refresh_from_db()
        assert review.handled_at is not None

        res = client.patch(
            f"/api/reviews/{review.id}/handled",
            data='{"handled": false}',
            content_type="application/json",
        )
        assert res.status_code == 200
        review.refresh_from_db()
        assert review.handled_at is None

    def test_handled_leaves_triage_and_needs_reply(self, client):
        _, review = self._setup(client)
        Review.objects.create(
            channex_id="handled-other",
            property_id="9001",
            property_name="Handled Hotel",
            ota_name="Booking.com",
            has_reply=False,
            overall_score=2.0,
        )
        client.patch(
            f"/api/reviews/{review.id}/handled",
            data='{"handled": true}',
            content_type="application/json",
        )

        triage = client.get("/api/reviews/triage/summary").json()
        assert triage["unanswered_total"] == 1
        assert triage["handled_awaiting"] == 1

        listed = client.get("/api/reviews?has_reply=false&handled=false").json()
        assert listed["total"] == 1

        # Without the handled filter, both still list.
        assert client.get("/api/reviews?has_reply=false").json()["total"] == 2

    def test_cannot_mark_another_users_review(self, client):
        self._setup(client)
        stranger_review = Review.objects.create(
            channex_id="handled-stranger",
            property_id="someone-elses-hotel",
            property_name="Not Yours",
            has_reply=False,
        )
        res = client.patch(
            f"/api/reviews/{stranger_review.id}/handled",
            data='{"handled": true}',
            content_type="application/json",
        )
        assert res.status_code == 404
