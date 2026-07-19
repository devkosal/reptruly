"""Reply Studio pre-generation (reviews/reply_drafts.py) + draft persistence."""
from unittest.mock import MagicMock, patch

import pytest

from reptruly.billing.entitlements import PRO, STARTER
from reptruly.reviews.models import Property, Review
from reptruly.reviews.reply_drafts import PREGEN_DRAFT_CAP_PER_SYNC, pregenerate_drafts
from reptruly.users.emails import get_preferences
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _property(user, hotel_id="7001"):
    return Property.objects.create(
        user=user,
        booking_hotel_id=hotel_id,
        property_name="Draft Hotel",
    )


def _review(idx=0, content="Lovely stay, great staff.", **kwargs):
    defaults = dict(
        channex_id=f"drafttest_{idx}",
        property_id="7001",
        property_name="Draft Hotel",
        ota_name="Booking.com",
        reviewer_name="Sarah Smith",
        content=content,
        overall_score=9.0,
    )
    defaults.update(kwargs)
    return Review.objects.create(**defaults)


def _mock_openai(draft_text="Thank you Sarah, we loved hosting you!"):
    """Mocked OpenAI client whose chat completion returns `draft_text`."""
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = draft_text
    client = MagicMock()
    client.chat.completions.create.return_value = resp
    return client


class TestPregenerateDrafts:
    def test_no_api_key_returns_zero(self, settings):
        settings.OPENAI_API_KEY = ""
        user = UserFactory()
        prop = _property(user)
        review = _review(0)
        with patch("openai.OpenAI") as mock_cls:
            assert pregenerate_drafts([review], prop) == 0
        mock_cls.assert_not_called()
        review.refresh_from_db()
        assert review.draft_reply == ""

    def test_starter_plan_is_gated(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        prop = _property(user)
        review = _review(0)
        with (
            patch("reptruly.billing.entitlements.get_plan", return_value=STARTER),
            patch("openai.OpenAI") as mock_cls,
        ):
            assert pregenerate_drafts([review], prop) == 0
        mock_cls.assert_not_called()

    def test_auto_suggest_off_skips(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        prefs = get_preferences(user)
        prefs.reply_auto_suggest = False
        prefs.save()
        prop = _property(user)
        review = _review(0)
        with (
            patch("reptruly.billing.entitlements.get_plan", return_value=PRO),
            patch("openai.OpenAI") as mock_cls,
        ):
            assert pregenerate_drafts([review], prop) == 0
        mock_cls.assert_not_called()

    def test_draft_saved_with_stored_prefs(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        prefs = get_preferences(user)
        prefs.reply_tone = "concise"
        prefs.reply_language = "fr"
        prefs.reply_signature = "— The Draft Hotel Team"
        prefs.save()
        prop = _property(user)
        review = _review(0)
        client = _mock_openai("Merci Sarah !")
        with (
            patch("reptruly.billing.entitlements.get_plan", return_value=PRO),
            patch("openai.OpenAI", return_value=client),
        ):
            assert pregenerate_drafts([review], prop) == 1
        review.refresh_from_db()
        assert review.draft_reply == "Merci Sarah !"
        assert review.draft_generated_at is not None
        prompt = client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert "concise" in prompt
        assert "French" in prompt
        assert "— The Draft Hotel Team" in prompt

    def test_cap_per_sync(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        prop = _property(user)
        reviews = [_review(i) for i in range(PREGEN_DRAFT_CAP_PER_SYNC + 5)]
        client = _mock_openai()
        with (
            patch("reptruly.billing.entitlements.get_plan", return_value=PRO),
            patch("openai.OpenAI", return_value=client),
        ):
            generated = pregenerate_drafts(reviews, prop)
        assert generated == PREGEN_DRAFT_CAP_PER_SYNC
        assert client.chat.completions.create.call_count == PREGEN_DRAFT_CAP_PER_SYNC

    def test_skips_empty_replied_and_already_drafted(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        prop = _property(user)
        reviews = [
            _review(0, content=""),
            _review(1, has_reply=True),
            _review(2, draft_reply="Existing draft"),
        ]
        client = _mock_openai()
        with (
            patch("reptruly.billing.entitlements.get_plan", return_value=PRO),
            patch("openai.OpenAI", return_value=client),
        ):
            assert pregenerate_drafts(reviews, prop) == 0
        client.chat.completions.create.assert_not_called()

    def test_openai_failure_never_raises(self, settings):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        prop = _property(user)
        review = _review(0)
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("boom")
        with (
            patch("reptruly.billing.entitlements.get_plan", return_value=PRO),
            patch("openai.OpenAI", return_value=client),
        ):
            assert pregenerate_drafts([review], prop) == 0
        review.refresh_from_db()
        assert review.draft_reply == ""


class TestDraftEndpointPersistence:
    def test_on_demand_draft_is_saved_on_review(self, settings, client):
        settings.OPENAI_API_KEY = "sk-test"
        user = UserFactory()
        client.force_login(user)
        _property(user)
        review = _review(0)
        with (
            patch("reptruly.reviews.api.controllers.require_feature", return_value=PRO),
            patch(
                "reptruly.reviews.reply_drafts.generate_reply_draft",
                return_value="Thanks Sarah — come back soon!",
            ),
        ):
            res = client.post(
                f"/api/reviews/{review.id}/draft-reply",
                data={"tone": "warm", "language": "en", "signature": ""},
                content_type="application/json",
            )
        assert res.status_code == 200
        assert res.json()["draft"] == "Thanks Sarah — come back soon!"
        review.refresh_from_db()
        assert review.draft_reply == "Thanks Sarah — come back soon!"
        assert review.draft_generated_at is not None

    def test_list_returns_draft_fields(self, settings, client):
        user = UserFactory()
        client.force_login(user)
        _property(user)
        _review(0, draft_reply="Stored draft")
        res = client.get("/api/reviews")
        assert res.status_code == 200
        row = res.json()["data"][0]
        assert row["draft_reply"] == "Stored draft"
        assert "draft_generated_at" in row
