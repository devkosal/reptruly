"""Stripe webhook side-effects.

dj-stripe receives events at /stripe/webhook/<uuid>/ (see config/urls.py),
validates them (DJSTRIPE_WEBHOOK_VALIDATION="retrieve_event" re-fetches each
event from Stripe), and keeps Customer/Subscription rows in sync on its own.
These receivers add our business side-effects on top: dunning and lifecycle
emails. Imported from BillingConfig.ready().
"""
import logging

from djstripe.event_handlers import djstripe_receiver
from djstripe.models import Customer

from reptruly.users.emails import (
    send_payment_failed_email,
    send_subscription_ended_email,
    send_trial_ending_email,
)

logger = logging.getLogger(__name__)


def _event_object(event) -> dict:
    return (event.data or {}).get("object") or {}


def _user_for_event(event):
    obj = _event_object(event)
    customer_id = obj.get("customer")
    if not customer_id:
        return None
    customer = Customer.objects.filter(id=customer_id).first()
    if customer is None:
        return None
    return getattr(customer, "user", None)


@djstripe_receiver("invoice.payment_failed")
def on_payment_failed(sender, event, **kwargs):
    user = _user_for_event(event)
    if user is None:
        logger.warning("payment_failed webhook: no user for event %s", event.id)
        return
    obj = _event_object(event)
    send_payment_failed_email(
        user,
        amount_cents=obj.get("amount_due"),
        currency=(obj.get("currency") or "usd").upper(),
    )
    logger.info("Dunning email queued for user %s (event %s)", user.id, event.id)


@djstripe_receiver("customer.subscription.deleted")
def on_subscription_deleted(sender, event, **kwargs):
    user = _user_for_event(event)
    if user is None:
        logger.warning("subscription_deleted webhook: no user for event %s", event.id)
        return
    send_subscription_ended_email(user)
    logger.info("Subscription-ended email queued for user %s (event %s)", user.id, event.id)


@djstripe_receiver("customer.subscription.trial_will_end")
def on_trial_will_end(sender, event, **kwargs):
    user = _user_for_event(event)
    if user is None:
        logger.warning("trial_will_end webhook: no user for event %s", event.id)
        return
    obj = _event_object(event)
    items = ((obj.get("items") or {}).get("data")) or [{}]
    price = items[0].get("price") or {}
    quantity = items[0].get("quantity") or 1
    unit = price.get("unit_amount")
    send_trial_ending_email(
        user,
        amount_cents=unit * quantity if unit else None,
        currency=(price.get("currency") or "usd").upper(),
        interval=(price.get("recurring") or {}).get("interval"),
    )
    logger.info("Trial-ending email queued for user %s (event %s)", user.id, event.id)
