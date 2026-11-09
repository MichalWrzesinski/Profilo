import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, Response

from app.core.db import dispose_engine
from app.core.errors import register_error_handlers
from app.core.health import router as health_router
from app.core.logging import configure_logging, log
from app.core.settings import get_settings
from app.core.valkey import close_valkey

REQUEST_ID_HEADER = "X-Request-ID"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    log.info("app_started", environment=get_settings().environment)
    yield
    await dispose_engine()
    await close_valkey()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="Profilo API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.environment in ("local", "test") else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.environment in ("local", "test") else None,
    )

    @app.middleware("http")
    async def request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        rid = incoming if 0 < len(incoming) <= 64 and incoming.isprintable() else uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=rid)
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = rid
        return response

    register_error_handlers(app)
    app.include_router(health_router)
    return app


app = create_app()
