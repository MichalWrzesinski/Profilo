"""Cleanup jobs: unconfirmed accounts, quarantine, orphaned files (TASK-017)."""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import fsspec
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.core import jobs
from app.core.db import get_sessionmaker
from app.core.valkey import get_valkey
from app.modules.accounts import cleanup
from app.modules.accounts.models import Account
from app.modules.media import service as media
from app.modules.media import storage
from app.modules.media.models import Image
from app.modules.profiles import service as profiles
from app.modules.profiles.models import Profile, ReservedNick
from tests import images

pytestmark = pytest.mark.usefixtures("clean_state")

PASSWORD = "jasne-niebo-nad-krakowem"


async def owner(
    client: AsyncClient, email: str, nick: str, *, confirmed: bool, age_days: int
) -> str:
    response = await client.post(
        "/api/v1/accounts",
        json={"displayName": "Anna", "email": email, "password": PASSWORD, "acceptTerms": True},
    )
    assert response.status_code == 201
    headers = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    assert (
        await client.put("/api/v1/me/profile/nick", json={"nick": nick}, headers=headers)
    ).status_code == 200
    upload = await client.put(
        "/api/v1/me/profile/images/avatar",
        files={"file": ("a.jpg", images.jpeg(600, 600), "image/jpeg")},
        headers=headers,
    )
    assert upload.status_code == 200
    created = datetime.now(UTC) - timedelta(days=age_days)
    async with get_sessionmaker()() as session:
        await session.execute(
            update(Account)
            .where(Account.email == email)
            .values(created_at=created, email_confirmed_at=created if confirmed else None)
        )
        await session.commit()
    return str(response.json()["account"]["id"])


async def account_emails() -> set[str]:
    async with get_sessionmaker()() as session:
        return {str(email) for email in await session.scalars(select(Account.email))}


async def keys_of(account_id: str) -> list[str]:
    return [key for key in await storage.stored_keys() if key.startswith(account_id)]


# --- unconfirmed accounts (ACC-BR-6) ----------------------------------------------------


async def test_unconfirmed_accounts_older_than_7_days_are_deleted(client: AsyncClient) -> None:
    old = await owner(client, "stara@example.pl", "stara", confirmed=False, age_days=8)
    await owner(client, "mloda@example.pl", "mloda", confirmed=False, age_days=6)
    await owner(client, "potwierdzona@example.pl", "potwierdzona", confirmed=True, age_days=30)
    assert await keys_of(old)

    counts = await cleanup.delete_unconfirmed()

    assert counts == {"deleted": 1}
    assert await account_emails() == {"mloda@example.pl", "potwierdzona@example.pl"}
    assert await keys_of(old) == []
    async with get_sessionmaker()() as session:
        assert await session.get(ReservedNick, "stara") is None  # released at once
        assert await session.scalar(select(func.count()).select_from(Profile)) == 2
    # Somebody else can take the nick right away.
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Ewa",
            "email": "ewa@example.pl",
            "password": PASSWORD,
            "acceptTerms": True,
        },
    )
    headers = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    taken = await client.put("/api/v1/me/profile/nick", json={"nick": "stara"}, headers=headers)
    assert taken.status_code == 200


async def test_deleting_twice_changes_nothing(client: AsyncClient) -> None:
    await owner(client, "stara@example.pl", "stara", confirmed=False, age_days=8)

    first = await cleanup.delete_unconfirmed()
    second = await cleanup.delete_unconfirmed()

    assert (first, second) == ({"deleted": 1}, {"deleted": 0})


async def test_an_account_locked_elsewhere_is_skipped(client: AsyncClient) -> None:
    """Scenario 3: two runs at once never process the same account (SKIP LOCKED); a row
    being confirmed right now is left for the next run."""
    await owner(client, "stara@example.pl", "stara", confirmed=False, age_days=8)

    async with get_sessionmaker()() as other:
        await other.scalar(select(Account).with_for_update())
        skipped = await cleanup.delete_unconfirmed()
    later = await cleanup.delete_unconfirmed()

    assert (skipped, later) == ({"deleted": 0}, {"deleted": 1})


async def test_many_accounts_are_deleted_in_batches(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cleanup, "BATCH", 1)
    for number in range(3):
        await owner(client, f"s{number}@example.pl", f"stara-{number}", confirmed=False, age_days=9)

    assert await cleanup.delete_unconfirmed() == {"deleted": 3}


async def test_a_failing_file_removal_is_only_logged(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await owner(client, "stara@example.pl", "stara", confirmed=False, age_days=8)

    async def broken(_: str) -> None:
        raise OSError

    monkeypatch.setattr(storage, "delete_prefix", broken)

    assert await cleanup.delete_unconfirmed() == {"deleted": 1}


# --- quarantine (ACC-BR-10) -------------------------------------------------------------


async def test_expired_quarantines_are_released() -> None:
    now = datetime.now(UTC)
    async with get_sessionmaker()() as session:
        session.add_all(
            [
                ReservedNick(
                    nick="po-terminie", reason="quarantine", expires_at=now - timedelta(minutes=1)
                ),
                ReservedNick(
                    nick="jeszcze-nie", reason="quarantine", expires_at=now + timedelta(days=1)
                ),
            ]
        )
        await session.commit()

    first = await profiles.release_quarantined_nicks()
    second = await profiles.release_quarantined_nicks()

    assert (first, second) == ({"released": 1}, {"released": 0})
    async with get_sessionmaker()() as session:
        left = set(
            await session.scalars(
                select(ReservedNick.nick).where(ReservedNick.reason == "quarantine")
            )
        )
        assert left == {"jeszcze-nie"}
        # System and offensive words (no expiry) are never touched.
        assert await session.scalar(
            select(func.count())
            .select_from(ReservedNick)
            .where(ReservedNick.reason != "quarantine")
        )


async def test_a_nick_is_free_again_after_30_days(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Ewa",
            "email": "ewa@example.pl",
            "password": PASSWORD,
            "acceptTerms": True,
        },
    )
    headers = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    async with get_sessionmaker()() as session:
        session.add(
            ReservedNick(
                nick="usuniety",
                reason="quarantine",
                expires_at=datetime.now(UTC) + timedelta(days=30),
            )
        )
        await session.commit()
    blocked = await client.put(
        "/api/v1/me/profile/nick", json={"nick": "usuniety"}, headers=headers
    )
    async with get_sessionmaker()() as session:
        await session.execute(
            update(ReservedNick)
            .where(ReservedNick.nick == "usuniety")
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        await session.commit()
    await profiles.release_quarantined_nicks()

    free = await client.put("/api/v1/me/profile/nick", json={"nick": "usuniety"}, headers=headers)

    assert (blocked.status_code, free.status_code) == (409, 200)


# --- orphaned files ---------------------------------------------------------------------


async def test_files_without_a_row_are_removed_after_an_hour(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    kept = await owner(client, "anna@example.pl", "anna", confirmed=True, age_days=1)
    await storage.put("01a1dead-0000-7000-8000-000000000000/stary/256.webp", b"x")
    later = datetime.now(UTC) + timedelta(hours=2)

    # Storage is shared by the whole test run (memory://): look at these keys only.
    await media.remove_orphaned_files()
    assert await keys_of("01a1dead")  # still younger than an hour: maybe an upload
    real_stamp = storage._stamp
    # memory:// folders have no time; on a volume they have one (an hour old here).
    monkeypatch.setattr(
        storage, "_stamp", lambda info: real_stamp(info) if info.get("created") else 0.0
    )
    await media.remove_orphaned_files(now=later)

    assert await keys_of("01a1dead") == []
    root = storage._path("")
    assert not storage._fs()[0].exists(f"{root}01a1dead-0000-7000-8000-000000000000")
    assert await keys_of(kept)
    async with get_sessionmaker()() as session:
        assert await session.scalar(select(func.count()).select_from(Image)) == 1


@pytest.fixture
def own_storage(monkeypatch: pytest.MonkeyPatch) -> Any:
    """A storage root of its own (the memory:// storage is shared by the whole run)."""
    import uuid

    root = f"/test-{uuid.uuid4()}"
    memory = fsspec.filesystem("memory")
    monkeypatch.setattr(storage, "_fs", lambda: (memory, root))
    yield memory
    monkeypatch.undo()  # a test may have patched the file system itself
    if memory.exists(root):
        memory.rm(root, recursive=True)


@pytest.mark.parametrize("rows", ["none", "few"])
async def test_a_missing_or_partial_database_deletes_nothing(
    client: AsyncClient, own_storage: Any, rows: str
) -> None:
    """Review: during a restore every file looks orphaned; the job must stop instead."""
    for number in range(12):
        await storage.put(f"01a1aaaa-0000-7000-8000-0000000000{number:02d}/k/256.webp", b"x")
    if rows == "few":
        await owner(client, "anna@example.pl", "anna", confirmed=True, age_days=1)
        async with get_sessionmaker()() as session:
            await session.execute(
                update(Image).values(storage_key="01a1aaaa-0000-7000-8000-000000000000/k")
            )
            await session.commit()

    before = len(await storage.stored_keys())

    counts = await media.remove_orphaned_files(now=datetime.now(UTC) + timedelta(hours=2))

    assert counts["aborted"] == 1
    assert len(await storage.stored_keys()) == before


async def test_removals_per_run_are_capped(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, own_storage: Any
) -> None:
    await owner(client, "anna@example.pl", "anna", confirmed=True, age_days=1)
    monkeypatch.setattr(media, "MAX_REMOVALS_PER_RUN", 1)
    monkeypatch.setattr(media, "MAX_ORPHAN_SHARE", 1.0)
    for number in range(2):
        await storage.put(f"01a1cccc-0000-7000-8000-00000000000{number}/k/256.webp", b"x")

    first = await media.remove_orphaned_files(now=datetime.now(UTC) + timedelta(hours=2))

    assert first["removed"] == 1
    assert len(await keys_of("01a1cccc")) == 1
    await media.remove_orphaned_files(now=datetime.now(UTC) + timedelta(hours=2))
    assert await keys_of("01a1cccc") == []


async def test_a_failing_image_query_deletes_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    await storage.put("01a1dddd-0000-7000-8000-000000000000/k/256.webp", b"x")

    def broken() -> Any:
        raise ConnectionError

    monkeypatch.setattr(media, "get_sessionmaker", broken)

    with pytest.raises(ConnectionError):
        await media.remove_orphaned_files(now=datetime.now(UTC) + timedelta(hours=2))
    assert await keys_of("01a1dddd")


async def test_a_folder_that_got_a_file_meanwhile_is_kept(
    monkeypatch: pytest.MonkeyPatch, own_storage: Any
) -> None:
    folder = storage._path("01a1eeee-0000-7000-8000-000000000000")
    own_storage.makedirs(folder, exist_ok=True)
    monkeypatch.setattr(storage, "_stamp", lambda _: 0.0)

    def rmdir_after_upload(path: str) -> None:  # the upload wins the race
        raise OSError("Directory not empty")

    monkeypatch.setattr(own_storage, "rmdir", rmdir_after_upload)

    assert await storage.remove_empty_folders(older_than=1.0) == 0
    assert own_storage.exists(folder)


async def test_empty_storage_has_nothing_to_remove(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        storage, "_fs", lambda: (fsspec.filesystem("memory"), "/nie-ma-takiego-katalogu")
    )

    assert await media.remove_orphaned_files() == {"removed": 0, "kept": 0, "empty_folders": 0}


async def test_a_new_empty_folder_is_kept_for_an_upload_in_progress() -> None:
    fs, _ = storage._fs()
    folder = storage._path("01a1beef-0000-7000-8000-000000000000")
    fs.makedirs(folder, exist_ok=True)

    await media.remove_orphaned_files()

    assert fs.exists(folder)
    fs.rm(folder, recursive=True)


async def test_stray_files_outside_image_folders_are_ignored(own_storage: Any) -> None:
    await storage.put("README.txt", b"x")
    await storage.put("01a1ffff-0000-7000-8000-000000000000/plik.txt", b"x")

    assert await storage.stored_keys() == {}


# --- one instance at a time -------------------------------------------------------------


async def test_a_job_runs_once_while_its_lock_is_held() -> None:
    started = asyncio.Event()
    finish = asyncio.Event()
    calls = 0

    async def slow() -> dict[str, int]:
        nonlocal calls
        calls += 1
        started.set()
        await finish.wait()
        return {"done": 1}

    first = asyncio.create_task(jobs.run_locked("test_job", slow, 60))
    await started.wait()
    second = await jobs.run_locked("test_job", slow, 60)
    finish.set()

    assert (await first, second, calls) == ({"done": 1}, None, 1)
    assert await get_valkey().get("job:test_job") is None  # released


async def test_without_valkey_the_job_is_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    class Down:
        def lock(self, *_: object, **__: object) -> Any:
            raise ConnectionError

    monkeypatch.setattr(jobs, "get_valkey", lambda: Down())

    async def job() -> dict[str, int]:
        raise AssertionError("must not run")

    assert await jobs.run_locked("test_job", job, 60) is None


async def test_a_failed_lock_release_is_only_logged(monkeypatch: pytest.MonkeyPatch) -> None:
    class Lock:
        async def acquire(self) -> bool:
            return True

        async def release(self) -> None:
            raise ConnectionError

    class Client:
        def lock(self, *_: object, **__: object) -> Lock:
            return Lock()

    monkeypatch.setattr(jobs, "get_valkey", lambda: Client())

    async def job() -> dict[str, int]:
        return {"done": 1}

    assert await jobs.run_locked("test_job", job, 60) == {"done": 1}


def test_run_disposes_the_loop_bound_clients(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    async def locked(name: str, job: Any, seconds: int) -> None:
        calls.append(f"{name}:{seconds}")

    async def dispose() -> None:
        calls.append("engine")

    async def close() -> None:
        calls.append("valkey")

    monkeypatch.setattr(jobs, "run_locked", locked)
    monkeypatch.setattr(jobs, "dispose_engine", dispose)
    monkeypatch.setattr(jobs, "close_valkey", close)

    jobs.run("x", lambda: None)  # type: ignore[arg-type,return-value]

    assert calls == ["x:3000", "engine", "valkey"]


@pytest.mark.parametrize(
    ("module", "task", "job"),
    [
        ("app.modules.accounts.tasks", "delete_unconfirmed", "delete_unconfirmed"),
        ("app.modules.profiles.tasks", "release_quarantined_nicks", "release_quarantined_nicks"),
        ("app.modules.media.tasks", "remove_orphaned_files", "remove_orphaned_files"),
    ],
)
def test_tasks_run_their_job(
    monkeypatch: pytest.MonkeyPatch, module: str, task: str, job: str
) -> None:
    import importlib

    tasks = importlib.import_module(module)
    started: list[str] = []
    monkeypatch.setattr(jobs, "run", lambda name, fn, *_: started.append(name))

    getattr(tasks, task).run()

    assert started == [job]


def test_beat_runs_every_job_hourly() -> None:
    from app.worker import celery_app

    schedule = celery_app.conf.beat_schedule
    assert {entry["task"] for entry in schedule.values()} == {
        "accounts.delete_unconfirmed",
        "profiles.release_quarantined_nicks",
        "media.remove_orphaned_files",
    }
    assert {str(entry["schedule"]._orig_minute) for entry in schedule.values()} == {"5", "15", "25"}
    assert {entry["options"]["expires"] for entry in schedule.values()} == {3000}
