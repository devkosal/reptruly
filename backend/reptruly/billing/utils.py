import stripe
from django.conf import settings
from djstripe.models import Customer, Price, Subscription

from reptruly.core.common.exceptions import (
    AlreadySubscribedException,
    CustomerNotFoundError,
)


def set_stripe_api_key():
    stripe.api_key = (
        settings.STRIPE_LIVE_SECRET_KEY
        if settings.STRIPE_LIVE_MODE
        else settings.STRIPE_TEST_SECRET_KEY
    )
    if not stripe.api_key:
        raise ValueError("stripe key is misconfigured")


def get_default_payment_method(customer: Customer) -> str | None:
    return customer.invoice_settings["default_payment_method"]
