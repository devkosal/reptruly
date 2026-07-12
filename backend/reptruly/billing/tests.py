"""Per-property billing quantity logic, trial eligibility, webhook side-effects."""
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.core import mail

from reptruly.billing.entitlements import has_ever_subscribed
from reptruly.billing.quantity import desired_quantity, sync_subscription_quantity
from reptruly.billing.webhooks import (
    on_payment_failed,
    on_subscription_deleted,
    on_trial_will_end,
)
from reptruly.reviews.models import Property
from reptruly.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _user_with_customer(email="hotelier@example.com", cus_id="cus_webhook"):
    from djstripe.models import Customer

    user = UserFactory(email=email)
    customer = Customer.objects.create(id=cus_id)
    user.customer = customer
    user.save(update_fields=["customer"])
    return user


def _event(obj: dict):
    return SimpleNamespace(id="evt_test", data={"object": obj})


class TestWebhookEmails:
    def test_payment_failed_emails_user_and_admins(self, settings):
        settings.ADMINS = [("Admin", "owner@reptruly.com")]
        _user_with_customer()
        on_payment_failed(
            sender=None,
            event=_event({"customer": "cus_webhook", "amount_due": 8997, "currency": "usd"}),
        )
        assert len(mail.outbox) == 2
        assert mail.outbox[0].to == ["hotelier@example.com"]
        assert "payment failed" in mail.outbox[0].subject.lower()
        assert "$89.97" in mail.outbox[0].body
        assert mail.outbox[1].to == ["owner@reptruly.com"]

    def test_subscription_deleted_emails_user(self):
        _user_with_customer()
        on_subscription_deleted(
            sender=None, event=_event({"customer": "cus_webhook"})
        )
        assert len(mail.outbox) == 1
        assert "has ended" in mail.outbox[0].subject

    def test_trial_will_end_includes_upcoming_charge(self):
        _user_with_customer()
        on_trial_will_end(
            sender=None,
            event=_event({
                "customer": "cus_webhook",
                "items": {"data": [{
                    "quantity": 2,
                    "price": {"unit_amount": 2999, "currency": "usd", "recurring": {"interval": "month"}},
                }]},
            }),
        )
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert "trial ends in 3 days" in msg.subject
        assert "$59.98" in msg.body and "per month" in msg.body

    def test_unknown_customer_is_ignored(self):
        on_payment_failed(sender=None, event=_event({"customer": "cus_nobody"}))
        assert len(mail.outbox) == 0


class TestProPriceSelection:
    def _price(self, pid, interval):
        from djstripe.models import Price, Product

        product, _ = Product.objects.get_or_create(
            id="prod_test", defaults={"name": "Test Pro", "stripe_data": {}}
        )
        return Price.objects.create(
            id=pid,
            active=True,
            product=product,
            stripe_data={"recurring": {"interval": interval}},
        )

    def test_picks_price_matching_interval(self):
        from reptruly.billing.api.controllers import _pro_price

        monthly = self._price("price_m", "month")
        annual = self._price("price_y", "year")
        assert _pro_price("month").id == monthly.id
        assert _pro_price("year").id == annual.id

    def test_missing_interval_raises_503(self):
        from ninja.errors import HttpError

        from reptruly.billing.api.controllers import _pro_price

        self._price("price_m", "month")
        with pytest.raises(HttpError):
            _pro_price("year")


class TestTrialEligibility:
    def test_no_customer_never_subscribed(self):
        assert has_ever_subscribed(UserFactory()) is False

    def test_customer_with_any_subscription_is_ineligible(self):
        from djstripe.models import Customer, Subscription

        user = UserFactory()
        customer = Customer.objects.create(id="cus_trialtest")
        user.customer = customer
        user.save(update_fields=["customer"])
        assert has_ever_subscribed(user) is False

        # Even a long-cancelled subscription burns the one-time trial.
        Subscription.objects.create(
            id="sub_trialtest",
            customer=customer,
            stripe_data={"status": "canceled"},
        )
        assert has_ever_subscribed(user) is True


def _add_properties(user, n):
    for i in range(n):
        Property.objects.create(
            user=user, property_name=f"Hotel {i}", booking_hotel_id=str(1000 + i)
        )


class TestDesiredQuantity:
    def test_zero_properties_bills_one(self):
        assert desired_quantity(UserFactory()) == 1

    def test_one_per_property(self):
        user = UserFactory()
        _add_properties(user, 3)
        assert desired_quantity(user) == 3

    def test_capped_at_plan_max(self):
        user = UserFactory()
        _add_properties(user, 12)
        assert desired_quantity(user) == 10


class TestSyncSubscriptionQuantity:
    def test_noop_without_subscription(self):
        # No customer/subscription — must return silently, no Stripe calls.
        with patch("reptruly.billing.quantity.stripe") as stripe_mock:
            sync_subscription_quantity(UserFactory())
        stripe_mock.SubscriptionItem.modify.assert_not_called()

    def test_stripe_error_never_raises(self):
        # A broken subscription object raises inside the sync body — the helper
        # must swallow it so property CRUD keeps working.
        with patch(
            "reptruly.billing.quantity.active_subscription", return_value=object()
        ):
            sync_subscription_quantity(UserFactory())

    def test_modifies_when_quantity_differs(self):
        user = UserFactory()
        _add_properties(user, 2)

        class FakeItem:
            id = "si_test"
            stripe_data = {"quantity": 1}

        class FakeItems:
            def first(self):
                return FakeItem()

        class FakeSub:
            id = "sub_test"
            items = FakeItems()

        with (
            patch("reptruly.billing.quantity.active_subscription", return_value=FakeSub()),
            patch("reptruly.billing.quantity.set_stripe_api_key"),
            patch("reptruly.billing.quantity.stripe") as stripe_mock,
            patch("reptruly.billing.quantity.Subscription") as sub_model_mock,
        ):
            sync_subscription_quantity(user)

        stripe_mock.SubscriptionItem.modify.assert_called_once_with(
            "si_test", quantity=2, proration_behavior="create_prorations"
        )
        stripe_mock.Subscription.retrieve.assert_called_once_with("sub_test")
        sub_model_mock.sync_from_stripe_data.assert_called_once()

    def test_no_call_when_quantity_matches(self):
        user = UserFactory()
        _add_properties(user, 2)

        class FakeItem:
            id = "si_test"
            stripe_data = {"quantity": 2}

        class FakeItems:
            def first(self):
                return FakeItem()

        class FakeSub:
            id = "sub_test"
            items = FakeItems()

        with (
            patch("reptruly.billing.quantity.active_subscription", return_value=FakeSub()),
            patch("reptruly.billing.quantity.stripe") as stripe_mock,
        ):
            sync_subscription_quantity(user)

        stripe_mock.SubscriptionItem.modify.assert_not_called()
