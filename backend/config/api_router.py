from django.contrib.admin.views.decorators import staff_member_required
from ninja_extra import NinjaExtraAPI

from reptruly.core.api.controllers import HealthCheckAPI
from reptruly.users.api.controllers import UserAPI

# https://github.com/vitalik/django-ninja/issues/267
api = NinjaExtraAPI(docs_decorator=staff_member_required)

api.register_controllers(
    HealthCheckAPI,
    # UserAPI,
)
