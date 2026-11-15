"""Operator blocking with the CLI (TASK-020)."""

from typing import Any

import pytest
from httpx import AsyncClient

from app import cli
from app.core.valkey import get_valkey
from app.modules.profiles import service
from tests.test_publishing import edit, owner, public, publish

pytestmark = pytest.mark.usefixtures("clean_state")


@pytest.fixture(autouse=True)
def keep_clients(monkeypatch: pytest.MonkeyPatch) -> None:
    """The CLI disposes the engine and Valkey client at the end; tests share them."""

    async def nothing() -> None:
        return None

    monkeypatch.setattr(cli, "dispose_engine", nothing)
    monkeypatch.setattr(cli, "close_valkey", nothing)


async def test_block_hides_the_page_at_once_and_the_owner_sees_it(
    client: AsyncClient, capsys: pytest.CaptureFixture[str]
) -> None:
    auth = await owner(client)
    await edit(client, auth, headline="Projektantka UX")
    await publish(client, auth)
    assert (await client.get("/api/v1/public/profiles/anna-wisniewska/og-image.jpg")).is_success
    assert [key async for key in get_valkey().scan_iter(match="og:*")]

    code = await cli._run("block-profile", "Anna-Wisniewska")

    assert code == 0
    assert "Zablokowano stronę anna-wisniewska" in capsys.readouterr().out
    assert (await public(client)).status_code == 404
    card = await client.get("/api/v1/public/profiles/anna-wisniewska/og-image.jpg")
    assert card.status_code == 404
    assert [key async for key in get_valkey().scan_iter(match="og:*")] == []
    me = (await client.get("/api/v1/me/profile", headers=auth)).json()
    assert me["status"] == "blocked"
    assert (await publish(client, auth)).json()["code"] == "profile_blocked"


async def test_unblock_shows_the_last_published_version(client: AsyncClient) -> None:
    auth = await owner(client)
    await edit(client, auth, headline="Wersja opublikowana")
    await publish(client, auth)
    await cli._run("block-profile", "anna-wisniewska")
    await edit(client, auth, headline="Szkic w czasie blokady")  # editing still works

    code = await cli._run("unblock-profile", "anna-wisniewska")

    page = await public(client)
    assert code == 0
    assert page.status_code == 200
    assert page.json()["content"]["headline"] == "Wersja opublikowana"
    me = (await client.get("/api/v1/me/profile", headers=auth)).json()
    assert (me["status"], me["hasUnpublishedChanges"]) == ("published", True)


@pytest.mark.parametrize(
    ("command", "message"),
    [("block-profile", "była już zablokowana"), ("unblock-profile", "nie była zablokowana")],
)
async def test_repeating_a_command_changes_nothing(
    client: AsyncClient, capsys: pytest.CaptureFixture[str], command: str, message: str
) -> None:
    auth = await owner(client)
    await publish(client, auth)
    if command == "block-profile":
        await service.set_blocked("anna-wisniewska", blocked=True)
    capsys.readouterr()

    code = await cli._run(command, "anna-wisniewska")

    assert code == 0
    assert message in capsys.readouterr().out


async def test_unknown_nick_is_an_error(capsys: pytest.CaptureFixture[str]) -> None:
    code = await cli._run("block-profile", "nie-ma-takiej")

    assert code == 1
    assert "Nie ma strony o adresie nie-ma-takiej" in capsys.readouterr().err


def test_main_parses_the_command(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str]] = []

    async def run(command: str, nick: str) -> int:
        calls.append((command, nick))
        return 0

    monkeypatch.setattr(cli, "_run", run)

    assert cli.main(["unblock-profile", "anna"]) == 0
    assert calls == [("unblock-profile", "anna")]


def test_main_needs_a_command(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exit_:
        cli.main([])

    assert exit_.value.code == 2
    assert "block-profile" in capsys.readouterr().err


async def test_cli_disposes_clients(monkeypatch: pytest.MonkeyPatch) -> None:
    disposed: list[str] = []

    async def mark(name: str) -> None:
        disposed.append(name)

    async def blocked(*_: Any, **__: Any) -> str:
        return "unknown"

    monkeypatch.setattr(service, "set_blocked", blocked)
    monkeypatch.setattr(cli, "dispose_engine", lambda: mark("engine"))
    monkeypatch.setattr(cli, "close_valkey", lambda: mark("valkey"))

    await cli._run("block-profile", "x")

    assert disposed == ["engine", "valkey"]


async def test_the_command_works_as_a_separate_process(client: AsyncClient) -> None:
    """As the operator runs it (`profilo block-profile …`): a fresh interpreter that has
    not imported the whole app (the mapper must still know every table)."""
    import asyncio
    import sys

    auth = await owner(client)
    await publish(client, auth)

    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "app.cli",
        "block-profile",
        "anna-wisniewska",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await process.communicate()

    assert process.returncode == 0, err.decode()
    assert "Zablokowano stronę anna-wisniewska" in out.decode()
    assert (await public(client)).status_code == 404


async def test_a_blocked_nick_stays_reserved_after_the_owner_deletes_the_account(
    client: AsyncClient,
) -> None:
    from sqlalchemy import select

    from app.core.db import get_sessionmaker
    from app.modules.profiles.models import ReservedNick

    auth = await owner(client)
    await publish(client, auth)
    await service.set_blocked("anna-wisniewska", blocked=True)

    deleted = await client.post(
        "/api/v1/me/deletion", json={"password": "jasne-niebo-nad-krakowem"}, headers=auth
    )

    assert deleted.status_code == 204
    async with get_sessionmaker()() as session:
        row = await session.scalar(
            select(ReservedNick).where(ReservedNick.nick == "anna-wisniewska")
        )
        assert row is not None
        assert (row.reason, row.expires_at) == ("blocked", None)


async def test_a_failing_database_is_a_clear_error(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def broken(*_: Any, **__: Any) -> str:
        raise ConnectionError

    monkeypatch.setattr(service, "set_blocked", broken)

    assert await cli._run("block-profile", "anna") == 3
    assert "Nie udało się: ConnectionError" in capsys.readouterr().err
