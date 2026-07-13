"""Notification preferences API + transactional email triggers."""
import pytest
from django.core import mail

from reptruly.reviews.models import Property, Review
from reptruly.users.emails import (
    send_negative_review_alert,
    send_pro_subscription_emails,
    send_welcome_email,
)
from reptruly.users.models import Preferences, User
from reptruly.users.tasks import (
    _previous_month_window,
    send_daily_digests,
    send_monthly_reports,
    send_weekly_summaries,
)
from reptruly.users.tests.factories import UserFactory
from reptruly.users.verification import make_token, verify_token

pytestmark = pytest.mark.django_db


def _login(client, user, password="Sup3r-s3cret!x42"):
    user.set_password(password)
    user.save()
    client.force_login(user)


class TestNotificationPrefsAPI:
    def test_requires_auth(self, client):
        assert client.get("/api/auth/notifications").status_code == 401

    def test_defaults(self, client):
        user = UserFactory()
        _login(client, user)
        res = client.get("/api/auth/notifications")
        assert res.status_code == 200
        data = res.json()
        assert data["new_reviews"] is True
        assert data["negative_alerts"] is True
        assert data["daily_digest"] is False
        assert data["marketing"] is False
        assert data["email_override"] == ""

    def test_partial_update_persists(self, client):
        user = UserFactory()
        _login(client, user)
        res = client.put(
            "/api/auth/notifications",
            data={"negative_alerts": False, "email_override": "alerts@hotel.com"},
            content_type="application/json",
        )
        assert res.status_code == 200
        prefs = Preferences.objects.get(user=user)
        assert prefs.notify_negative_reviews is False
        assert prefs.alert_email == "alerts@hotel.com"
        # Untouched fields keep their defaults.
        assert prefs.notify_new_reviews is True
        assert prefs.alert_recipient == "alerts@hotel.com"


class TestWelcomeEmail:
    def test_signup_sends_welcome(self, client):
        res = client.post(
            "/api/auth/signup",
            data={
                "username": "newbie",
                "email": "newbie@example.com",
                "password": "Sup3r-s3cret!x42",
            },
            content_type="application/json",
        )
        assert res.status_code == 200
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["newbie@example.com"]
        assert "Welcome to reptruly" in mail.outbox[0].subject

    def test_no_email_no_send(self):
        user = User.objects.create_user(username="noemail", email="", password="x" * 12)
        send_welcome_email(user)
        assert len(mail.outbox) == 0


class TestNegativeReviewAlert:
    def _property(self, user):
        return Property.objects.create(
            user=user, property_name="Test Hotel", booking_hotel_id="123"
        )

    def _review(self, score, content="Bad stay"):
        return Review.objects.create(
            channex_id=f"booking_{score}_{content[:8]}",
            property_id="123",
            property_name="Test Hotel",
            ota_name="Booking.com",
            content=content,
            overall_score=score,
        )

    def test_sends_summary_to_alert_recipient(self):
        user = UserFactory(email="owner@example.com")
        Preferences.objects.create(user=user, alert_email="alerts@hotel.com")
        prop = self._property(user)
        reviews = [self._review(2.5), self._review(4.0, "Noisy room")]
        send_negative_review_alert(prop, reviews)
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == ["alerts@hotel.com"]
        assert "2 negative reviews" in msg.subject
        assert "Test Hotel" in msg.subject
        assert "Noisy room" in msg.body

    def test_respects_toggle_off(self):
        user = UserFactory()
        Preferences.objects.create(user=user, notify_negative_reviews=False)
        prop = self._property(user)
        send_negative_review_alert(prop, [self._review(1.0)])
        assert len(mail.outbox) == 0

    def test_no_reviews_no_email(self):
        prop = self._property(UserFactory())
        send_negative_review_alert(prop, [])
        assert len(mail.outbox) == 0


class TestEmailVerification:
    def test_token_roundtrip(self):
        user = UserFactory()
        assert verify_token(make_token(user)) == user

    def test_bad_token_returns_none(self):
        assert verify_token("garbage:token") is None

    def test_signup_welcome_includes_verify_link(self, client):
        client.post(
            "/api/auth/signup",
            data={
                "username": "verifyme",
                "email": "verifyme@example.com",
                "password": "Sup3r-s3cret!x42",
            },
            content_type="application/json",
        )
        assert len(mail.outbox) == 1
        assert "/api/auth/verify-email?token=" in mail.outbox[0].body

    def test_verify_endpoint_sets_flag_and_redirects(self, client):
        user = UserFactory()
        assert user.email_verified is False
        res = client.get(f"/api/auth/verify-email?token={make_token(user)}")
        assert res.status_code == 302
        assert res.url == "/dashboard?verified=1"
        user.refresh_from_db()
        assert user.email_verified is True

    def test_verify_bad_token_redirects_expired(self, client):
        res = client.get("/api/auth/verify-email?token=nope")
        assert res.status_code == 302
        assert res.url == "/dashboard?verified=expired"

    def test_resend_sends_email(self, client):
        user = UserFactory(email="again@example.com")
        client.force_login(user)
        res = client.post("/api/auth/resend-verification")
        assert res.status_code == 200
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["again@example.com"]

    def test_resend_requires_auth(self, client):
        assert client.post("/api/auth/resend-verification").status_code == 401


def _property_with_reviews(user, scores):
    prop = Property.objects.create(
        user=user, property_name="Digest Hotel", booking_hotel_id="d123"
    )
    for i, score in enumerate(scores):
        Review.objects.create(
            channex_id=f"booking_digest_{i}_{score}",
            property_id="d123",
            property_name="Digest Hotel",
            ota_name="Booking.com",
            content=f"Review {i}",
            overall_score=score,
        )
    return prop


class TestDailyDigest:
    def test_sends_when_new_reviews(self):
        user = UserFactory(email="digest@example.com")
        Preferences.objects.create(user=user, notify_daily_digest=True)
        _property_with_reviews(user, [9.0, 3.0])
        result = send_daily_digests()
        assert result == {"sent": 1}
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == ["digest@example.com"]
        assert "2 new reviews" in msg.subject
        assert "1 negative" in msg.body

    def test_skips_quiet_day_and_opt_out(self):
        quiet = UserFactory()
        Preferences.objects.create(user=quiet, notify_daily_digest=True)
        Property.objects.create(
            user=quiet, property_name="Quiet Hotel", booking_hotel_id="q1"
        )
        opted_out = UserFactory()
        Preferences.objects.create(user=opted_out, notify_daily_digest=False)
        _property_with_reviews(opted_out, [2.0])
        assert send_daily_digests() == {"sent": 0}
        assert len(mail.outbox) == 0


class TestWeeklySummary:
    def test_sends_recap(self):
        user = UserFactory(email="weekly@example.com")
        Preferences.objects.create(user=user, notify_weekly_summary=True)
        _property_with_reviews(user, [8.0, 9.0, 2.0])
        result = send_weekly_summaries()
        assert result == {"sent": 1}
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert "3 new reviews" in msg.subject
        assert "Booking.com: 3" in msg.body

    def test_skips_users_without_properties(self):
        user = UserFactory()
        Preferences.objects.create(user=user, notify_weekly_summary=True)
        assert send_weekly_summaries() == {"sent": 0}
        assert len(mail.outbox) == 0


class TestMonthlyReport:
    def test_previous_month_window(self):
        from datetime import date

        start, end, label = _previous_month_window(date(2026, 7, 1))
        assert (start, end) == (date(2026, 6, 1), date(2026, 6, 30))
        assert label == "June 2026"
        # January rolls back across the year boundary.
        start, end, label = _previous_month_window(date(2026, 1, 15))
        assert (start, end) == (date(2025, 12, 1), date(2025, 12, 31))

    def test_sends_report_with_stats_and_link(self):
        from datetime import datetime, timezone as tz

        from django.utils import timezone as dj_tz

        user = UserFactory(email="owner@example.com")
        Preferences.objects.create(user=user, notify_monthly_report=True)
        prop = _property_with_reviews(user, [])
        # Reviews dated inside the previous calendar month.
        start, _, _ = _previous_month_window(dj_tz.now().date())
        for i, score in enumerate([9.0, 3.0]):
            Review.objects.create(
                channex_id=f"booking_month_{i}",
                property_id="d123",
                property_name=prop.property_name,
                ota_name="Booking.com",
                overall_score=score,
                has_reply=(i == 0),
                reviewed_at=datetime(start.year, start.month, 5 + i, 12, 0, tzinfo=tz.utc),
            )
        result = send_monthly_reports()
        assert result == {"sent": 1}
        assert len(mail.outbox) == 1
        body = mail.outbox[0].body
        assert "report is ready" in mail.outbox[0].subject
        assert "2 reviews" in body and "1 negative" in body and "reply rate 50%" in body
        assert f"/analytics/report?from={start.isoformat()}" in body
        assert "property=Digest%20Hotel" in body

    def test_respects_toggle_off(self):
        user = UserFactory()
        Preferences.objects.create(user=user, notify_monthly_report=False)
        _property_with_reviews(user, [5.0])
        assert send_monthly_reports() == {"sent": 0}
        assert len(mail.outbox) == 0

    def test_skips_users_without_properties(self):
        user = UserFactory()
        Preferences.objects.create(user=user, notify_monthly_report=True)
        assert send_monthly_reports() == {"sent": 0}


class TestProSubscriptionEmails:
    def test_emails_subscriber_and_admins(self, settings):
        settings.ADMINS = [("Admin", "owner@reptruly.com")]
        user = UserFactory(email="subscriber@example.com", name="Jane")
        send_pro_subscription_emails(user)
        assert len(mail.outbox) == 2
        subscriber_msg, admin_msg = mail.outbox
        assert subscriber_msg.to == ["subscriber@example.com"]
        assert "Pro" in subscriber_msg.subject
        assert admin_msg.to == ["owner@reptruly.com"]
        assert "New Pro subscriber: Jane" in admin_msg.subject
