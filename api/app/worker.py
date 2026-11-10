"""Celery application: `celery -A app.worker worker` and `celery -A app.worker beat`."""

from celery import Celery

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
    broker_connection_retry_on_startup=True,
    # Publishing from the API must fail fast when Valkey is down (notifications.send).
    broker_transport_options={"socket_connect_timeout": 2, "socket_timeout": 2},
    timezone="UTC",
    beat_schedule={},
)
celery_app.autodiscover_tasks(
    [f"app.modules.{name}" for name in ("accounts", "profiles", "media", "notifications", "qr")]
)


@celery_app.task(name="system.ping")  # type: ignore[untyped-decorator]
def ping() -> str:
    return "pong"
