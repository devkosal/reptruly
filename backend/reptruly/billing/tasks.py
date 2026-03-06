"""in order to add any task you must use the `add_scheduled_tasks` script"""
import stripe
from celery.utils.log import get_task_logger
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import F, Sum
from djstripe.models import Price, UsageRecord
from stripe.error import RateLimitError

from config import celery_app
from reptruly.billing.utils import set_stripe_api_key

logger = get_task_logger(__name__)
User = get_user_model()
set_stripe_api_key()


@celery_app.task()
def sample_force_task():
    logger.warning("may the force be with you. you were supposed to be the chosen one")
