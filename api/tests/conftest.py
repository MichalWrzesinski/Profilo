from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import get_engine
from app.core.valkey import get_valkey
from app.main import app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def clean_state() -> None:
    """Empty application tables and the test Valkey database (VALKEY_URL …/1)."""
    async with get_engine().begin() as conn:
        await conn.execute(text("TRUNCATE accounts CASCADE"))
    await get_valkey().flushdb()
