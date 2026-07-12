"""Keep the Stripe subscription quantity equal to the user's property count.

Pro is priced per property per month. Checkout starts at the current count;
adding/removing a property adjusts the live subscription with prorations, so
the next invoice reflects the change automatically.
"""
import logging

import stripe
from djstripe.models import Subscription

from reptruly.billing.entitlements import PRO, active_subscription
from reptruly.billing.utils import set_stripe_api_key

logger = logging.getLogger(__name__)


def desired_quantity(user) -> int:
    """Billable quantity: one per connected property, min 1, capped at plan max."""
    count = user.properties.count()
    return max(1, min(count, PRO.max_properties))


def sync_subscription_quantity(user) -> None:
    """Best-effort: align the active subscription's quantity with the property count.

    Never raises — property add/remove must not fail because Stripe hiccuped.
    A skipped sync self-corrects on the next property change.
    """
    sub = active_subscription(user)
    if sub is None:
        return
    try:
        item = sub.items.first()
        if item is None:
            return
        current = (item.stripe_data or {}).get("quantity") or 1
        target = desired_quantity(user)
        if current == target:
            return
        set_stripe_api_key()
        stripe.SubscriptionItem.modify(
            item.id,
            quantity=target,
            proration_behavior="create_prorations",
        )
        Subscription.sync_from_stripe_data(stripe.Subscription.retrieve(sub.id))
        logger.info(
            "Subscription %s quantity %s -> %s (user %s)",
            sub.id, current, target, user.id,
        )
    except Exception:
        logger.exception("Failed to sync subscription quantity for user %s", user.id)
