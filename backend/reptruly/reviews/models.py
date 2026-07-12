from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from reptruly.core.models import UUIDModel, DateModel


class Property(UUIDModel, DateModel):
    """A hotel property a user has connected to reptruly."""

    class OTA(models.TextChoices):
        BOOKING = "Booking.com", "Booking.com"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="properties",
    )
    ota = models.CharField(
        _("OTA"), max_length=32, choices=OTA.choices, default=OTA.BOOKING
    )
    booking_hotel_id = models.CharField(
        _("Booking.com Hotel ID"), max_length=64, db_index=True, blank=True
    )
    expedia_property_id = models.CharField(
        _("Expedia/Hotels.com Property ID"), max_length=64, db_index=True, blank=True
    )
    google_place_id = models.CharField(
        _("Google Place ID"), max_length=255, db_index=True, blank=True
    )
    property_name = models.CharField(_("Property Name"), max_length=255)
    location = models.CharField(_("Location"), max_length=512, blank=True)
    latitude = models.FloatField(_("Latitude"), null=True, blank=True)
    longitude = models.FloatField(_("Longitude"), null=True, blank=True)
    currency = models.CharField(_("Currency"), max_length=8, blank=True)
    last_synced_at = models.DateTimeField(_("Last Synced At"), null=True, blank=True)

    class Meta:
        ordering = ["property_name"]
        verbose_name = "Property"
        verbose_name_plural = "Properties"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "ota", "booking_hotel_id"],
                name="unique_property_per_user_ota",
            ),
        ]

    def __str__(self):
        return f"{self.property_name} ({self.ota}:{self.booking_hotel_id})"


class Review(UUIDModel, DateModel):
    """A guest review fetched from Channex (Airbnb, Booking.com, Expedia)."""

    channex_id = models.CharField(
        _("Channex ID"), max_length=100, unique=True, db_index=True
    )
    property_id = models.CharField(_("Property ID"), max_length=100, db_index=True)
    property_name = models.CharField(_("Property Name"), max_length=255, blank=True)
    location = models.CharField(_("Location"), max_length=512, blank=True)
    ota_name = models.CharField(_("OTA Name"), max_length=100, blank=True, db_index=True)
    reservation_id = models.CharField(_("Reservation ID"), max_length=100, blank=True)
    reviewer_name = models.CharField(_("Reviewer Name"), max_length=255, blank=True)
    content = models.TextField(_("Review Content"), blank=True)
    overall_score = models.FloatField(_("Overall Score"), null=True, blank=True)
    has_reply = models.BooleanField(_("Has Reply"), default=False)
    reply = models.TextField(_("Owner Reply"), blank=True)
    is_pending = models.BooleanField(_("Is Pending"), default=False)
    scores = models.JSONField(_("Scores"), default=list)
    tags = models.JSONField(_("Tags"), default=list)
    reviewed_at = models.DateTimeField(_("Reviewed At"), null=True, blank=True)
    raw_data = models.JSONField(_("Raw Data"), default=dict)

    class Meta:
        ordering = ["-reviewed_at", "-created_at"]
        verbose_name = "Review"
        verbose_name_plural = "Reviews"
        indexes = [
            # Hot path: analytics endpoints filter by property_name and group by ota_name,
            # often constrained to a date window. Composite index dramatically speeds up
            # those grouped aggregates.
            models.Index(fields=["property_name", "ota_name", "reviewed_at"]),
            models.Index(fields=["property_id", "ota_name"]),
        ]

    def __str__(self):
        return f"{self.ota_name} | {self.property_name} | score={self.overall_score}"
