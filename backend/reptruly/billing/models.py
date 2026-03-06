from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils.translation import gettext_lazy as _
from djstripe.models import Subscription as DJStripeSubscription

from reptruly.core.models import DateModel, UUIDModel

User = get_user_model()


class Cart(UUIDModel):
    """Shopping cart for authenticated users."""

    user = models.OneToOneField(User, on_delete=models.CASCADE)

    @property
    def total_price(self) -> int:
        return sum(item.subtotal for item in self.items.all())

    @property
    def num_items(self) -> int:
        return self.items.aggregate(total=models.Sum("quantity"))["total"] or 0

    def __str__(self):
        return f"Cart {self.display_id} | {self.user}"


class CartItem(UUIDModel):
    """Item in a shopping cart."""

    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product_id = models.UUIDField(_("Product ID"))
    product_name = models.CharField(_("Product Name"), max_length=255)
    quantity = models.PositiveIntegerField(_("Quantity"), default=1)
    unit_price = models.IntegerField(_("Unit Price"))
    date_added = models.DateTimeField(_("Date Added"), auto_now_add=True)

    @property
    def subtotal(self) -> int:
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"


class Subscription(UUIDModel, DateModel):
    """User subscription model."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PAST_DUE = "PAST_DUE", "Past Due"
        UNPAID = "UNPAID", "Unpaid"
        INACTIVE = "INACTIVE", "Inactive"

    class Interval(models.TextChoices):
        MONTH = "MONTH", "Month"
        YEAR = "YEAR", "Year"

    user = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="subscriptions"
    )
    djstripe_subscription = models.OneToOneField(
        DJStripeSubscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subscription",
    )
    status = models.CharField(
        _("Status"),
        choices=Status.choices,
        max_length=20,
        default=Status.INACTIVE,
    )
    interval = models.CharField(
        _("Interval"),
        choices=Interval.choices,
        max_length=20,
        default=Interval.MONTH,
    )
    price = models.IntegerField(_("Price"), default=0)
    current_period_end = models.DateTimeField(
        _("Current Period End"), null=True, blank=True
    )
    end_at = models.DateTimeField(_("End At"), null=True, blank=True)

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE

    @property
    def is_cancelled(self) -> bool:
        return not self.is_active and self.end_at is not None

    def __str__(self):
        return f"Subscription {self.display_id} | {self.user} | {self.status}"


class Order(UUIDModel, DateModel):
    """Purchase order model."""

    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="orders")
    payment_id = models.CharField(
        _("Payment ID"), max_length=100, unique=True, null=True, blank=True
    )
    subtotal = models.IntegerField(_("Subtotal"))
    tax = models.IntegerField(_("Tax"), default=0)
    discount = models.IntegerField(_("Discount"), default=0)
    is_cancelled = models.BooleanField(_("Is Cancelled"), default=False)
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )

    @property
    def total_price(self) -> int:
        return self.subtotal + self.tax - self.discount

    @property
    def num_items(self) -> int:
        return self.items.aggregate(total=models.Sum("quantity"))["total"] or 0

    def __str__(self):
        return f"Order {self.display_id} | {self.user} | ${self.total_price / 100:.2f}"


class OrderItem(UUIDModel):
    """Item in an order."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product_id = models.UUIDField(_("Product ID"))
    product_name = models.CharField(_("Product Name"), max_length=255)
    quantity = models.PositiveIntegerField(_("Quantity"))
    price = models.IntegerField(_("Price"))
    status = models.CharField(
        _("Status"),
        choices=Status.choices,
        default=Status.PENDING,
        max_length=20,
    )

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"
