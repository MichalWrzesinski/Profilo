"""Problem Details (RFC 9457) responses with a stable `code`."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any, get_args

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic_core.core_schema import ErrorType
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_JSON = "application/problem+json"
PROBLEM_BASE = "https://profilo.pl/problems/"


class ProblemError(Exception):
    """Raise to return a Problem Details response."""

    def __init__(
        self,
        status: int,
        code: str,
        detail: str | None = None,
        headers: Mapping[str, str] | None = None,
        **extra: Any,
    ) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.detail = detail
        self.headers = headers
        self.extra = extra


def problem_response(
    status: int,
    code: str,
    detail: str | None = None,
    headers: Mapping[str, str] | None = None,
    **extra: Any,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": PROBLEM_BASE + code.replace("_", "-"),
        "title": HTTPStatus(status).phrase,
        "status": status,
        "code": code,
    }
    if detail:
        body["detail"] = detail
    body.update(extra)
    return JSONResponse(
        body, status_code=status, media_type=PROBLEM_JSON, headers=dict(headers or {})
    )


_STATUS_CODES = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}


_BUILT_IN_ERRORS = frozenset(get_args(ErrorType))


def _characters(count: object) -> str:
    """„3 znaki”, „5 znaków”, „22 znaki” (Polish plural)."""
    n = int(count) if isinstance(count, int) else 0
    if n == 1:
        return "1 znak"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return f"{n} znaki"
    return f"{n} znaków"


def _validation_message(err: Mapping[str, Any]) -> str:
    """Polish message for a validation error. Messages of our own validators
    (`PydanticCustomError`) are already Polish; Pydantic's built-in errors are English (and may
    quote the input, e.g. an e-mail with an emoji), so the error type alone decides. One custom
    type shares a built-in name (`missing`): only Pydantic's own text is replaced there."""
    message = str(err["msg"])
    if err["type"] not in _BUILT_IN_ERRORS:
        return message
    if err["type"] == "missing" and message != "Field required":
        return message
    ctx = err.get("ctx") or {}
    field = str(err["loc"][-1]) if err["loc"] else ""
    match err["type"]:
        case "missing":
            return "To pole jest wymagane"
        case "string_too_short":
            return f"Wpisz co najmniej {_characters(ctx.get('min_length'))}"
        case "string_too_long":
            return f"Wpisz najwyżej {_characters(ctx.get('max_length'))}"
        case "value_error" if field == "email":
            return "Wpisz prawidłowy adres e-mail"
        case _:
            return "Sprawdź tę wartość"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _problem(_: Request, exc: ProblemError) -> JSONResponse:
        return problem_response(exc.status, exc.code, exc.detail, exc.headers, **exc.extra)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "http_error")
        return problem_response(exc.status_code, code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path")),
                "code": err["type"],
                "message": _validation_message(err),
            }
            for err in exc.errors()
        ]
        return problem_response(422, "validation_error", errors=errors)
