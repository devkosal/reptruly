import logging
from datetime import timezone as dt_timezone

from celery import shared_task
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from reptruly.reviews.channex.client import ChannexClient
from reptruly.reviews.expedia.client import ExpediaClient, ExpediaNotSubscribedError, normalize_expedia_review
from reptruly.reviews.google.client import GoogleNotConfiguredError, GooglePlacesClient, normalize_google_review
from reptruly.reviews.models import Property, Review
from reptruly.reviews.rapidapi.client import BookingComClient
from reptruly.users.emails import NEGATIVE_SCORE_MAX, send_negative_review_alert

logger = logging.getLogger(__name__)

# Max newly-created reviews auto-tagged per _collect_upserts run (cost control).
AUTO_TAG_CAP_PER_SYNC = 60


def _is_negative(review: Review) -> bool:
    return review.overall_score is not None and review.overall_score <= NEGATIVE_SCORE_MAX


@shared_task(bind=True, max_retries=3)
def sync_reviews_from_channex(self, ota_name: str = "Booking.com"):
    """Legacy Channex sync. Kept for completeness but no longer triggered from the UI."""
    try:
        client = ChannexClient()
        filters = {"ota_name": ota_name} if ota_name else {}
        raw_reviews = client.fetch_all_reviews(**filters)

        synced = 0
        for item in raw_reviews:
            channex_id = item.get("id")
            attrs = item.get("attributes", {})

            if not channex_id:
                continue

            reviewed_at = None
            raw_date = attrs.get("inserted_at") or attrs.get("created_at")
            if raw_date:
                reviewed_at = parse_datetime(raw_date)

            Review.objects.update_or_create(
                channex_id=channex_id,
                defaults={
                    "property_id": attrs.get("property_id", ""),
                    "property_name": attrs.get("property_name", ""),
                    "ota_name": attrs.get("ota_name", ""),
                    "reservation_id": attrs.get("reservation_id", ""),
                    "content": attrs.get("content", ""),
                    "overall_score": attrs.get("overall_score"),
                    "has_reply": attrs.get("has_reply", False),
                    "reply": attrs.get("reply", "") or "",
                    "is_pending": attrs.get("is_pending", False),
                    "scores": attrs.get("scores", []),
                    "tags": attrs.get("tags", []),
                    "reviewed_at": reviewed_at,
                    "raw_data": item,
                },
            )
            synced += 1

        logger.info("Channex sync complete: %d reviews upserted", synced)
        return {"synced": synced}

    except Exception as exc:
        logger.error("Channex sync failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)


def _upsert_booking_review(item: dict, property_obj: Property) -> tuple[Review, bool] | None:
    review_id = str(item.get("review_id", "") or item.get("review_hash", ""))
    if not review_id:
        return None

    # Prefer the review post date ("date") over the stay's check-in date —
    # they often differ by several days and the post date is what users
    # see on Booking.com. The API returns naive datetimes; treat as UTC.
    post_date = item.get("date")
    reviewed_at = parse_datetime(post_date) if post_date else None
    if reviewed_at is None:
        checkin = item.get("stayed_room_info", {}).get("checkin")
        reviewed_at = parse_datetime(checkin) if checkin else None
    if reviewed_at is not None and timezone.is_naive(reviewed_at):
        reviewed_at = timezone.make_aware(reviewed_at, dt_timezone.utc)

    pros = item.get("pros", "") or item.get("pros_translated", "") or ""
    cons = item.get("cons", "") or item.get("cons_translated", "") or ""
    content = f"{pros}\n{cons}".strip()

    raw_score = item.get("average_score")
    # API returns scores on 0-4 scale; Booking.com displays 0-10
    score = min(round(float(raw_score) * 2.5, 1), 10.0) if raw_score is not None else None

    author = item.get("author") or {}
    reviewer_name = author.get("name", "") if isinstance(author, dict) else ""

    return Review.objects.update_or_create(
        channex_id=f"booking_{review_id}",
        defaults={
            "property_id": property_obj.booking_hotel_id,
            "property_name": property_obj.property_name,
            "location": property_obj.location,
            "ota_name": "Booking.com",
            "reservation_id": str(item.get("stayed_room_info", {}).get("room_id", "")),
            "reviewer_name": reviewer_name,
            "content": content,
            "overall_score": score,
            "has_reply": bool(item.get("hotelier_response")),
            "reply": item.get("hotelier_response", "") or "",
            "is_pending": False,
            "scores": [],
            "tags": [],
            "reviewed_at": reviewed_at,
            "raw_data": item,
        },
    )


def _upsert_expedia_review(raw: dict, property_obj: Property) -> tuple[Review, bool] | None:
    norm = normalize_expedia_review(raw)
    if not norm:
        return None
    reviewed_at = norm["reviewed_at"]
    if isinstance(reviewed_at, str):
        reviewed_at = parse_datetime(reviewed_at)

    return Review.objects.update_or_create(
        channex_id=f"expedia_{norm['external_id']}",
        defaults={
            "property_id": property_obj.expedia_property_id,
            "property_name": property_obj.property_name,
            "location": property_obj.location,
            "ota_name": "Expedia",
            "reservation_id": "",
            "reviewer_name": norm["reviewer_name"],
            "content": norm["content"],
            "overall_score": norm["overall_score"],
            "has_reply": norm["has_reply"],
            "reply": norm["reply"],
            "is_pending": False,
            "scores": [],
            "tags": [],
            "reviewed_at": reviewed_at,
            "raw_data": norm["raw_data"],
        },
    )


def _collect_upserts(raw_reviews, upsert, property_obj: Property) -> tuple[int, list[Review]]:
    """Run ``upsert`` over raw payloads; count successes, gather brand-new
    negative reviews for the alert email, and stamp reply-SLA transitions."""
    ids = [
        pid
        for pid in (
            property_obj.booking_hotel_id,
            property_obj.expedia_property_id,
            property_obj.google_place_id,
        )
        if pid
    ]
    # Prior reply state, so we can detect has_reply flipping False -> True
    # during this sync (reply-SLA data). One query per property per run.
    prior_replies = (
        dict(Review.objects.filter(property_id__in=ids).values_list("channex_id", "has_reply"))
        if ids
        else {}
    )
    now = timezone.now()
    synced = 0
    new_negatives: list[Review] = []
    created_with_content: list[Review] = []
    for item in raw_reviews:
        result = upsert(item, property_obj)
        if result is None:
            continue
        synced += 1
        review, created = result
        if created and _is_negative(review):
            new_negatives.append(review)
        if created and (review.content or "").strip():
            created_with_content.append(review)
        if (
            not created
            and review.has_reply
            and prior_replies.get(review.channex_id) is False
            and review.reply_detected_at is None
        ):
            review.reply_detected_at = now
            review.save(update_fields=["reply_detected_at"])

    # Auto-tag brand-new reviews (fixed taxonomy, gpt-4o-mini). Capped per sync
    # run so nightly syncs stay cheap; best-effort — a tagging failure must
    # never fail the sync itself.
    if created_with_content:
        to_tag = created_with_content[:AUTO_TAG_CAP_PER_SYNC]
        skipped = len(created_with_content) - len(to_tag)
        if skipped:
            logger.info(
                "Auto-tagging capped at %d reviews for %s; %d new reviews skipped",
                AUTO_TAG_CAP_PER_SYNC,
                property_obj.property_name,
                skipped,
            )
        try:
            from reptruly.reviews.tagging import classify_reviews  # local import: avoids cycles

            classify_reviews(to_tag)
        except Exception as exc:
            logger.warning("Auto-tagging failed during sync: %s", exc)

        # Pre-generate AI reply drafts for the new reviews (Pro plans with
        # auto-suggest on; capped inside). Same contract as tagging:
        # best-effort — a drafting failure must never fail the sync itself.
        try:
            from reptruly.reviews.reply_drafts import pregenerate_drafts  # local import: avoids cycles

            pregenerate_drafts(created_with_content, property_obj)
        except Exception as exc:
            logger.warning("Draft pre-generation failed during sync: %s", exc)
    return synced, new_negatives


def _sync_booking_reviews(property_obj: Property) -> tuple[int, list[Review]]:
    if not property_obj.booking_hotel_id:
        return 0, []
    # Build the set of review IDs already in our DB so the client can early-break
    # on the first page where every review is already known.
    known_ids = {
        # We store as f"booking_{review_id}"; strip the prefix to compare.
        cid.split("_", 1)[1] if cid.startswith("booking_") else cid
        for cid in Review.objects.filter(
            property_id=property_obj.booking_hotel_id, ota_name="Booking.com"
        ).values_list("channex_id", flat=True)
    }
    raw_reviews = BookingComClient().fetch_all_reviews(
        hotel_id=int(property_obj.booking_hotel_id),
        known_ids=known_ids,
    )
    synced, new_negatives = _collect_upserts(raw_reviews, _upsert_booking_review, property_obj)
    logger.info(
        "Booking sync for %s (%s): %d reviews fetched (incremental from %d known)",
        property_obj.property_name,
        property_obj.booking_hotel_id,
        synced,
        len(known_ids),
    )
    return synced, new_negatives


def _sync_expedia_reviews(property_obj: Property) -> tuple[int, list[Review]]:
    if not property_obj.expedia_property_id:
        return 0, []
    known_ids = {
        cid.split("_", 1)[1] if cid.startswith("expedia_") else cid
        for cid in Review.objects.filter(
            property_id=property_obj.expedia_property_id, ota_name="Expedia"
        ).values_list("channex_id", flat=True)
    }
    try:
        raw_reviews = ExpediaClient().fetch_all_reviews(
            property_obj.expedia_property_id,
            known_ids=known_ids,
        )
    except ExpediaNotSubscribedError as exc:
        logger.warning(
            "Skipping Expedia sync for %s: %s", property_obj.property_name, exc
        )
        return 0, []
    synced, new_negatives = _collect_upserts(raw_reviews, _upsert_expedia_review, property_obj)
    logger.info(
        "Expedia sync for %s (%s): %d reviews fetched (incremental from %d known)",
        property_obj.property_name,
        property_obj.expedia_property_id,
        synced,
        len(known_ids),
    )
    return synced, new_negatives


def _upsert_google_review(raw: dict, property_obj: Property) -> tuple[Review, bool] | None:
    norm = normalize_google_review(raw)
    if not norm:
        return None
    reviewed_at = norm["reviewed_at"]
    if isinstance(reviewed_at, str):
        reviewed_at = parse_datetime(reviewed_at)

    return Review.objects.update_or_create(
        channex_id=f"google_{norm['external_id']}",
        defaults={
            "property_id": property_obj.google_place_id,
            "property_name": property_obj.property_name,
            "location": property_obj.location,
            "ota_name": "Google",
            "reservation_id": "",
            "reviewer_name": norm["reviewer_name"],
            "content": norm["content"],
            "overall_score": norm["overall_score"],
            "has_reply": norm["has_reply"],
            "reply": norm["reply"],
            "is_pending": False,
            "scores": [],
            "tags": [],
            "reviewed_at": reviewed_at,
            "raw_data": norm["raw_data"],
        },
    )


def _sync_google_reviews(property_obj: Property) -> tuple[int, list[Review]]:
    if not property_obj.google_place_id:
        return 0, []
    client = GooglePlacesClient()
    if not client.is_configured():
        logger.info(
            "Skipping Google sync for %s — GOOGLE_PLACES_API_KEY not set.",
            property_obj.property_name,
        )
        return 0, []
    try:
        raw_reviews = client.fetch_all_reviews(property_obj.google_place_id)
    except GoogleNotConfiguredError:
        return 0, []
    except Exception as exc:
        logger.warning("Google sync failed for %s: %s", property_obj.property_name, exc)
        return 0, []
    synced, new_negatives = _collect_upserts(raw_reviews, _upsert_google_review, property_obj)
    logger.info(
        "Google sync for %s (%s): %d reviews upserted",
        property_obj.property_name,
        property_obj.google_place_id,
        synced,
    )
    return synced, new_negatives


def _sync_property(property_obj: Property) -> int:
    """Sync reviews from every OTA the property has connected. Returns total upserts."""
    total = 0
    new_negatives: list[Review] = []
    for sync in (_sync_booking_reviews, _sync_expedia_reviews, _sync_google_reviews):
        synced, negatives = sync(property_obj)
        total += synced
        new_negatives.extend(negatives)
    property_obj.last_synced_at = timezone.now()
    property_obj.save(update_fields=["last_synced_at", "updated_at"])
    send_negative_review_alert(property_obj, new_negatives)
    return total


@shared_task(bind=True, max_retries=3)
def sync_reviews_for_property(self, property_id: str):
    """Sync reviews for a single Property (used when a user adds a property)."""
    try:
        property_obj = Property.objects.get(id=property_id)
    except Property.DoesNotExist:
        logger.warning("sync_reviews_for_property: property %s not found", property_id)
        return {"synced": 0}
    try:
        return {"synced": _sync_property(property_obj)}
    except Exception as exc:
        logger.error("Booking sync failed for property %s: %s", property_id, exc)
        raise self.retry(exc=exc, countdown=60)


@shared_task()
def send_rate_opportunity_alerts():
    """Daily: email Pro users when high-demand dates are priced below market.

    Implementation lives in reviews/rate_alerts.py; registered here so celery
    autodiscovery picks it up.
    """
    from reptruly.reviews.rate_alerts import send_rate_opportunity_alerts as run

    return run()


@shared_task(bind=True, max_retries=3)
def sync_reviews_from_booking(self):
    """Periodically refresh reviews from every OTA on every connected Property.

    Despite the name, this task syncs Booking.com AND Expedia (when the property
    has those IDs set). Renaming the task is avoided because the celery-beat
    schedule references it by dotted path.
    """
    from reptruly.billing.entitlements import EXPIRED, get_plan

    total_synced = 0
    for prop in Property.objects.exclude(booking_hotel_id="", expedia_property_id="", google_place_id="").select_related("user"):
        if get_plan(prop.user) is EXPIRED:
            continue  # Starter trial lapsed without upgrading — stop burning API credits
        try:
            total_synced += _sync_property(prop)
        except Exception as exc:
            logger.error("Periodic sync failed for property %s: %s", prop.id, exc)
    logger.info("Periodic sync complete: %d reviews upserted across all OTAs", total_synced)
    return {"synced": total_synced}
