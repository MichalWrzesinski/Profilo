"""Account settings: change password and delete the account (TASK-016)."""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select, update

from app.core.db import get_sessionmaker
from app.modules.accounts.models import Account, OneTimeToken, RefreshToken
from app.modules.media import service as media
from app.modules.media import storage
from app.modules.media.models import Image
from app.modules.profiles.models import Profile, ProfileLink, PublishedProfile, ReservedNick
from tests import images

pytestmark = pytest.mark.usefixtures("clean_state")


@pytest.fixture(autouse=True)
def queued_file_deletions(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, object]]:
    """Capture the file-removal task instead of publishing it to the broker."""
    from app.modules.media.tasks import delete_account_files

    queued: list[dict[str, object]] = []
    monkeypatch.setattr(
        delete_account_files, "apply_async", lambda kwargs, **_: queued.append(kwargs)
    )
    return queued


EMAIL = "anna@example.pl"
OLD = "jasne-niebo-nad-krakowem"
NEW = "zielona-herbata-o-poranku"
PASSWORD = "/api/v1/me/password"
DELETION = "/api/v1/me/deletion"


async def owner(
    client: AsyncClient, *, confirmed: bool = True, email: str = EMAIL, nick: str = "anna"
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/accounts",
        json={"displayName": "Anna", "email": email, "password": OLD, "acceptTerms": True},
    )
    assert response.status_code == 201
    session = dict(response.json())
    if confirmed:
        async with get_sessionmaker()() as db:
            await db.execute(
                update(Account)
                .where(Account.email == email)
                .values(email_confirmed_at=datetime.now(UTC))
            )
            await db.commit()
    headers = {"Authorization": f"Bearer {session['accessToken']}"}
    put = await client.put("/api/v1/me/profile/nick", json={"nick": nick}, headers=headers)
    assert put.status_code == 200
    session["headers"] = headers
    return session


async def count(model: Any) -> int:
    async with get_sessionmaker()() as db:
        return int(await db.scalar(select(func.count()).select_from(model)) or 0)


# --- change password ------------------------------------------------------------------


async def test_change_password_ends_other_sessions_and_keeps_this_one(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    other = await owner(client)
    other_cookie = client.cookies.get("profilo_rt")

    response = await client.put(
        PASSWORD,
        json={"currentPassword": OLD, "newPassword": NEW},
        headers=other["headers"],
    )

    assert response.status_code == 200
    fresh = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    assert (await client.get("/api/v1/me", headers=fresh)).status_code == 200
    assert (await client.get("/api/v1/me", headers=other["headers"])).status_code == 401
    new_cookie = client.cookies.get("profilo_rt")
    assert new_cookie
    assert new_cookie != other_cookie
    client.cookies.clear()
    client.cookies.set("profilo_rt", other_cookie or "", path="/api/v1/auth")
    old_refresh = await client.post("/api/v1/auth/refresh", headers={"X-Requested-With": "profilo"})
    assert old_refresh.status_code == 401
    client.cookies.clear()
    login_old = await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": OLD})
    login_new = await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": NEW})
    assert (login_old.status_code, login_new.status_code) == (401, 200)
    assert [mail["template"] for mail in sent_emails][-1] == "password_changed"


async def test_wrong_current_password_changes_nothing(client: AsyncClient) -> None:
    session = await owner(client)

    response = await client.put(
        PASSWORD,
        json={"currentPassword": "zle-haslo-zle-haslo", "newPassword": NEW},
        headers=session["headers"],
    )

    assert response.status_code == 403
    assert response.json()["code"] == "invalid_password"
    assert (await client.get("/api/v1/me", headers=session["headers"])).status_code == 200
    login = await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": OLD})
    assert login.status_code == 200


async def test_unconfirmed_account_cannot_change_the_password(client: AsyncClient) -> None:
    session = await owner(client, confirmed=False)

    response = await client.put(
        PASSWORD, json={"currentPassword": OLD, "newPassword": NEW}, headers=session["headers"]
    )

    assert response.status_code == 403
    assert response.json()["code"] == "email_not_confirmed"


@pytest.mark.parametrize(
    ("new", "code"),
    [("krotkie", "too_short"), ("password123", "password_too_common"), (OLD, "same_password")],
)
async def test_new_password_rules(client: AsyncClient, new: str, code: str) -> None:
    session = await owner(client)

    response = await client.put(
        PASSWORD, json={"currentPassword": OLD, "newPassword": new}, headers=session["headers"]
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "newPassword"
    assert response.json()["errors"][0]["code"] == code


async def test_sixth_wrong_password_is_refused_for_a_while(client: AsyncClient) -> None:
    session = await owner(client)
    for _ in range(5):
        wrong = await client.post(
            DELETION, json={"password": "zle-haslo-zle-haslo"}, headers=session["headers"]
        )
        assert wrong.status_code == 403

    blocked = await client.put(
        PASSWORD, json={"currentPassword": OLD, "newPassword": NEW}, headers=session["headers"]
    )

    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0


async def test_settings_need_login(client: AsyncClient) -> None:
    put = await client.put(PASSWORD, json={"currentPassword": OLD, "newPassword": NEW})
    post = await client.post(DELETION, json={"password": OLD})

    assert (put.status_code, post.status_code) == (401, 401)


# --- delete the account -----------------------------------------------------------------


async def published_owner_with_content(client: AsyncClient) -> dict[str, Any]:
    session = await owner(client)
    headers = session["headers"]
    avatar = await client.put(
        "/api/v1/me/profile/images/avatar",
        files={"file": ("a.jpg", images.jpeg(600, 600), "image/jpeg")},
        headers=headers,
    )
    assert avatar.status_code == 200
    link = await client.post(
        "/api/v1/me/profile/links", json={"url": "https://example.com"}, headers=headers
    )
    assert link.status_code == 201
    version = (await client.get("/api/v1/me/profile", headers=headers)).json()["version"]
    published = await client.post(
        "/api/v1/me/profile/publish", json={"version": version}, headers=headers
    )
    assert published.status_code == 200
    session["avatar"] = avatar.json()["draft"]["avatar"]["urls"]["256"]
    return session


async def test_deletion_removes_everything_and_quarantines_the_nick(
    client: AsyncClient,
    sent_emails: list[dict[str, Any]],
    queued_file_deletions: list[dict[str, object]],
) -> None:
    session = await published_owner_with_content(client)
    account_id = session["account"]["id"]

    response = await client.post(DELETION, json={"password": OLD}, headers=session["headers"])

    assert response.status_code == 204
    assert "profilo_rt=" in response.headers["set-cookie"]  # cleared
    for model in (Account, Profile, ProfileLink, PublishedProfile, Image, RefreshToken):
        assert await count(model) == 0, model
    assert await count(OneTimeToken) == 0
    assert (await client.get("/api/v1/public/profiles/anna")).status_code == 404
    assert (await client.get(session["avatar"])).status_code == 404
    assert (await client.get("/api/v1/me", headers=session["headers"])).status_code == 401
    assert queued_file_deletions == [{"account_id": account_id}]
    assert sent_emails[-1] == {"template": "account_deleted", "to": EMAIL, "params": {}}
    async with get_sessionmaker()() as db:
        reserved = await db.get(ReservedNick, "anna")
        assert reserved is not None
        assert reserved.reason == "quarantine"
        assert reserved.expires_at is not None
        left = reserved.expires_at - datetime.now(UTC)
        assert timedelta(days=29, hours=23) < left <= timedelta(days=30)
    # Nobody can take the nick while it is in quarantine.
    stranger = await owner(client, email="obcy@example.pl", nick="obcy")
    taken = await client.put(
        "/api/v1/me/profile/nick", json={"nick": "anna"}, headers=stranger["headers"]
    )
    assert taken.status_code == 409


async def test_wrong_password_deletes_nothing(client: AsyncClient) -> None:
    session = await owner(client)

    response = await client.post(
        DELETION, json={"password": "zle-haslo-zle-haslo"}, headers=session["headers"]
    )

    assert response.status_code == 403
    assert response.json()["code"] == "invalid_password"
    assert await count(Account) == 1
    async with get_sessionmaker()() as db:
        assert await db.get(ReservedNick, "anna") is None


async def test_unconfirmed_account_can_be_deleted(client: AsyncClient) -> None:
    session = await owner(client, confirmed=False)

    response = await client.post(DELETION, json={"password": OLD}, headers=session["headers"])

    assert response.status_code == 204
    assert await count(Account) == 0


async def test_account_without_a_nick_reserves_nothing(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Ola",
            "email": "ola@example.pl",
            "password": OLD,
            "acceptTerms": True,
        },
    )
    headers = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    before = await count(ReservedNick)

    deleted = await client.post(DELETION, json={"password": OLD}, headers=headers)

    assert deleted.status_code == 204
    assert await count(ReservedNick) == before


async def test_quarantine_never_weakens_a_permanent_reservation(client: AsyncClient) -> None:
    session = await owner(client, nick="anna-stala")
    async with get_sessionmaker()() as db:  # e.g. the nick became a system word later
        db.add(ReservedNick(nick="anna-stala", reason="system", expires_at=None))
        await db.commit()
    try:
        await client.post(DELETION, json={"password": OLD}, headers=session["headers"])

        async with get_sessionmaker()() as db:
            reserved = await db.get(ReservedNick, "anna-stala")
            assert reserved is not None
            assert (reserved.reason, reserved.expires_at) == ("system", None)
    finally:
        async with get_sessionmaker()() as db:
            await db.execute(delete(ReservedNick).where(ReservedNick.nick == "anna-stala"))
            await db.commit()


async def test_files_are_removed_by_the_task(client: AsyncClient) -> None:
    from app.modules.media.tasks import delete_account_files

    session = await published_owner_with_content(client)
    account_id = session["account"]["id"]
    image_id = session["avatar"].split("/")[2]
    async with get_sessionmaker()() as db:
        image = await db.get(Image, image_id)
        assert image is not None
        key = image.storage_key
    assert await storage.get(f"{key}/256.webp") is not None

    # A Celery worker runs it outside any event loop.
    await asyncio.to_thread(delete_account_files.run, account_id)
    await asyncio.to_thread(delete_account_files.run, account_id)  # idempotent

    assert await storage.get(f"{key}/256.webp") is None


async def test_queue_failure_is_only_logged(monkeypatch: pytest.MonkeyPatch) -> None:
    import uuid

    from app.modules.media import tasks

    def broken(**_: object) -> None:
        raise ConnectionError

    monkeypatch.setattr(tasks.delete_account_files, "apply_async", broken)

    assert await media.delete_files_of(uuid.uuid4()) is False


async def test_task_refuses_a_path_instead_of_an_account_id() -> None:
    from app.modules.media.tasks import delete_account_files

    with pytest.raises(ValueError, match="badly formed"):
        delete_account_files.run("../etc")
