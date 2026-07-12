"""in order to add any task you must use the `add_scheduled_tasks` script"""
from celery.utils.log import get_task_logger

from config import celery_app

logger = get_task_logger(__name__)


@celery_app.task()
def sample_force_task():
    logger.warning("may the force be with you. you were supposed to be the chosen one")
