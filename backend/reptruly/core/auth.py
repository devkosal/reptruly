from django.contrib.auth.hashers import check_password
from ninja_apikey.models import APIKey
from ninja_extra.security import AsyncAPIKeyHeader


async def check_apikey(api_key: str):
    """Validate API key and return the associated user."""
    if not api_key or "." not in api_key:
        return None

    prefix, key = api_key.split(".", 1)

    # Use native async ORM (Django 4.1+)
    persistent_key = await APIKey.objects.filter(prefix=prefix).afirst()

    if not persistent_key:
        return None

    if not check_password(key, persistent_key.hashed_key):
        return None

    if not persistent_key.is_valid:
        return None

    # Access user through async select_related would be better
    # but for now sync access is acceptable here
    user = persistent_key.user

    if not user or not user.is_active:
        return None

    return user


class AsyncAPIKeyAuth(AsyncAPIKeyHeader):
    """Async API key authentication for Django Ninja.

    Usage:
        @api_controller(auth=AsyncAPIKeyAuth())
        class MyController:
            @http_post("/endpoint")
            async def endpoint(self, request):
                user = request.user
                ...
    """

    param_name = "X-API-Key"

    async def authenticate(self, request, key):
        user = await check_apikey(key)

        if not user:
            return None

        request.user = user
        return user
