"""Password reset by e-mail (TASK-015)."""

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.core import rate_limit
from app.core.db import get_sessionmaker
from app.core.errors import ProblemError
from app.modules.accounts import password_reset, tokens
from app.modules.accounts.models import Account, OneTimeToken
from app.modules.notifications import service as notifications

pytestmark = pytest.mark.usefixtures("clean_state")

EMAIL = "anna@example.pl"
OLD = "jasne-niebo-nad-krakowem"
NEW = "zielona-herbata-o-poranku"
REQUEST = "/api/v1/auth/password-resets"
CONFIRM = "/api/v1/auth/password-resets/confirm"


async def register(client: AsyncClient, email: str = EMAIL) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/accounts",
        json={"displayName": "Anna", "email": email, "password": OLD, "acceptTerms": True},
    )
    assert response.status_code == 201
    return dict(response.json())


def reset_emails(sent: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [email for email in sent if email["template"] == "password_reset"]


def token_from(email: dict[str, Any]) -> str:
    link: str = email["params"]["link"]
    assert link.startswith("http://localhost:8080/nowe-haslo?token=")
    return str(parse_qs(urlparse(link).query)["token"][0])


async def requested_token(client: AsyncClient, sent: list[dict[str, Any]]) -> str:
    response = await client.post(REQUEST, json={"email": EMAIL})
    assert response.status_code == 202
    return token_from(reset_emails(sent)[-1])


async def login(client: AsyncClient, password: str) -> int:
    response = await client.post("/api/v1/auth/login", json={"email": EMAIL, "password": password})
    return response.status_code


async def test_reset_sets_the_password_logs_in_and_ends_other_sessions(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    other = await register(client)  # another browser: access token + refresh cookie
    other_cookie = client.cookies.get("profilo_rt")
    client.cookies.clear()
    token = await requested_token(client, sent_emails)

    response = await client.post(CONFIRM, json={"token": token, "newPassword": NEW})

    assert response.status_code == 200
    session = response.json()
    assert session["account"]["email"] == EMAIL
    assert "profilo_rt=" in response.headers["set-cookie"]
    me = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {session['accessToken']}"}
    )
    assert me.status_code == 200
    # The other browser is logged out: its refresh token and its access token stop working.
    client.cookies.clear()
    client.cookies.set("profilo_rt", other_cookie or "", path="/api/v1/auth")
    refreshed = await client.post("/api/v1/auth/refresh", headers={"X-Requested-With": "profilo"})
    assert refreshed.status_code == 401
    old_access = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {other['accessToken']}"}
    )
    assert old_access.status_code == 401
    client.cookies.clear()
    assert await login(client, OLD) == 401
    assert await login(client, NEW) == 200
    notices = [email for email in sent_emails if email["template"] == "password_changed"]
    assert [notice["to"] for notice in notices] == [EMAIL]
    assert notices[0]["params"]["reset_link"] == "http://localhost:8080/nie-pamietam-hasla"


async def test_unknown_email_gets_the_same_answer_and_no_email(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)
    known = await client.post(REQUEST, json={"email": EMAIL})

    unknown = await client.post(REQUEST, json={"email": "nikt@example.pl"})

    assert (unknown.status_code, unknown.content) == (known.status_code, known.content)
    assert [email["to"] for email in reset_emails(sent_emails)] == [EMAIL]


async def test_email_lookup_ignores_case(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)

    await client.post(REQUEST, json={"email": "Anna@Example.PL"})

    assert [email["to"] for email in reset_emails(sent_emails)] == [EMAIL]


@pytest.mark.parametrize("case", ["used", "expired", "replaced", "unknown", "other_purpose"])
async def test_used_expired_or_replaced_link_is_refused(
    client: AsyncClient, sent_emails: list[dict[str, Any]], case: str
) -> None:
    registered = await register(client)
    token = await requested_token(client, sent_emails)
    if case == "used":
        assert (await client.post(CONFIRM, json={"token": token, "newPassword": NEW})).is_success
    elif case == "expired":
        async with get_sessionmaker()() as session:
            await session.execute(
                update(OneTimeToken).values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
            )
            await session.commit()
    elif case == "replaced":
        await client.post(REQUEST, json={"email": EMAIL})
    elif case == "unknown":
        token = "x" * 43
    else:  # the e-mail confirmation token is not a reset token
        token = parse_qs(urlparse(sent_emails[0]["params"]["link"]).query)["token"][0]
        assert registered

    response = await client.post(
        CONFIRM, json={"token": token, "newPassword": "inne-dobre-haslo-123"}
    )

    assert response.status_code == 410
    assert response.json()["code"] == "token_expired"
    assert response.json()["detail"] == "Link wygasł albo został już użyty."


async def test_link_is_valid_for_one_hour(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)
    await requested_token(client, sent_emails)

    async with get_sessionmaker()() as session:
        stored = await session.scalar(
            select(OneTimeToken).where(OneTimeToken.purpose == password_reset.PURPOSE)
        )
        assert stored is not None
        lifetime = stored.expires_at - stored.created_at
        assert timedelta(minutes=59) < lifetime < timedelta(hours=1, seconds=1)


@pytest.mark.parametrize(
    ("password", "code"),
    [("krotkie", "too_short"), ("password123", "password_too_common"), ("x" * 129, "too_long")],
)
async def test_weak_new_password_is_refused_and_the_link_stays_valid(
    client: AsyncClient, sent_emails: list[dict[str, Any]], password: str, code: str
) -> None:
    await register(client)
    token = await requested_token(client, sent_emails)

    response = await client.post(CONFIRM, json={"token": token, "newPassword": password})
    retry = await client.post(CONFIRM, json={"token": token, "newPassword": NEW})

    assert response.status_code == 422
    assert response.json()["errors"][0] | {"message": ""} == {
        "field": "newPassword",
        "code": code,
        "message": "",
    }
    assert retry.status_code == 200


async def test_reset_confirms_an_unconfirmed_email(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)
    token = await requested_token(client, sent_emails)

    session = (await client.post(CONFIRM, json={"token": token, "newPassword": NEW})).json()

    assert session["account"]["emailConfirmed"] is True


async def test_sixth_request_from_one_ip_within_an_hour_is_refused(client: AsyncClient) -> None:
    for number in range(5):
        response = await client.post(REQUEST, json={"email": f"osoba{number}@example.pl"})
        assert response.status_code == 202

    response = await client.post(REQUEST, json={"email": "osoba5@example.pl"})

    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


async def test_extra_requests_for_one_address_are_dropped_silently(
    client: AsyncClient, sent_emails: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    await register(client)
    monkeypatch.setattr(
        password_reset,
        "REQUEST_PER_IP",
        rate_limit.Limit("reset_request_ip", 100, 3600),
    )

    answers = [(await client.post(REQUEST, json={"email": EMAIL})).status_code for _ in range(5)]

    assert answers == [202] * 5
    assert len(reset_emails(sent_emails)) == 3


async def test_a_failing_background_step_is_only_logged(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await register(client)

    async def broken(*_: object, **__: object) -> None:
        raise ConnectionError

    monkeypatch.setattr(notifications, "send", broken)

    assert (await client.post(REQUEST, json={"email": EMAIL})).status_code == 202


async def test_old_access_tokens_are_refused_on_optional_endpoints_too(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    from app.core.auth import optional_account

    first = await register(client)
    client.cookies.clear()
    token = await requested_token(client, sent_emails)
    await client.post(CONFIRM, json={"token": token, "newPassword": NEW})

    async with get_sessionmaker()() as session:
        credentials = type("C", (), {"credentials": first["accessToken"]})()
        assert await optional_account(credentials, session) is None
        account = await session.scalar(select(Account))
        assert account is not None
        fresh = tokens.issue_access_token(account.id)
        credentials = type("C", (), {"credentials": fresh})()
        assert await optional_account(credentials, session) is not None


async def test_a_refresh_running_during_the_reset_does_not_keep_its_session(
    client: AsyncClient, sent_emails: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review B1: a rotation in flight (row locked, sibling token being written) must not
    leave a token the reset's revocation cannot see."""
    import asyncio

    from app.modules.accounts import service

    await register(client)
    stolen = client.cookies.get("profilo_rt")
    assert stolen
    client.cookies.clear()
    token = await requested_token(client, sent_emails)
    real_issue = service._issue_refresh_token
    refresh_holds_locks = asyncio.Event()

    async def slow_issue(*args: Any, **kwargs: Any) -> str:
        refresh_holds_locks.set()
        await asyncio.sleep(0.3)  # the reset starts meanwhile
        return await real_issue(*args, **kwargs)

    monkeypatch.setattr(service, "_issue_refresh_token", slow_issue)

    async def rotate() -> str:
        async with get_sessionmaker()() as session:
            return (await service.refresh(session, stolen)).refresh_token

    async def reset() -> None:
        await refresh_holds_locks.wait()
        async with get_sessionmaker()() as session:
            monkeypatch.setattr(service, "_issue_refresh_token", real_issue)
            await service.reset_password(session, token, NEW, "203.0.113.9")

    sibling, _ = await asyncio.gather(rotate(), reset())

    async with get_sessionmaker()() as session:
        with pytest.raises(ProblemError) as refused:
            await service.refresh(session, sibling)
    assert refused.value.status == 401


async def test_reset_requests_count_an_ipv6_network_as_one_address() -> None:
    ip = rate_limit.ip_subject
    assert ip("2001:db8:1:2:aaaa::1") == ip("2001:db8:1:2:ffff::9")
    assert ip("2001:db8:1:3::1") != ip("2001:db8:1:2::1")
    assert ip("203.0.113.9") == "203.0.113.9"
    assert ip("unknown") == "unknown"


async def test_reset_mails_have_a_daily_cap(
    client: AsyncClient, sent_emails: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    await register(client)
    monkeypatch.setattr(
        password_reset, "MAILS_PER_DAY", rate_limit.Limit("reset_mail_day", 1, 86400)
    )
    await client.post(REQUEST, json={"email": "nikt@example.pl"})  # unknown: not counted
    await client.post(REQUEST, json={"email": EMAIL})

    response = await client.post(REQUEST, json={"email": EMAIL})

    assert response.status_code == 202
    assert len(reset_emails(sent_emails)) == 1
