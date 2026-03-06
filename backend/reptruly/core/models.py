import uuid
from typing import Any

from django.db import models
from django.utils.translation import gettext_lazy as _


class UUIDModel(models.Model):
    """Base model with UUID primary key."""

    id = models.UUIDField(_("UUID"), primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

    @property
    def display_id(self) -> str:
        """Return a short display-friendly ID."""
        return str(self.id)[:8]


class DateModel(models.Model):
    """Base model with created_at and updated_at timestamps."""

    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated At"), auto_now=True)

    class Meta:
        abstract = True


class MetadataModel(models.Model):
    """Base model with a JSON metadata field."""

    metadata = models.JSONField(_("Metadata"), default=dict, blank=True)

    class Meta:
        abstract = True

    def set_metadata_key(self, key: str, value: Any | None = None):
        self.metadata = self.metadata or {}
        self.metadata[key] = value
        self.save(update_fields=["metadata"])

    def get_metadata_key(self, key: str) -> Any | None:
        if self.metadata is None:
            return None
        return self.metadata.get(key)

    def delete_metadata_key(self, key: str):
        if self.metadata and key in self.metadata:
            del self.metadata[key]
            self.save(update_fields=["metadata"])


class IPModel(models.Model):
    """Base model with IP address field."""

    ip_address = models.GenericIPAddressField(_("IP Address"), blank=True, null=True)

    class Meta:
        abstract = True


class FileHashModel(models.Model):
    """Base model with file hash field for deduplication."""

    file_hash = models.CharField(_("File Hash"), max_length=64, blank=True)

    class Meta:
        abstract = True


class LanguageModel(models.Model):
    """Base model with language field."""

    language = models.CharField(_("Language"), max_length=10, blank=True)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, DateModel, MetadataModel):
    """Combined base model with UUID, timestamps, and metadata."""

    class Meta:
        abstract = True
