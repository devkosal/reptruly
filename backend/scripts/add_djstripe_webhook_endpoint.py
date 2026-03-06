# add stripe wehbook endpoint to db and stripe
# pmy runscript -v3 scripts.add_djstripe_webhook_endpoint
import stripe
from django.conf import settings
from djstripe.admin.forms import WebhookEndpointAdminCreateForm
from djstripe.models import WebhookEndpoint

from reptruly.billing.utils import set_stripe_api_key

set_stripe_api_key()


def main(*args, **kwargs):
    # adding constant here to avoid scope issues with modifying FORCE_ADD in method
    FORCE_ADD = False
    base_url = settings.DOMAIN_NAME
    existing_webhooks = WebhookEndpoint.objects.all()
    existing_domain_webhook = WebhookEndpoint.objects.filter(url__startswith=base_url)
    # if WebhookEndpoint is non empty but current domain name does not exist, there has been
    # a change in domain name.
    if existing_webhooks.exists() and not existing_domain_webhook.exists():
        print("change in domain name detected. enforcing `FORCE_ADD` as true")
        FORCE_ADD = True
    if existing_webhooks.exists():
        print("webhook(s) already exists")
        if not FORCE_ADD:
            print("skipping. set `FORCE_ADD` as true to override any existing webhooks")
            return
        else:
            # only a single webhook per deployment can exist so even if there were two webhooks
            # prior to running this, only one will remain in the end.
            print(
                "deleting all existing webhooks and adding since `FORCE_ADD` is true\n"
                f"webhooks to be deleted: {[w.url for w in existing_webhooks]}"
            )
            # djstripe does not delete webhooks on stripe. force deleting directly here first.
            for wh in existing_webhooks:
                print(f"force deleting webhook from stripe {wh.url}")
                stripe.WebhookEndpoint.delete(wh.id)
            existing_webhooks.delete()
    else:
        print("no existing webhook found")
    print(f"adding a new webhook for {base_url=}")
    livemode = settings.STRIPE_LIVE_MODE
    data = {
        "base_url": base_url,
        "livemode": livemode,
        "enabled_events": ["*"],
    }
    form = WebhookEndpointAdminCreateForm(data)
    form.full_clean()
    new_webhook = form.save()
    print(
        f"created webhook endpoint for {base_url=} and {livemode=} at {new_webhook.url=}"
    )


def run(*args, **kwargs):
    main(*args, **kwargs)
