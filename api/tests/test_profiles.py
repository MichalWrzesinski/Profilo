import asyncio
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.modules.profiles import nicks
from app.modules.profiles.models import Profile

pytestmark = pytest.mark.usefixtures("clean_state")


async def owner(
    client: AsyncClient, email: str = "anna@example.pl", name: str = "Anna Wiśniewska"
) -> dict[str, str]:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": name,
            "email": email,
            "password": "jasne-niebo-nad-krakowem",
            "acceptTerms": True,
        },
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


async def set_nick(client: AsyncClient, auth: dict[str, str], nick: str) -> Any:
    return await client.put("/api/v1/me/profile/nick", json={"nick": nick}, headers=auth)


async def lock_nick(email: str = "anna@example.pl") -> None:
    async with get_sessionmaker()() as session:
        profile = await session.scalar(select(Profile))
        assert profile is not None
        profile.nick_locked = True
        await session.commit()


# --- profile -------------------------------------------------------------------------


async def test_owner_profile_has_the_contract_shape(client: AsyncClient) -> None:
    auth = await owner(client)

    body = (await client.get("/api/v1/me/profile", headers=auth)).json()

    assert body["nick"] is None
    assert body["status"] == "never_published"
    assert body["publicUrl"] is None
    assert body["draft"]["displayName"] == "Anna Wiśniewska"
    assert (body["draft"]["layout"], body["draft"]["accent"]) == ("classic", "granat")
    assert body["draft"]["links"] == []


async def test_profile_requires_login(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/me/profile")).status_code == 401
    assert (await client.get("/api/v1/nicks/anna/availability")).status_code == 401


# --- suggestion ----------------------------------------------------------------------


async def test_suggestion_from_display_name(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.get(
        "/api/v1/nicks/suggestion", params={"displayName": "Anna Wiśniewska"}, headers=auth
    )

    assert response.json() == {"nick": "anna-wisniewska"}


async def test_suggestion_avoids_taken_nicks(client: AsyncClient) -> None:
    first = await owner(client, "first@example.pl")
    await set_nick(client, first, "anna-wisniewska")
    second = await owner(client, "second@example.pl")

    response = await client.get(
        "/api/v1/nicks/suggestion", params={"displayName": "Anna Wiśniewska"}, headers=second
    )

    assert response.json() == {"nick": "anna-wisniewska-2"}


async def test_no_suggestion_for_too_short_names(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.get(
        "/api/v1/nicks/suggestion", params={"displayName": "Al"}, headers=auth
    )

    assert response.json() == {"nick": None}


# --- availability --------------------------------------------------------------------


async def test_available_nick_is_normalised(client: AsyncClient) -> None:
    auth = await owner(client)

    body = (await client.get("/api/v1/nicks/Anna Wiśniewska/availability", headers=auth)).json()

    assert body == {"nick": "anna-wisniewska", "available": True, "reason": None, "suggestions": []}


async def test_taken_nick_comes_with_three_suggestions(client: AsyncClient) -> None:
    first = await owner(client, "first@example.pl")
    await set_nick(client, first, "anna")
    await owner(client, "x@example.pl")  # not needed but keeps accounts distinct
    second = await owner(client, "second@example.pl")

    body = (await client.get("/api/v1/nicks/anna/availability", headers=second)).json()

    assert body["available"] is False
    assert body["reason"] == "taken"
    assert body["suggestions"] == ["anna-2", "anna-3", "anna-4"]


async def test_suggestions_skip_taken_variants_and_start_with_the_city(client: AsyncClient) -> None:
    first = await owner(client, "first@example.pl")
    await set_nick(client, first, "anna")
    other = await owner(client, "other@example.pl")
    await set_nick(client, other, "anna-2")
    second = await owner(client, "second@example.pl")
    profile = (await client.get("/api/v1/me/profile", headers=second)).json()
    await client.patch(
        "/api/v1/me/profile", json={"version": profile["version"], "city": "Kraków"}, headers=second
    )

    body = (await client.get("/api/v1/nicks/anna/availability", headers=second)).json()

    assert body["suggestions"] == ["anna-krakow", "anna-3", "anna-4"]


async def test_reserved_and_invalid_nicks_are_unavailable(client: AsyncClient) -> None:
    auth = await owner(client)

    reserved = (await client.get("/api/v1/nicks/Admin/availability", headers=auth)).json()
    invalid = (await client.get("/api/v1/nicks/ab/availability", headers=auth)).json()

    assert (reserved["available"], reserved["reason"]) == (False, "reserved")
    assert reserved["suggestions"][0] == "admin-2"
    assert (invalid["available"], invalid["reason"]) == (False, "invalid_format")


async def test_own_nick_counts_as_available(client: AsyncClient) -> None:
    auth = await owner(client)
    await set_nick(client, auth, "anna-wisniewska")

    body = (await client.get("/api/v1/nicks/anna-wisniewska/availability", headers=auth)).json()

    assert body["available"] is True


# --- set nick ------------------------------------------------------------------------


async def test_available_nick_is_assigned(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await set_nick(client, auth, "Anna Wiśniewska")

    assert response.status_code == 200
    assert response.json()["nick"] == "anna-wisniewska"
    assert response.json()["version"] == 2


@pytest.mark.parametrize("nick", ["ab", "-anna", "anna--maria", "a" * 41])
async def test_invalid_nick_is_rejected_with_the_rule(client: AsyncClient, nick: str) -> None:
    auth = await owner(client)

    response = await set_nick(client, auth, nick)

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "nick"
    assert response.json()["errors"][0]["message"] == nicks.RULE


async def test_taken_and_reserved_nicks_are_refused_with_suggestions(client: AsyncClient) -> None:
    first = await owner(client, "first@example.pl")
    await set_nick(client, first, "anna")
    second = await owner(client, "second@example.pl")

    taken = await set_nick(client, second, "anna")
    reserved = await set_nick(client, second, "panel")

    assert taken.status_code == 409
    assert taken.json()["code"] == "nick_taken"
    assert taken.json()["suggestions"] == ["anna-2", "anna-3", "anna-4"]
    assert reserved.json()["code"] == "nick_reserved"


async def test_nick_can_change_before_publication_but_not_after(client: AsyncClient) -> None:
    auth = await owner(client)
    await set_nick(client, auth, "anna")
    changed = await set_nick(client, auth, "anna-w")
    await lock_nick()

    locked = await set_nick(client, auth, "anna-x")
    same = await set_nick(client, auth, "anna-w")

    assert changed.json()["nick"] == "anna-w"
    assert locked.status_code == 409
    assert locked.json()["code"] == "nick_locked"
    assert same.status_code == 200


async def test_released_nick_can_be_taken_by_another_owner(client: AsyncClient) -> None:
    first = await owner(client, "first@example.pl")
    await set_nick(client, first, "anna")
    await set_nick(client, first, "anna-w")  # releases "anna"
    second = await owner(client, "second@example.pl")

    assert (await set_nick(client, second, "anna")).status_code == 200


async def test_two_owners_saving_the_same_nick_at_once(client: AsyncClient) -> None:
    owners = [await owner(client, f"u{i}@example.pl") for i in range(2)]

    results = await asyncio.gather(*(set_nick(client, auth, "anna") for auth in owners))

    statuses = sorted(r.status_code for r in results)
    assert statuses == [200, 409]
    loser = next(r for r in results if r.status_code == 409)
    assert loser.json()["code"] == "nick_taken"
    assert loser.json()["suggestions"]


# --- draft patch ---------------------------------------------------------------------


async def test_draft_patch_updates_fields_and_version(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.patch(
        "/api/v1/me/profile",
        json={
            "version": 1,
            "displayName": "Anna W.",
            "headline": "Projektantka",
            "publicPhone": "601 234 567",
        },
        headers=auth,
    )

    body = response.json()
    assert response.status_code == 200
    assert body["version"] == 2
    assert body["draft"]["displayName"] == "Anna W."
    assert body["draft"]["publicPhone"] == "+48601234567"


async def test_stale_version_returns_conflict_with_current_state(client: AsyncClient) -> None:
    auth = await owner(client)
    await client.patch("/api/v1/me/profile", json={"version": 1, "headline": "A"}, headers=auth)

    stale = await client.patch(
        "/api/v1/me/profile", json={"version": 1, "headline": "B"}, headers=auth
    )

    assert stale.status_code == 409
    assert stale.json()["code"] == "draft_conflict"
    assert stale.json()["current"]["draft"]["headline"] == "A"


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"publicPhone": "12"}, "publicPhone"),
        ({"displayName": ""}, "displayName"),
        ({"displayName": None}, "displayName"),
        ({"bio": "x" * 501}, "bio"),
        ({"layout": "grid"}, "layout"),
        ({"publicEmail": "nie-email"}, "publicEmail"),
    ],
)
async def test_invalid_draft_values_are_rejected(
    client: AsyncClient, patch: dict[str, Any], field: str
) -> None:
    auth = await owner(client)

    response = await client.patch("/api/v1/me/profile", json={"version": 1, **patch}, headers=auth)

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"].endswith(field)


async def test_empty_strings_clear_optional_fields(client: AsyncClient) -> None:
    auth = await owner(client)
    await client.patch("/api/v1/me/profile", json={"version": 1, "city": "Kraków"}, headers=auth)

    response = await client.patch(
        "/api/v1/me/profile", json={"version": 2, "city": ""}, headers=auth
    )

    assert response.json()["draft"]["city"] is None


async def test_patch_rejects_unknown_fields_and_keeps_version_without_changes(
    client: AsyncClient,
) -> None:
    auth = await owner(client)

    unknown = await client.patch(
        "/api/v1/me/profile", json={"version": 1, "nick": "x"}, headers=auth
    )
    empty = await client.patch("/api/v1/me/profile", json={"version": 1}, headers=auth)

    assert unknown.status_code == 422
    assert empty.json()["version"] == 1


async def test_unique_index_decides_when_both_checks_pass(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.profiles import service

    first = await owner(client, "first@example.pl")
    await set_nick(client, first, "anna")
    second = await owner(client, "second@example.pl")
    real = service._unavailable
    calls = {"n": 0}

    async def stale_check(*args: Any) -> dict[str, str]:
        calls["n"] += 1
        return {} if calls["n"] == 1 else await real(*args)  # first check misses the race

    monkeypatch.setattr(service, "_unavailable", stale_check)

    response = await set_nick(client, second, "anna")

    assert response.status_code == 409
    assert response.json()["code"] == "nick_taken"
    assert response.json()["suggestions"] == ["anna-2", "anna-3", "anna-4"]


async def test_saving_the_current_nick_again_is_a_no_op(client: AsyncClient) -> None:
    auth = await owner(client)
    await set_nick(client, auth, "anna")

    again = await set_nick(client, auth, "anna")

    assert again.status_code == 200
    assert again.json()["version"] == 2  # unchanged


async def test_unparseable_phone_is_rejected(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.patch(
        "/api/v1/me/profile", json={"version": 1, "publicPhone": "abc"}, headers=auth
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "invalid_phone"


async def test_no_suggestion_when_all_variants_are_taken(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.profiles import service

    auth = await owner(client)

    async def everything_taken(_: Any, candidates: list[str], __: Any) -> dict[str, str]:
        return dict.fromkeys(candidates, "taken")

    monkeypatch.setattr(service, "_unavailable", everything_taken)

    response = await client.get(
        "/api/v1/nicks/suggestion", params={"displayName": "Anna"}, headers=auth
    )
    garbage = await client.get("/api/v1/nicks/---/availability", headers=auth)

    assert response.json() == {"nick": None}
    assert garbage.json()["suggestions"] == []


# --- review fixes ----------------------------------------------------------------------


async def test_offensive_words_block_every_nick_that_contains_them(client: AsyncClient) -> None:
    auth = await owner(client)

    exact = (await client.get("/api/v1/nicks/kurwa/availability", headers=auth)).json()
    with_suffix = await set_nick(client, auth, "kurwa-2")
    inside = (await client.get("/api/v1/nicks/anna-kurwa/availability", headers=auth)).json()
    harmless = (await client.get("/api/v1/nicks/kurwanek/availability", headers=auth)).json()

    assert (exact["reason"], exact["suggestions"]) == ("reserved", [])
    assert with_suffix.status_code == 409
    assert with_suffix.json()["code"] == "nick_reserved"
    assert inside["reason"] == "reserved"
    assert harmless["available"] is True


async def test_no_suggestion_from_an_offensive_name(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.get(
        "/api/v1/nicks/suggestion", params={"displayName": "Kurwa"}, headers=auth
    )

    assert response.json() == {"nick": None}


@pytest.mark.parametrize(
    "call",
    [
        lambda c, a: c.get("/api/v1/nicks/suggestion", params={"displayName": "Anna"}, headers=a),
        lambda c, a: c.put("/api/v1/me/profile/nick", json={"nick": "anna-w"}, headers=a),
        lambda c, a: c.get("/api/v1/nicks/anna-w/availability", headers=a),
    ],
)
async def test_nick_checks_share_one_rate_limit(client: AsyncClient, call: Any) -> None:
    auth = await owner(client)
    for _ in range(120):
        await client.get("/api/v1/nicks/anna-x/availability", headers=auth)

    response = await call(client, auth)

    assert response.status_code == 429


async def test_empty_public_email_clears_the_field(client: AsyncClient) -> None:
    auth = await owner(client)
    first = await client.patch(
        "/api/v1/me/profile",
        json={"version": 1, "publicEmail": "Kontakt@Example.PL"},
        headers=auth,
    )

    cleared = await client.patch(
        "/api/v1/me/profile", json={"version": 2, "publicEmail": ""}, headers=auth
    )

    assert first.json()["draft"]["publicEmail"] == "Kontakt@example.pl"
    assert cleared.status_code == 200
    assert cleared.json()["draft"]["publicEmail"] is None


async def test_invalid_public_email_has_a_polish_message(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.patch(
        "/api/v1/me/profile", json={"version": 1, "publicEmail": "anna@"}, headers=auth
    )

    assert response.status_code == 422
    assert response.json()["errors"] == [
        {
            "field": "publicEmail",
            "code": "invalid_email",
            "message": "To nie wygląda na adres e-mail. Sprawdź, czy jest w nim @.",
        }
    ]


async def test_saving_unchanged_values_keeps_the_version(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.patch(
        "/api/v1/me/profile",
        json={"version": 1, "publicEmail": "", "displayName": "Anna Wiśniewska"},
        headers=auth,
    )

    assert response.json()["version"] == 1


# --- editor (TASK-008) ---------------------------------------------------------------


async def test_invalid_value_keeps_the_last_valid_draft(client: AsyncClient) -> None:
    auth = await owner(client)
    await client.patch(
        "/api/v1/me/profile",
        json={"version": 1, "bio": "Dobry opis", "city": "Kraków"},
        headers=auth,
    )

    rejected = await client.patch(
        "/api/v1/me/profile",
        json={"version": 2, "bio": "x" * 501, "city": "Gdańsk"},
        headers=auth,
    )
    draft = (await client.get("/api/v1/me/profile", headers=auth)).json()

    assert rejected.status_code == 422
    assert (draft["version"], draft["draft"]["bio"], draft["draft"]["city"]) == (
        2,
        "Dobry opis",
        "Kraków",
    )


async def test_conflict_never_overwrites_the_newer_draft(client: AsyncClient) -> None:
    auth = await owner(client)
    await client.patch(
        "/api/v1/me/profile", json={"version": 1, "headline": "Okno A"}, headers=auth
    )

    stale = await client.patch(
        "/api/v1/me/profile", json={"version": 1, "headline": "Okno B"}, headers=auth
    )

    assert stale.status_code == 409
    assert stale.json()["detail"] == "Szkic zmienił się w innym oknie — odśwież."
    assert stale.json()["current"]["draft"]["headline"] == "Okno A"


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("601234567", "+48601234567"),
        ("601 234 567", "+48601234567"),
        ("+49 30 901820", "+4930901820"),
    ],
)
async def test_phone_is_stored_in_e164_with_default_poland(
    client: AsyncClient, typed: str, stored: str
) -> None:
    auth = await owner(client)

    response = await client.patch(
        "/api/v1/me/profile", json={"version": 1, "publicPhone": typed}, headers=auth
    )

    assert response.json()["draft"]["publicPhone"] == stored


async def test_new_owner_has_no_public_email(client: AsyncClient) -> None:
    auth = await owner(client)

    draft = (await client.get("/api/v1/me/profile", headers=auth)).json()["draft"]

    assert draft["publicEmail"] is None


# --- appearance (TASK-012) -----------------------------------------------------------


@pytest.mark.parametrize(
    "patch",
    [{"accent": "rozowy"}, {"accent": "#ff00ff"}, {"layout": "grid"}, {"accent": None}],
)
async def test_values_outside_the_palette_are_refused(
    client: AsyncClient, patch: dict[str, Any]
) -> None:
    auth = await owner(client)
    await client.patch(
        "/api/v1/me/profile",
        json={"version": 1, "layout": "card", "accent": "bordo"},
        headers=auth,
    )

    refused = await client.patch("/api/v1/me/profile", json={"version": 2, **patch}, headers=auth)
    draft = (await client.get("/api/v1/me/profile", headers=auth)).json()

    assert refused.status_code == 422
    assert (draft["version"], draft["draft"]["layout"], draft["draft"]["accent"]) == (
        2,
        "card",
        "bordo",
    )
