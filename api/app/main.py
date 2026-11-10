from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.db import dispose_engine
from app.core.errors import register_error_handlers
from app.core.health import router as health_router
from app.core.logging import configure_logging, log
from app.core.request_context import RequestContextMiddleware
from app.core.settings import get_settings
from app.core.valkey import close_valkey
from app.modules.accounts.router import router as accounts_router
from app.modules.profiles.router import router as profiles_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    log.info("app_started", environment=get_settings().environment)
    yield
    await dispose_engine()
    await close_valkey()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    local = settings.environment in ("local", "test")
    app = FastAPI(
        title="Profilo API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs" if local else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if local else None,
    )
    register_error_handlers(app)
    app.add_middleware(RequestContextMiddleware)
    app.include_router(health_router)
    app.include_router(accounts_router)
    app.include_router(profiles_router)
    return app


app = create_app()
