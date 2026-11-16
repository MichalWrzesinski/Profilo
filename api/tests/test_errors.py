import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_core import PydanticCustomError

from app.core.errors import ProblemError, _characters, register_error_handlers
from app.core.request_context import RequestContextMiddleware


class Payload(BaseModel):
    name: str


class Form(BaseModel):
    email: EmailStr
    code: str = Field(min_length=3, max_length=5)
    count: int = 1
    label: str = ""

    @field_validator("label")
    @classmethod
    def _label(cls, value: str) -> str:
        if value == "x":
            raise PydanticCustomError("required", "Wpisz etykietę")
        if value == "-":
            # A custom type with a built-in name and an ASCII-only Polish text.
            raise PydanticCustomError("missing", "Podaj adres")
        return value


def build_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(RequestContextMiddleware)

    @app.post("/items")
    async def create(payload: Payload) -> dict[str, str]:
        return {"name": payload.name}

    @app.post("/forms")
    async def form(payload: Form) -> dict[str, str]:
        return {"email": payload.email}

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
    assert r.json()["errors"] == [
        {"field": "name", "code": "missing", "message": "To pole jest wymagane"}
    ]


@pytest.mark.parametrize(
    ("body", "field", "message"),
    [
        ({"email": "anna@example.test", "code": "abc"}, "email", "Wpisz prawidłowy adres e-mail"),
        ({"email": "a@\U0001f600.pl", "code": "abc"}, "email", "Wpisz prawidłowy adres e-mail"),
        ({"email": "anna@example.pl", "code": "ab"}, "code", "Wpisz co najmniej 3 znaki"),
        ({"email": "anna@example.pl", "code": "abcdef"}, "code", "Wpisz najwyżej 5 znaków"),
        ({"email": "anna@example.pl", "code": "abc", "count": "x"}, "count", "Sprawdź tę wartość"),
        ({"email": "anna@example.pl", "code": "abc", "label": "x"}, "label", "Wpisz etykietę"),
        ({"email": "anna@example.pl", "code": "abc", "label": "-"}, "label", "Podaj adres"),
    ],
)
async def test_validation_messages_are_polish(
    body: dict[str, str], field: str, message: str
) -> None:
    r = await request("POST", "/forms", json=body)
    assert r.status_code == 422
    assert [(e["field"], e["message"]) for e in r.json()["errors"]] == [(field, message)]


@pytest.mark.parametrize(
    ("count", "text"),
    [
        (1, "1 znak"),
        (3, "3 znaki"),
        (5, "5 znaków"),
        (12, "12 znaków"),
        (22, "22 znaki"),
        (None, "0 znaków"),
    ],
)
def test_character_counts_are_declined(count: object, text: str) -> None:
    assert _characters(count) == text


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
