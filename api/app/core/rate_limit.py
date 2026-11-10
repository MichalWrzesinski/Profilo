"""Fixed-window rate limits in Valkey.

If Valkey is unavailable the limit is not enforced: a cache outage must not make login
or registration fail (backend standard: dependency failure is not an application failure).
This also suspends the failed-login lockout, so it is logged at error level for alerting.
"""

from dataclasses import dataclass

from app.core.errors import ProblemError
from app.core.logging import log
from app.core.valkey import get_valkey


@dataclass(frozen=True)
class Limit:
    name: str
    max_hits: int
    window_seconds: int


async def hit(limit: Limit, subject: str) -> int:
    """Count one hit; raise 429 when the limit is exceeded. Returns the current count."""
    key = f"rl:{limit.name}:{subject}"
    try:
        client = get_valkey()
        count = int(await client.incr(key))
        if count == 1:
            await client.expire(key, limit.window_seconds)
        ttl = int(await client.ttl(key))
    except Exception as exc:  # fail open, see module docstring
        log.error("rate_limit_unavailable", limit=limit.name, error=type(exc).__name__)
        return 0
    if count > limit.max_hits:
        log.warning("rate_limited", limit=limit.name)
        retry_after = max(ttl, 1)
        raise ProblemError(
            429,
            "rate_limited",
            "Za dużo prób. Spróbuj ponownie później.",
            headers={"Retry-After": str(retry_after)},
        )
    return count


async def is_blocked(limit: Limit, subject: str) -> int | None:
    """Return seconds until unblocked when the counter is already over the limit."""
    key = f"rl:{limit.name}:{subject}"
    try:
        client = get_valkey()
        value = await client.get(key)
        if value is not None and int(value) >= limit.max_hits:
            return max(int(await client.ttl(key)), 1)
    except Exception as exc:
        log.error("rate_limit_unavailable", limit=limit.name, error=type(exc).__name__)
    return None


async def reset(limit: Limit, subject: str) -> None:
    try:
        await get_valkey().delete(f"rl:{limit.name}:{subject}")
    except Exception as exc:
        log.error("rate_limit_unavailable", limit=limit.name, error=type(exc).__name__)
