"""LLM-driven hotel-impact classification for events.

For each event we ask GPT-4o-mini to estimate how much it will drive *out-of-town*
overnight visitors — i.e. hotel demand. A high-school basketball game and a Taylor
Swift stadium concert both count as "1 event" to Ticketmaster but they have wildly
different effects on hotel occupancy. This module converts an event into an
impact score on a 0-3 scale:

    0 = local-only attendance, no measurable hotel impact
    1 = some out-of-town visitors (regional draw, mid-size venue)
    2 = significant tourist draw (major artist / pro sports / popular festival)
    3 = destination event (stadium-scale concert, championship game, multi-day festival)

Classifications are cached in Redis for 30 days, keyed by a normalized
(event_name, venue) hash. The same artist's tour stop at the same venue won't
get re-classified across calendar requests.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_TTL = 30 * 24 * 60 * 60  # 30 days

IMPACT_LABELS = {
    0: ("Local", "📍"),
    1: ("Regional draw", "🚗"),
    2: ("Major draw", "✈️"),
    3: ("Destination event", "🎯"),
}


def impact_label(score: int) -> tuple[str, str]:
    return IMPACT_LABELS.get(max(0, min(3, score)), ("", ""))


def _event_cache_key(event: dict, city: str) -> str:
    name = (event.get("name") or "").strip().lower()
    venue = (event.get("venue") or "").strip().lower()
    classification = (event.get("classification") or "").strip().lower()
    raw = f"{name}|{venue}|{classification}|{city.lower()}"
    h = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return f"event_impact:v1:{h}"


def _heuristic_impact(event: dict) -> int:
    """Cheap baseline used when OpenAI isn't available or fails. Conservative — biases low."""
    classification = (event.get("classification") or "").lower()
    name = (event.get("name") or "").lower()
    venue = (event.get("venue") or "").lower()

    # Obvious destination-tier signals
    if any(s in venue for s in ["stadium", "coliseum"]) or "stadium" in name:
        return 2
    # Sports often pull visiting team fans
    if classification in ("sports",):
        return 1
    # "Tour" in the name implies travelling artist
    if re.search(r"\btour\b", name):
        return 1
    # Otherwise treat as local
    return 0


def _classify_with_openai(events_to_classify: list[dict], city: str) -> dict[int, int]:
    """Call OpenAI to score impact for a batch of events. Returns {index: score}."""
    if not getattr(settings, "OPENAI_API_KEY", ""):
        return {}

    try:
        from openai import OpenAI
    except Exception:
        return {}

    items = []
    for i, e in enumerate(events_to_classify):
        items.append({
            "i": i,
            "name": e.get("name", ""),
            "venue": e.get("venue", ""),
            "classification": e.get("classification", ""),
            "city": city,
        })

    prompt = (
        "You are a hotel revenue analyst. For each event below, estimate its likely impact "
        "on hotel demand in the host city — i.e. how many *out-of-town* attendees will need "
        "overnight accommodation.\n\n"
        "Score each event 0-3:\n"
        "  0 = mostly local attendance (small venue, community event, niche local act)\n"
        "  1 = regional draw (mid-size venue, popular regional act, college sports)\n"
        "  2 = major draw (well-known national artist, pro sports, popular festival)\n"
        "  3 = destination event (stadium-scale concert by a top global artist, "
        "championship/playoff game, multi-day festival drawing tourists)\n\n"
        "Use venue size, artist/team notoriety, and event type. Stadium > Arena > Theater > Club. "
        "Taylor Swift, Beyonce, Bad Bunny, NFL/NBA/MLB playoff games, F1 races = 3. "
        "Touring Broadway, popular country/rock acts at arenas, regular-season pro sports = 2. "
        "Local theater, community concerts, minor-league sports, kids' events = 0.\n\n"
        "Return ONLY a JSON object: {\"scores\": [{\"i\": 0, \"s\": 2}, {\"i\": 1, \"s\": 0}, ...]}\n\n"
        f"Events:\n{json.dumps(items, ensure_ascii=False)}"
    )

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json_object"},
            max_tokens=2000,
        )
        text = resp.choices[0].message.content
    except Exception as exc:
        logger.warning("OpenAI event classification failed: %s", exc)
        return {}

    try:
        parsed = json.loads(text)
        scores = parsed.get("scores", [])
        out: dict[int, int] = {}
        for entry in scores:
            idx = entry.get("i")
            score = entry.get("s")
            if isinstance(idx, int) and isinstance(score, (int, float)):
                out[idx] = max(0, min(3, int(score)))
        return out
    except Exception as exc:
        logger.warning("Could not parse OpenAI classification response: %s — text=%r", exc, text[:300])
        return {}


def annotate_events_with_impact(events: list[dict], city: str) -> list[dict]:
    """Mutates each event dict in-place to add `impact_score` and `impact_label`/`impact_emoji`.

    Pulls cached scores first; only sends uncached events to OpenAI.
    """
    if not events:
        return events

    cache_keys = [_event_cache_key(e, city) for e in events]
    cached_map = cache.get_many(cache_keys)

    uncached_indices: list[int] = []
    uncached_events: list[dict] = []
    for i, key in enumerate(cache_keys):
        if key in cached_map:
            events[i]["impact_score"] = int(cached_map[key])
        else:
            uncached_indices.append(i)
            uncached_events.append(events[i])

    if uncached_events:
        # Try OpenAI first; fall back to heuristic per-event if it fails or omits an entry.
        ai_scores = _classify_with_openai(uncached_events, city)
        to_cache: dict[str, int] = {}
        for batch_idx, original_idx in enumerate(uncached_indices):
            score = ai_scores.get(batch_idx)
            if score is None:
                score = _heuristic_impact(events[original_idx])
            events[original_idx]["impact_score"] = score
            to_cache[cache_keys[original_idx]] = score
        if to_cache:
            cache.set_many(to_cache, CACHE_TTL)

    for e in events:
        label, emoji = impact_label(e.get("impact_score", 0))
        e["impact_label"] = label
        e["impact_emoji"] = emoji

    return events
