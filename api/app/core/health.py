import asyncio

from fastapi import APIRouter
from sqlalchemy import text

from app.core.db import get_engine
from app.core.errors import problem_response
from app.core.health_models import HealthStatus
from app.core.logging import log
from app.core.settings import get_settings
from app.core.valkey import get_valkey

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> HealthStatus:
    """The process is running. Does not check dependencies."""
    return HealthStatus()


async def _check_database() -> None:
    async with get_engine().connect() as conn:
        await conn.execute(text("SELECT 1"))


async def _check_valkey() -> None:
    await get_valkey().ping()


@router.get("/ready", response_model=None)
async def ready() -> object:
    """The app can serve requests: PostgreSQL and Valkey are reachable."""
    timeout = get_settings().dependency_timeout_seconds
    checks = {"database": _check_database, "valkey": _check_valkey}

    async def run(name: str) -> str | None:
        try:
            await asyncio.wait_for(checks[name](), timeout=timeout)
        except Exception as exc:  # any failure, including timeout, means "not ready"
            log.warning("readiness_check_failed", dependency=name, error=type(exc).__name__)
            return name
        return None

    results = await asyncio.gather(*(run(name) for name in checks))
    failed = [name for name in results if name]
    if failed:
        return problem_response(
            503,
            "dependency_unavailable",
            "Required dependencies are unavailable.",
            headers={"Retry-After": "5"},
            dependencies=failed,
        )
    return {"status": "ready"}
