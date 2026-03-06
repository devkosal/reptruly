from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class StaticS3Storage(S3Boto3Storage):
    """S3 storage backend for static files."""

    location = "static"
    default_acl = None


class MediaS3Storage(S3Boto3Storage):
    """S3 storage backend for media files."""

    location = "media"
    file_overwrite = False


# Backwards compatibility aliases
StaticRootS3Boto3Storage = StaticS3Storage
MediaRootS3Boto3Storage = MediaS3Storage
