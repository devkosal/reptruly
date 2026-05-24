# dmy runscript -v3 scripts.add_scheduled_tasks
from dataclasses import dataclass
from typing import Union

from celery.utils.log import get_task_logger
from django_celery_beat.models import CrontabSchedule, IntervalSchedule, PeriodicTask

logger = get_task_logger(__name__)
crontab_defaults = {"day_of_week": "*", "day_of_month": "*", "month_of_year": "*"}
every_ten_seconds_schedule, _ = IntervalSchedule.objects.get_or_create(
    every=10, period=IntervalSchedule.SECONDS
)
every_minute_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute="*", hour="*", **crontab_defaults
)
every_hour_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=0, hour="*", **crontab_defaults
)
# Daily sync schedules — staggered so they don't all fire at the same minute.
daily_reviews_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=0, hour=3, **crontab_defaults
)
daily_rates_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=15, hour=3, **crontab_defaults
)
daily_calendar_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=30, hour=3, **crontab_defaults
)
daily_analytics_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=45, hour=3, **crontab_defaults
)


# TODO(devkosal): manage hardcoded tasks in settings.py
@dataclass
class CeleryTaskMetaData:
    task_path: str
    interval: IntervalSchedule | None = None
    crontab: CrontabSchedule | None = None
    enabled: bool = True

    def __post_init__(self):
        if bool(self.interval) + bool(self.crontab) != 1:
            raise ValueError("exactly one of interval or crontab must be passed")


TASKS = [
    CeleryTaskMetaData(
        task_path="reptruly.billing.tasks.sample_force_task",
        crontab=every_minute_schedule,
        # for reference on using `every_minute_schedule`
        enabled=False,
    ),
    CeleryTaskMetaData(
        "reptruly.billing.tasks.post_usage_charges_to_stripe",
        crontab=every_hour_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.core.sync_tasks.sync_reviews_daily",
        crontab=daily_reviews_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.core.sync_tasks.sync_rates_daily",
        crontab=daily_rates_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.core.sync_tasks.sync_calendar_daily",
        crontab=daily_calendar_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.core.sync_tasks.sync_analytics_daily",
        crontab=daily_analytics_schedule,
    ),
]

FORCE_ADD = False


def main():
    for task in TASKS:
        task_name = task.task_path.split(".")[-1]
        existing = PeriodicTask.objects.filter(name=task_name)
        if existing.exists():
            logger.info(f"task {task_name} already exists.")
            if not FORCE_ADD:
                logger.info("`FORCE_ADD` is false so skipping recreating the task")
                continue
            logger.info("deleting existing")
            existing.delete()
        PeriodicTask.objects.create(
            interval=task.interval,
            crontab=task.crontab,
            name=task_name,
            # str path to task
            task=task.task_path,
            enabled=task.enabled,
        )
        logger.info(f"created task {task_name}")


def run():
    main()
