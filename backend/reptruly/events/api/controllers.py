from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from ninja.errors import HttpError
from ninja.responses import codes_4xx, codes_5xx
from ninja_extra import api_controller, http_get

from reptruly.core.common.schema import Message
from reptruly.core.common.utils import get_logger
from reptruly.events.calendar import CalendarUnavailable, get_calendar_data
from reptruly.reviews.models import Property

from .schema import CalendarOut

logger = get_logger()


def _require_user(request):
    if not request.user.is_authenticated:
        raise HttpError(401, "Not authenticated")
    return request.user


@api_controller("/calendar", tags=["Calendar"], auth=None)
class CalendarAPI:

    @http_get("/{property_id}", response={200: CalendarOut, codes_4xx: Message, codes_5xx: Message})
    def get_calendar(
        self,
        request,
        property_id: UUID,
        days: int = 60,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        radius_miles: int = 25,
        force_refresh: bool = False,
    ):
        """Return per-day overlays (events, weather, holidays, demand score).

        If start_date/end_date are provided, returns that explicit window (clamped to
        [today, today + 365 days]). Otherwise returns the next `days` days from today.
        """
        user = _require_user(request)
        try:
            prop = Property.objects.get(id=property_id, user=user)
        except Property.DoesNotExist:
            return 404, {"message": "Property not found"}

        today = date.today()
        max_end = today + timedelta(days=365)

        if start_date or end_date:
            try:
                start = date.fromisoformat(start_date) if start_date else today
                end = date.fromisoformat(end_date) if end_date else start + timedelta(days=29)
            except ValueError:
                return 400, {"message": "start_date/end_date must be YYYY-MM-DD"}
            # Clamp: never fetch past data, never beyond +365.
            if start < today:
                start = today
            if end > max_end:
                end = max_end
            if end < start:
                return 400, {"message": "end_date must be on or after start_date"}
        else:
            days = max(1, min(days, 365))
            start = today
            end = start + timedelta(days=days - 1)

        try:
            result = get_calendar_data(prop, start, end, radius_miles, force_refresh)
        except CalendarUnavailable as exc:
            return 502, {"message": str(exc)}
        return 200, result
