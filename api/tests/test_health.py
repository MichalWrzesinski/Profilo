import pytest
from httpx import AsyncClient

from app.core import health


async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_when_dependencies_reachable(client: AsyncClient) -> None:
    response = await client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


async def test_ready_returns_problem_when_database_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def failing() -> None:
        raise ConnectionRefusedError

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
