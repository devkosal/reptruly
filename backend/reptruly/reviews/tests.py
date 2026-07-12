"""Demand-based rate opportunity alerts."""
from unittest.mock import patch

import pytest
from django.core import mail
from django.core.cache import cache

from reptruly.billing.entitlements import PRO, STARTER
from reptruly.reviews.models import Property
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
