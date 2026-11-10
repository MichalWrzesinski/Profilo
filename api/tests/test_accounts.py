import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient, Response
from sqlalchemy import func, select

from app.core.db import get_sessionmaker
from app.core.valkey import get_valkey
from app.modules.accounts import service, tokens
from app.modules.accounts.models import Account, RefreshToken
from app.modules.profiles.models import Profile

pytestmark = pytest.mark.usefixtures("clean_state")

PASSWORD = "jasne-niebo-nad-krakowem"
CSRF = {"X-Requested-With": "profilo"}


def registration(**overrides: Any) -> dict[str, Any]:
    body = {
        "displayName": "Anna Wiśniewska",
        "email": "anna@example.pl",
        "password": PASSWORD,
        "acceptTerms": True,
    }
    return {**body, **overrides}


async def register(client: AsyncClient, **overrides: Any) -> Response:
    return await client.post("/api/v1/accounts", json=registration(**overrides))


def refresh_cookie(response: Response) -> str:
    return response.cookies["profilo_rt"]


async def with_cookie(
    client: AsyncClient, path: str, token: str | None, csrf: bool = True
) -> Response:
    """POST with only the given refresh cookie (the client's cookie jar is replaced)."""
    client.cookies.clear()
    if token is not None:
        client.cookies.set("profilo_rt", token)
    return await client.post(path, headers=CSRF if csrf else {})


async def count(model: type[Any]) -> int:
    async with get_sessionmaker()() as session:
        return int(await session.scalar(select(func.count()).select_from(model)) or 0)


# --- registration -------------------------------------------------------------------


async def test_registration_creates_account_and_profile_and_logs_in(client: AsyncClient) -> None:
    response = await register(client)

    assert response.status_code == 201
    assert response.headers["location"] == "/api/v1/me"
    body = response.json()
    assert body["expiresIn"] == 900
    assert body["account"]["email"] == "anna@example.pl"
    assert body["account"]["emailConfirmed"] is False
    cookie = response.headers["set-cookie"]
    for part in (
        "profilo_rt=",
        "HttpOnly",
        "Path=/api/v1/auth",
        "SameSite=strict",
        "Max-Age=2592000",
    ):
        assert part in cookie
    async with get_sessionmaker()() as session:
        profile = await session.scalar(select(Profile))
    assert profile is not None
    assert (profile.display_name, profile.layout, profile.accent) == (
        "Anna Wiśniewska",
        "classic",
        "granat",
    )
    assert profile.nick is None
    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.json()["id"] == body["account"]["id"]


async def test_password_is_stored_as_argon2id_hash(client: AsyncClient) -> None:
    await register(client)

    async with get_sessionmaker()() as session:
        account = await session.scalar(select(Account))
    assert account is not None
    assert account.password_hash.startswith("$argon2id$")
    assert PASSWORD not in account.password_hash


async def test_email_is_unique_regardless_of_letter_case(client: AsyncClient) -> None:
    await register(client, email="anna@example.pl")

    response = await register(client, email="Anna@Example.pl")

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"
    assert "Zaloguj się" in response.json()["detail"]
    assert await count(Account) == 1


@pytest.mark.parametrize(
    ("password", "code"),
    [("krotkie1", "too_short"), ("x" * 129, "too_long"), ("password123", "password_too_common")],
)
async def test_weak_password_is_rejected_with_field_error(
    client: AsyncClient, password: str, code: str
) -> None:
    response = await register(client, password=password)

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "password"
    assert response.json()["errors"][0]["code"] == code
    assert await count(Account) == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"acceptTerms": False},
        {"displayName": "   "},
        {"displayName": "x" * 61},
        {"email": "anna@example"},
        {"unexpected": "field"},
    ],
)
async def test_invalid_registration_input_is_rejected(
    client: AsyncClient, overrides: dict[str, Any]
) -> None:
    response = await register(client, **overrides)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_registration_is_rate_limited_per_ip(client: AsyncClient) -> None:
    for i in range(service.REGISTER_PER_IP.max_hits):
        await register(client, email=f"user{i}@example.pl")

    response = await register(client, email="one-more@example.pl")

    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


async def test_concurrent_registrations_with_same_email_create_one_account(
    client: AsyncClient,
) -> None:
    results = await asyncio.gather(*(register(client) for _ in range(3)))

    statuses = sorted(r.status_code for r in results)
    assert statuses[0] == 201
    assert set(statuses[1:]) == {409}
    assert await count(Account) == 1


# --- login --------------------------------------------------------------------------


async def test_login_with_any_email_case_returns_session(client: AsyncClient) -> None:
    await register(client)

    response = await client.post(
        "/api/v1/auth/login", json={"email": "ANNA@example.PL", "password": PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["account"]["email"] == "anna@example.pl"
    assert refresh_cookie(response)


async def test_wrong_password_and_unknown_email_get_identical_responses(
    client: AsyncClient,
) -> None:
    await register(client)

    wrong = await client.post(
        "/api/v1/auth/login", json={"email": "anna@example.pl", "password": "zle-haslo-123"}
    )
    unknown = await client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.pl", "password": "zle-haslo-123"}
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["code"] == "invalid_credentials"


async def test_sixth_failed_login_within_window_is_refused(client: AsyncClient) -> None:
    await register(client)
    bad = {"email": "anna@example.pl", "password": "zle-haslo-123"}
    for _ in range(5):
        assert (await client.post("/api/v1/auth/login", json=bad)).status_code == 401

    sixth = await client.post("/api/v1/auth/login", json=bad)
    correct = await client.post(
        "/api/v1/auth/login", json={"email": "anna@example.pl", "password": PASSWORD}
    )

    assert sixth.status_code == 429
    assert int(sixth.headers["retry-after"]) > 0
    assert correct.status_code == 429  # locked until the window ends


async def test_successful_login_resets_failure_counter(client: AsyncClient) -> None:
    await register(client)
    bad = {"email": "anna@example.pl", "password": "zle-haslo-123"}
    for _ in range(4):
        await client.post("/api/v1/auth/login", json=bad)
    good = {"email": "anna@example.pl", "password": PASSWORD}
    assert (await client.post("/api/v1/auth/login", json=good)).status_code == 200

    for _ in range(5):
        assert (await client.post("/api/v1/auth/login", json=bad)).status_code == 401


async def test_rate_limits_fail_open_when_valkey_is_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    class Down:
        def __getattr__(self, _: str) -> Any:
            async def fail(*_: Any) -> None:
                raise ConnectionError

            return fail

    monkeypatch.setattr("app.core.rate_limit.get_valkey", lambda: Down())

    response = await register(client)
    login = await client.post(
        "/api/v1/auth/login", json={"email": "anna@example.pl", "password": PASSWORD}
    )

    assert response.status_code == 201
    assert login.status_code == 200


# --- session refresh and logout -----------------------------------------------------


async def test_refresh_rotates_the_token(client: AsyncClient) -> None:
    first = refresh_cookie(await register(client))

    response = await with_cookie(client, "/api/v1/auth/refresh", first)

    assert response.status_code == 200
    assert response.json()["accessToken"]
    assert refresh_cookie(response) != first


async def test_reusing_a_refresh_token_revokes_the_whole_family(client: AsyncClient) -> None:
    first = refresh_cookie(await register(client))
    second = refresh_cookie(await with_cookie(client, "/api/v1/auth/refresh", first))

    replay = await with_cookie(client, "/api/v1/auth/refresh", first)
    after = await with_cookie(client, "/api/v1/auth/refresh", second)

    assert replay.status_code == 401
    assert after.status_code == 401  # the legitimate newer token is revoked too


async def test_refresh_requires_csrf_header_and_cookie(client: AsyncClient) -> None:
    token = refresh_cookie(await register(client))

    without_header = await with_cookie(client, "/api/v1/auth/refresh", token, csrf=False)
    without_cookie = await with_cookie(client, "/api/v1/auth/refresh", None)
    unknown = await with_cookie(client, "/api/v1/auth/refresh", "not-a-token")

    assert without_header.status_code == 401
    assert without_cookie.status_code == 401
    assert unknown.status_code == 401


async def test_expired_refresh_token_is_rejected(client: AsyncClient) -> None:
    token = refresh_cookie(await register(client))
    async with get_sessionmaker()() as session:
        stored = await session.scalar(select(RefreshToken))
        assert stored is not None
        stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()

    response = await with_cookie(client, "/api/v1/auth/refresh", token)

    assert response.status_code == 401


async def test_logout_revokes_the_session(client: AsyncClient) -> None:
    token = refresh_cookie(await register(client))

    logout = await with_cookie(client, "/api/v1/auth/logout", token)
    refresh = await with_cookie(client, "/api/v1/auth/refresh", token)
    again = await with_cookie(client, "/api/v1/auth/logout", None)

    assert logout.status_code == 204
    assert (
        'profilo_rt=""' in logout.headers["set-cookie"]
        or "Max-Age=0" in logout.headers["set-cookie"]
    )
    assert refresh.status_code == 401
    assert again.status_code == 204  # idempotent


async def test_logout_ends_only_the_current_session(client: AsyncClient) -> None:
    first = refresh_cookie(await register(client))
    login = await client.post(
        "/api/v1/auth/login", json={"email": "anna@example.pl", "password": PASSWORD}
    )
    other = refresh_cookie(login)

    await with_cookie(client, "/api/v1/auth/logout", first)
    still_valid = await with_cookie(client, "/api/v1/auth/refresh", other)

    assert still_valid.status_code == 200


# --- access token -------------------------------------------------------------------


async def test_me_requires_a_valid_access_token(client: AsyncClient) -> None:
    body = (await register(client)).json()
    account_id = body["account"]["id"]
    import uuid

    expired = tokens.issue_access_token(
        uuid.UUID(account_id), now=datetime.now(UTC) - timedelta(hours=1)
    )
    tampered = body["accessToken"][:-2] + ("aa" if body["accessToken"][-2:] != "aa" else "bb")

    assert (await client.get("/api/v1/me")).status_code == 401
    for token in (expired, tampered, "not.a.jwt"):
        response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401
        assert response.json()["code"] == "unauthorized"


async def test_token_with_none_algorithm_is_rejected(client: AsyncClient) -> None:
    import base64
    import json

    body = (await register(client)).json()
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).rstrip(b"=")
    claims = body["accessToken"].split(".")[1].encode()
    forged = f"{header.decode()}.{claims.decode()}."

    response = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401


async def test_access_token_of_deleted_account_is_rejected(client: AsyncClient) -> None:
    body = (await register(client)).json()
    async with get_sessionmaker()() as session:
        account = await session.scalar(select(Account))
        await session.delete(account)
        await session.commit()

    response = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {body['accessToken']}"}
    )

    assert response.status_code == 401


async def test_login_does_not_reveal_the_email_in_logs(
    client: AsyncClient, capsys: pytest.CaptureFixture[str]
) -> None:
    await client.post(
        "/api/v1/auth/login", json={"email": "secret-person@example.pl", "password": "x" * 12}
    )

    assert "secret-person" not in capsys.readouterr().out
    assert await get_valkey().exists("rl:login_fail:secret-person@example.pl") == 1
