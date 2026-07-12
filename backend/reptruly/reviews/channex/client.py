import httpx
from django.conf import settings


class ChannexClient:
    """Client for the Channex Reviews API."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or settings.CHANNEX_API_KEY
        self.base_url = (base_url or settings.CHANNEX_BASE_URL).rstrip("/")

    def _headers(self) -> dict:
        return {
            "user-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def fetch_reviews(self, page: int = 1, limit: int = 100, **filters) -> dict:
        """Fetch a page of reviews. Returns full Channex JSON response."""
        params = {
            "pagination[page]": page,
            "pagination[limit]": limit,
        }
        for key, value in filters.items():
            params[f"filter[{key}]"] = value

        response = httpx.get(
            f"{self.base_url}/reviews",
            headers=self._headers(),
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def fetch_all_reviews(self, **filters) -> list:
        """Paginate through all reviews and return a flat list of data objects."""
        all_reviews = []
        page = 1

        while True:
            data = self.fetch_reviews(page=page, limit=100, **filters)
            reviews = data.get("data", [])
            all_reviews.extend(reviews)

            meta = data.get("meta", {})
            total = meta.get("total", 0)
            if len(all_reviews) >= total or not reviews:
                break

            page += 1

        return all_reviews

    def reply_to_review(self, channex_review_id: str, reply_text: str) -> dict:
        """Post a reply to a review on Channex."""
        response = httpx.post(
            f"{self.base_url}/reviews/{channex_review_id}/reply",
            headers=self._headers(),
            json={"reply": {"reply": reply_text}},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
