import pytest
from httpx import AsyncClient


async def test_request_id_is_generated(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert len(response.headers["x-request-id"]) == 32


async def test_request_id_is_propagated(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "abc-123.x_Y"})
    assert response.headers["x-request-id"] == "abc-123.x_Y"


@pytest.mark.parametrize("bad", ["x" * 65, "a b", "aéb", "<script>"])
async def test_invalid_request_id_is_replaced(client: AsyncClient, bad: str) -> None:
    response = await client.get("/health", headers={b"X-Request-ID": bad.encode()})
    assert response.headers["x-request-id"] != bad
    assert len(response.headers["x-request-id"]) == 32
