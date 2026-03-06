# adds djstripe keys to db -- i.e. programmatically do this https://dj-stripe.dev/api_keys/
# pmy runscript -v3 scripts.add_djstripe_api_keys
from django.conf import settings
from django.db.utils import IntegrityError
from djstripe.admin.forms import APIKeyAdminCreateForm
from djstripe.models import APIKey

APP_NAME = "reptruly"
FORCE_ADD = False


def main(*args, **kwargs):
    keys = {}
    if settings.STRIPE_LIVE_MODE:
        print("loading live mode keys")
        keys[f"{APP_NAME} live pubic"] = settings.STRIPE_LIVE_PUBLIC_KEY
        keys[f"{APP_NAME} live secret"] = settings.STRIPE_LIVE_SECRET_KEY
    else:
        print("loading test mode keys")
        keys[f"{APP_NAME} test public"] = settings.STRIPE_TEST_PUBLIC_KEY
        keys[f"{APP_NAME} test secret"] = settings.STRIPE_TEST_SECRET_KEY
    if None in set(keys.values()):
        raise ValueError(
            "invalid key configuration. check if keys are loaded correctly"
        )
    for name, secret in keys.items():
        existing_objects = APIKey.objects.filter(secret=secret)
        if existing_objects.exists():
            print(f"{name=} already exists")
            if FORCE_ADD:
                print("adding anyway")
                existing_objects.delete()
            else:
                print("skipping adding")
                continue
        form = APIKeyAdminCreateForm(
            data={"name": name, "secret": secret},
        )
        try:
            form.save()
        except IntegrityError:
            print(
                f"encountered constraint error for {name=}. most likely it already exists"
            )
        print(f"created key for {name}")


def run(*args, **kwargs):
    main(*args, **kwargs)
