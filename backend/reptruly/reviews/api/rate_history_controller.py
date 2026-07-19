"""Rate history API — daily snapshots written by the rates sync.

Kept out of controllers.py so the history feature stays self-contained;
the heavy fetch/snapshot logic lives in reviews/rate_history.py.
"""
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from ninja import Schema
from ninja.errors import HttpError
from ninja.responses import codes_4xx, codes_5xx
from ninja_extra import api_controller, http_get

from reptruly.billing.entitlements import require_feature
from reptruly.core.common.schema import Message
from reptruly.reviews.models import Property, RateSnapshot

HISTORY_DAYS = 90


class RateSnapshotOut(Schema):
    snapshot_date: date
    checkin: date
    user_rate: Optional[float] = None
    comp_avg: Optional[float] = None
    comp_count: int
    currency: str


class RateHistoryOut(Schema):
    property_id: UUID
    snapshots: list[RateSnapshotOut]


@api_controller("/rates-history")
class RateHistoryAPI:

    @http_get("/{property_id}", response={200: RateHistoryOut, codes_4xx: Message, codes_5xx: Message})
    def get_rate_history(self, request, property_id: UUID):
        """Daily rate snapshots (you vs comp-set average) for the last 90 days."""
        if not request.user.is_authenticated:
            raise HttpError(401, "Not authenticated")
        require_feature(request.user, "rate_shopping")
        try:
            prop = Property.objects.get(id=property_id, user=request.user)
        except Property.DoesNotExist:
            return 404, {"message": "Property not found"}

        since = date.today() - timedelta(days=HISTORY_DAYS)
        snapshots = (
            RateSnapshot.objects.filter(property=prop, snapshot_date__gte=since)
            .order_by("snapshot_date", "checkin")
        )
        return 200, {"property_id": prop.id, "snapshots": list(snapshots)}
