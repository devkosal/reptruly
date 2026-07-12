"""Hotels.com Provider (RapidAPI) — talks to https://hotels-com-provider.p.rapidapi.com.

Endpoint shapes (discovered by probing the live API):
    GET /v2/regions          ?query, locale, domain         → city/region search
    GET /v2/hotels/search    ?region_id, checkin/out, ...   → list hotels in a region
    GET /v2/hotels/details   ?hotel_id, locale, domain      → hotel name + review summary
    GET /v2/hotels/offers    ?hotel_id, checkin/out, ...    → rates for given dates

Useful gotcha: this API takes the Expedia property ID directly
(the `.h12345.` segment from an expedia.com URL). No Hotels.com↔Expedia ID conversion
is needed.

The provider does NOT appear to expose a per-review listing endpoint on this tier,
so review *aggregates* (count + average score) work but per-review text does not yet.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class ExpediaNotSubscribedError(RuntimeError):
    """Raised when the RapidAPI key has no active Hotels.com Provider subscription."""


class ExpediaClient:
    HOST = "hotels-com-provider.p.rapidapi.com"
    BASE_URL = f"https://{HOST}"

    def __init__(self, api_key: str | None = None, domain: str = "US", locale: str = "en_US"):
        self.api_key = api_key or settings.RAPIDAPI_KEY
        self.domain = domain
        self.locale = locale

    def _headers(self) -> dict:
        return {
            "x-rapidapi-host": self.HOST,
            "x-rapidapi-key": self.api_key,
        }

    def _get(self, path: str, params: dict) -> dict:
        url = f"{self.BASE_URL}{path}"
        try:
            resp = httpx.get(url, headers=self._headers(), params=params, timeout=30)
        except Exception as exc:
            raise RuntimeError(f"Hotels.com Provider request failed: {exc}") from exc
        if resp.status_code == 403:
            raise ExpediaNotSubscribedError(
                "RapidAPI 'Hotels.com Provider' is not subscribed on this key. "
                "Subscribe at https://rapidapi.com/apidojo/api/hotels-com-provider"
            )
        if resp.status_code == 404:
            raise RuntimeError(
                f"Hotels.com Provider endpoint {path!r} not found — schema may have changed. "
                f"Body: {resp.text[:200]}"
            )
        resp.raise_for_status()
        return resp.json() or {}

    # ----- Hotel metadata + review summary -----

    def fetch_property_metadata(self, hotel_id: str) -> dict:
        """Returns name, address, lat/lng, review summary. Works with Expedia property IDs directly."""
        raw = self._get(
            "/v2/hotels/details",
            {"hotel_id": str(hotel_id), "locale": self.locale, "domain": self.domain},
        )
        summary = raw.get("summary") or {}
        loc = summary.get("location") or {}
        coords = loc.get("coordinates") or {}

        # Review summary in nested form
        review_info = (raw.get("reviewInfo") or {}).get("summary") or {}
        review_count = _extract_review_count(review_info)
        review_score = _extract_review_score(review_info)

        return {
            "name": summary.get("name") or "",
            "latitude": coords.get("latitude"),
            "longitude": coords.get("longitude"),
            "address": (loc.get("address") or {}).get("addressLine") or "",
            "city": (loc.get("address") or {}).get("city") or "",
            "country": (loc.get("address") or {}).get("countryName") or "",
            "review_count": review_count,
            "review_avg_score_10": review_score,
            "_raw": raw,
        }

    # ----- Rates -----

    def fetch_property_rate(
        self,
        hotel_id: str,
        checkin_date: str,
        checkout_date: str,
        adults: int = 2,
        currency: str = "USD",
    ) -> dict | None:
        """Lowest available rate for a property on the given dates, or None if sold out."""
        try:
            raw = self._get(
                "/v2/hotels/offers",
                {
                    "hotel_id": str(hotel_id),
                    "checkin_date": checkin_date,
                    "checkout_date": checkout_date,
                    "adults_number": str(adults),
                    "domain": self.domain,
                    "locale": self.locale,
                    "currency": currency,
                },
            )
        except RuntimeError as exc:
            logger.warning("Expedia rate fetch failed for %s: %s", hotel_id, exc)
            return None

        price = _walk_min_price(raw)
        if price is None:
            return None
        return {"price": price, "currency": currency, "room_name": ""}

    # ----- Reviews -----

    def fetch_reviews_page(self, hotel_id: str, page: int = 1) -> list[dict]:
        raw = self._get(
            "/v2/hotels/reviews/list",
            {
                "hotel_id": str(hotel_id),
                "locale": self.locale,
                "domain": self.domain,
                "page_number": str(page),
            },
        )
        return ((raw.get("reviewInfo") or {}).get("reviews") or [])

    def fetch_all_reviews(
        self,
        hotel_id: str,
        max_pages: int = 100,
        known_ids: set[str] | None = None,
    ) -> list[dict]:
        """Paginate through reviews. 10 per page; assumed sorted recent-first by the API.

        If `known_ids` is provided (the set of review IDs already stored locally), we stop
        as soon as a full page contains only known IDs — that's the incremental path.
        """
        out: list[dict] = []
        seen_ids: set[str] = set()
        for page in range(1, max_pages + 1):
            try:
                reviews = self.fetch_reviews_page(hotel_id, page=page)
            except ExpediaNotSubscribedError:
                raise
            except Exception as exc:
                logger.warning("Expedia reviews page %s failed for %s: %s", page, hotel_id, exc)
                break
            if not reviews:
                break
            new_count = 0
            for review in reviews:
                rid = review.get("id")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    out.append(review)
                    new_count += 1
            if new_count == 0:
                break
            if len(reviews) < 10:
                break
            if known_ids:
                page_ids = {str(r.get("id") or "") for r in reviews}
                page_ids.discard("")
                if page_ids and page_ids.issubset(known_ids):
                    break
        return out


# ----- Helpers -----

def _walk_min_price(payload: Any) -> float | None:
    """Best-effort traversal to find the lowest numeric 'amount' under price-related keys."""
    candidates: list[float] = []

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k.lower() in {"amount", "price", "total"} and isinstance(v, (int, float)):
                    candidates.append(float(v))
                else:
                    _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(payload)
    return min(candidates) if candidates else None


def _extract_review_count(summary: dict) -> int | None:
    """The provider stores count inside a nested string like 'See all 481 reviews'.
    Pull the first integer out of that label.
    """
    import re
    label = (
        (summary.get("propertyReviewCountDetails") or {}).get("shortDescription")
        or summary.get("reviewCount")
        or ""
    )
    if isinstance(label, int):
        return label
    if not isinstance(label, str):
        return None
    m = re.search(r"(\d+)", label)
    return int(m.group(1)) if m else None


def _extract_review_score(summary: dict) -> float | None:
    """Score is buried in 'overallScoreWithDescriptionA11y.value' as a string like '5.2/10'."""
    import re
    val = (summary.get("overallScoreWithDescriptionA11y") or {}).get("value")
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        m = re.search(r"(\d+(?:\.\d+)?)", val)
        return float(m.group(1)) if m else None
    return None


def normalize_expedia_review(raw: dict) -> dict | None:
    """Map a Hotels.com Provider review payload (Expedia/Hotels.com) into our internal Review fields.

    Real example shape (key fields):
        id: '69ee6f04a8ee701fc121a58b'
        brandType: 'Expedia' | 'Hotels.com' | etc.
        title: 'Some title'
        text: 'review body'
        reviewScoreWithDescription: { value: '4/10 Fair', accessibilityLabel: '4 out of 10 Fair' }
        submissionTimeLocalized: 'Apr 26, 2026'
        travelers: [{name: 'John'}]
        managementResponses: [{...}] | null
    """
    import re
    from datetime import datetime

    review_id = raw.get("id")
    if not review_id:
        return None

    title = (raw.get("title") or "").strip()
    body = (raw.get("text") or "").strip()
    content = "\n".join(p for p in (title, body) if p).strip()

    # Score: parse "4/10 Fair" → 4.0
    score = None
    score_box = raw.get("reviewScoreWithDescription") or {}
    score_str = score_box.get("value") or score_box.get("accessibilityLabel") or ""
    if isinstance(score_str, str):
        m = re.match(r"\s*(\d+(?:\.\d+)?)", score_str)
        if m:
            try:
                score = float(m.group(1))
            except ValueError:
                pass

    # Reviewer name
    travelers = raw.get("travelers") or []
    reviewer_name = ""
    if isinstance(travelers, list) and travelers:
        first = travelers[0]
        if isinstance(first, dict):
            reviewer_name = first.get("name") or first.get("display") or ""
        elif isinstance(first, str):
            reviewer_name = first

    # Date: "Apr 26, 2026" → datetime
    reviewed_at = None
    sub_time = raw.get("submissionTimeLocalized") or ""
    if sub_time:
        for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d"):
            try:
                reviewed_at = datetime.strptime(sub_time, fmt)
                break
            except ValueError:
                continue

    # Hotelier reply
    response_text = ""
    responses = raw.get("managementResponses")
    if isinstance(responses, list) and responses:
        for resp in responses:
            if not isinstance(resp, dict):
                continue
            t = resp.get("text") or resp.get("body") or ""
            if isinstance(t, dict):
                t = t.get("value") or ""
            if t:
                response_text = t.strip()
                break

    return {
        "external_id": str(review_id),
        "content": content,
        "overall_score": score,
        "reviewer_name": reviewer_name,
        "reviewed_at": reviewed_at.isoformat() if reviewed_at else None,
        "has_reply": bool(response_text),
        "reply": response_text,
        "raw_data": raw,
    }
