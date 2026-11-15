"""Celery tasks of the accounts module."""

from app.core import jobs
from app.modules.accounts import cleanup
from app.worker import celery_app


@celery_app.task(name="accounts.delete_unconfirmed")  # type: ignore[untyped-decorator]
def delete_unconfirmed() -> None:
    """Hourly (Celery Beat): ACC-BR-6."""
    jobs.run("delete_unconfirmed", cleanup.delete_unconfirmed)
