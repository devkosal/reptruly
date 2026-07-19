import logging
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from django.core.cache import cache
from django.db.models import Avg, Count, F, Q
from django.utils import timezone
from ninja.errors import HttpError
from ninja.responses import codes_4xx, codes_5xx
from ninja_extra import api_controller, http_delete, http_get, http_patch, http_post

from reptruly.billing.entitlements import (
    OTA_EXPEDIA,
    OTA_GOOGLE,
    get_plan,
    require_feature,
    upgrade_required,
)
from reptruly.billing.quantity import sync_subscription_quantity
from reptruly.core.common.schema import Message
from reptruly.core.common.utils import get_logger
from reptruly.reviews.models import Property, Review
from reptruly.reviews.expedia.client import ExpediaClient, ExpediaNotSubscribedError
from reptruly.reviews.google.client import extract_google_place_id, fetch_place_geo, search_places
from reptruly.reviews.rapidapi.client import (
    BookingComClient,
    extract_booking_hotel_id,
    extract_expedia_input,
)
from reptruly.reviews.tasks import _sync_property

from .schema import (
    AISummaryOut,
    AnalyticsOut,
    DraftReplyIn,
    DraftReplyOut,
    PlaceSearchOut,
    PropertyCreateIn,
    PropertyOut,
    PropertyUpdateIn,
    RatesOut,
    ReviewListOut,
    ReviewOut,
    TopicScoresOut,
    TrendsOut,
    TriageSummaryOut,
)

logger = get_logger()


def _user_review_qs(request):
    """Scope reviews to the logged-in user's connected properties.

    A property may have a Booking ID, an Expedia ID, or both — we need to include
    reviews stored under either. Anonymous users get nothing (would otherwise leak
    data across users).
    """
    if not request.user.is_authenticated:
        return Review.objects.none()
    props = Property.objects.filter(user=request.user)
    ids = set()
    for booking_id, expedia_id, google_id in props.values_list(
        "booking_hotel_id", "expedia_property_id", "google_place_id"
    ):
        if booking_id:
            ids.add(booking_id)
        if expedia_id:
            ids.add(expedia_id)
        if google_id:
            ids.add(google_id)
    return Review.objects.filter(property_id__in=list(ids))


def _require_user(request):
    if not request.user.is_authenticated:
        raise HttpError(401, "Not authenticated")
    return request.user


@api_controller("/reviews", tags=["Reviews"], auth=None)
class ReviewsAPI:

    @staticmethod
    def _apply_filters(
        qs,
        search=None,
        property_id=None,
        property_name=None,
        has_reply=None,
        min_score=None,
        max_score=None,
        from_date=None,
        to_date=None,
        tag=None,
    ):
        if search:
            qs = qs.filter(content__icontains=search)
        if property_id:
            qs = qs.filter(property_id=property_id)
        if property_name:
            qs = qs.filter(property_name=property_name)
        if has_reply is not None:
            qs = qs.filter(has_reply=has_reply)
        if min_score is not None:
            qs = qs.filter(overall_score__gte=min_score)
        if max_score is not None:
            qs = qs.filter(overall_score__lte=max_score)
        if from_date is not None:
            qs = qs.filter(reviewed_at__date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(reviewed_at__date__lte=to_date)
        if tag:
            # tags is a JSON list; __contains=[tag] matches membership.
            qs = qs.filter(tags__contains=[tag])
        return qs

    @http_get("", response={200: ReviewListOut})
    def list_reviews(
        self,
        request,
        page: int = 1,
        limit: int = 20,
        ota_name: Optional[str] = None,
        property_id: Optional[str] = None,
        property_name: Optional[str] = None,
        has_reply: Optional[bool] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        search: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        tag: Optional[str] = None,
        ordering: str = "newest",
    ):
        """List reviews stored locally, with optional filters.

        ordering: newest (default) | oldest | lowest | highest — score orders
        put unscored reviews last and break ties newest-first.
        """
        qs = self._apply_filters(
            _user_review_qs(request),
            search=search,
            property_id=property_id,
            property_name=property_name,
            has_reply=has_reply,
            min_score=min_score,
            max_score=max_score,
            from_date=from_date,
            to_date=to_date,
            tag=tag,
        )

        if ordering == "oldest":
            qs = qs.order_by("reviewed_at", "created_at")
        elif ordering == "lowest":
            qs = qs.order_by(F("overall_score").asc(nulls_last=True), "-reviewed_at")
        elif ordering == "highest":
            qs = qs.order_by(F("overall_score").desc(nulls_last=True), "-reviewed_at")
        else:
            qs = qs.order_by("-reviewed_at", "-created_at")

        # Per-OTA counts reflect every filter EXCEPT the OTA selection, so chips stay
        # clickable and show how many reviews each source has in the current scope.
        # order_by() clears the list ordering — its fields would otherwise join the
        # GROUP BY and splinter the counts into one row per review.
        ota_counts = {
            row["ota_name"]: row["c"]
            for row in qs.order_by().values("ota_name").annotate(c=Count("id"))
            if row["ota_name"]
        }

        if ota_name:
            qs = qs.filter(ota_name__iexact=ota_name)

        total = qs.count()
        offset = (page - 1) * limit
        reviews = qs[offset : offset + limit]

        return 200, {
            "data": list(reviews),
            "total": total,
            "page": page,
            "limit": limit,
            "ota_counts": ota_counts,
        }

    @http_get("/triage/summary", response={200: TriageSummaryOut})
    def triage_summary(self, request, property_name: Optional[str] = None):
        """Counts behind the inbox triage preset chips, scoped to one property or all."""
        qs = _user_review_qs(request)
        if property_name:
            qs = qs.filter(property_name=property_name)
        unanswered = qs.filter(has_reply=False)
        week_ago = timezone.now() - timedelta(days=7)
        return 200, {
            "unanswered_total": unanswered.count(),
            "negative_unanswered": unanswered.filter(overall_score__lte=6).count(),
            "recent_unanswered": unanswered.filter(reviewed_at__gte=week_ago).count(),
            "positive_unthanked": unanswered.filter(overall_score__gte=9).count(),
        }

    @http_get("/export/csv")
    def export_reviews_csv(
        self,
        request,
        ota_name: Optional[str] = None,
        property_id: Optional[str] = None,
        property_name: Optional[str] = None,
        has_reply: Optional[bool] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None,
        search: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ):
        """Download the caller's reviews as CSV, honoring the same filters
        as the list endpoint. Capped at 10,000 rows."""
        import csv

        from django.http import HttpResponse
        from django.utils import timezone as dj_timezone

        _require_user(request)
        qs = self._apply_filters(
            _user_review_qs(request),
            search=search,
            property_id=property_id,
            property_name=property_name,
            has_reply=has_reply,
            min_score=min_score,
            max_score=max_score,
            from_date=from_date,
            to_date=to_date,
        )
        if ota_name:
            qs = qs.filter(ota_name__iexact=ota_name)

        today = dj_timezone.now().date().isoformat()
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="reptruly-reviews-{today}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow([
            "reviewed_at", "property_name", "ota_name", "reviewer_name",
            "score", "content", "has_reply", "reply",
        ])
        for r in qs[:10_000]:
            writer.writerow([
                r.reviewed_at.isoformat() if r.reviewed_at else "",
                r.property_name,
                r.ota_name,
                r.reviewer_name,
                r.overall_score if r.overall_score is not None else "",
                r.content,
                "yes" if r.has_reply else "no",
                r.reply,
            ])
        return response

    @http_get("/{review_id}", response={200: ReviewOut, codes_4xx: Message})
    def get_review(self, request, review_id: UUID):
        """Get a single review by its internal UUID (scoped to the caller)."""
        try:
            review = _user_review_qs(request).get(id=review_id)
        except Review.DoesNotExist:
            return 404, {"message": "Review not found"}
        return 200, review

    @http_post(
        "/{review_id}/draft-reply",
        response={200: DraftReplyOut, codes_4xx: Message, codes_5xx: Message},
    )
    def draft_reply(self, request, review_id: UUID, payload: DraftReplyIn):
        """Generate an AI-drafted reply for the given review using the
        caller's chosen tone, language, and signature.

        The draft is returned to the client to review/edit. Posting it back
        to the OTA happens on the OTA's partner extranet — we deep-link
        there from the UI after copying to clipboard.
        """
        if not request.user.is_authenticated:
            return 401, {"message": "Not authenticated"}
        require_feature(request.user, "ai_enabled")

        try:
            review = _user_review_qs(request).get(id=review_id)
        except Review.DoesNotExist:
            return 404, {"message": "Review not found"}

        from django.conf import settings

        from reptruly.reviews.reply_drafts import generate_reply_draft

        if not getattr(settings, "OPENAI_API_KEY", ""):
            return 502, {"message": "OPENAI_API_KEY not configured on the backend."}

        tone = (payload.tone or "warm").lower()
        try:
            draft = generate_reply_draft(
                review, tone, payload.language or "en", payload.signature
            )
        except Exception as exc:
            logger.error("Draft reply generation failed: %s", exc)
            return 502, {"message": f"Could not generate draft: {exc}"}

        # Persist the draft on the review so the list pre-fills it instantly
        # next time (and regenerations replace the stored copy).
        review.draft_reply = draft
        review.draft_generated_at = timezone.now()
        review.save(update_fields=["draft_reply", "draft_generated_at"])

        return 200, {
            "draft": draft,
            "tone": tone,
            "language": payload.language or "en",
            "review_id": review.id,
        }

    @http_get("/analytics/summary", response={200: AnalyticsOut})
    def analytics(
        self,
        request,
        property_name: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ):
        """Return aggregated analytics + per-OTA breakdown, optionally scoped to one property
        and/or a reviewed-at date range."""
        qs = _user_review_qs(request)
        if property_name:
            qs = qs.filter(property_name=property_name)
        if from_date is not None:
            qs = qs.filter(reviewed_at__date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(reviewed_at__date__lte=to_date)

        # Single SQL pass per scope: total, avg, replied, pending, and all 5 score bands
        # via conditional aggregates. Replaces the old Python loop that materialized every
        # row and bucketed it (~3500 rows × 4 OTA passes was killing the endpoint).
        from django.db.models import IntegerField
        BAND_AGG = {
            "band_0_2": Count("id", filter=Q(overall_score__lte=2, overall_score__isnull=False)),
            "band_2_4": Count("id", filter=Q(overall_score__gt=2, overall_score__lte=4)),
            "band_4_6": Count("id", filter=Q(overall_score__gt=4, overall_score__lte=6)),
            "band_6_8": Count("id", filter=Q(overall_score__gt=6, overall_score__lte=8)),
            "band_8_10": Count("id", filter=Q(overall_score__gt=8)),
            "total": Count("id"),
            "avg_score": Avg("overall_score"),
            "replied": Count("id", filter=Q(has_reply=True)),
            "pending": Count("id", filter=Q(has_reply=False)),
        }

        def _agg_to_stats(row: dict) -> dict:
            total = row.get("total") or 0
            avg = row.get("avg_score")
            avg = round(avg, 2) if avg is not None else None
            replied = row.get("replied") or 0
            return {
                "total": total,
                "avg_score": avg,
                "replied": replied,
                "pending_reply": row.get("pending") or 0,
                "reply_rate": round((replied / total) * 100, 1) if total > 0 else None,
                "score_distribution": {
                    "0-2": row.get("band_0_2") or 0,
                    "2-4": row.get("band_2_4") or 0,
                    "4-6": row.get("band_4_6") or 0,
                    "6-8": row.get("band_6_8") or 0,
                    "8-10": row.get("band_8_10") or 0,
                },
            }

        # One DB call for the combined view…
        combined = _agg_to_stats(qs.aggregate(**BAND_AGG))

        # …and one DB call grouped by ota_name for every per-OTA breakdown.
        per_ota: dict[str, dict] = {}
        for row in qs.exclude(ota_name="").values("ota_name").annotate(**BAND_AGG):
            per_ota[row["ota_name"]] = _agg_to_stats(row)

        by_ota_count = {name: stats["total"] for name, stats in per_ota.items()}

        return 200, {
            "total_reviews": combined["total"],
            "avg_score": combined["avg_score"],
            "reviews_by_ota": by_ota_count,
            "score_distribution": combined["score_distribution"],
            "replied": combined["replied"],
            "pending_reply": combined["pending_reply"],
            "per_ota": per_ota,
        }

    @http_get("/analytics/trends", response={200: TrendsOut})
    def trends(
        self,
        request,
        property_name: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ):
        """Return weekly/monthly averages, rolling last-12-months volume/avg,
        plus per-OTA breakdown of the same series. Date range narrows the source
        queryset; rolling-window stats (weekly/monthly) intersect the chosen range."""
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        twelve_months_ago = now - timedelta(days=365)

        # Build ordered last-12-month labels: "May '25", "Jun '25", ... "Apr '26"
        short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        labels: list[str] = []
        for i in range(11, -1, -1):
            d = now - timedelta(days=30 * i)
            labels.append(f"{short_months[d.month - 1]} '{str(d.year)[2:]}")

        qs = _user_review_qs(request)
        if property_name:
            qs = qs.filter(property_name=property_name)
        if from_date is not None:
            qs = qs.filter(reviewed_at__date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(reviewed_at__date__lte=to_date)

        # Three SQL queries total instead of N+1 per OTA:
        #   (1) weekly+monthly counts/avg per OTA via conditional aggregates
        #   (2) monthly volume/avg per OTA grouped by year+month
        #   (3) same as (1) and (2) but for the combined view
        WEEK_MONTH_AGG = {
            "weekly_count": Count("id", filter=Q(reviewed_at__gte=week_ago)),
            "weekly_avg": Avg("overall_score", filter=Q(reviewed_at__gte=week_ago)),
            "monthly_count": Count("id", filter=Q(reviewed_at__gte=month_ago)),
            "monthly_avg": Avg("overall_score", filter=Q(reviewed_at__gte=month_ago)),
        }

        def _empty_series() -> tuple[dict, dict]:
            return {l: 0 for l in labels}, {l: 0.0 for l in labels}

        def _build_trends(week_month_row: dict, monthly_rows: list[dict]) -> dict:
            volume, avg_scores = _empty_series()
            for r in monthly_rows:
                yr = str(r["reviewed_at__year"])[2:]
                label = f"{short_months[r['reviewed_at__month'] - 1]} '{yr}"
                if label in volume:
                    volume[label] = r["count"]
                    avg_scores[label] = round(r["avg"], 2) if r["avg"] else 0.0
            wa = week_month_row.get("weekly_avg")
            ma = week_month_row.get("monthly_avg")
            return {
                "weekly_avg_score": round(wa, 2) if wa is not None else None,
                "monthly_avg_score": round(ma, 2) if ma is not None else None,
                "weekly_count": week_month_row.get("weekly_count") or 0,
                "monthly_count": week_month_row.get("monthly_count") or 0,
                "monthly_volume": volume,
                "monthly_avg": avg_scores,
            }

        # Combined: 1 aggregate + 1 group-by query
        combined_wm = qs.aggregate(**WEEK_MONTH_AGG)
        combined_monthly = list(
            qs.filter(reviewed_at__gte=twelve_months_ago)
              .exclude(reviewed_at=None)
              .values("reviewed_at__year", "reviewed_at__month")
              .annotate(count=Count("id"), avg=Avg("overall_score"))
        )
        combined = _build_trends(combined_wm, combined_monthly)

        # Per-OTA: 1 group-by-OTA query for week/month + 1 group-by-(OTA,year,month) for monthly series
        per_ota: dict[str, dict] = {}
        per_ota_wm = {
            row["ota_name"]: row
            for row in qs.exclude(ota_name="").values("ota_name").annotate(**WEEK_MONTH_AGG)
        }
        per_ota_monthly: dict[str, list[dict]] = {}
        for row in (
            qs.exclude(ota_name="")
              .filter(reviewed_at__gte=twelve_months_ago)
              .exclude(reviewed_at=None)
              .values("ota_name", "reviewed_at__year", "reviewed_at__month")
              .annotate(count=Count("id"), avg=Avg("overall_score"))
        ):
            per_ota_monthly.setdefault(row["ota_name"], []).append(row)
        for ota_name, wm_row in per_ota_wm.items():
            per_ota[ota_name] = _build_trends(wm_row, per_ota_monthly.get(ota_name, []))

        return 200, {**combined, "per_ota": per_ota}

    @http_get("/analytics/ai-summary", response={200: AISummaryOut, codes_4xx: Message, codes_5xx: Message})
    def ai_summary(
        self,
        request,
        property_name: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ):
        """Use OpenAI to summarise biggest positives and problems from reviews,
        optionally narrowed to a property and/or a reviewed-at date range."""
        require_feature(_require_user(request), "ai_enabled")

        from django.conf import settings
        from openai import OpenAI

        qs = _user_review_qs(request).exclude(content="")
        if property_name:
            qs = qs.filter(property_name=property_name)
        if from_date is not None:
            qs = qs.filter(reviewed_at__date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(reviewed_at__date__lte=to_date)

        reviews = list(qs.order_by("-reviewed_at").values_list("content", "overall_score", "reviewer_name")[:200])
        if not reviews:
            return 400, {"message": "No reviews with text found"}

        review_count = len(reviews)
        lines = []
        for content, score, name in reviews:
            score_str = f"{score}/10" if score is not None else "no score"
            reviewer = name or "Anonymous"
            lines.append(f"- [{score_str}] {reviewer}: {content[:300]}")

        reviews_text = "\n".join(lines)
        prompt = (
            "You are a hotel reputation analyst. Based on the guest reviews below, "
            "provide a concise summary in exactly two sections.\n\n"
            "Use this exact format with no extra headers or markdown:\n\n"
            "TOP POSITIVES:\n"
            "• Location: [insight]\n"
            "• Cleanliness: [insight]\n"
            "• Staff: [insight]\n"
            "• Bathroom: [insight]\n"
            "• Bed comfort: [insight]\n"
            "• Price: [insight]\n\n"
            "TOP PROBLEMS:\n"
            "• Location: [insight]\n"
            "• Cleanliness: [insight]\n"
            "• Staff: [insight]\n"
            "• Bathroom: [insight]\n"
            "• Bed comfort: [insight]\n"
            "• Price: [insight]\n\n"
            "Rules: ALWAYS produce exactly one bullet per category in each section, in the order shown "
            "(Location, Cleanliness, Staff, Bathroom, Bed comfort, Price). Each bullet must start with "
            "the category name followed by ': '. If a category is not mentioned in the reviews, write "
            "'Location: Not mentioned in reviews.' (or the matching category). Be specific and actionable. "
            "No bold, no markdown, no extra commentary. Each bullet under 30 words.\n\n"
            f"Reviews ({review_count} total):\n{reviews_text}"
        )

        if not getattr(settings, "OPENAI_API_KEY", ""):
            return 502, {"message": "OPENAI_API_KEY not configured on the backend."}

        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.3,
            )
            text = resp.choices[0].message.content.strip()
        except Exception as exc:
            logger.error("AI summary OpenAI call failed: %s", exc)
            return 502, {"message": f"Could not generate AI summary: {exc}"}

        import re
        # Strip any stray markdown bold/headers
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"#{1,3}\s*", "", text)

        parts = re.split(r"(?i)TOP PROBLEMS\s*:?", text, maxsplit=1)
        if len(parts) == 2:
            positives = re.sub(r"(?i)TOP POSITIVES\s*:?", "", parts[0]).strip()
            problems = parts[1].strip()
        else:
            positives = text
            problems = ""

        return 200, {"positives": positives, "problems": problems, "review_count": review_count}

    @http_get("/analytics/topics", response={200: TopicScoresOut, codes_4xx: Message, codes_5xx: Message})
    def topic_scores(
        self,
        request,
        property_name: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        force_refresh: bool = False,
    ):
        """Score each fixed topic (cleanliness, location, maintenance, staff, breakfast,
        amenities, beds) on a 0-10 scale, derived from review text via OpenAI.
        Cached 24h per (user, property, date_range) to keep LLM calls cheap.
        """
        require_feature(_require_user(request), "ai_enabled")

        from django.conf import settings
        from openai import OpenAI
        import hashlib
        import json as _json
        import re as _re

        TOPICS = [
            {"key": "cleanliness", "label": "Cleanliness"},
            {"key": "housekeeping", "label": "Housekeeping"},
            {"key": "staff", "label": "Staff & service"},
            {"key": "beds", "label": "Beds & sleep quality"},
            {"key": "breakfast", "label": "Breakfast & food"},
            {"key": "amenities", "label": "Pool & amenities"},
            {"key": "maintenance", "label": "Maintenance"},
            {"key": "safety", "label": "Safety & security"},
            {"key": "location", "label": "Location"},
            {"key": "value_for_money", "label": "Value for money"},
        ]

        qs = _user_review_qs(request).exclude(content="")
        if property_name:
            qs = qs.filter(property_name=property_name)
        if from_date is not None:
            qs = qs.filter(reviewed_at__date__gte=from_date)
        if to_date is not None:
            qs = qs.filter(reviewed_at__date__lte=to_date)

        # Sample the most recent ~150 reviews with text content.
        rows = list(qs.order_by("-reviewed_at").values_list("content", "overall_score")[:150])
        review_count = len(rows)
        if review_count == 0:
            return 200, {
                "review_count": 0,
                "topics": [{"topic": t["key"], "label": t["label"], "score": None,
                            "mentions": 0, "note": "", "priority": "low"}
                           for t in TOPICS],
                "cached": False,
            }

        # Cache key: user + property + date range + a hash of the sampled review IDs so the
        # cache invalidates when new reviews come in.
        user_id = str(request.user.id) if request.user.is_authenticated else "anon"
        sample_hash = hashlib.sha1(
            "|".join(f"{c[:60]}~{s}" for c, s in rows[:50]).encode("utf-8")
        ).hexdigest()[:12]
        cache_key = (
            f"topic_scores:v2:{user_id}:{property_name or '_all_'}:"
            f"{from_date or ''}:{to_date or ''}:{sample_hash}"
        )

        if not force_refresh:
            cached_payload = cache.get(cache_key)
            if cached_payload:
                cached_payload["cached"] = True
                return 200, cached_payload

        if not getattr(settings, "OPENAI_API_KEY", ""):
            return 502, {"message": "OPENAI_API_KEY not configured on the backend."}

        # Build prompt — keep it tight; gpt-4o-mini handles 150 short reviews well.
        lines = []
        for content, score in rows:
            score_str = f"{score}/10" if score is not None else "—"
            lines.append(f"- [{score_str}] {content[:280]}")
        reviews_text = "\n".join(lines)

        topic_keys = [t["key"] for t in TOPICS]
        prompt = (
            "You are a hotel reputation analyst. Read the guest reviews below and score each "
            "of these topics on a 0-10 scale based on how guests describe them. 0 = consistently "
            "bad, 5 = mixed, 10 = consistently excellent. Also count how many of the reviews "
            "actually MENTION each topic (a brief allusion counts).\n\n"
            f"Topics: {', '.join(topic_keys)}\n\n"
            "Output a SINGLE JSON object with one key per topic. Each value is an object with "
            "keys: score (0-10 number, or null if too few mentions to judge), mentions (integer), "
            "note (one short sentence, ≤14 words, summarising what guests say). Do not include "
            "any text outside the JSON.\n\n"
            f"Example of expected shape:\n"
            "{\n"
            "  \"cleanliness\": {\"score\": 7.2, \"mentions\": 38, \"note\": \"Mostly praised; a few flagged bathroom mildew.\"},\n"
            "  \"breakfast\": {\"score\": null, \"mentions\": 1, \"note\": \"Too few mentions to judge.\"}\n"
            "}\n\n"
            f"Reviews ({review_count} total):\n{reviews_text}"
        )

        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"},
                max_tokens=900,
            )
            text = resp.choices[0].message.content or ""
        except Exception as exc:
            logger.error("Topic scoring OpenAI call failed: %s", exc)
            return 502, {"message": f"Could not generate topic scores: {exc}"}

        try:
            parsed = _json.loads(text)
        except Exception:
            # If the model wrapped the JSON in extra text, salvage the first {...} block.
            m = _re.search(r"\{.*\}", text, _re.DOTALL)
            if not m:
                return 502, {"message": "AI response was not valid JSON."}
            try:
                parsed = _json.loads(m.group(0))
            except Exception as exc:
                logger.error("Could not parse topic-scores JSON: %s — text=%r", exc, text[:300])
                return 502, {"message": "AI response was not valid JSON."}

        def _priority(score: Optional[float], mentions: int, review_count: int) -> str:
            """Rank how urgently a hotelier should act on this topic.

            HIGH   = guests mention it AND rate it poorly (real pain point)
            MEDIUM = mixed signal or only a few mentions trending negative
            LOW    = either consistently strong, or barely talked about
            """
            if score is None or mentions == 0:
                return "low"
            mention_rate = mentions / max(review_count, 1)
            if score < 6 and (mentions >= 10 or mention_rate >= 0.15):
                return "high"
            if score < 7 and mentions >= 5:
                return "medium"
            if score < 5:
                return "medium"
            return "low"

        topics_out = []
        for t in TOPICS:
            entry = parsed.get(t["key"]) if isinstance(parsed, dict) else None
            if not isinstance(entry, dict):
                topics_out.append({
                    "topic": t["key"], "label": t["label"], "score": None,
                    "mentions": 0, "note": "", "priority": "low",
                })
                continue
            raw_score = entry.get("score")
            score_val: Optional[float]
            try:
                score_val = float(raw_score) if raw_score is not None else None
                if score_val is not None:
                    score_val = round(max(0.0, min(10.0, score_val)), 1)
            except (TypeError, ValueError):
                score_val = None
            try:
                mentions = max(0, int(entry.get("mentions") or 0))
            except (TypeError, ValueError):
                mentions = 0
            note = str(entry.get("note") or "").strip()
            topics_out.append({
                "topic": t["key"],
                "label": t["label"],
                "score": score_val,
                "mentions": mentions,
                "note": note[:160],
                "priority": _priority(score_val, mentions, review_count),
            })

        payload = {"review_count": review_count, "topics": topics_out, "cached": False}
        cache.set(cache_key, payload, 24 * 60 * 60)  # 24h TTL
        return 200, payload


def _serialize_property(prop: Property, sync_warnings: Optional[list[str]] = None) -> dict:
    return {
        "id": prop.id,
        "property_id": prop.booking_hotel_id or prop.expedia_property_id or prop.google_place_id,
        "property_name": prop.property_name,
        "location": prop.location,
        "ota": prop.ota,
        "booking_hotel_id": prop.booking_hotel_id or "",
        "expedia_property_id": prop.expedia_property_id or "",
        "google_place_id": prop.google_place_id or "",
        "last_synced_at": prop.last_synced_at,
        "sync_warnings": sync_warnings or [],
    }


def _resolve_expedia_input(raw_input: str) -> tuple[Optional[str], list[str]]:
    """Pull the property ID out of user-pasted Expedia/Hotels.com input.

    Hotels.com Provider on RapidAPI takes Expedia property IDs directly (the `.h12345.`
    segment from an expedia.com URL), so no ID conversion is needed — both expedia.com
    and hotels.com URLs resolve to the same numeric ID.
    """
    parsed = extract_expedia_input(raw_input)
    if not parsed:
        return None, []
    return parsed["id"], []


@api_controller("/properties", tags=["Properties"], auth=None)
class PropertiesAPI:

    @http_get("", response={200: list[PropertyOut]})
    def list_properties(self, request):
        """List the logged-in user's connected properties."""
        user = _require_user(request)
        return 200, [_serialize_property(p) for p in Property.objects.filter(user=user)]

    @http_get("/google/search", response={200: PlaceSearchOut})
    def search_google_places(self, request, q: str = ""):
        """Search Google Places by hotel name so the user can pick the right place
        instead of hunting for a Place ID. Returns up to 6 candidates with name + address."""
        _require_user(request)
        query = (q or "").strip()
        if len(query) < 3:
            return 200, {"results": []}
        return 200, {"results": search_places(query)}

    @http_post("", response={200: PropertyOut, codes_4xx: Message, codes_5xx: Message})
    def create_property(self, request, payload: PropertyCreateIn):
        """Connect a property. Accepts a property name plus at least one OTA input
        (Booking.com URL/ID and/or Expedia URL/ID). Reviews start syncing immediately
        for OTAs that are connected (Booking.com today; Expedia stored for future)."""
        user = _require_user(request)

        # Plan entitlements: property count and which OTAs may be connected.
        plan = get_plan(user)
        if plan.max_properties == 0:
            raise upgrade_required(
                "Your 7-day free trial has ended. Upgrade to Pro to keep "
                "syncing reviews and connect properties."
            )
        if Property.objects.filter(user=user).count() >= plan.max_properties:
            noun = "property" if plan.max_properties == 1 else "properties"
            raise upgrade_required(
                f"The {plan.name} plan includes {plan.max_properties} {noun}. "
                "Upgrade to Pro to connect more."
            )
        if payload.expedia_property_id and OTA_EXPEDIA not in plan.allowed_otas:
            raise upgrade_required(
                "Expedia review sync is available on the Pro plan. Upgrade to unlock."
            )
        if payload.google_place_id and OTA_GOOGLE not in plan.allowed_otas:
            raise upgrade_required(
                "Google review sync is available on the Pro plan. Upgrade to unlock."
            )

        booking_id = extract_booking_hotel_id(payload.booking_hotel_id) if payload.booking_hotel_id else None
        sync_warnings: list[str] = []
        expedia_id: Optional[str] = None
        if payload.expedia_property_id:
            expedia_id, expedia_warnings = _resolve_expedia_input(payload.expedia_property_id)
            sync_warnings.extend(expedia_warnings)
        google_id = extract_google_place_id(payload.google_place_id) if payload.google_place_id else None

        # OTAs are all optional on create — user can add them later via edit.

        if payload.booking_hotel_id and not booking_id:
            return 400, {
                "message": "Could not resolve a Booking.com hotel ID from that input. "
                           "Paste a numeric hotel ID or a booking.com URL."
            }
        if payload.expedia_property_id and not expedia_id:
            return 400, {
                "message": "Could not resolve an Expedia property ID from that input. "
                           "Paste a numeric ID or an expedia.com / hotels.com URL."
            }
        if payload.google_place_id and not google_id:
            return 400, {
                "message": "Could not resolve a Google Place ID from that input. "
                           "Paste a Place ID (starts with ChIJ…) or a google.com/maps URL."
            }

        # Prevent duplicates per OTA
        if booking_id and Property.objects.filter(user=user, booking_hotel_id=booking_id).exists():
            return 409, {"message": "A property with this Booking.com hotel ID is already connected"}
        if expedia_id and Property.objects.filter(user=user, expedia_property_id=expedia_id).exists():
            return 409, {"message": "A property with this Expedia ID is already connected"}
        if google_id and Property.objects.filter(user=user, google_place_id=google_id).exists():
            return 409, {"message": "A property with this Google Place ID is already connected"}

        # Look up Booking metadata when available — gives us name/lat/lng/currency.
        meta = {}
        if booking_id:
            try:
                meta = BookingComClient().fetch_hotel_metadata(int(booking_id))
            except Exception as exc:
                logger.error("Booking hotel lookup failed for %s: %s", booking_id, exc)
                return 502, {"message": f"Could not look up hotel on Booking.com: {exc}"}

        user_name = (payload.property_name or "").strip()
        api_name = (meta.get("name") or "").strip()
        property_name = user_name or api_name
        if not property_name:
            return 400, {
                "message": "Property name is required (or provide a Booking.com link so we can fetch it)."
            }

        loc = meta.get("location") or {}
        city_bits = ", ".join(filter(None, [meta.get("address"), meta.get("city"), meta.get("country")]))
        latitude = loc.get("latitude")
        longitude = loc.get("longitude")

        # Fall back to Google for coordinates/location when Booking didn't supply them
        # (e.g. a Google-only property). Keeps the Demand Calendar & Rates pages working.
        if (latitude is None or longitude is None) and google_id:
            geo = fetch_place_geo(google_id)
            if geo:
                latitude = geo["latitude"]
                longitude = geo["longitude"]
                if not city_bits:
                    city_bits = geo.get("address", "")

        prop = Property.objects.create(
            user=user,
            ota=Property.OTA.BOOKING,  # primary OTA — kept for backward-compat
            booking_hotel_id=booking_id or "",
            expedia_property_id=expedia_id or "",
            google_place_id=google_id or "",
            property_name=property_name,
            location=city_bits,
            country=meta.get("country", "") or "",
            latitude=latitude,
            longitude=longitude,
            currency=meta.get("currencycode", "") or "",
        )

        # Pro bills per property — bump the subscription quantity (prorated).
        sync_subscription_quantity(user)

        # Run the initial sync inline so reviews are immediately available.
        # _sync_property iterates every connected OTA on the property automatically.
        # Subsequent refreshes are handled by the periodic celery task.
        if booking_id or expedia_id or google_id:
            try:
                _sync_property(prop)
                prop.refresh_from_db()
            except Exception as exc:
                logger.error("Initial sync failed for property %s: %s", prop.id, exc)

        return 200, _serialize_property(prop, sync_warnings=sync_warnings)

    @http_patch("/{property_id}", response={200: PropertyOut, codes_4xx: Message, codes_5xx: Message})
    def update_property(self, request, property_id: UUID, payload: PropertyUpdateIn):
        """Update a property: rename, add a new OTA link, or remove an existing OTA link.

        Sending an empty string for an OTA field removes that link (and deletes its synced
        reviews). Sending a non-empty value adds it (and syncs reviews inline if possible).
        Sending null / omitting a field leaves it unchanged.
        """
        user = _require_user(request)
        try:
            prop = Property.objects.get(id=property_id, user=user)
        except Property.DoesNotExist:
            return 404, {"message": "Property not found"}

        # Plan entitlements: adding a non-Booking OTA link is Pro-only
        # (removals — empty string — are always allowed).
        plan = get_plan(user)
        if (payload.expedia_property_id or "").strip() and OTA_EXPEDIA not in plan.allowed_otas:
            raise upgrade_required(
                "Expedia review sync is available on the Pro plan. Upgrade to unlock."
            )
        if (payload.google_place_id or "").strip() and OTA_GOOGLE not in plan.allowed_otas:
            raise upgrade_required(
                "Google review sync is available on the Pro plan. Upgrade to unlock."
            )

        sync_warnings: list[str] = []
        ids_to_sync: list[str] = []

        # Track each OTA: did the user change it, and what to.
        # 'unchanged' = field omitted; '' = remove; otherwise = new value (must be parsed).
        changed_booking = payload.booking_hotel_id is not None
        changed_expedia = payload.expedia_property_id is not None
        changed_google = payload.google_place_id is not None

        new_booking = prop.booking_hotel_id
        new_expedia = prop.expedia_property_id
        new_google = prop.google_place_id

        if changed_booking:
            raw = (payload.booking_hotel_id or "").strip()
            if not raw:
                new_booking = ""
            else:
                resolved = extract_booking_hotel_id(raw)
                if not resolved:
                    return 400, {"message": "Could not resolve a Booking.com hotel ID from that input."}
                if resolved != prop.booking_hotel_id and Property.objects.filter(
                    user=user, booking_hotel_id=resolved
                ).exclude(id=prop.id).exists():
                    return 409, {"message": "Another property already uses that Booking.com hotel ID."}
                new_booking = resolved

        if changed_expedia:
            raw = (payload.expedia_property_id or "").strip()
            if not raw:
                new_expedia = ""
            else:
                resolved, warn = _resolve_expedia_input(raw)
                sync_warnings.extend(warn)
                if not resolved:
                    return 400, {"message": "Could not resolve an Expedia property ID from that input."}
                if resolved != prop.expedia_property_id and Property.objects.filter(
                    user=user, expedia_property_id=resolved
                ).exclude(id=prop.id).exists():
                    return 409, {"message": "Another property already uses that Expedia ID."}
                new_expedia = resolved

        if changed_google:
            raw = (payload.google_place_id or "").strip()
            if not raw:
                new_google = ""
            else:
                resolved = extract_google_place_id(raw)
                if not resolved:
                    return 400, {"message": "Could not resolve a Google Place ID from that input."}
                if resolved != prop.google_place_id and Property.objects.filter(
                    user=user, google_place_id=resolved
                ).exclude(id=prop.id).exists():
                    return 409, {"message": "Another property already uses that Google Place ID."}
                new_google = resolved

        # OTAs are all optional — a property can exist with just a name.

        # Detect which OTAs are NEWLY added (so we sync them inline) vs removed (so we
        # delete their reviews).
        def added(old: str, new: str) -> bool:
            return bool(new) and old != new
        def removed(old: str, new: str) -> bool:
            return bool(old) and not new

        # Apply review cleanup for removed OTAs
        ids_to_purge: list[str] = []
        if removed(prop.booking_hotel_id, new_booking):
            ids_to_purge.append(prop.booking_hotel_id)
        if removed(prop.expedia_property_id, new_expedia):
            ids_to_purge.append(prop.expedia_property_id)
        if removed(prop.google_place_id, new_google):
            ids_to_purge.append(prop.google_place_id)
        if ids_to_purge:
            Review.objects.filter(property_id__in=ids_to_purge).delete()

        # Note which OTAs need a fresh inline sync (newly-added)
        will_sync_booking = added(prop.booking_hotel_id, new_booking)
        will_sync_expedia = added(prop.expedia_property_id, new_expedia)
        will_sync_google = added(prop.google_place_id, new_google)

        # Apply changes
        prop.booking_hotel_id = new_booking
        prop.expedia_property_id = new_expedia
        prop.google_place_id = new_google
        if payload.property_name is not None:
            renamed = payload.property_name.strip()
            if renamed:
                prop.property_name = renamed
        prop.save(update_fields=["booking_hotel_id", "expedia_property_id", "google_place_id", "property_name", "updated_at"])

        # Sync newly-added OTAs inline (full _sync_property is fine — it skips OTAs whose IDs are unset
        # but we still want to refresh others if they hadn't run today).
        if will_sync_booking or will_sync_expedia or will_sync_google:
            try:
                _sync_property(prop)
                prop.refresh_from_db()
            except Exception as exc:
                logger.error("Sync after update failed for property %s: %s", prop.id, exc)

        return 200, _serialize_property(prop, sync_warnings=sync_warnings)

    @http_delete("/{property_id}", response={200: Message, codes_4xx: Message})
    def delete_property(self, request, property_id: UUID):
        """Disconnect a property and remove its locally cached reviews."""
        user = _require_user(request)
        try:
            prop = Property.objects.get(id=property_id, user=user)
        except Property.DoesNotExist:
            return 404, {"message": "Property not found"}

        # Clean up reviews for every OTA the property had.
        ids = [i for i in (prop.booking_hotel_id, prop.expedia_property_id, prop.google_place_id) if i]
        if ids:
            Review.objects.filter(property_id__in=ids).delete()
        prop.delete()
        # Pro bills per property — drop the subscription quantity (prorated credit).
        sync_subscription_quantity(user)
        return 200, {"message": "Property removed"}


def _backfill_property_geo(prop: Property) -> None:
    """Populate lat/lng/currency for properties added before those columns existed,
    or for Google-only properties that never had a Booking.com location to source from."""
    if prop.latitude is not None and prop.longitude is not None:
        return

    # Prefer Booking.com metadata (also gives currency); fall back to Google Places.
    if prop.booking_hotel_id:
        try:
            meta = BookingComClient().fetch_hotel_metadata(int(prop.booking_hotel_id))
            loc = meta.get("location") or {}
            prop.latitude = loc.get("latitude")
            prop.longitude = loc.get("longitude")
            if not prop.currency:
                prop.currency = meta.get("currencycode", "") or ""
            if not prop.location:
                prop.location = ", ".join(filter(None, [meta.get("address"), meta.get("city"), meta.get("country")]))
        except Exception as exc:
            logger.warning("Booking geo backfill failed for property %s: %s", prop.id, exc)

    if (prop.latitude is None or prop.longitude is None) and prop.google_place_id:
        geo = fetch_place_geo(prop.google_place_id)
        if geo:
            prop.latitude = geo["latitude"]
            prop.longitude = geo["longitude"]
            if not prop.location:
                prop.location = geo.get("address", "")

    if prop.latitude is None or prop.longitude is None:
        return
    prop.save(update_fields=["latitude", "longitude", "currency", "location", "updated_at"])


RATES_CACHE_TTL = 24 * 60 * 60  # 24 hours


def _rates_cache_key(property_id: UUID, checkin: str, checkout: str, adults: int) -> str:
    return f"rates:v2:{property_id}:{checkin}:{checkout}:{adults}"


@api_controller("/badge", tags=["Badge"], auth=None)
class BadgeAPI:

    @http_get("/{property_id}/badge.svg")
    def property_badge(self, request, property_id: UUID, theme: str = "light"):
        """Public, embeddable review-score badge for a property.

        No auth by design: the UUID is unguessable, the numbers are public on
        the OTAs, and the badge carries reptruly branding.
        """
        from django.http import HttpResponse

        from reptruly.reviews.badge import render_badge_svg

        try:
            prop = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            raise HttpError(404, "Property not found")
        if theme not in ("light", "dark"):
            theme = "light"
        response = HttpResponse(
            render_badge_svg(prop, theme), content_type="image/svg+xml"
        )
        response["Cache-Control"] = "public, max-age=3600"
        return response


@api_controller("/rates", tags=["Rates"], auth=None)
class RatesAPI:

    @http_get("/{property_id}", response={200: RatesOut, codes_4xx: Message, codes_5xx: Message})
    def get_rates(
        self,
        request,
        property_id: UUID,
        checkin: Optional[str] = None,
        checkout: Optional[str] = None,
        adults: int = 2,
        force_refresh: bool = False,
    ):
        """Return the property's rate plus a comp set of nearby hotels for the given dates.

        Results are cached for 24 hours. Pass force_refresh=true to bypass the cache.
        """
        user = _require_user(request)
        require_feature(user, "rate_shopping")
        try:
            prop = Property.objects.get(id=property_id, user=user)
        except Property.DoesNotExist:
            return 404, {"message": "Property not found"}

        # Default: 2-week-ahead 1-night stay
        today = date.today()
        try:
            checkin_d = date.fromisoformat(checkin) if checkin else today + timedelta(days=14)
            checkout_d = date.fromisoformat(checkout) if checkout else checkin_d + timedelta(days=1)
        except ValueError:
            return 400, {"message": "checkin/checkout must be YYYY-MM-DD"}
        if checkout_d <= checkin_d:
            return 400, {"message": "checkout must be after checkin"}

        try:
            result = build_rates_data(prop, checkin_d, checkout_d, adults, force_refresh)
        except RatesUnavailable as exc:
            return 502, {"message": str(exc)}
        return 200, result


class RatesUnavailable(Exception):
    """Coordinates or the Booking.com comp set could not be loaded."""


def build_rates_data(
    prop: Property,
    checkin_d: date,
    checkout_d: date,
    adults: int = 2,
    force_refresh: bool = False,
) -> dict:
    """The property's rate plus a comp set of nearby hotels for the given dates.

    Shared by the rates API and the rate-alert task; cached 24h per
    (property, dates, adults) so neither pays twice. Raises RatesUnavailable.
    """
    nights = (checkout_d - checkin_d).days
    currency = (prop.currency or "USD").upper()

    cache_key = _rates_cache_key(prop.id, checkin_d.isoformat(), checkout_d.isoformat(), adults)
    if not force_refresh:
        cached = cache.get(cache_key)
        if cached:
            cached["cached"] = True
            return cached

    _backfill_property_geo(prop)
    if prop.latitude is None or prop.longitude is None:
        raise RatesUnavailable("Could not load coordinates for this property from Booking.com")

    client = BookingComClient()
    try:
        user_rate = client.fetch_hotel_rate(
            hotel_id=int(prop.booking_hotel_id),
            checkin_date=checkin_d.isoformat(),
            checkout_date=checkout_d.isoformat(),
            adults=adults,
            currency=currency,
        )
    except Exception as exc:
        logger.error("Rate fetch failed for property %s: %s", prop.id, exc)
        user_rate = None

    try:
        nearby = client.fetch_nearby_with_rates(
            latitude=prop.latitude,
            longitude=prop.longitude,
            checkin_date=checkin_d.isoformat(),
            checkout_date=checkout_d.isoformat(),
            adults=adults,
            currency=currency,
        )
    except Exception as exc:
        logger.error("Nearby search failed for property %s: %s", prop.id, exc)
        raise RatesUnavailable(f"Could not load comp set from Booking.com: {exc}")

    competitors: list[dict] = []
    for h in nearby:
        try:
            price = float(h.get("min_total_price")) if h.get("min_total_price") is not None else None
        except (TypeError, ValueError):
            price = None
        competitors.append({
            "hotel_id": str(h.get("hotel_id", "")),
            "hotel_name": h.get("hotel_name") or "",
            "distance_km": h.get("distance"),
            "star_rating": h.get("class"),
            "review_score": h.get("review_score"),
            "price": price,
            "currency": h.get("currencycode") or h.get("currency_code") or currency,
            "is_user_property": str(h.get("hotel_id")) == str(prop.booking_hotel_id),
        })

    # If the search didn't return our own property (rare), inject it from the rate lookup.
    if not any(c["is_user_property"] for c in competitors) and user_rate:
        competitors.insert(0, {
            "hotel_id": str(prop.booking_hotel_id),
            "hotel_name": prop.property_name,
            "distance_km": 0.0,
            "star_rating": None,
            "review_score": None,
            "price": user_rate["price"],
            "currency": user_rate.get("currency") or currency,
            "is_user_property": True,
        })

    # Avg comparison among priced rooms only (excluding the user's own property).
    priced = [c for c in competitors if c.get("price") is not None]
    comp_only = [c["price"] for c in priced if not c["is_user_property"]]
    avg_competitor = sum(comp_only) / len(comp_only) if comp_only else None

    # Resolve our own price, preferring room-list (more accurate) over search result.
    our_price = (user_rate or {}).get("price")
    if our_price is None:
        mine = next((c for c in competitors if c["is_user_property"]), None)
        our_price = mine["price"] if mine and mine.get("price") is not None else None

    vs_avg_pct = None
    if our_price is not None and avg_competitor:
        vs_avg_pct = round((our_price - avg_competitor) / avg_competitor * 100, 1)

    result = {
        "property_id": prop.id,
        "property_name": prop.property_name,
        "checkin": checkin_d.isoformat(),
        "checkout": checkout_d.isoformat(),
        "nights": nights,
        "currency": currency,
        "user_rate": our_price,
        "user_room_name": (user_rate or {}).get("room_name"),
        "user_vs_avg_pct": vs_avg_pct,
        "competitors": competitors,
        "fetched_at": timezone.now(),
        "cached": False,
    }
    cache.set(cache_key, result, RATES_CACHE_TTL)
    return result
