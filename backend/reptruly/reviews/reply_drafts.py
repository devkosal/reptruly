"""Reply Studio — AI reply draft generation.

``generate_reply_draft`` is the single OpenAI-backed core used both by the
on-demand POST /reviews/{id}/draft-reply endpoint and by ``pregenerate_drafts``,
which runs during review syncs to pre-fill drafts for new reviews.
"""
import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Max newly-created reviews that get a pre-generated draft per sync run
# (cost control, mirrors AUTO_TAG_CAP_PER_SYNC in tasks.py).
PREGEN_DRAFT_CAP_PER_SYNC = 20

TONE_DESCRIPTIONS = {
    "professional": "formal, respectful, businesslike — appropriate for corporate clientele",
    "warm": "friendly, personable, sincere — a real human voice with warmth",
    "concise": "brief and direct, no fluff, gets to the point",
    "playful": "light, conversational, can use a friendly emoji or two",
}

LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "nl": "Dutch", "ja": "Japanese",
    "zh": "Chinese", "ko": "Korean", "ar": "Arabic", "hi": "Hindi",
    "th": "Thai", "tr": "Turkish", "ru": "Russian",
}


def _build_prompt(review, tone: str, language: str, signature: str) -> str:
    tone_desc = TONE_DESCRIPTIONS.get(tone, TONE_DESCRIPTIONS["warm"])
    lang = LANGUAGE_NAMES.get((language or "en").lower(), "English")

    score = review.overall_score
    reviewer = review.reviewer_name or "the guest"
    if score is not None:
        sentiment_guidance = (
            "This is a negative review. Acknowledge the specific issue they raised, "
            "apologize sincerely (without being defensive or making excuses), and invite "
            "them to contact the hotel directly to make it right."
            if score < 6
            else "This is a positive review. Thank them warmly, reference something specific "
            "they mentioned, and invite them back."
            if score >= 8
            else "This is a mixed review. Acknowledge what they liked, address what they "
            "didn't, and be honest about it."
        )
    else:
        sentiment_guidance = (
            "Respond appropriately to the tone and content of the review."
        )

    signature_instruction = (
        f"End with this signature on its own line:\n{signature.strip()}"
        if signature.strip()
        else "End with a generic friendly closing — no fake hotel manager name."
    )

    return (
        "You are drafting a reply from a hotel manager to a guest review.\n\n"
        f"OTA: {review.ota_name}\n"
        f"Property: {review.property_name}\n"
        f"Reviewer: {reviewer}\n"
        f"Rating: {score if score is not None else 'not provided'}/10\n"
        f"Review content:\n{review.content or '(no text)'}\n\n"
        "REPLY REQUIREMENTS:\n"
        f"- Tone: {tone} ({tone_desc})\n"
        f"- Language: write the reply entirely in {lang}\n"
        "- Length: 2-4 sentences\n"
        f"- {sentiment_guidance}\n"
        "- Address the reviewer by first name if available\n"
        "- Be specific to what they mentioned — never generic boilerplate\n"
        "- Don't make promises you can't keep\n"
        "- Don't be sycophantic or over-the-top\n"
        f"- {signature_instruction}\n\n"
        "Output the reply text only — no preamble, no headers, no quotes around it."
    )


def generate_reply_draft(review, tone: str, language: str, signature: str) -> str:
    """Call OpenAI to draft a reply to ``review``. Raises on any failure —
    callers decide whether that's a 502 (endpoint) or a skip (pre-generation).
    """
    from openai import OpenAI  # local import: keep app import light

    tone = (tone or "warm").lower()
    prompt = _build_prompt(review, tone, language, signature)
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.7,
    )
    return (resp.choices[0].message.content or "").strip()


def pregenerate_drafts(reviews, property_obj) -> int:
    """Pre-generate AI reply drafts for brand-new reviews during a sync.

    Only runs when the property owner's plan includes AI features AND their
    ``reply_auto_suggest`` preference is on; uses their stored tone, language,
    and signature. Capped at ``PREGEN_DRAFT_CAP_PER_SYNC`` per run. Best-effort:
    never raises — a drafting failure must never break the sync itself.
    Returns the number of drafts written.
    """
    if not getattr(settings, "OPENAI_API_KEY", ""):
        return 0
    try:
        from reptruly.billing.entitlements import get_plan
        from reptruly.users.emails import get_preferences

        plan = get_plan(property_obj.user)
        if not plan.ai_enabled:
            return 0
        prefs = get_preferences(property_obj.user)
        if not prefs.reply_auto_suggest:
            return 0

        candidates = [
            r for r in reviews
            if (r.content or "").strip() and not r.has_reply and not r.draft_reply
        ]
        skipped = len(candidates) - PREGEN_DRAFT_CAP_PER_SYNC
        if skipped > 0:
            logger.info(
                "Draft pre-generation capped at %d reviews for %s; %d skipped",
                PREGEN_DRAFT_CAP_PER_SYNC,
                property_obj.property_name,
                skipped,
            )
        generated = 0
        for review in candidates[:PREGEN_DRAFT_CAP_PER_SYNC]:
            try:
                draft = generate_reply_draft(
                    review,
                    prefs.reply_tone,
                    prefs.reply_language,
                    prefs.reply_signature,
                )
            except Exception as exc:
                logger.warning(
                    "Draft pre-generation failed for review %s: %s",
                    review.channex_id,
                    exc,
                )
                continue
            if not draft:
                continue
            review.draft_reply = draft
            review.draft_generated_at = timezone.now()
            review.save(update_fields=["draft_reply", "draft_generated_at"])
            generated += 1
        return generated
    except Exception as exc:
        logger.warning("Draft pre-generation failed during sync: %s", exc)
        return 0
