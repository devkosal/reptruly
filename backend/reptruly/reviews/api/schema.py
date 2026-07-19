from datetime import datetime
from typing import Optional
from uuid import UUID

from ninja import Schema


class ReviewOut(Schema):
    id: UUID
    channex_id: str
    property_id: str
    property_name: str
    ota_name: str
    reservation_id: str
    reviewer_name: str
    content: str
    overall_score: Optional[float] = None
    has_reply: bool
    reply: str
    is_pending: bool
    scores: list
    tags: list
    reviewed_at: Optional[datetime] = None
    draft_reply: str = ""
    draft_generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ReviewListOut(Schema):
    data: list[ReviewOut]
    total: int
    page: int
    limit: int
    # Per-OTA review counts for the current scope (property + filters, excluding the
    # OTA filter itself) so the UI can show clickable "Booking 3099 · Google 7" chips.
    ota_counts: dict[str, int] = {}


class TriageSummaryOut(Schema):
    """Counts behind the inbox triage presets."""

    unanswered_total: int
    # Unanswered with score <= 6 — the angry-guest pile.
    negative_unanswered: int
    # Unanswered from the last 7 days.
    recent_unanswered: int
    # Unanswered with score >= 9 — quick wins to thank.
    positive_unthanked: int


class ReplyIn(Schema):
    reply: str


class DraftReplyIn(Schema):
    tone: str = "warm"  # professional | warm | concise | playful
    language: str = "en"
    signature: str = ""


class DraftReplyOut(Schema):
    draft: str
    tone: str
    language: str
    review_id: UUID


class OTAStats(Schema):
    total: int
    avg_score: Optional[float]
    replied: int
    pending_reply: int
    reply_rate: Optional[float]  # 0-100, null when total=0
    score_distribution: dict


class AnalyticsOut(Schema):
    total_reviews: int
    avg_score: Optional[float]
    reviews_by_ota: dict
    score_distribution: dict
    replied: int
    pending_reply: int
    per_ota: dict  # OTA name → OTAStats dict


class OTATrends(Schema):
    weekly_avg_score: Optional[float]
    monthly_avg_score: Optional[float]
    weekly_count: int
    monthly_count: int
    monthly_volume: dict
    monthly_avg: dict


class TrendsOut(Schema):
    weekly_avg_score: Optional[float]
    monthly_avg_score: Optional[float]
    weekly_count: int
    monthly_count: int
    monthly_volume: dict
    monthly_avg: dict
    per_ota: dict  # OTA name → OTATrends dict


class PropertyOut(Schema):
    id: UUID
    property_id: str
    property_name: str
    location: str
    ota: str
    booking_hotel_id: str = ""
    expedia_property_id: str = ""
    google_place_id: str = ""
    last_synced_at: Optional[datetime] = None
    sync_warnings: list[str] = []


class PropertyCreateIn(Schema):
    property_name: Optional[str] = None
    booking_hotel_id: Optional[str] = None
    expedia_property_id: Optional[str] = None
    google_place_id: Optional[str] = None


class PropertyUpdateIn(Schema):
    """All fields are optional. To remove an OTA link, send the corresponding field as ''."""
    property_name: Optional[str] = None
    booking_hotel_id: Optional[str] = None
    expedia_property_id: Optional[str] = None
    google_place_id: Optional[str] = None


class PlaceSearchResult(Schema):
    place_id: str
    name: str
    address: str = ""
    rating: Optional[float] = None
    user_rating_count: Optional[int] = None


class PlaceSearchOut(Schema):
    results: list[PlaceSearchResult] = []


class CompetitorRate(Schema):
    hotel_id: str
    hotel_name: str
    distance_km: Optional[float] = None
    star_rating: Optional[float] = None
    review_score: Optional[float] = None
    price: Optional[float] = None
    currency: str = ""
    is_user_property: bool = False


class RatesOut(Schema):
    property_id: UUID
    property_name: str
    checkin: str
    checkout: str
    nights: int
    currency: str
    user_rate: Optional[float] = None
    user_room_name: Optional[str] = None
    user_vs_avg_pct: Optional[float] = None
    competitors: list[CompetitorRate]
    fetched_at: datetime
    cached: bool = False


class AISummaryOut(Schema):
    positives: str
    problems: str
    review_count: int


class TopicScore(Schema):
    topic: str          # canonical key e.g. "cleanliness"
    label: str          # human label e.g. "Cleanliness"
    score: Optional[float] = None  # 0-10, null when there's not enough signal
    mentions: int = 0   # how many of the sampled reviews touched this topic
    note: str = ""      # short AI-generated insight (e.g. "consistently strong")
    priority: str = "low"  # "high" | "medium" | "low" — how urgently to act


class TopicScoresOut(Schema):
    review_count: int
    topics: list[TopicScore]
    cached: bool = False
