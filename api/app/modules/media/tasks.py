"""Celery tasks of the media module."""

import asyncio
import uuid

from app.core import jobs
from app.core.logging import log
from app.modules.media import service, storage
from app.worker import celery_app


@celery_app.task(  # type: ignore[untyped-decorator]
    name="media.delete_account_files",
    autoretry_for=(OSError,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=6,
)
def delete_account_files(account_id: str) -> None:
    """Remove every image file of a deleted account (ACC-BR-9). Idempotent."""
    prefix = str(uuid.UUID(account_id))  # never a path fragment from elsewhere
    asyncio.run(storage.delete_prefix(prefix))
    log.info("account_files_deleted", account_id=prefix)


@celery_app.task(name="media.remove_orphaned_files")  # type: ignore[untyped-decorator]
def remove_orphaned_files() -> None:
    """Hourly (Celery Beat)."""
    jobs.run("remove_orphaned_files", service.remove_orphaned_files)
