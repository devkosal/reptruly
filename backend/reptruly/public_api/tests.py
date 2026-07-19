"""Tests for the public read API and API-key management endpoints.

Run: docker exec reptruly_local_django pytest reptruly/public_api/ -q
"""

from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone
from ninja_apikey.models import APIKey

from reptruly.public_api.keys import create_api_key, list_api_keys, revoke_api_key
from reptruly.reviews.models import Property, Review
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

URLCONF = "reptruly.public_api.test_urls"


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def other_user():
    return UserFactory()


def _make_property(user, name="Hotel Alpha", booking_id="111", expedia_id="", google_id=""):
    return Property.objects.create(
        user=user,
        property_name=name,
        booking_hotel_id=booking_id,
        expedia_property_id=expedia_id,
        google_place_id=google_id,
        location="Lisbon, Portugal",
    )


_review_seq = iter(range(1, 10_000))


def _make_review(property_id, ota="Booking.com", score=8.0, has_reply=False, days_ago=1, **kw):
    n = next(_review_seq)
    return Review.objects.create(
        channex_id=f"chx-{property_id}-{n}",
        property_id=property_id,
        property_name=kw.pop("property_name", "Hotel Alpha"),
        ota_name=ota,
        reviewer_name=kw.pop("reviewer_name", "Guest"),
        content=kw.pop("content", "Great stay."),
        overall_score=score,
        has_reply=has_reply,
        reply="Thanks!" if has_reply else "",
        reviewed_at=timezone.now() - timedelta(days=days_ago),
        **kw,
    )


def _api_client(full_key=None):
    headers = {}
    if full_key:
        headers["HTTP_X_API_KEY"] = full_key
    return Client(**headers)


# ---------------------------------------------------------------------------
# keys.py helpers
# ---------------------------------------------------------------------------

class TestKeyHelpers:
    def test_create_returns_plaintext_once_and_stores_hash(self, user):
        full_key = create_api_key(user, "ci key")
        prefix, _, secret = full_key.partition(".")
        assert prefix and secret
        row = APIKey.objects.get(prefix=prefix)
        assert row.user == user
        assert row.label == "ci key"
        assert secret not in row.hashed_key  # only the hash is persisted
        assert row.is_valid

    def test_list_and_revoke(self, user, other_user):
        full_key = create_api_key(user, "mine")
        prefix = full_key.split(".", 1)[0]

        keys = list_api_keys(user)
        assert [k["prefix"] for k in keys] == [prefix]
        assert keys[0]["revoked"] is False
        assert list_api_keys(other_user) == []

        # Another user can't revoke my key
        assert revoke_api_key(other_user, prefix) is False
        assert revoke_api_key(user, prefix) is True
        assert revoke_api_key(user, prefix) is False  # already revoked
        assert list_api_keys(user)[0]["revoked"] is True


# ---------------------------------------------------------------------------
# /keys management endpoints (session auth)
# ---------------------------------------------------------------------------

@pytest.mark.urls(URLCONF)
class TestKeysEndpoints:
    def test_requires_session(self):
        client = Client()
        assert client.get("/api/keys").status_code == 401
        assert client.post(
            "/api/keys", data={"label": "x"}, content_type="application/json"
        ).status_code == 401

    def test_create_list_revoke_flow(self, user):
        client = Client()
        client.force_login(user)

        # Create — plaintext returned once
        resp = client.post(
            "/api/keys", data={"label": "zapier"}, content_type="application/json"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["label"] == "zapier"
        assert body["key"].startswith(body["prefix"] + ".")

        # List — no plaintext, just metadata
        resp = client.get("/api/keys")
        assert resp.status_code == 200
        keys = resp.json()
        assert len(keys) == 1
        assert keys[0]["prefix"] == body["prefix"]
        assert keys[0]["revoked"] is False
        assert "key" not in keys[0]

        # Revoke
        resp = client.delete(f"/api/keys/{body['prefix']}")
        assert resp.status_code == 200
        assert client.get("/api/keys").json()[0]["revoked"] is True

        # Revoking again → 404
        assert client.delete(f"/api/keys/{body['prefix']}").status_code == 404

    def test_blank_label_rejected(self, user):
        client = Client()
        client.force_login(user)
        resp = client.post(
            "/api/keys", data={"label": "  "}, content_type="application/json"
        )
        assert resp.status_code == 400

    def test_cannot_revoke_other_users_key(self, user, other_user):
        prefix = create_api_key(other_user, "theirs").split(".", 1)[0]
        client = Client()
        client.force_login(user)
        assert client.delete(f"/api/keys/{prefix}").status_code == 404
        assert APIKey.objects.get(prefix=prefix).revoked is False


# ---------------------------------------------------------------------------
# /v1 public endpoints (X-API-Key auth)
# ---------------------------------------------------------------------------

@pytest.mark.urls(URLCONF)
class TestPublicV1:
    def test_401_without_key_and_with_bad_key(self):
        assert _api_client().get("/api/v1/properties").status_code == 401
        assert _api_client("bogus").get("/api/v1/properties").status_code == 401
        assert _api_client("aaaa.bbbb").get("/api/v1/reviews").status_code == 401

    def test_revoked_key_rejected(self, user):
        full_key = create_api_key(user, "k")
        client = _api_client(full_key)
        assert client.get("/api/v1/properties").status_code == 200
        revoke_api_key(user, full_key.split(".", 1)[0])
        assert client.get("/api/v1/properties").status_code == 401

    def test_expired_key_rejected(self, user):
        full_key = create_api_key(user, "k")
        APIKey.objects.filter(prefix=full_key.split(".", 1)[0]).update(
            expires_at=timezone.now() - timedelta(days=1)
        )
        assert _api_client(full_key).get("/api/v1/properties").status_code == 401

    def test_properties_list(self, user):
        _make_property(user, booking_id="111", google_id="ChIJx")
        full_key = create_api_key(user, "k")
        resp = _api_client(full_key).get("/api/v1/properties")
        assert resp.status_code == 200
        props = resp.json()
        assert len(props) == 1
        assert props[0]["name"] == "Hotel Alpha"
        assert props[0]["channels"] == ["booking", "google"]

    def test_reviews_scoping_and_isolation(self, user, other_user):
        _make_property(user, booking_id="111")
        _make_property(other_user, name="Hotel Bravo", booking_id="222")
        _make_review("111", content="mine")
        _make_review("222", property_name="Hotel Bravo", content="theirs")

        key_a = create_api_key(user, "a")
        key_b = create_api_key(other_user, "b")

        data_a = _api_client(key_a).get("/api/v1/reviews").json()
        assert data_a["total"] == 1
        assert data_a["data"][0]["content"] == "mine"

        data_b = _api_client(key_b).get("/api/v1/reviews").json()
        assert data_b["total"] == 1
        assert data_b["data"][0]["content"] == "theirs"

        # User A's key can't read user B's property via property_id either
        prop_b = Property.objects.get(user=other_user)
        resp = _api_client(key_a).get(f"/api/v1/reviews?property_id={prop_b.id}")
        assert resp.status_code == 404

    def test_reviews_filters_and_pagination(self, user):
        prop = _make_property(user, booking_id="111", expedia_id="e-9")
        _make_review("111", ota="Booking.com", score=9.0, days_ago=1)
        _make_review("111", ota="Booking.com", score=4.0, days_ago=10)
        _make_review("e-9", ota="Expedia", score=7.0, days_ago=5)

        client = _api_client(create_api_key(user, "k"))

        assert client.get("/api/v1/reviews").json()["total"] == 3
        assert client.get("/api/v1/reviews?ota_name=expedia").json()["total"] == 1
        assert client.get("/api/v1/reviews?min_score=6").json()["total"] == 2
        assert client.get("/api/v1/reviews?min_score=6&max_score=8").json()["total"] == 1

        cutoff = (timezone.now() - timedelta(days=3)).date().isoformat()
        assert client.get(f"/api/v1/reviews?from_date={cutoff}").json()["total"] == 1

        # property_id (UUID from /v1/properties) matches reviews across channels
        assert client.get(f"/api/v1/reviews?property_id={prop.id}").json()["total"] == 3

        # Pagination + limit clamping (limit ≤ 100)
        page = client.get("/api/v1/reviews?page=2&limit=2").json()
        assert page["page"] == 2 and page["limit"] == 2
        assert page["total"] == 3 and len(page["data"]) == 1
        assert client.get("/api/v1/reviews?limit=500").json()["limit"] == 100

        # Field shape
        row = client.get("/api/v1/reviews?limit=1").json()["data"][0]
        assert set(row) == {
            "id", "property_name", "ota_name", "reviewer_name", "content",
            "score", "has_reply", "reply", "reviewed_at", "tags",
        }

    def test_analytics_summary(self, user, other_user):
        prop = _make_property(user, booking_id="111")
        _make_review("111", ota="Booking.com", score=10.0, has_reply=True)
        _make_review("111", ota="Booking.com", score=6.0)
        # Noise from another user must not leak in
        _make_property(other_user, name="Bravo", booking_id="222")
        _make_review("222", ota="Expedia", score=1.0)

        client = _api_client(create_api_key(user, "k"))
        body = client.get("/api/v1/analytics/summary").json()
        assert body == {
            "total_reviews": 2,
            "avg_score": 8.0,
            "replied": 1,
            "pending_reply": 1,
            "by_ota": {"Booking.com": 2},
        }

        scoped = client.get(f"/api/v1/analytics/summary?property_id={prop.id}").json()
        assert scoped["total_reviews"] == 2

        # Unknown / foreign property → 404
        prop_b = Property.objects.get(user=other_user)
        resp = client.get(f"/api/v1/analytics/summary?property_id={prop_b.id}")
        assert resp.status_code == 404
