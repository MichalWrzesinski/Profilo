"""Celery tasks of the profiles module."""

from app.core import jobs
from app.modules.profiles import service
from app.worker import celery_app


@celery_app.task(name="profiles.release_quarantined_nicks")  # type: ignore[untyped-decorator]
def release_quarantined_nicks() -> None:
    """Hourly (Celery Beat): ACC-BR-10."""
    jobs.run("release_quarantined_nicks", service.release_quarantined_nicks)
