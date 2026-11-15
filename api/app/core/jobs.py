"""Scheduled jobs (Celery Beat): one instance at a time, structured logs with counts.

Celery tasks are synchronous; each run gets its own event loop (`asyncio.run`), so the
database engine and the Valkey client, which belong to a loop, are disposed at the end.
"""

import asyncio
from collections.abc import Awaitable, Callable

from redis.exceptions import LockError

from app.core.db import dispose_engine
from app.core.logging import log
from app.core.valkey import close_valkey, get_valkey

Job = Callable[[], Awaitable[dict[str, int]]]


async def run_locked(name: str, job: Job, lock_seconds: int) -> dict[str, int] | None:
    """Run `job` if no other instance holds its lock; None when skipped. Without Valkey the
    run is skipped too (fail closed: the next hour tries again)."""
    try:
        lock = get_valkey().lock(f"job:{name}", timeout=lock_seconds, blocking=False)
        acquired = await lock.acquire()
    except Exception as exc:
        log.error("job_skipped", job=name, reason="lock_unavailable", error=type(exc).__name__)
        return None
    if not acquired:
        log.info("job_skipped", job=name, reason="running_elsewhere")
        return None
    try:
        counts = await job()
        log.info("job_done", job=name, **counts)
        return counts
    finally:
        try:
            await lock.release()
        except (LockError, Exception) as exc:  # expired or Valkey gone: it times out anyway
            log.warning("job_lock_release_failed", job=name, error=type(exc).__name__)


def run(name: str, job: Job, lock_seconds: int = 50 * 60) -> None:
    """Entry point for a Celery task."""

    async def main() -> None:
        try:
            await run_locked(name, job, lock_seconds)
        finally:
            await dispose_engine()
            await close_valkey()

    asyncio.run(main())
