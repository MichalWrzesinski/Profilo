from sqlalchemy import text

from app.core import db, valkey
from app.main import app


async def test_session_dependency_runs_queries_on_the_database() -> None:
    sessions = db.get_session()
    session = await anext(sessions)

    result = await session.execute(text("SELECT 1"))

    assert result.scalar_one() == 1
    await sessions.aclose()


async def test_dispose_engine_creates_a_fresh_engine_next_time() -> None:
    first = db.get_engine()

    await db.dispose_engine()

    assert db.get_engine() is not first


async def test_close_valkey_creates_a_fresh_client_next_time() -> None:
    first = valkey.get_valkey()
    assert await first.ping() is True

    await valkey.close_valkey()

    second = valkey.get_valkey()
    assert second is not first
    assert await second.ping() is True


async def test_lifespan_releases_connections_on_shutdown() -> None:
    engine = db.get_engine()
    client = valkey.get_valkey()

    async with app.router.lifespan_context(app):
        pass

    assert db.get_engine() is not engine
    assert valkey.get_valkey() is not client
