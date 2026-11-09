from redis.asyncio import Redis

from app.core.settings import get_settings

_client: Redis | None = None


def get_valkey() -> Redis:
    """Shared Valkey client (Redis protocol) for rate limits and caching."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = Redis.from_url(
            str(settings.valkey_url),
            socket_timeout=settings.dependency_timeout_seconds,
            socket_connect_timeout=settings.dependency_timeout_seconds,
        )
    return _client


async def close_valkey() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
    _client = None
