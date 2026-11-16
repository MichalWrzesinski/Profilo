"""Fixed-window rate limits in Valkey.

If Valkey is unavailable the limit is not enforced: a cache outage must not make login
or registration fail (backend standard: dependency failure is not an application failure).
This also suspends the failed-login lockout, so it is logged at error level for alerting.

Keys never hold the subject in plain text (TASK-027): e-mail and IP addresses are personal
data, so the subject is replaced by a keyed hash (HMAC-SHA-256 with a key derived from the
server secret); without the secret a listed key cannot be checked against a guessed address.
"""

import hashlib
import hmac
import ipaddress
from dataclasses import dataclass
from functools import lru_cache

from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.core.valkey import get_valkey


@dataclass(frozen=True)
class Limit:
    name: str
    max_hits: int
    window_seconds: int


@lru_cache
def _hash_key() -> bytes:
    secret = get_settings().jwt_secret.get_secret_value().encode()
    return hmac.new(secret, b"profilo:rate-limit", hashlib.sha256).digest()


def counter_key(limit: Limit, subject: str) -> str:
    """The Valkey key of a subject's counter: `rl:<limit>:<hash>` (128 bits of HMAC-SHA-256)."""
    # The limit's name is part of the input: counters of different limits cannot be linked.
    message = f"{limit.name}:{subject}".encode()
    digest = hmac.new(_hash_key(), message, hashlib.sha256).hexdigest()[:32]
    return f"rl:{limit.name}:{digest}"


async def hit(limit: Limit, subject: str) -> int:
    """Count one hit; raise 429 when the limit is exceeded. Returns the current count."""
    key = counter_key(limit, subject)
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
            "Za dużo prób. Spróbuj ponownie później",
            headers={"Retry-After": str(retry_after)},
        )
    return count


def ip_subject(client_ip: str) -> str:
    """Subject of a per-IP limit: an IPv4 address, or the /64 network of an IPv6 address
    (one connection usually gets a whole /64, so single IPv6 addresses are free to change)."""
    try:
        address = ipaddress.ip_address(client_ip)
    except ValueError:
        return client_ip
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped:  # ::ffff:a.b.c.d is one IPv4 client, not a /64
            return str(address.ipv4_mapped)
        return str(ipaddress.ip_network(f"{address}/64", strict=False))
    return client_ip


async def is_blocked(limit: Limit, subject: str) -> int | None:
    """Return seconds until unblocked when the counter is already over the limit."""
    key = counter_key(limit, subject)
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
        await get_valkey().delete(counter_key(limit, subject))
    except Exception as exc:
        log.error("rate_limit_unavailable", limit=limit.name, error=type(exc).__name__)
