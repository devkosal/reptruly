"""Plan entitlements — what Starter vs Pro accounts can do, enforced server-side.

Single source of truth for plan limits. API controllers call
``get_plan(user)`` and either check flags or use ``require_feature``.

Entitlement blocks use HTTP 402 (Payment Required) so the frontend can
distinguish "upgrade to unlock" from a plain permission error.
"""
from dataclasses import dataclass

from djstripe.models import Subscription
from ninja.errors import HttpError

# Stripe subscription statuses that count as an active Pro plan.
ACTIVE_STATUSES = ("active", "trialing")

# Starter is a free trial, not a free-forever tier: full Starter access for
# this many days after signup, then upgrade walls until a Pro subscription.
STARTER_TRIAL_DAYS = 7

# OTA keys as used across the reviews app.
OTA_BOOKING = "booking"
OTA_EXPEDIA = "expedia"
OTA_GOOGLE = "google"


@dataclass(frozen=True)
class Plan:
    name: str
    max_properties: int
    allowed_otas: frozenset
    ai_enabled: bool
    rate_shopping: bool


STARTER = Plan(
    name="Starter",
    max_properties=1,
    allowed_otas=frozenset({OTA_BOOKING}),
    ai_enabled=False,
    rate_shopping=False,
)

# Starter trial has lapsed and no Pro subscription exists. Existing data stays
# readable, but everything gated is locked until the user upgrades.
EXPIRED = Plan(
    name="Trial ended",
    max_properties=0,
    allowed_otas=frozenset(),
    ai_enabled=False,
    rate_shopping=False,
)

PRO = Plan(
    name="Pro",
    max_properties=10,
    allowed_otas=frozenset({OTA_BOOKING, OTA_EXPEDIA, OTA_GOOGLE}),
    ai_enabled=True,
    rate_shopping=True,
)

# Group: self-serve volume plan for portfolios beyond Pro's 10-property cap.
# Billing never drops below GROUP_MIN_PROPERTIES units so the volume price
# can't undercut Pro for small portfolios.
GROUP_MIN_PROPERTIES = 11
GROUP_PRICE_LOOKUP_KEY = "reptruly_group_month"

GROUP = Plan(
    name="Group",
    max_properties=1000,
    allowed_otas=frozenset({OTA_BOOKING, OTA_EXPEDIA, OTA_GOOGLE}),
    ai_enabled=True,
    rate_shopping=True,
)


def subscription_plan(sub) -> Plan:
    """PRO or GROUP, decided by the subscribed price's lookup key / metadata."""
    try:
        item = sub.items.first()
        price_data = (item.price.stripe_data or {}) if item and item.price else {}
        if (
            price_data.get("lookup_key") == GROUP_PRICE_LOOKUP_KEY
            or (price_data.get("metadata") or {}).get("reptruly_plan") == "group"
        ):
            return GROUP
    except Exception:  # malformed stripe_data must never break plan resolution
        pass
    return PRO


def active_subscription(user) -> Subscription | None:
    """The user's active/trialing dj-stripe subscription, if any."""
    if user.customer is None:
        return None
    return (
        Subscription.objects.filter(
            customer=user.customer,
            stripe_data__status__in=list(ACTIVE_STATUSES),
        )
        .order_by("-created")
        .first()
    )


def starter_trial_ends_at(user):
    """When the user's 7-day Starter trial ends (datetime)."""
    from datetime import timedelta

    return user.date_joined + timedelta(days=STARTER_TRIAL_DAYS)


def starter_trial_days_left(user) -> int:
    """Days of Starter trial remaining (ceiling), floored at 0."""
    import math

    from django.utils import timezone

    seconds = (starter_trial_ends_at(user) - timezone.now()).total_seconds()
    return max(0, math.ceil(seconds / 86400))


def get_plan(user) -> Plan:
    from django.utils import timezone

    sub = active_subscription(user)
    if sub is not None:
        return subscription_plan(sub)
    if timezone.now() >= starter_trial_ends_at(user):
        return EXPIRED
    return STARTER


def upgrade_required(message: str) -> HttpError:
    """402 error the frontend renders as an upgrade-to-Pro prompt."""
    return HttpError(402, message)


def require_feature(user, feature: str) -> Plan:
    """Raise 402 unless the user's plan includes the boolean ``feature`` flag."""
    plan = get_plan(user)
    if not getattr(plan, feature):
        labels = {
            "ai_enabled": "AI summaries and reply drafting are",
            "rate_shopping": "Rate shopping is",
        }
        label = labels.get(feature, "This feature is")
        raise upgrade_required(f"{label} available on the Pro plan. Upgrade to unlock.")
    return plan
