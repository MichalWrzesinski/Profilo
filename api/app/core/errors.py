"""Problem Details (RFC 9457) responses with a stable `code`."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
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
                "message": err["msg"],
            }
            for err in exc.errors()
        ]
        return problem_response(422, "validation_error", errors=errors)
