import asyncio
import time

import pytest
from httpx import AsyncClient

from app.core import health
from app.core.settings import get_settings


async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_when_dependencies_reachable(client: AsyncClient) -> None:
    response = await client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


async def failing() -> None:
    raise ConnectionRefusedError


async def test_ready_returns_problem_when_database_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(health, "_check_database", failing)

    response = await client.get("/ready")
    health_response = await client.get("/health")

    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    assert response.headers["retry-after"] == "5"
    body = response.json()
    assert body["code"] == "dependency_unavailable"
    assert body["dependencies"] == ["database"]
    assert health_response.status_code == 200


async def test_ready_returns_problem_when_valkey_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(health, "_check_valkey", failing)

    response = await client.get("/ready")

    assert response.status_code == 503
    assert response.json()["dependencies"] == ["valkey"]


async def test_ready_times_out_slow_dependencies_in_parallel(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def hanging() -> None:
        await asyncio.sleep(30)

    monkeypatch.setattr(health, "_check_database", hanging)
    monkeypatch.setattr(health, "_check_valkey", hanging)
    timeout = get_settings().dependency_timeout_seconds

    started = time.monotonic()
    response = await client.get("/ready")
    elapsed = time.monotonic() - started

    assert response.status_code == 503
    assert sorted(response.json()["dependencies"]) == ["database", "valkey"]
    assert elapsed < timeout + 1
