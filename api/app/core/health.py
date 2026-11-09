import asyncio

from fastapi import APIRouter
from sqlalchemy import text

from app.core.db import get_engine
from app.core.errors import problem_response
from app.core.logging import log
from app.core.settings import get_settings
from app.core.valkey import get_valkey

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict[str, str]:
    """The process is running. Does not check dependencies."""
    return {"status": "ok"}


async def _check_database() -> None:
    async with get_engine().connect() as conn:
        await conn.execute(text("SELECT 1"))


async def _check_valkey() -> None:
    await get_valkey().ping()


@router.get("/ready", response_model=None)
async def ready() -> object:
    """The app can serve requests: PostgreSQL and Valkey are reachable."""
    timeout = get_settings().dependency_timeout_seconds
    failed: list[str] = []
    for name, check in (("database", _check_database), ("valkey", _check_valkey)):
        try:
            await asyncio.wait_for(check(), timeout=timeout)
        except Exception as exc:  # any failure means "not ready"
            log.warning("readiness_check_failed", dependency=name, error=type(exc).__name__)
            failed.append(name)
    if failed:
        return problem_response(
            503,
            "dependency_unavailable",
            "Required dependencies are unavailable.",
            headers={"Retry-After": "5"},
            dependencies=failed,
        )
    return {"status": "ready"}
