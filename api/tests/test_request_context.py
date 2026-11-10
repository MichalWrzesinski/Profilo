import pytest
from starlette.types import Message, Receive, Scope, Send

from app.core.request_context import RequestContextMiddleware


async def noop_receive() -> Message:
    return {"type": "http.request", "body": b""}


async def test_non_http_scopes_pass_through_untouched() -> None:
    seen: list[str] = []

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        seen.append(scope["type"])

    async def send(_: Message) -> None:
        pass

    await RequestContextMiddleware(inner)({"type": "lifespan"}, noop_receive, send)

    assert seen == ["lifespan"]


async def test_error_after_response_started_is_reraised() -> None:
    sent: list[Message] = []

    async def inner(scope: Scope, receive: Receive, send: Send) -> None:
        await send({"type": "http.response.start", "status": 200, "headers": []})
        raise RuntimeError("stream broke")

    async def send(message: Message) -> None:
        sent.append(message)

    scope: Scope = {"type": "http", "headers": []}
    with pytest.raises(RuntimeError, match="stream broke"):
        await RequestContextMiddleware(inner)(scope, noop_receive, send)

    assert sent[0]["status"] == 200
    assert any(name == b"x-request-id" for name, _ in sent[0]["headers"])
