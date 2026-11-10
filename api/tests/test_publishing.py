"""Publishing, unpublishing and the public read path (TASK-007)."""

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core.db import get_sessionmaker
from app.modules.accounts.models import Account
from app.modules.profiles.models import Profile

pytestmark = pytest.mark.usefixtures("clean_state")

LOGIN_EMAIL = "anna.logowanie@example.pl"


async def owner(
    client: AsyncClient, nick: str | None = "anna-wisniewska", confirmed: bool = True
) -> dict[str, str]:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Anna Wiśniewska",
            "email": LOGIN_EMAIL,
            "password": "jasne-niebo-nad-krakowem",
            "acceptTerms": True,
        },
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    auth = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    if confirmed:
        async with get_sessionmaker()() as session:
            await session.execute(update(Account).values(email_confirmed_at=datetime.now(UTC)))
            await session.commit()
    if nick:
        put = await client.put("/api/v1/me/profile/nick", json={"nick": nick}, headers=auth)
        assert put.status_code == 200, put.text
    return auth


async def version(client: AsyncClient, auth: dict[str, str]) -> int:
    return int((await client.get("/api/v1/me/profile", headers=auth)).json()["version"])


async def publish(client: AsyncClient, auth: dict[str, str]) -> Any:
    return await client.post(
        "/api/v1/me/profile/publish", json={"version": await version(client, auth)}, headers=auth
    )


async def public(client: AsyncClient, nick: str = "anna-wisniewska") -> Any:
    return await client.get(f"/api/v1/public/profiles/{nick}")


async def edit(client: AsyncClient, auth: dict[str, str], **fields: Any) -> Any:
    v = await version(client, auth)
    response = await client.patch("/api/v1/me/profile", json={"version": v, **fields}, headers=auth)
    assert response.status_code == 200, response.text
    return response.json()


async def test_first_publication_shows_the_page_and_locks_the_nick(client: AsyncClient) -> None:
    auth = await owner(client)
    await edit(client, auth, headline="Projektantka UX", publicEmail="kontakt@example.pl")

    response = await publish(client, auth)
    page = await public(client)
    rename = await client.put("/api/v1/me/profile/nick", json={"nick": "anna-nowa"}, headers=auth)

    body = response.json()
    assert response.status_code == 200
    assert (body["status"], body["nickLocked"], body["hasUnpublishedChanges"]) == (
        "published",
        True,
        False,
    )
    assert body["publicUrl"].endswith("/user/anna-wisniewska")
    assert body["publishedAt"]
    assert page.status_code == 200
    assert page.headers["cache-control"] == "no-store"
    assert page.json()["canonicalUrl"] == body["publicUrl"]
    assert page.json()["content"]["headline"] == "Projektantka UX"
    assert page.json()["content"]["publicEmail"] == "kontakt@example.pl"
    assert rename.status_code == 409
    assert rename.json()["code"] == "nick_locked"


async def test_visitors_see_the_previous_version_until_changes_are_published(
    client: AsyncClient,
) -> None:
    auth = await owner(client)
    await edit(client, auth, headline="Pierwsza wersja")
    await publish(client, auth)

    draft = await edit(client, auth, headline="Druga wersja")
    before = (await public(client)).json()["content"]["headline"]
    await publish(client, auth)
    after = (await public(client)).json()["content"]["headline"]

    assert draft["hasUnpublishedChanges"] is True
    assert (before, after) == ("Pierwsza wersja", "Druga wersja")


async def test_publishing_an_unchanged_draft_is_idempotent(client: AsyncClient) -> None:
    auth = await owner(client)
    first = (await publish(client, auth)).json()

    second = (await publish(client, auth)).json()

    assert second["publishedAt"] == first["publishedAt"]


async def test_unpublish_hides_the_page_and_publish_shows_the_current_draft(
    client: AsyncClient,
) -> None:
    auth = await owner(client)
    await publish(client, auth)

    hidden = await client.post("/api/v1/me/profile/unpublish", headers=auth)
    gone = await public(client)
    again = await client.post("/api/v1/me/profile/unpublish", headers=auth)
    await edit(client, auth, headline="Po przerwie")
    republished = await publish(client, auth)

    assert hidden.json()["status"] == "unpublished"
    assert hidden.json()["publicUrl"] is None
    assert hidden.json()["nickLocked"] is True
    assert gone.status_code == 404
    assert again.status_code == 200
    assert republished.json()["status"] == "published"
    assert (await public(client)).json()["content"]["headline"] == "Po przerwie"


async def test_login_email_never_reaches_the_public_profile(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)

    page = await public(client)

    assert page.json()["content"]["publicEmail"] is None
    assert LOGIN_EMAIL not in page.text


async def test_unconfirmed_email_cannot_publish(client: AsyncClient) -> None:
    auth = await owner(client, confirmed=False)

    response = await publish(client, auth)

    assert response.status_code == 403
    assert response.json()["code"] == "email_not_confirmed"
    assert (await public(client)).status_code == 404


async def test_publishing_needs_a_nick(client: AsyncClient) -> None:
    auth = await owner(client, nick=None)

    response = await publish(client, auth)

    assert response.status_code == 422
    assert response.json()["code"] == "profile_incomplete"
    assert response.json()["errors"][0]["field"] == "nick"


async def test_publishing_a_stale_version_conflicts(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.post("/api/v1/me/profile/publish", json={"version": 1}, headers=auth)

    assert response.status_code == 409
    assert response.json()["code"] == "draft_conflict"
    assert response.json()["current"]["nick"] == "anna-wisniewska"


async def test_blocked_profile_returns_404_and_cannot_publish(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)
    async with get_sessionmaker()() as session:
        await session.execute(update(Profile).values(blocked_at=datetime.now(UTC)))
        await session.commit()

    page = await public(client)
    again = await publish(client, auth)
    me = (await client.get("/api/v1/me/profile", headers=auth)).json()

    assert page.status_code == 404
    assert again.status_code == 403
    assert again.json()["code"] == "profile_blocked"
    assert (me["status"], me["publicUrl"]) == ("blocked", None)


@pytest.mark.parametrize("nick", ["nie-ma-takiego", "x" * 200])
async def test_unknown_nick_gets_the_same_404(client: AsyncClient, nick: str) -> None:
    auth = await owner(client, nick="anna-szkic")  # a never-published draft

    unknown = await public(client, nick)
    draft = await public(client, "anna-szkic")

    assert unknown.status_code == draft.status_code == 404
    assert unknown.json() == draft.json()
    assert auth


async def test_public_lookup_ignores_case(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)

    page = await public(client, "Anna-Wisniewska")

    assert page.json()["nick"] == "anna-wisniewska"


async def test_publish_requires_login(client: AsyncClient) -> None:
    response = await client.post("/api/v1/me/profile/publish", json={"version": 1})

    assert response.status_code == 401
