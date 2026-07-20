"""Billing API — Stripe Checkout, subscription status, and customer portal."""
from datetime import datetime, timezone

import stripe
from django.conf import settings
from djstripe.models import Customer, Price, Subscription
from ninja import Schema
from ninja.errors import HttpError
from ninja_extra import api_controller, route
from stripe import StripeError

from reptruly.billing.entitlements import (
    GROUP,
    GROUP_MIN_PROPERTIES,
    GROUP_PRICE_LOOKUP_KEY,
    STARTER,
    active_subscription,
    get_plan,
    starter_trial_days_left,
    subscription_plan,
)
from reptruly.billing.quantity import desired_quantity, sync_subscription_quantity
from reptruly.billing.utils import set_stripe_api_key
from reptruly.users.emails import send_pro_subscription_emails

set_stripe_api_key()


class PlanLimitsOut(Schema):
    max_properties: int
    allowed_otas: list[str]
    ai_enabled: bool
    rate_shopping: bool


class BillingStatusOut(Schema):
    has_pro: bool
    plan: str
    price: int | None = None  # unit amount in cents
    quantity: int = 1  # billed units (one per property)
    currency: str = "usd"
    interval: str | None = None
    current_period_end: str | None = None
    cancel_at_period_end: bool = False
    trialing: bool = False
    trial_end: str | None = None
    # Days left in the 7-day Starter trial (None once subscribed or expired).
    trial_days_left: int | None = None
    limits: PlanLimitsOut


class CheckoutOut(Schema):
    url: str


class ConfirmIn(Schema):
    session_id: str


class PortalOut(Schema):
    url: str


def _require_user(request):
    if not request.user.is_authenticated:
        raise HttpError(401, "Not authenticated")
    return request.user


def _get_or_create_customer(user) -> Customer:
    if user.customer is not None and not user.customer.deleted:
        return user.customer
    stripe_customer = stripe.Customer.create(
        email=user.email or None,
        name=user.name or user.username,
        metadata={"reptruly_user_id": str(user.id)},
    )
    customer = Customer.sync_from_stripe_data(stripe_customer)
    user.customer = customer
    user.save(update_fields=["customer"])
    return customer


def _pro_price(interval: str = "month") -> Price:
    """Pick the Pro price for a billing interval: explicit setting first,
    else the first active price with that recurring interval.

    dj-stripe 2.10 keeps most of the Stripe payload in the ``stripe_data``
    JSON field, so recurring-interval filtering goes through JSON lookups.
    """
    setting_name = (
        "STRIPE_PRO_PRICE_ID" if interval == "month" else "STRIPE_PRO_ANNUAL_PRICE_ID"
    )
    price_id = getattr(settings, setting_name, "")
    qs = Price.objects.filter(active=True)
    price = qs.filter(id=price_id).first() if price_id else None
    if price is None:
        price = (
            qs.filter(stripe_data__recurring__interval=interval)
            .order_by("created")
            .first()
        )
    if price is None:
        raise HttpError(
            503,
            f"No {interval}ly subscription price configured — "
            "sync products from Stripe first",
        )
    return price


GROUP_UNIT_AMOUNT = 1500  # $15.00 per property per month


def _group_price() -> Price:
    """The Group volume price: explicit setting, then lookup key, else create it.

    First Group checkout ever creates the Stripe product + price (idempotent
    thereafter via the lookup key) so no manual dashboard setup is needed.
    """
    from djstripe.models import Product

    price_id = getattr(settings, "STRIPE_GROUP_PRICE_ID", "")
    qs = Price.objects.filter(active=True)
    price = qs.filter(id=price_id).first() if price_id else None
    if price is None:
        price = qs.filter(stripe_data__lookup_key=GROUP_PRICE_LOOKUP_KEY).first()
    if price is None:
        try:
            stripe_price = stripe.Price.create(
                unit_amount=GROUP_UNIT_AMOUNT,
                currency="usd",
                recurring={"interval": "month"},
                lookup_key=GROUP_PRICE_LOOKUP_KEY,
                metadata={"reptruly_plan": "group"},
                product_data={"name": "reptruly Group"},
            )
            Product.sync_from_stripe_data(stripe.Product.retrieve(stripe_price.product))
            price = Price.sync_from_stripe_data(stripe_price)
        except StripeError as e:
            raise HttpError(502, f"Could not set up Group pricing: {e.user_message or e}")
    return price


def _origin(request) -> str:
    return f"{request.scheme}://{request.get_host()}"


def _plan_limits(user) -> dict:
    plan = get_plan(user)
    return {
        "max_properties": plan.max_properties,
        "allowed_otas": sorted(plan.allowed_otas),
        "ai_enabled": plan.ai_enabled,
        "rate_shopping": plan.rate_shopping,
    }


def _status_payload(user) -> dict:
    sub = active_subscription(user)
    if sub is None:
        plan = get_plan(user)
        return {
            "has_pro": False,
            "plan": plan.name,
            "limits": _plan_limits(user),
            "trial_days_left": starter_trial_days_left(user) if plan is STARTER else None,
        }
    sub_data = sub.stripe_data or {}
    item = sub.items.first()
    price_data = (item.price.stripe_data or {}) if item and item.price else {}
    recurring = price_data.get("recurring") or {}
    quantity = ((item.stripe_data or {}).get("quantity") if item else None) or 1
    period_end = sub_data.get("current_period_end")
    if not period_end:
        # newer Stripe API versions keep the period on the subscription item
        items_data = (sub_data.get("items") or {}).get("data") or [{}]
        period_end = items_data[0].get("current_period_end")
    trial_end = sub_data.get("trial_end")
    return {
        "has_pro": True,
        "plan": subscription_plan(sub).name,
        "limits": _plan_limits(user),
        "price": price_data.get("unit_amount"),
        "quantity": quantity,
        "currency": price_data.get("currency") or "usd",
        "interval": recurring.get("interval"),
        "current_period_end": (
            datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat()
            if period_end
            else None
        ),
        "cancel_at_period_end": bool(sub_data.get("cancel_at_period_end")),
        "trialing": sub_data.get("status") == "trialing",
        "trial_end": (
            datetime.fromtimestamp(trial_end, tz=timezone.utc).isoformat()
            if trial_end
            else None
        ),
    }


@api_controller("/billing", tags=["Billing"], auth=None)
class BillingAPI:
    @route.get("/status", response=BillingStatusOut)
    def status(self, request):
        """Current user's plan and subscription state."""
        user = _require_user(request)
        return _status_payload(user)

    @route.post("/checkout", response=CheckoutOut)
    def checkout(self, request, interval: str = "month", plan: str = "pro", properties: int = 0):
        """Create a Stripe Checkout Session for a subscription.

        ``plan`` is "pro" (default) or "group". Pro: ``interval`` "month" or
        "year" (2 months free), one unit per connected property. Group:
        month-only volume pricing; ``properties`` declares the portfolio size
        (min 11 — Pro covers up to 10) and seeds the billed quantity.
        """
        user = _require_user(request)
        if plan not in ("pro", "group"):
            raise HttpError(400, "plan must be 'pro' or 'group'")
        if interval not in ("month", "year"):
            raise HttpError(400, "interval must be 'month' or 'year'")
        if active_subscription(user) is not None:
            raise HttpError(409, "Already subscribed — manage your plan from the billing portal")
        customer = _get_or_create_customer(user)
        if plan == "group":
            if properties < GROUP_MIN_PROPERTIES:
                raise HttpError(
                    400,
                    f"Group is for {GROUP_MIN_PROPERTIES}+ properties — "
                    "Pro covers portfolios up to 10.",
                )
            price = _group_price()
            quantity = min(
                max(properties, user.properties.count()), GROUP.max_properties
            )
        else:
            price = _pro_price(interval)
            quantity = desired_quantity(user)
        origin = _origin(request)
        try:
            session = stripe.checkout.Session.create(
                customer=customer.id,
                mode="subscription",
                # Per property per month — bill one unit per property.
                # No paid trial: the free trial is the 7-day Starter period.
                line_items=[{"price": price.id, "quantity": quantity}],
                success_url=(
                    f"{origin}/settings?billing=success"
                    "&session_id={CHECKOUT_SESSION_ID}"
                ),
                cancel_url=f"{origin}/pricing?billing=cancelled",
                allow_promotion_codes=True,
            )
        except StripeError as e:
            raise HttpError(502, f"Stripe error: {e.user_message or e}")
        return {"url": session.url}

    @route.post("/confirm", response=BillingStatusOut)
    def confirm(self, request, data: ConfirmIn):
        """Sync the subscription after Checkout redirects back.

        Local sandbox flow has no webhook, so the frontend posts the
        session_id from the success URL and we pull the subscription in.
        """
        user = _require_user(request)
        customer = _get_or_create_customer(user)
        # Only email on the transition to Pro, not when the success page is refreshed.
        had_pro = active_subscription(user) is not None
        try:
            session = stripe.checkout.Session.retrieve(data.session_id)
            if session.customer != customer.id:
                raise HttpError(403, "Checkout session does not belong to this user")
            if session.subscription:
                stripe_sub = stripe.Subscription.retrieve(session.subscription)
                Subscription.sync_from_stripe_data(stripe_sub)
        except StripeError as e:
            raise HttpError(502, f"Stripe error: {e.user_message or e}")
        if not had_pro and active_subscription(user) is not None:
            send_pro_subscription_emails(user)
            # Property count may have changed between session creation and payment.
            sync_subscription_quantity(user)
        return _status_payload(user)

    @route.post("/portal", response=PortalOut)
    def portal(self, request):
        """Create a Stripe customer portal session (manage/cancel plan)."""
        user = _require_user(request)
        customer = _get_or_create_customer(user)
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer.id,
                return_url=f"{_origin(request)}/settings",
            )
        except StripeError as e:
            raise HttpError(502, f"Stripe error: {e.user_message or e}")
        return {"url": session.url}
