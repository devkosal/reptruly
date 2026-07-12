from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "reptruly.billing"

    def ready(self):
        # Connect Stripe webhook side-effects (dunning/lifecycle emails).
        from reptruly.billing import webhooks  # noqa: F401
