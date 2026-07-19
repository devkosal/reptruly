"""Account security endpoints: change-password, logout-everywhere, sessions."""
import pytest
from django.contrib.sessions.models import Session
from django.test import Client

from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

PASSWORD = "Sup3r-s3cret!x42"


def _make_user():
    user = UserFactory()
    user.set_password(PASSWORD)
    user.save()
    return user


def _login(client, user, password=PASSWORD):
    res = client.post(
        "/api/auth/login",
        data={"username": user.username, "password": password},
        content_type="application/json",
    )
    assert res.status_code == 200
    return res


class TestChangePassword:
    def test_requires_auth(self, client):
        res = client.post(
            "/api/auth/change-password",
            data={"current_password": "x", "new_password": "whatever12345"},
            content_type="application/json",
        )
        assert res.status_code == 401

    def test_happy_path_keeps_current_session(self, client):
        user = _make_user()
        _login(client, user)
        res = client.post(
            "/api/auth/change-password",
            data={"current_password": PASSWORD, "new_password": "N3w-p4ssword!77"},
            content_type="application/json",
        )
        assert res.status_code == 200
        user.refresh_from_db()
        assert user.check_password("N3w-p4ssword!77")
        assert not user.check_password(PASSWORD)
        # The session that made the change must survive.
        assert client.get("/api/auth/me").status_code == 200

    def test_wrong_current_password(self, client):
        user = _make_user()
        _login(client, user)
        res = client.post(
            "/api/auth/change-password",
            data={"current_password": "not-the-password", "new_password": "N3w-p4ssword!77"},
            content_type="application/json",
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "Current password is incorrect"
        user.refresh_from_db()
        assert user.check_password(PASSWORD)

    def test_new_password_too_short(self, client):
        user = _make_user()
        _login(client, user)
        res = client.post(
            "/api/auth/change-password",
            data={"current_password": PASSWORD, "new_password": "short"},
            content_type="application/json",
        )
        assert res.status_code == 400
        assert "at least 8 characters" in res.json()["detail"]

    def test_new_password_fails_validators(self, client):
        user = _make_user()
        _login(client, user)
        res = client.post(
            "/api/auth/change-password",
            data={"current_password": PASSWORD, "new_password": "1234567890"},
            content_type="application/json",
        )
        assert res.status_code == 400
        user.refresh_from_db()
        assert user.check_password(PASSWORD)


class TestLogoutEverywhere:
    def test_requires_auth(self, client):
        assert client.post("/api/auth/logout-everywhere").status_code == 401

    def test_revokes_other_sessions_keeps_current(self, client):
        user = _make_user()
        _login(client, user)
        other = Client()
        _login(other, user)
        assert other.get("/api/auth/me").status_code == 200

        res = client.post("/api/auth/logout-everywhere")
        assert res.status_code == 200
        assert res.json()["revoked"] == 1
        # Current session still valid; the other one is gone.
        assert client.get("/api/auth/me").status_code == 200
        assert other.get("/api/auth/me").status_code == 401

    def test_does_not_touch_other_users_sessions(self, client):
        user = _make_user()
        bystander = _make_user()
        _login(client, user)
        other = Client()
        _login(other, bystander)

        res = client.post("/api/auth/logout-everywhere")
        assert res.status_code == 200
        assert res.json()["revoked"] == 0
        assert other.get("/api/auth/me").status_code == 200


class TestSessionsCount:
    def test_requires_auth(self, client):
        assert client.get("/api/auth/sessions").status_code == 401

    def test_counts_only_own_active_sessions(self, client):
        user = _make_user()
        bystander = _make_user()
        _login(client, user)
        second = Client()
        _login(second, user)
        third = Client()
        _login(third, bystander)

        res = client.get("/api/auth/sessions")
        assert res.status_code == 200
        assert res.json()["active_sessions"] == 2
        # Sanity: sessions exist in the DB (DB-backed engine).
        assert Session.objects.count() >= 3
