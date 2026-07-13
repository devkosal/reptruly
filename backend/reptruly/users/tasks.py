"""User-facing scheduled emails. Registered in scripts/add_scheduled_tasks.py."""
import logging
from datetime import date, timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from config import celery_app
from reptruly.reviews.models import Property, Review
from reptruly.users.emails import (
    NEGATIVE_SCORE_MAX,
    send_daily_digest_email,
    send_monthly_report_email,
    send_weekly_summary_email,
)
from reptruly.users.models import Preferences

User = get_user_model()
logger = logging.getLogger(__name__)


@celery_app.task()
def get_users_count():
    """A pointless Celery task to demonstrate usage."""
    return User.objects.count()


def _property_ids(prop: Property) -> list[str]:
    return [
        pid
        for pid in (prop.booking_hotel_id, prop.expedia_property_id, prop.google_place_id)
        if pid
    ]


def _review_stats(properties, since) -> dict:
    """Aggregate reviews ingested (created_at) after ``since`` per property.

    Keyed on ingestion time, not the guest's review date, so backfilling an
    old review history onto a newly connected property doesn't flood the
    digest beyond what actually arrived in the window.
    """
    per_property = []
    all_scores: list[float] = []
    total = negatives = replied = 0
    by_ota: dict[str, int] = {}
    for prop in properties:
        ids = _property_ids(prop)
        if not ids:
            continue
        reviews = list(
            Review.objects.filter(property_id__in=ids, created_at__gte=since)
        )
        scores = [r.overall_score for r in reviews if r.overall_score is not None]
        neg = sum(1 for s in scores if s <= NEGATIVE_SCORE_MAX)
        for r in reviews:
            if r.ota_name:
                by_ota[r.ota_name] = by_ota.get(r.ota_name, 0) + 1
            if r.has_reply:
                replied += 1
        per_property.append({
            "name": prop.property_name,
            "count": len(reviews),
            "avg": round(sum(scores) / len(scores), 1) if scores else 0,
            "negatives": neg,
        })
        total += len(reviews)
        negatives += neg
        all_scores.extend(scores)
    return {
        "properties": per_property,
        "total": total,
        "negatives": negatives,
        "avg": round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
        "by_ota": by_ota,
        "reply_rate": round(100 * replied / total) if total else 0,
        "property_count": len(per_property),
    }


def _opted_in(flag: str):
    """Preferences rows with ``flag`` on, whose user has a reachable address."""
    return Preferences.objects.filter(**{flag: True}).select_related("user")


@celery_app.task()
def send_daily_digests():
    """Email opted-in users a digest of reviews ingested in the last 24h.

    Quiet days (zero new reviews) send nothing.
    """
    since = timezone.now() - timedelta(hours=24)
    sent = 0
    for prefs in _opted_in("notify_daily_digest"):
        user = prefs.user
        if not prefs.alert_recipient:
            continue
        properties = list(user.properties.all())
        if not properties:
            continue
        stats = _review_stats(properties, since)
        if not stats["total"]:
            continue
        send_daily_digest_email(user, prefs.alert_recipient, stats)
        sent += 1
    logger.info("Daily digests sent: %d", sent)
    return {"sent": sent}


def _previous_month_window(today: date) -> tuple[date, date, str]:
    """(first day, last day, human label) of the previous calendar month."""
    last_of_prev = today.replace(day=1) - timedelta(days=1)
    first_of_prev = last_of_prev.replace(day=1)
    return first_of_prev, last_of_prev, last_of_prev.strftime("%B %Y")


def _monthly_property_stats(prop: Property, start: date, end: date) -> dict:
    """Last month's numbers keyed on the guest-facing review date, matching
    the from/to filters of the linked report page."""
    ids = [
        pid
        for pid in (prop.booking_hotel_id, prop.expedia_property_id, prop.google_place_id)
        if pid
    ]
    reviews = list(
        Review.objects.filter(
            property_id__in=ids,
            reviewed_at__date__gte=start,
            reviewed_at__date__lte=end,
        )
    ) if ids else []
    scores = [r.overall_score for r in reviews if r.overall_score is not None]
    total = len(reviews)
    return {
        "name": prop.property_name,
        "total": total,
        "avg": round(sum(scores) / len(scores), 1) if scores else 0,
        "negatives": sum(1 for s in scores if s <= NEGATIVE_SCORE_MAX),
        "reply_rate": round(100 * sum(1 for r in reviews if r.has_reply) / total) if total else 0,
        "report_url": (
            f"{settings.DOMAIN_NAME}/analytics/report"
            f"?from={start.isoformat()}&to={end.isoformat()}"
            f"&property={quote(prop.property_name)}"
        ),
    }


@celery_app.task()
def send_monthly_reports():
    """First of the month: email opted-in owners last month's per-property
    report with deep links to the printable version."""
    start, end, label = _previous_month_window(timezone.now().date())
    sent = 0
    for prefs in _opted_in("notify_monthly_report"):
        user = prefs.user
        if not prefs.alert_recipient:
            continue
        properties = list(user.properties.all())
        if not properties:
            continue
        stats = [_monthly_property_stats(p, start, end) for p in properties]
        send_monthly_report_email(user, prefs.alert_recipient, label, stats)
        sent += 1
    logger.info("Monthly reports sent: %d", sent)
    return {"sent": sent}


@celery_app.task()
def send_weekly_summaries():
    """Monday recap of the previous 7 days for opted-in users with properties."""
    since = timezone.now() - timedelta(days=7)
    sent = 0
    for prefs in _opted_in("notify_weekly_summary"):
        user = prefs.user
        if not prefs.alert_recipient:
            continue
        properties = list(user.properties.all())
        if not properties:
            continue
        stats = _review_stats(properties, since)
        send_weekly_summary_email(user, prefs.alert_recipient, stats)
        sent += 1
    logger.info("Weekly summaries sent: %d", sent)
    return {"sent": sent}
