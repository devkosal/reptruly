"""Standalone URLconf for public_api tests.

The controllers are registered on the main API by config/api_router.py; tests
use this minimal urlconf (via @override_settings(ROOT_URLCONF=...)) so the
suite passes before/independently of that registration.
"""

from django.urls import path
from ninja_extra import NinjaExtraAPI

from reptruly.public_api.controllers import KeysAPI, PublicAPI

api = NinjaExtraAPI(urls_namespace="public_api_test")
api.register_controllers(KeysAPI, PublicAPI)

urlpatterns = [
    path("api/", api.urls),
]
