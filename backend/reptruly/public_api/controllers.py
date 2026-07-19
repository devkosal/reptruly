"""Public read API (key-authenticated) + session-authenticated key management.

Two controllers:

* KeysAPI    — /keys — session auth (same `request.user.is_authenticated`
               pattern as the rest of the app). Create / list / revoke keys.
* PublicAPI  — /v1   — authenticated via `X-API-Key: <prefix>.<key>`
               (ninja_apikey.security.APIKeyAuth). Read-only endpoints scoped
               to the key owner's properties.

Entitlements note: the public API is positioned as a Group-tier feature, but
for now ANY authenticated key holder is allowed. When gating lands, check
`reptruly.billing.entitlements.get_plan(user)` in PublicAPI endpoints.
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from django.db.models import Avg, Count, Q
from ninja import Schema
from ninja.errors import HttpError
from ninja_apikey.security import APIKeyAuth
from ninja_extra import api_controller, http_delete, http_get, http_post

from reptruly.reviews.models import Property, Review

MAX_PAGE_LIMIT = 100
DEFAULT_PAGE_LIMIT = 50


# ---------------------------------------------------------------------------
# Scoping helpers
# ---------------------------------------------------------------------------

def _property_channel_ids(prop: Property) -> list[str]:
    """The OTA-level ids reviews are stored under for one property."""
    return [
        i
        for i in (prop.booking_hotel_id, prop.expedia_property_id, prop.google_place_id)
        if i
    ]


def _user_review_qs(user):
    """Scope reviews to `user`'s connected properties.

    Mirrors the session API: a property may have a Booking ID, an Expedia ID,
    and/or a Google Place ID — reviews are stored under any of them.
    """
    if not user or not user.is_authenticated:
        return Review.objects.none()
    ids: set[str] = set()
    for prop in Property.objects.filter(user=user):
        ids.update(_property_channel_ids(prop))
    return Review.objects.filter(property_id__in=list(ids))


def _resolve_property(user, property_id: UUID) -> Property:
    try:
        return Property.objects.get(id=property_id, user=user)
    except Property.DoesNotExist:
        raise HttpError(404, "Property not found")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class KeyCreateIn(Schema):
    label: str


class KeyCreatedOut(Schema):
    key: str  # full plaintext key — returned exactly once
    prefix: str
    label: str


class KeyOut(Schema):
    prefix: str
    label: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    revoked: bool


class MessageOut(Schema):
    message: str


class PublicPropertyOut(Schema):
    id: UUID
    name: str
    location: str
    channels: list[str]
    created_at: datetime


class PublicReviewOut(Schema):
    id: UUID
    property_name: str
    ota_name: str
    reviewer_name: str
    content: str
    score: Optional[float] = None
    has_reply: bool
    reply: str
    reviewed_at: Optional[datetime] = None
    tags: list


class PublicReviewListOut(Schema):
    data: list[PublicReviewOut]
    total: int
    page: int
    limit: int


class PublicAnalyticsOut(Schema):
    total_reviews: int
    avg_score: Optional[float] = None
    replied: int
    pending_reply: int
    by_ota: dict[str, int]


# ---------------------------------------------------------------------------
# /keys — session-authenticated key management
# ---------------------------------------------------------------------------

@api_controller("/keys", tags=["API keys"], auth=None)
class KeysAPI:

    @staticmethod
    def _require_user(request):
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        return request.user

    @http_get("", response={200: list[KeyOut]})
    def list_keys(self, request):
        """List the caller's API keys (prefixes only — secrets are never stored)."""
        from .keys import list_api_keys

        user = self._require_user(request)
        return 200, list_api_keys(user)

    @http_post("", response={200: KeyCreatedOut, 400: MessageOut})
    def create_key(self, request, payload: KeyCreateIn):
        """Create an API key. The full key is returned ONCE — store it safely."""
        from .keys import create_api_key

        user = self._require_user(request)
        label = (payload.label or "").strip()
        if not label:
            return 400, {"message": "Label is required"}
        full_key = create_api_key(user, label)
        prefix = full_key.split(".", 1)[0]
        return 200, {"key": full_key, "prefix": prefix, "label": label[:40]}

    @http_delete("/{prefix}", response={200: MessageOut, 404: MessageOut})
    def revoke_key(self, request, prefix: str):
        """Revoke an API key by its prefix. Revocation is immediate."""
        from .keys import revoke_api_key

        user = self._require_user(request)
        if not revoke_api_key(user, prefix):
            return 404, {"message": "API key not found"}
        return 200, {"message": "API key revoked"}


# ---------------------------------------------------------------------------
# /v1 — key-authenticated public read API
# ---------------------------------------------------------------------------

@api_controller("/v1", tags=["Public API"], auth=APIKeyAuth())
class PublicAPI:
    """Read-only API authenticated with `X-API-Key: <prefix>.<key>`.

    APIKeyAuth resolves the key to its owning user, assigns it to
    `request.user`, and stores it on `request.auth`; bad, revoked, or expired
    keys are rejected with 401 before the endpoint runs.
    """

    @http_get("/properties", response={200: list[PublicPropertyOut]})
    def list_properties(self, request):
        """List the key owner's connected properties."""
        out = []
        for prop in Property.objects.filter(user=request.user):
            channels = []
            if prop.booking_hotel_id:
                channels.append("booking")
            if prop.expedia_property_id:
                channels.append("expedia")
            if prop.google_place_id:
                channels.append("google")
            out.append(
                {
                    "id": prop.id,
                    "name": prop.property_name,
                    "location": prop.location,
                    "channels": channels,
                    "created_at": prop.created_at,
                }
            )
        return 200, out

    @http_get("/reviews", response={200: PublicReviewListOut})
    def list_reviews(
        self,
        request,
        property_id: Optional[UUID] = None,
        ota_name: Optional[str] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        page: int = 1,
        limit: int = DEFAULT_PAGE_LIMIT,
    ):
        """List reviews for the key owner's properties, newest first.

        `property_id` is the property UUID from /v1/properties.
        """
        page = max(page, 1)
        limit = max(1, min(limit, MAX_PAGE_LIMIT))

        qs = _user_review_qs(request.user)
        if property_id is not None:
            prop = _resolve_property(request.user, property_id)
            qs = qs.filter(property_id__in=_property_channel_ids(prop))
        if ota_name:
            qs = qs.filter(ota_name__iexact=ota_name)
        if min_score is not None:
            qs = qs.filter(overall_score__gte=min_score)
        if max_score is not None:
            qs = qs.filter(overall_score__lte=max_score)
        if from_date is not None:
            qs = qs.filter(reviewed_at__date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(reviewed_at__date__lte=to_date)

        total = qs.count()
        offset = (page - 1) * limit
        data = [
            {
                "id": r.id,
                "property_name": r.property_name,
                "ota_name": r.ota_name,
                "reviewer_name": r.reviewer_name,
                "content": r.content,
                "score": r.overall_score,
                "has_reply": r.has_reply,
                "reply": r.reply,
                "reviewed_at": r.reviewed_at,
                "tags": r.tags,
            }
            for r in qs[offset : offset + limit]
        ]
        return 200, {"data": data, "total": total, "page": page, "limit": limit}

    @http_get("/analytics/summary", response={200: PublicAnalyticsOut})
    def analytics_summary(self, request, property_id: Optional[UUID] = None):
        """Aggregate review stats for the key owner (optionally one property)."""
        qs = _user_review_qs(request.user)
        if property_id is not None:
            prop = _resolve_property(request.user, property_id)
            qs = qs.filter(property_id__in=_property_channel_ids(prop))

        agg = qs.aggregate(
            total=Count("id"),
            avg_score=Avg("overall_score"),
            replied=Count("id", filter=Q(has_reply=True)),
            pending=Count("id", filter=Q(has_reply=False)),
        )
        by_ota = {
            row["ota_name"]: row["c"]
            for row in qs.exclude(ota_name="").values("ota_name").annotate(c=Count("id"))
        }
        avg = agg["avg_score"]
        return 200, {
            "total_reviews": agg["total"] or 0,
            "avg_score": round(avg, 2) if avg is not None else None,
            "replied": agg["replied"] or 0,
            "pending_reply": agg["pending"] or 0,
            "by_ota": by_ota,
        }
