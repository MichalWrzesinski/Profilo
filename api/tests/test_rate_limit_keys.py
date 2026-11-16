"""Rate-limit keys hold no personal data (TASK-027)."""

import pytest
from httpx import AsyncClient

from app.core import rate_limit
from app.core.valkey import get_valkey

EMAIL = "Anna.Klucz@example.pl"
IP = "203.0.113.77"


async def test_keys_hold_no_addresses_after_logins_registrations_and_resets(
    client: AsyncClient, clean_state: None
) -> None:
    """Scenario 2: after logins, a registration and a reset request, no key contains an
    e-mail or IP address (the test client's address is 127.0.0.1)."""
    for _ in range(3):
        await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "x" * 12})
    await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Anna",
            "email": EMAIL,
            "password": "ciche-jezioro-pod-tatrami",
            "acceptTerms": True,
        },
    )
    await client.post("/api/v1/auth/password-resets", json={"email": EMAIL})

    keys = [k.decode() if isinstance(k, bytes) else k for k in await get_valkey().keys("rl:*")]
    assert keys, "the requests above must have created counters"
    for key in keys:
        assert "@" not in key
        name, digest = key.removeprefix("rl:").rsplit(":", 1)
        assert name
        assert len(digest) == 32
        assert int(digest, 16) >= 0  # hex


def test_counter_key_is_a_keyed_hash() -> None:
    limit = rate_limit.Limit("login_fail", max_hits=5, window_seconds=900)
    key = rate_limit.counter_key(limit, EMAIL)
    assert key.startswith("rl:login_fail:")
    assert EMAIL not in key
    assert IP not in rate_limit.counter_key(limit, IP)
    assert key == rate_limit.counter_key(limit, EMAIL)  # stable: the same counter
    assert key != rate_limit.counter_key(limit, "inna@example.pl")
    # Different limits give different hashes: their counters cannot be linked.
    other = rate_limit.Limit("register_email", max_hits=5, window_seconds=900)
    assert key.split(":")[-1] != rate_limit.counter_key(other, EMAIL).split(":")[-1]


def test_hash_depends_on_the_server_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import SecretStr

    from app.core.settings import get_settings

    limit = rate_limit.Limit("login_fail", max_hits=5, window_seconds=900)
    before = rate_limit.counter_key(limit, EMAIL)
    monkeypatch.setattr(get_settings(), "jwt_secret", SecretStr("another-secret-" * 4))
    rate_limit._hash_key.cache_clear()
    try:
        assert rate_limit.counter_key(limit, EMAIL) != before
    finally:
        monkeypatch.undo()
        rate_limit._hash_key.cache_clear()


async def test_ip_limits_count_an_ipv6_network(client: AsyncClient, clean_state: None) -> None:
    """Every per-IP limit counts IPv6 per /64 (an address can change within it)."""
    from app.modules.accounts import confirmation, password_reset
    from app.modules.profiles import service as profiles

    a, b = "2001:db8:1:2::10", "2001:db8:1:2::99"
    for limit in (
        confirmation.RESEND_PER_IP,
        confirmation.CONFIRM_PER_IP,
        password_reset.CONFIRM_PER_IP,
        profiles.OG_RENDERS,
    ):
        assert rate_limit.counter_key(limit, rate_limit.ip_subject(a)) == rate_limit.counter_key(
            limit, rate_limit.ip_subject(b)
        )
