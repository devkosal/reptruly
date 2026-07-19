from django.contrib.admin.views.decorators import staff_member_required
from ninja_extra import NinjaExtraAPI

from reptruly.billing.api.controllers import BillingAPI
from reptruly.core.api.controllers import HealthCheckAPI
from reptruly.core.api.sync_controller import SyncAPI
from reptruly.events.api.controllers import CalendarAPI
from reptruly.reviews.api.controllers import (
    BadgeAPI,
    PropertiesAPI,
    RatesAPI,
    ReviewsAPI,
)
from reptruly.reviews.api.rate_history_controller import RateHistoryAPI
from reptruly.reviews.api.rate_outlook_controller import RateOutlookAPI
from reptruly.public_api.controllers import KeysAPI, PublicAPI
from reptruly.users.api.controllers import AuthAPI

# https://github.com/vitalik/django-ninja/issues/267
api = NinjaExtraAPI(docs_decorator=staff_member_required)

api.register_controllers(
    HealthCheckAPI,
    AuthAPI,
    ReviewsAPI,
    PropertiesAPI,
    RatesAPI,
    RateHistoryAPI,
    RateOutlookAPI,
    BadgeAPI,
    CalendarAPI,
    SyncAPI,
    BillingAPI,
    KeysAPI,
    PublicAPI,
)
