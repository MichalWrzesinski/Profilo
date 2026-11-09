from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from pydantic import BaseModel

from app.core.errors import ProblemError, register_error_handlers
from app.core.request_context import RequestContextMiddleware


class Payload(BaseModel):
    name: str


def build_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(RequestContextMiddleware)

    @app.post("/items")
    async def create(payload: Payload) -> dict[str, str]:
        return {"name": payload.name}

    @app.get("/conflict")
    async def conflict() -> None:
        raise ProblemError(409, "draft_conflict", "Szkic zmienił się w innym oknie.", current=None)

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("secret internals")

    return app


async def request(method: str, url: str, **kwargs: object) -> Response:
    transport = ASGITransport(app=build_app(), raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        return await c.request(method, url, **kwargs)  # type: ignore[arg-type]


async def test_unknown_route_is_problem_not_found() -> None:
    r = await request("GET", "/missing")
    assert r.status_code == 404
    assert r.headers["content-type"] == "application/problem+json"
    assert r.json()["code"] == "not_found"
    assert r.json()["type"] == "https://profilo.pl/problems/not-found"


async def test_validation_error_lists_fields() -> None:
    r = await request("POST", "/items", json={})
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"
    assert r.json()["errors"] == [{"field": "name", "code": "missing", "message": "Field required"}]


async def test_problem_error_keeps_code_and_extra_fields() -> None:
    r = await request("GET", "/conflict")
    assert r.status_code == 409
    assert r.json()["code"] == "draft_conflict"
    assert r.json()["detail"] == "Szkic zmienił się w innym oknie."
    assert "current" in r.json()


async def test_unhandled_error_hides_internals_and_keeps_request_id() -> None:
    r = await request("GET", "/boom", headers={"X-Request-ID": "req-500"})
    assert r.status_code == 500
    assert r.headers["content-type"] == "application/problem+json"
    assert r.headers["x-request-id"] == "req-500"
    assert r.json()["code"] == "internal_error"
    assert r.json()["requestId"] == "req-500"
    assert "secret" not in r.text
