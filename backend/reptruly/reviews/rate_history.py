"""Daily rate history snapshots + competitor rate-movement alerts.

The daily rates sync (core/sync_tasks.py, 03:15 UTC) calls run_rates_sync():
for every Pro property with a Booking.com ID it snapshots the property's rate
and comp-set average at three lookahead check-ins (+7/+14/+30 days), then
compares today's comp average against the most recent earlier snapshot and
emails owners (one email per user) when the comp set moved >= 10% either way.

Rate fetching goes through build_rates_data and its 24h cache, so a property
whose UI already pulled today's rates costs no extra upstream calls.
"""
import logging
from datetime import date, timedelta

from reptruly.billing.entitlements import get_plan
from reptruly.reviews.models import Property, RateSnapshot

logger = logging.getLogger(__name__)

# Lookahead check-in dates snapshotted each day, in days from today.
SNAPSHOT_OFFSETS = (7, 14, 30)

# Comp-set average must move by at least this much (either direction) between
# snapshots before we call it a movement worth alerting on.
MOVEMENT_PCT = 10.0


def snapshot_property_rates(prop: Property) -> int:
    """Write/update today's RateSnapshot rows for the property.

    One row per lookahead check-in (today+7/+14/+30, 1-night stay). Dates
    where the comp set can't be loaded are skipped. Returns rows written.
    """
    from reptruly.reviews.api.controllers import RatesUnavailable, build_rates_data

    today = date.today()
    written = 0
    for offset in SNAPSHOT_OFFSETS:
        checkin = today + timedelta(days=offset)
        try:
            rates = build_rates_data(prop, checkin, checkin + timedelta(days=1))
        except RatesUnavailable:
            logger.info(
                "Rates unavailable for property %s checkin %s — skipping snapshot",
                prop.id, checkin,
            )
            continue

        comp_prices = [
            c["price"] for c in rates.get("competitors", [])
            if c.get("price") is not None and not c.get("is_user_property")
        ]
        RateSnapshot.objects.update_or_create(
            property=prop,
            snapshot_date=today,
            checkin=checkin,
            defaults={
                "user_rate": rates.get("user_rate"),
                "comp_avg": round(sum(comp_prices) / len(comp_prices), 2) if comp_prices else None,
                "comp_count": len(comp_prices),
                "currency": rates.get("currency") or (prop.currency or "USD").upper(),
            },
        )
        written += 1
    return written


def detect_movements(prop: Property) -> list[dict]:
    """Comp-set moves >= MOVEMENT_PCT between today's snapshots and the most
    recent earlier snapshot of the same (property, checkin)."""
    today = date.today()
    movements: list[dict] = []
    for snap in RateSnapshot.objects.filter(property=prop, snapshot_date=today):
        if snap.comp_avg is None:
            continue
        previous = (
            RateSnapshot.objects.filter(
                property=prop,
                checkin=snap.checkin,
                snapshot_date__lt=today,
                comp_avg__isnull=False,
            )
            .order_by("-snapshot_date")
            .first()
        )
        if previous is None or not previous.comp_avg:
            continue
        pct = (snap.comp_avg - previous.comp_avg) / previous.comp_avg * 100
        if abs(pct) < MOVEMENT_PCT:
            continue
        movements.append({
            "property_name": prop.property_name,
            "checkin": snap.checkin.isoformat(),
            "old_avg": previous.comp_avg,
            "new_avg": snap.comp_avg,
            "pct": round(pct, 1),
            "user_rate": snap.user_rate,
            "currency": snap.currency or "USD",
        })
    movements.sort(key=lambda m: m["checkin"])
    return movements


def run_rates_sync() -> int:
    """The daily rates sync: snapshot every Pro property, then send one
    rate-movement email per owner covering all their properties.

    Returns total snapshots written (the SyncStatus record count).
    """
    from reptruly.users.emails import get_preferences, send_rate_movement_email

    total = 0
    movements_by_user: dict = {}
    for prop in Property.objects.exclude(booking_hotel_id="").select_related("user"):
        if not get_plan(prop.user).rate_shopping:
            continue  # rate shopping (and thus rate history) is a Pro feature
        try:
            total += snapshot_property_rates(prop)
            movements = detect_movements(prop)
        except Exception:
            logger.exception("Rate snapshot failed for property %s", prop.id)
            continue
        if movements:
            movements_by_user.setdefault(prop.user, []).extend(movements)

    for user, movements in movements_by_user.items():
        prefs = get_preferences(user)
        if not prefs.notify_rate_changes or not prefs.alert_recipient:
            continue
        movements.sort(key=lambda m: m["checkin"])
        send_rate_movement_email(user, prefs.alert_recipient, movements)

    logger.info(
        "Rates sync wrote %d snapshots; %d users had comp-set movements",
        total, len(movements_by_user),
    )
    return total
