from django.contrib.auth.models import AbstractUser
from django.db.models import (
    CASCADE,
    SET_NULL,
    BooleanField,
    CharField,
    EmailField,
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
    email_verified = BooleanField(_("Email Verified"), default=False)

    # Profile fields surfaced to the dashboard onboarding flow.
    company_name = CharField(_("Company / Hotel group"), blank=True, max_length=255)
    phone = CharField(_("Phone"), blank=True, max_length=64)
    address = CharField(_("Address"), blank=True, max_length=512)
    city = CharField(_("City"), blank=True, max_length=128)
    state = CharField(_("State / Province"), blank=True, max_length=128)
    country = CharField(_("Country"), blank=True, max_length=128)

    @property
    def profile_completed(self) -> bool:
        """Profile is considered complete once the basics are filled in."""
        return bool(self.name and self.country)

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
        default=False,
        help_text="Receive emails about promotions.",
    )
    receive_product_update_emails = BooleanField(
        "Receive Product Update Emails",
        default=False,
        help_text="Receive emails when we add new features.",
    )

    # Email notification preferences, surfaced in Settings → Notifications.
    # Alerts go to alert_email when set, otherwise the account email.
    alert_email = EmailField(
        _("Alert email override"),
        blank=True,
        help_text="Send alerts to this address instead of the account email.",
    )
    notify_new_reviews = BooleanField(_("Email on new reviews"), default=True)
    notify_negative_reviews = BooleanField(
        _("Instant alert on negative reviews"), default=True
    )
    notify_daily_digest = BooleanField(_("Daily digest"), default=False)
    notify_weekly_summary = BooleanField(_("Weekly summary"), default=True)
    notify_monthly_report = BooleanField(_("Monthly owner report"), default=True)
    notify_rate_changes = BooleanField(_("Rate movement alerts"), default=True)
    notify_sync_failures = BooleanField(_("Sync failure alerts"), default=True)

    @property
    def alert_recipient(self) -> str:
        return self.alert_email or self.user.email

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
