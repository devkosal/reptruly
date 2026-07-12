from datetime import datetime
from typing import Optional
from uuid import UUID

from ninja import Schema


class CalendarEvent(Schema):
    name: str
    date: str
    start_time: Optional[str] = None
    venue: str = ""
    venue_distance_miles: Optional[float] = None
    classification: str = ""
    url: Optional[str] = None
    impact_score: int = 0  # 0=local, 1=regional, 2=major, 3=destination
    impact_label: str = ""
    impact_emoji: str = ""


class CalendarDay(Schema):
    date: str
    is_weekend: bool
    holiday: Optional[str] = None
    events: list[CalendarEvent]
    event_count: int
    weather_temp_high: Optional[float] = None
    weather_temp_low: Optional[float] = None
    weather_summary: str = ""
    weather_emoji: str = ""
    precip_in: Optional[float] = None
    demand_score: int  # 0-5 (0 = quiet, 5 = very high demand expected)


class CalendarOut(Schema):
    property_id: UUID
    property_name: str
    start_date: str
    end_date: str
    radius_miles: int
    ticketmaster_configured: bool
    days: list[CalendarDay]
    fetched_at: datetime
    cached: bool = False
