from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.core.errors import ProblemError, register_error_handlers


class Payload(BaseModel):
    name: str


def build_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

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


async def request(method: str, url: str, **kwargs: object) -> tuple[int, dict[str, object], str]:
    transport = ASGITransport(app=build_app(), raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.request(method, url, **kwargs)  # type: ignore[arg-type]
    return r.status_code, r.json(), r.headers["content-type"]


async def test_unknown_route_is_problem_not_found() -> None:
    status, body, ctype = await request("GET", "/missing")
    assert status == 404
    assert ctype == "application/problem+json"
    assert body["code"] == "not_found"
    assert body["type"] == "https://profilo.pl/problems/not-found"


async def test_validation_error_lists_fields() -> None:
    status, body, _ = await request("POST", "/items", json={})
    assert status == 422
    assert body["code"] == "validation_error"
    assert body["errors"] == [{"field": "name", "code": "missing", "message": "Field required"}]


async def test_problem_error_keeps_code_and_extra_fields() -> None:
    status, body, _ = await request("GET", "/conflict")
    assert status == 409
    assert body["code"] == "draft_conflict"
    assert body["detail"] == "Szkic zmienił się w innym oknie."
    assert "current" in body


async def test_unhandled_error_hides_internals() -> None:
    status, body, _ = await request("GET", "/boom")
    assert status == 500
    assert body["code"] == "internal_error"
    assert "secret" not in str(body)
