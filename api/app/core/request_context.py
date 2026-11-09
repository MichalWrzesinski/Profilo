"""Pure ASGI middleware: request id for every response and one log entry per unhandled error."""

import re
import uuid

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import problem_response
from app.core.logging import log

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


def _request_id(scope: Scope) -> str:
    for name, value in scope.get("headers", []):
        if name == b"x-request-id":
            candidate: str = bytes(value).decode("latin-1")
            if _VALID_REQUEST_ID.fullmatch(candidate):
                return candidate
    return uuid.uuid4().hex


class RequestContextMiddleware:
    """Binds the request id to logs, echoes it in `X-Request-ID` and turns unhandled
    exceptions into a 500 Problem Details response (logged once, with the request id)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        rid = _request_id(scope)
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=rid)
        started = False

        async def send_with_id(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.lower().encode(), rid.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception as exc:
            log.error("unhandled_exception", exc_info=exc)
            if started:
                raise
            response = problem_response(500, "internal_error", requestId=rid)
            await response(scope, receive, send_with_id)
