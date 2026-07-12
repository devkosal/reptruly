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

# Free trial for first-time subscribers (checkout sets trial_period_days).
TRIAL_DAYS = 14

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

PRO = Plan(
    name="Pro",
    max_properties=10,
    allowed_otas=frozenset({OTA_BOOKING, OTA_EXPEDIA, OTA_GOOGLE}),
    ai_enabled=True,
    rate_shopping=True,
)


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


def has_ever_subscribed(user) -> bool:
    """Any subscription in any status — gates one-time perks like the free trial."""
    if user.customer is None:
        return False
    return Subscription.objects.filter(customer=user.customer).exists()


def get_plan(user) -> Plan:
    return PRO if active_subscription(user) is not None else STARTER


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
