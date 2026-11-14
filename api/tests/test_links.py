"""Links in the draft and on the published page (TASK-009)."""

from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.core.db import get_sessionmaker
from app.modules.accounts.models import Account

pytestmark = pytest.mark.usefixtures("clean_state")

LINKS = "/api/v1/me/profile/links"


async def owner(client: AsyncClient, email: str = "anna@example.pl") -> dict[str, str]:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Anna Wiśniewska",
            "email": email,
            "password": "jasne-niebo-nad-krakowem",
            "acceptTerms": True,
        },
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


async def add(client: AsyncClient, auth: dict[str, str], url: str, label: str | None = None) -> Any:
    body: dict[str, str] = {"url": url}
    if label is not None:
        body["label"] = label
    return await client.post(LINKS, json=body, headers=auth)


def links_of(profile: dict[str, Any]) -> list[dict[str, Any]]:
    return list(profile["draft"]["links"])


async def test_link_without_label_gets_https_service_and_name(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await add(client, auth, "linkedin.com/in/anna-wisniewska")

    assert response.status_code == 201
    link = links_of(response.json())[0]
    assert (link["url"], link["label"], link["service"]) == (
        "https://linkedin.com/in/anna-wisniewska",
        "LinkedIn",
        "linkedin",
    )
    assert response.headers["location"] == f"{LINKS}/{link['id']}"
    assert response.json()["version"] == 2


async def test_other_domains_get_the_domain_as_label(client: AsyncClient) -> None:
    auth = await owner(client)

    link = links_of((await add(client, auth, "https://www.studiowisniewska.pl/blog")).json())[0]
    named = links_of((await add(client, auth, "github.com/anna", "Mój kod")).json())[1]

    assert (link["label"], link["service"]) == ("studiowisniewska.pl", "other")
    assert (named["label"], named["service"]) == ("Mój kod", "github")


async def test_reorder_is_used_on_the_public_page_after_publishing(client: AsyncClient) -> None:
    auth = await owner(client)
    await client.put("/api/v1/me/profile/nick", json={"nick": "anna-w"}, headers=auth)
    async with get_sessionmaker()() as session:
        await session.execute(update(Account).values(email_confirmed_at=datetime.now(UTC)))
        await session.commit()
    for url in ("linkedin.com/in/a", "github.com/a", "behance.net/a"):
        last = await add(client, auth, url)
    first, second, third = (link["id"] for link in links_of(last.json()))

    reordered = await client.put(
        f"{LINKS}/order", json={"linkIds": [third, first, second]}, headers=auth
    )
    before = await client.get("/api/v1/public/profiles/anna-w")
    await client.post(
        "/api/v1/me/profile/publish", json={"version": reordered.json()["version"]}, headers=auth
    )
    after = (await client.get("/api/v1/public/profiles/anna-w")).json()

    assert [link["service"] for link in links_of(reordered.json())] == [
        "behance",
        "linkedin",
        "github",
    ]
    assert reordered.json()["hasUnpublishedChanges"] is False  # never published yet
    assert before.status_code == 404
    assert [link["service"] for link in after["content"]["links"]] == [
        "behance",
        "linkedin",
        "github",
    ]


async def test_same_order_changes_nothing(client: AsyncClient) -> None:
    auth = await owner(client)
    profile = (await add(client, auth, "github.com/a")).json()

    response = await client.put(
        f"{LINKS}/order", json={"linkIds": [links_of(profile)[0]["id"]]}, headers=auth
    )

    assert response.json()["version"] == profile["version"]


@pytest.mark.parametrize("ids", [[], ["00000000-0000-7000-8000-000000000001"]])
async def test_order_must_list_exactly_the_existing_links(
    client: AsyncClient, ids: list[str]
) -> None:
    auth = await owner(client)
    await add(client, auth, "github.com/a")

    response = await client.put(f"{LINKS}/order", json={"linkIds": ids}, headers=auth)

    assert response.status_code == 422
    assert response.json()["code"] == "link_order_mismatch"


async def test_edit_label_and_url_then_remove(client: AsyncClient) -> None:
    auth = await owner(client)
    link_id = links_of((await add(client, auth, "github.com/a")).json())[0]["id"]

    relabelled = await client.patch(
        f"{LINKS}/{link_id}", json={"label": "Kod na GitHubie"}, headers=auth
    )
    moved = await client.patch(f"{LINKS}/{link_id}", json={"url": "youtu.be/x"}, headers=auth)
    same = await client.patch(f"{LINKS}/{link_id}", json={"url": "youtu.be/x"}, headers=auth)
    removed = await client.delete(f"{LINKS}/{link_id}", headers=auth)
    again = await client.delete(f"{LINKS}/{link_id}", headers=auth)
    profile = (await client.get("/api/v1/me/profile", headers=auth)).json()

    assert links_of(relabelled.json())[0]["label"] == "Kod na GitHubie"
    assert links_of(moved.json())[0]["service"] == "youtube"
    assert links_of(moved.json())[0]["label"] == "Kod na GitHubie"
    assert same.json()["version"] == moved.json()["version"]
    assert (removed.status_code, again.status_code) == (204, 204)
    assert links_of(profile) == []
    assert profile["version"] == moved.json()["version"] + 1


@pytest.mark.parametrize("url", ["mój portfolio.pl", "javascript:alert(1)", "localhost"])
async def test_invalid_url_is_rejected_with_a_field_message(client: AsyncClient, url: str) -> None:
    auth = await owner(client)
    link_id = links_of((await add(client, auth, "github.com/a")).json())[0]["id"]

    created = await add(client, auth, url)
    edited = await client.patch(f"{LINKS}/{link_id}", json={"url": url}, headers=auth)

    for response in (created, edited):
        assert response.status_code == 422
        assert response.json()["errors"] == [
            {
                "field": "url",
                "code": "invalid_url",
                "message": "To nie wygląda na adres strony. Sprawdź, czy nie ma w nim spacji.",
            }
        ]


async def test_empty_label_is_refused(client: AsyncClient) -> None:
    auth = await owner(client)
    link_id = links_of((await add(client, auth, "github.com/a")).json())[0]["id"]

    blank = await client.patch(f"{LINKS}/{link_id}", json={"label": "   "}, headers=auth)
    null = await client.patch(f"{LINKS}/{link_id}", json={"label": None}, headers=auth)

    assert blank.status_code == 422
    assert null.json()["errors"][0]["message"] == "Wpisz etykietę."


async def test_twenty_first_link_is_refused(client: AsyncClient) -> None:
    auth = await owner(client)
    for n in range(20):
        assert (await add(client, auth, f"example.com/{n}")).status_code == 201

    response = await add(client, auth, "example.com/21")

    assert response.status_code == 409
    assert response.json()["code"] == "links_limit_reached"


async def test_links_of_another_owner_cannot_be_changed(client: AsyncClient) -> None:
    anna = await owner(client)
    link_id = links_of((await add(client, anna, "github.com/a")).json())[0]["id"]
    jan = await owner(client, "jan@example.pl")

    edited = await client.patch(f"{LINKS}/{link_id}", json={"label": "Moje"}, headers=jan)
    deleted = await client.delete(f"{LINKS}/{link_id}", headers=jan)
    reordered = await client.put(f"{LINKS}/order", json={"linkIds": [link_id]}, headers=jan)
    still = links_of((await client.get("/api/v1/me/profile", headers=anna)).json())

    assert edited.status_code == 404
    assert deleted.status_code == 204
    assert reordered.status_code == 422
    assert [link["label"] for link in still] == ["GitHub"]


async def test_links_need_login(client: AsyncClient) -> None:
    assert (await client.post(LINKS, json={"url": "github.com/a"})).status_code == 401
