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
# (calendar/analytics schedules removed — those domains compute on demand)
# Digest emails go out after the 03:00 UTC syncs have landed fresh data.
# 13:00 UTC ≈ 9am US Eastern.
daily_digest_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=0, hour=13, **crontab_defaults
)
weekly_summary_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=15,
    hour=13,
    day_of_week="1",  # Monday
    day_of_month="*",
    month_of_year="*",
)
rate_alerts_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=45, hour=13, **crontab_defaults
)
monthly_report_schedule, _ = CrontabSchedule.objects.get_or_create(
    minute=30,
    hour=14,
    day_of_month="1",
    day_of_week="*",
    month_of_year="*",
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
        "reptruly.core.sync_tasks.sync_reviews_daily",
        crontab=daily_reviews_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.core.sync_tasks.sync_rates_daily",
        crontab=daily_rates_schedule,
    ),
    # calendar/analytics compute on demand (24h caches) — no sync tasks.
    CeleryTaskMetaData(
        "reptruly.users.tasks.send_daily_digests",
        crontab=daily_digest_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.users.tasks.send_weekly_summaries",
        crontab=weekly_summary_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.reviews.tasks.send_rate_opportunity_alerts",
        crontab=rate_alerts_schedule,
    ),
    CeleryTaskMetaData(
        "reptruly.users.tasks.send_monthly_reports",
        crontab=monthly_report_schedule,
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
