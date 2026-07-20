"""Per-property billing quantity logic, trial eligibility, webhook side-effects."""
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.core import mail

from reptruly.billing.entitlements import (
    EXPIRED,
    PRO,
    STARTER,
    get_plan,
    starter_trial_days_left,
)
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


class TestStarterTrial:
    def _aged_user(self, days_old):
        from datetime import timedelta

        from django.utils import timezone

        user = UserFactory()
        user.date_joined = timezone.now() - timedelta(days=days_old)
        user.save(update_fields=["date_joined"])
        return user

    def test_fresh_signup_is_on_starter_trial(self):
        user = self._aged_user(1)
        assert get_plan(user) is STARTER
        assert starter_trial_days_left(user) == 6

    def test_trial_expires_after_seven_days(self):
        user = self._aged_user(8)
        assert get_plan(user) is EXPIRED
        assert starter_trial_days_left(user) == 0
        assert EXPIRED.max_properties == 0

    def test_pro_subscription_overrides_expiry(self):
        from djstripe.models import Customer, Subscription

        user = self._aged_user(30)
        customer = Customer.objects.create(id="cus_expiry")
        user.customer = customer
        user.save(update_fields=["customer"])
        Subscription.objects.create(
            id="sub_expiry", customer=customer, stripe_data={"status": "active"}
        )
        assert get_plan(user) is PRO


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


class TestGroupPlan:
    """Self-serve Group plan: price-keyed detection + quantity floor."""

    def _group_sub(self, user, lookup_key="reptruly_group_month"):
        from djstripe.models import (
            Customer, Plan as DjPlan, Price, Product, Subscription, SubscriptionItem,
        )

        customer = Customer.objects.create(id=f"cus_grp_{user.pk}")
        user.customer = customer
        user.save(update_fields=["customer"])
        product, _ = Product.objects.get_or_create(
            id="prod_group", defaults={"name": "reptruly Group", "stripe_data": {}}
        )
        price = Price.objects.create(
            id=f"price_grp_{user.pk}",
            active=True,
            product=product,
            stripe_data={
                "lookup_key": lookup_key,
                "recurring": {"interval": "month"},
            },
        )
        # SubscriptionItem's legacy plan FK is non-null; a bare row satisfies it.
        dj_plan = DjPlan.objects.create(id=f"plan_grp_{user.pk}", stripe_data={})
        sub = Subscription.objects.create(
            id=f"sub_grp_{user.pk}", customer=customer,
            stripe_data={"status": "active"},
        )
        SubscriptionItem.objects.create(
            id=f"si_grp_{user.pk}", subscription=sub, price=price, plan=dj_plan,
            stripe_data={"quantity": 12},
        )
        return sub

    def test_group_lookup_key_resolves_to_group_plan(self):
        from reptruly.billing.entitlements import GROUP

        user = UserFactory()
        self._group_sub(user)
        assert get_plan(user) is GROUP

    def test_other_price_resolves_to_pro(self):
        user = UserFactory()
        self._group_sub(user, lookup_key="something_else")
        assert get_plan(user) is PRO

    def test_group_quantity_floors_at_minimum(self):
        from reptruly.billing.entitlements import GROUP, GROUP_MIN_PROPERTIES

        user = UserFactory()
        _add_properties(user, 3)
        assert desired_quantity(user, GROUP) == GROUP_MIN_PROPERTIES

    def test_group_quantity_tracks_larger_portfolios(self):
        from reptruly.billing.entitlements import GROUP

        user = UserFactory()
        _add_properties(user, 15)
        assert desired_quantity(user, GROUP) == 15

    def test_group_price_reuses_existing_lookup_key(self):
        from djstripe.models import Price, Product

        from reptruly.billing.api.controllers import _group_price

        product, _ = Product.objects.get_or_create(
            id="prod_group", defaults={"name": "reptruly Group", "stripe_data": {}}
        )
        existing = Price.objects.create(
            id="price_group_existing",
            active=True,
            product=product,
            stripe_data={"lookup_key": "reptruly_group_month"},
        )
        with patch("reptruly.billing.api.controllers.stripe") as stripe_mock:
            assert _group_price().id == existing.id
        stripe_mock.Price.create.assert_not_called()


class TestGroupEligibility:
    """Group is verified by connected properties — no self-declaration."""

    def test_checkout_group_rejected_below_threshold(self, client):
        user = UserFactory()
        _add_properties(user, 5)
        client.force_login(user)
        res = client.post("/api/billing/checkout?plan=group")
        assert res.status_code == 400
        assert "you have 5" in res.json()["detail"]

    def test_switch_requires_active_subscription(self, client):
        user = UserFactory()
        _add_properties(user, 10)
        client.force_login(user)
        res = client.post("/api/billing/switch-to-group")
        assert res.status_code == 400
        assert "checkout" in res.json()["detail"]

    def test_switch_rejected_below_threshold(self, client):
        from djstripe.models import Customer, Subscription

        user = UserFactory()
        _add_properties(user, 4)
        customer = Customer.objects.create(id=f"cus_sw_{user.pk}")
        user.customer = customer
        user.save(update_fields=["customer"])
        Subscription.objects.create(
            id=f"sub_sw_{user.pk}", customer=customer,
            stripe_data={"status": "active"},
        )
        client.force_login(user)
        res = client.post("/api/billing/switch-to-group")
        assert res.status_code == 400
        assert "you have 4" in res.json()["detail"]
