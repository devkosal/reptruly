"""Auto-tagging (reviews/tagging.py) + the list-endpoint tag filter."""
import json
from unittest.mock import MagicMock, patch

import pytest

from reptruly.reviews.models import Property, Review
from reptruly.reviews.tagging import TAG_TAXONOMY, classify_reviews
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _review(idx=0, content="Great location, spotless room.", tags=None, **kwargs):
    defaults = dict(
        channex_id=f"tagtest_{idx}",
        property_id="9001",
        property_name="Tag Hotel",
        ota_name="Booking.com",
        content=content,
        overall_score=8.5,
        tags=tags or [],
    )
    defaults.update(kwargs)
    return Review.objects.create(**defaults)


def _mock_openai_response(payload: dict):
    """Build a mocked OpenAI client whose chat completion returns `payload` as JSON."""
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = json.dumps(payload)
    client = MagicMock()
    client.chat.completions.create.return_value = resp
    return client


class TestClassifyReviews:
    def test_writes_only_taxonomy_tags(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        r = _review(0)
        # Model returns a valid tag, an invented tag, a dupe, and junk types.
        client = _mock_openai_response(
            {"0": ["cleanliness", "unicorns", "Location", "location", 42]}
        )
        with patch("openai.OpenAI", return_value=client):
            tagged = classify_reviews([r])
        assert tagged == 1
        r.refresh_from_db()
        assert r.tags == ["cleanliness", "location"]
        assert set(r.tags) <= set(TAG_TAXONOMY)

    def test_skips_already_tagged_and_empty_content(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        _review(0, tags=["staff"])
        _review(1, content="")
        client = _mock_openai_response({})
        with patch("openai.OpenAI", return_value=client) as mock_cls:
            tagged = classify_reviews(list(Review.objects.all()))
        assert tagged == 0
        # No candidates -> the OpenAI client is never even constructed.
        mock_cls.assert_not_called()
        assert Review.objects.get(channex_id="tagtest_0").tags == ["staff"]

    def test_no_api_key_returns_zero(self, settings):
        settings.OPENAI_API_KEY = ""
        r = _review(0)
        tagged = classify_reviews([r])
        assert tagged == 0
        r.refresh_from_db()
        assert r.tags == []

    def test_api_failure_returns_zero_without_raising(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        r = _review(0)
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("boom")
        with patch("openai.OpenAI", return_value=client):
            tagged = classify_reviews([r])
        assert tagged == 0
        r.refresh_from_db()
        assert r.tags == []


class TestListReviewsTagFilter:
    def test_tag_filter(self, client):
        user = UserFactory()
        Property.objects.create(
            user=user, property_name="Tag Hotel", booking_hotel_id="9001"
        )
        _review(0, tags=["cleanliness", "staff"])
        _review(1, tags=["location"])
        _review(2, tags=[])
        client.force_login(user)

        res = client.get("/api/reviews?tag=cleanliness")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["data"][0]["channex_id"] == "tagtest_0"
        assert "cleanliness" in data["data"][0]["tags"]

        # No tag param -> everything comes back.
        res = client.get("/api/reviews")
        assert res.json()["total"] == 3
