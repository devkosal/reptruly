"""Periodic sync tasks for the four data domains.

Each task:
  * marks SyncStatus as RUNNING when it starts,
  * delegates to a domain-specific worker function,
  * updates SyncStatus with SUCCESS / FAILED + timing on completion.

The reviews task wraps the existing per-property sync. The other three are
scaffolds — they record a successful "sync" timestamp so the UI and
schedules are wired up, ready for the real fetcher implementations.
"""

from __future__ import annotations

import time
from typing import Callable

from celery import shared_task
from celery.utils.log import get_task_logger
from django.utils import timezone

from reptruly.core.models import SyncStatus

logger = get_task_logger(__name__)


def _run_sync(domain: str, worker: Callable[[], int]) -> dict:
    """Run a worker fn, persist timing + outcome to SyncStatus, and return summary."""
    status, _ = SyncStatus.objects.get_or_create(domain=domain)
    started = timezone.now()
    started_ms = time.monotonic()
    status.status = SyncStatus.Status.RUNNING
    status.last_started_at = started
    status.last_error = ""
    status.save(update_fields=["status", "last_started_at", "last_error"])

    try:
        count = int(worker() or 0)
    except Exception as exc:
        elapsed_ms = int((time.monotonic() - started_ms) * 1000)
        status.status = SyncStatus.Status.FAILED
        status.last_synced_at = timezone.now()
        status.last_duration_ms = elapsed_ms
        status.last_error = f"{type(exc).__name__}: {exc}"[:2000]
        status.save(update_fields=[
            "status", "last_synced_at", "last_duration_ms", "last_error",
        ])
        logger.exception("Sync failed for domain=%s", domain)
        raise

    elapsed_ms = int((time.monotonic() - started_ms) * 1000)
    status.status = SyncStatus.Status.SUCCESS
    status.last_synced_at = timezone.now()
    status.last_duration_ms = elapsed_ms
    status.last_record_count = count
    status.last_error = ""
    status.save(update_fields=[
        "status", "last_synced_at", "last_duration_ms",
        "last_record_count", "last_error",
    ])
    logger.info("Sync OK domain=%s count=%d elapsed_ms=%d", domain, count, elapsed_ms)
    return {"domain": domain, "synced": count, "elapsed_ms": elapsed_ms}


# ---------- Domain workers ----------

def _do_reviews() -> int:
    """Refresh reviews from all connected OTAs for every Property."""
    from reptruly.reviews.models import Property
    from reptruly.reviews.tasks import _sync_property

    total = 0
    for prop in Property.objects.exclude(
        booking_hotel_id="", expedia_property_id="", google_place_id=""
    ):
        try:
            total += _sync_property(prop)
        except Exception:
            logger.exception("Sync failed for property %s", prop.id)
    return total


def _do_rates() -> int:
    """Refresh competitor rates. Stub — real fetcher to be implemented."""
    logger.info("Rates sync stub ran — no fetcher implemented yet.")
    return 0


def _do_calendar() -> int:
    """Refresh demand-calendar signals (events, holidays, weather).

    Stub — the `reptruly.events` app has API clients but no persistence
    model yet, so this only records the heartbeat for now.
    """
    logger.info("Calendar sync stub ran — no fetcher implemented yet.")
    return 0


def _do_analytics() -> int:
    """Recompute analytics aggregates. Stub for now."""
    logger.info("Analytics sync stub ran — no aggregator implemented yet.")
    return 0


# ---------- Celery entrypoints ----------

@shared_task(bind=True, max_retries=2)
def sync_reviews_daily(self):
    try:
        return _run_sync(SyncStatus.Domain.REVIEWS, _do_reviews)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


@shared_task(bind=True, max_retries=2)
def sync_rates_daily(self):
    try:
        return _run_sync(SyncStatus.Domain.RATES, _do_rates)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


@shared_task(bind=True, max_retries=2)
def sync_calendar_daily(self):
    try:
        return _run_sync(SyncStatus.Domain.CALENDAR, _do_calendar)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


@shared_task(bind=True, max_retries=2)
def sync_analytics_daily(self):
    try:
        return _run_sync(SyncStatus.Domain.ANALYTICS, _do_analytics)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


DOMAIN_TO_TASK = {
    SyncStatus.Domain.REVIEWS: sync_reviews_daily,
    SyncStatus.Domain.RATES: sync_rates_daily,
    SyncStatus.Domain.CALENDAR: sync_calendar_daily,
    SyncStatus.Domain.ANALYTICS: sync_analytics_daily,
}
