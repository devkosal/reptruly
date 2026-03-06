import asyncio
import io
import time
from django.conf import settings
from ninja import File, UploadedFile
from ninja.responses import codes_4xx
from ninja_apikey.security import APIKeyAuth
from ninja_extra import api_controller, http_get, http_post, throttle

from reptruly.core.common.decorators.api import (
    error_500,
)
from reptruly.core.common.schema import Message
from reptruly.core.common.throttles import (
    UserDefaultBurstThrottle,
    UserDefaultSustainedThrottle,
)
from reptruly.core.common.utils import get_logger

auth = APIKeyAuth()
logger = get_logger()


@api_controller(auth=auth)
class HealthCheckAPI:
    """test!"""

    @http_get("/health", response={200: Message})
    @throttle(UserDefaultBurstThrottle, UserDefaultSustainedThrottle)
    def health(self, request):
        return 200, {"message": "all good"}