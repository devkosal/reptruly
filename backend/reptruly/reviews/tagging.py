"""Auto-tagging of guest reviews against a fixed topic taxonomy.

Newly synced reviews are batched to gpt-4o-mini which assigns zero or more
topic tags per review (cleanliness, location, staff, …). Tags live in the
existing ``Review.tags`` JSON list — no schema changes. Sentiment is NOT
stored; the frontend derives it from ``overall_score``.

Everything degrades gracefully: if OPENAI_API_KEY is unset, the openai
package is missing, or the API call/parse fails, we log and tag nothing.
"""

from __future__ import annotations

import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

# Fixed taxonomy — the model may ONLY use these tags. Keep in sync with the
# frontend tag filter dropdown in frontend/src/pages/Reviews.tsx.
TAG_TAXONOMY = [
    "cleanliness",
    "location",
    "staff",
    "breakfast",
    "room",
    "bathroom",
    "noise",
    "wifi",
    "parking",
    "value",
    "amenities",
    "checkin",
]

CHUNK_SIZE = 20
MAX_CONTENT_CHARS = 400
MAX_TAGS_PER_REVIEW = 5


def _build_prompt(chunk) -> str:
    items = []
    for i, review in enumerate(chunk):
        items.append({"i": i, "text": (review.content or "")[:MAX_CONTENT_CHARS]})
    return (
        "You tag hotel guest reviews with topic tags.\n"
        f"Allowed tags (use ONLY these): {', '.join(TAG_TAXONOMY)}\n\n"
        "For each review below, pick the tags for topics the guest actually "
        "mentions (positively or negatively). 0-4 tags per review; omit or use "
        "an empty list when nothing matches. Do not invent tags.\n\n"
        'Return ONLY a JSON object mapping review index to tag list, e.g. '
        '{"0": ["cleanliness", "staff"], "1": []}\n\n'
        f"Reviews:\n{json.dumps(items, ensure_ascii=False)}"
    )


def _classify_chunk(client, chunk) -> dict[int, list[str]]:
    """One gpt-4o-mini call for up to CHUNK_SIZE reviews. Returns {index: tags};
    empty dict on any failure."""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": _build_prompt(chunk)}],
            temperature=0.1,
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        text = resp.choices[0].message.content or ""
        parsed = json.loads(text)
    except Exception as exc:
        logger.warning("Review tag classification call failed: %s", exc)
        return {}

    allowed = set(TAG_TAXONOMY)
    out: dict[int, list[str]] = {}
    if not isinstance(parsed, dict):
        return {}
    for key, raw_tags in parsed.items():
        try:
            idx = int(key)
        except (TypeError, ValueError):
            continue
        if not isinstance(raw_tags, list):
            continue
        tags: list[str] = []
        for t in raw_tags:
            if isinstance(t, str):
                t = t.strip().lower()
                if t in allowed and t not in tags:
                    tags.append(t)
        out[idx] = tags[:MAX_TAGS_PER_REVIEW]
    return out


def classify_reviews(reviews) -> int:
    """Auto-tag the given Review objects. Returns how many reviews were tagged.

    Skips reviews with no text or with existing tags. Never raises — returns 0
    when OpenAI is unavailable or misconfigured.
    """
    candidates = [
        r for r in reviews if (r.content or "").strip() and not r.tags
    ]
    if not candidates:
        return 0

    if not getattr(settings, "OPENAI_API_KEY", ""):
        logger.info("Skipping review auto-tagging: OPENAI_API_KEY not configured.")
        return 0

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
    except Exception as exc:
        logger.warning("Skipping review auto-tagging: OpenAI client unavailable (%s)", exc)
        return 0

    tagged = 0
    try:
        for start in range(0, len(candidates), CHUNK_SIZE):
            chunk = candidates[start : start + CHUNK_SIZE]
            results = _classify_chunk(client, chunk)
            for i, review in enumerate(chunk):
                tags = results.get(i)
                if tags:
                    review.tags = tags
                    review.save(update_fields=["tags"])
                    tagged += 1
    except Exception as exc:
        logger.warning("Review auto-tagging aborted: %s", exc)
    logger.info("Auto-tagged %d/%d reviews", tagged, len(candidates))
    return tagged
