import functools
from collections.abc import Callable

# may need to move this to the inside the function if other pre settings
# decorators are added
from django.conf import settings
from django.urls import reverse

from reptruly.billing.utils import (
    get_default_payment_method,
)


def error_500(f: Callable):
    """A function decorator for catching all exceptions and logging them
    Inspired by:
    https://rinaarts.com/declutter-python-code-with-error-handling-decorators/
    Args:
        f (Callable):function to be wrapper
    """

    @functools.wraps(f)
    def inner(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:  # noqa NOSONAR
            # return the actual error if in DEBUG mode
            if settings.DEBUG:
                raise e
            # otherwise return a generic error message
            return 500, {"message": "Internal Server Error"}

    return inner


def user_subscription_required(f: Callable):
    @functools.wraps(f)
    def inner(*args, **kwargs):
        request = kwargs["request"]
        customer = request.user.customer
        if not customer or customer.deleted or not get_default_payment_method(customer):
            url = settings.DOMAIN_NAME + reverse("billing:stripe-customer-portal")
            return 402, {
                "message": f"No default payment method set. In order to set a default payment method, visit {url}"
            }

        usage_subscription = ...  # get_customer_usage_subscription(customer)
        # check if the customer has a cancelled subscription
        if not usage_subscription:
            if (
                customer.subscriptions.filter(
                    plan__nickname=settings.USAGE_PRICE_NICKNAME
                )
                .exclude(status="active")
                .exists()
            ):
                # this view does not exist by default
                url = settings.DOMAIN_NAME + reverse("billing:stripe-reactivate-usage")
                return 404, {
                    "message": (
                        "Usage subscription plan is either cancelled or expired."
                        f" Visit {url} to resubscribe to the usage plan"
                    )
                }
            else:
                # needs to be tested on a brand new user
                # subscribe_to_usage_price(customer)
                pass
        return f(*args, **kwargs)

    return inner
