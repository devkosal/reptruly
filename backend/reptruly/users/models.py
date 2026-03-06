from django.contrib.auth.models import AbstractUser
from django.db.models import (
    CASCADE,
    SET_NULL,
    BooleanField,
    CharField,
    ForeignKey,
    OneToOneField,
    TextChoices,
)
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from djstripe.models import Customer

from reptruly.core.models import DateModel, UUIDModel


class User(UUIDModel, AbstractUser):
    """
    Default custom user model for reptruly.
    If adding fields that need to be filled at user signup,
    check forms.SignupForm and forms.SocialSignupForms accordingly.
    """

    # First and last name do not cover name patterns around the globe
    name = CharField(_("Full Name"), blank=True, max_length=255)
    first_name = None  # type: ignore
    last_name = None  # type: ignore
    customer = OneToOneField(Customer, null=True, blank=True, on_delete=SET_NULL)

    def get_absolute_url(self):
        """Get url for user's detail view."""
        return reverse("users:detail", kwargs={"username": self.username})

    @property
    def subscription(self):
        """Get the user's active subscription if any."""
        from reptruly.billing.models import Subscription

        return self.subscriptions.filter(
            status=Subscription.Status.ACTIVE,
        ).first()

    @property
    def is_paid_member(self):
        return self.subscription is not None


class Preferences(UUIDModel):
    """User preferences for customizing the application."""

    class Theme(TextChoices):
        LIGHT = "LIGHT", "Light"
        DARK = "DARK", "Dark"
        SYSTEM = "SYSTEM", "System"

    user = OneToOneField(User, on_delete=CASCADE, related_name="preferences")
    theme = CharField(
        _("UI Display Theme"),
        max_length=16,
        choices=Theme.choices,
        default=Theme.SYSTEM,
    )
    receive_marketing_emails = BooleanField(
        "Receive Marketing Emails",
        default=True,
        help_text="Receive emails about promotions.",
    )
    receive_product_update_emails = BooleanField(
        "Receive Product Update Emails",
        default=True,
        help_text="Receive emails when we add new features.",
    )

    def __str__(self):
        return f"{self.user.username}'s Preferences"


class APIKeyProfile(UUIDModel, DateModel):
    """Profile associated with an API key for tracking and management."""

    api_key = OneToOneField(
        "ninja_apikey.APIKey", on_delete=CASCADE, related_name="profile"
    )
    name = CharField(_("Name"), max_length=255, blank=True)

    def __str__(self):
        return f"API Key Profile: {self.name or self.api_key.prefix}"
