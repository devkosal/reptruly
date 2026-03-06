from django.urls import path

from reptruly.billing.views import (
    stripe_customer_portal_view,
)

app_name = "users"
urlpatterns = [
    path(
        "customer-portal-session/",
        view=stripe_customer_portal_view,
        name="stripe-customer-portal",
    ),
]
