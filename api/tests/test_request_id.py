from httpx import AsyncClient


async def test_request_id_is_generated(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert len(response.headers["x-request-id"]) == 32


async def test_request_id_is_propagated(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "abc-123"})
    assert response.headers["x-request-id"] == "abc-123"


async def test_oversized_request_id_is_replaced(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "x" * 200})
    assert response.headers["x-request-id"] != "x" * 200
