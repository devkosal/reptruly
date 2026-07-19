"""Reply Studio preferences API (/api/auth/reply-prefs)."""
import pytest

from reptruly.users.models import Preferences
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


class TestReplyPrefsAPI:
    def test_requires_auth(self, client):
        assert client.get("/api/auth/reply-prefs").status_code == 401
        res = client.put(
            "/api/auth/reply-prefs",
            data={"tone": "playful"},
            content_type="application/json",
        )
        assert res.status_code == 401

    def test_defaults(self, client):
        user = UserFactory()
        client.force_login(user)
        res = client.get("/api/auth/reply-prefs")
        assert res.status_code == 200
        data = res.json()
        assert data == {
            "tone": "warm",
            "language": "en",
            "signature": "",
            "auto_suggest": True,
        }

    def test_partial_update_persists(self, client):
        user = UserFactory()
        client.force_login(user)
        res = client.put(
            "/api/auth/reply-prefs",
            data={"tone": "professional", "signature": "  — The Team  "},
            content_type="application/json",
        )
        assert res.status_code == 200
        data = res.json()
        assert data["tone"] == "professional"
        assert data["signature"] == "— The Team"
        # Untouched fields keep their defaults.
        assert data["language"] == "en"
        assert data["auto_suggest"] is True
        prefs = Preferences.objects.get(user=user)
        assert prefs.reply_tone == "professional"
        assert prefs.reply_signature == "— The Team"
        assert prefs.reply_language == "en"
        assert prefs.reply_auto_suggest is True

    def test_toggle_auto_suggest_and_get_echoes(self, client):
        user = UserFactory()
        client.force_login(user)
        res = client.put(
            "/api/auth/reply-prefs",
            data={"auto_suggest": False, "language": "fr"},
            content_type="application/json",
        )
        assert res.status_code == 200
        res = client.get("/api/auth/reply-prefs")
        data = res.json()
        assert data["auto_suggest"] is False
        assert data["language"] == "fr"
        assert data["tone"] == "warm"
