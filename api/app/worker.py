"""Celery application: `celery -A app.worker worker` and `celery -A app.worker beat`."""

from celery import Celery
from celery.schedules import crontab

import app.models  # noqa: F401 - all models, as in the API (tasks flush ORM objects)
from app.core.logging import configure_logging
from app.core.settings import get_settings

settings = get_settings()
configure_logging(settings.log_level)

celery_app = Celery("profilo", broker=str(settings.valkey_url))
celery_app.conf.update(
    task_ignore_result=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_hijack_root_logger=False,
    # Our structlog JSON goes straight to stdout; redirecting would re-wrap it as a warning.
    worker_redirect_stdouts=False,
    broker_connection_retry_on_startup=True,
    # Publishing from the API must fail fast when Valkey is down (notifications.send).
    broker_transport_options={"socket_connect_timeout": 2, "socket_timeout": 2},
    timezone="UTC",
    # Cleanup jobs (TASK-017), hourly at different minutes; each takes a Valkey lock.
    beat_schedule={
        "delete-unconfirmed-accounts": {
            "task": "accounts.delete_unconfirmed",
            "schedule": crontab(minute=5),
            "options": {"expires": 50 * 60},  # after an outage, no backlog of hourly runs
        },
        "release-quarantined-nicks": {
            "task": "profiles.release_quarantined_nicks",
            "schedule": crontab(minute=15),
            "options": {"expires": 50 * 60},  # after an outage, no backlog of hourly runs
        },
        "remove-orphaned-files": {
            "task": "media.remove_orphaned_files",
            "schedule": crontab(minute=25),
            "options": {"expires": 50 * 60},  # after an outage, no backlog of hourly runs
        },
    },
)
celery_app.autodiscover_tasks(
    [f"app.modules.{name}" for name in ("accounts", "profiles", "media", "notifications", "qr")]
)


@celery_app.task(name="system.ping")  # type: ignore[untyped-decorator]
def ping() -> str:
    return "pong"
