"""The RapidAPI Booking.com proxy intermittently 400s / drops connections on
requests that succeed seconds later. _rapidapi_get must retry those and give
up cleanly on real errors."""
import httpx
import pytest

from reptruly.reviews.rapidapi import client as mod

URL = "https://booking-com.p.rapidapi.com/v1/hotels/search-by-coordinates"


def _resp(status: int, body: str = "") -> httpx.Response:
    return httpx.Response(status, text=body, request=httpx.Request("GET", URL))


@pytest.fixture
def no_sleep(monkeypatch):
    slept: list[float] = []
    monkeypatch.setattr(mod.time, "sleep", lambda s: slept.append(s))
    return slept


def _fake_get(monkeypatch, outcomes):
    """Each outcome is a Response to return or an Exception to raise."""
    calls: list[dict] = []

    def fake(url, headers, params, timeout):
        calls.append({"url": url, "params": params})
        out = outcomes[len(calls) - 1]
        if isinstance(out, Exception):
            raise out
        return out

    monkeypatch.setattr(mod.httpx, "get", fake)
    return calls


def test_success_first_try_does_not_sleep(monkeypatch, no_sleep):
    calls = _fake_get(monkeypatch, [_resp(200, '{"result": []}')])
    r = mod._rapidapi_get(URL, headers={}, params={"a": 1})
    assert r.status_code == 200
    assert len(calls) == 1
    assert no_sleep == []


def test_transient_400_then_success_is_retried(monkeypatch, no_sleep):
    calls = _fake_get(monkeypatch, [_resp(400), _resp(200, "{}")])
    r = mod._rapidapi_get(URL, headers={}, params={})
    assert r.status_code == 200
    assert len(calls) == 2
    assert no_sleep == [mod._RETRY_BASE_DELAY]


def test_dropped_connection_then_success_is_retried(monkeypatch, no_sleep):
    calls = _fake_get(monkeypatch, [
        httpx.RemoteProtocolError("Server disconnected without sending a response."),
        _resp(200, "{}"),
    ])
    r = mod._rapidapi_get(URL, headers={}, params={})
    assert r.status_code == 200
    assert len(calls) == 2


def test_gives_up_after_max_attempts_with_body_in_message(monkeypatch, no_sleep):
    _fake_get(monkeypatch, [_resp(502, "upstream exploded")] * mod._RETRY_ATTEMPTS)
    with pytest.raises(httpx.HTTPStatusError) as exc:
        mod._rapidapi_get(URL, headers={}, params={})
    assert "502" in str(exc.value)
    assert "upstream exploded" in str(exc.value)
    # backoff doubles: 1.5, 3
    assert no_sleep == [mod._RETRY_BASE_DELAY, mod._RETRY_BASE_DELAY * 2]


def test_real_client_errors_are_not_retried(monkeypatch, no_sleep):
    calls = _fake_get(monkeypatch, [_resp(403, "bad api key")])
    with pytest.raises(httpx.HTTPStatusError):
        mod._rapidapi_get(URL, headers={}, params={})
    assert len(calls) == 1
    assert no_sleep == []
