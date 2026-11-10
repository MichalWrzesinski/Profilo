from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.modules.accounts.models import Account, OneTimeToken

pytestmark = pytest.mark.usefixtures("clean_state")


async def register(client: AsyncClient) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Anna",
            "email": "anna@example.pl",
            "password": "jasne-niebo-nad-krakowem",
            "acceptTerms": True,
        },
    )
    assert response.status_code == 201
    return dict(response.json())


def token_from(email: dict[str, Any]) -> str:
    link: str = email["params"]["link"]
    assert link.startswith("http://localhost:8080/potwierdz-email?token=")
    token: str = parse_qs(urlparse(link).query)["token"][0]
    return token


async def confirm(client: AsyncClient, token: str) -> int:
    response = await client.post("/api/v1/auth/email-confirmations/confirm", json={"token": token})
    return response.status_code


async def is_confirmed() -> bool:
    async with get_sessionmaker()() as session:
        account = await session.scalar(select(Account))
        assert account is not None
        return account.email_confirmed_at is not None


def auth(session: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {session['accessToken']}"}


async def test_registration_queues_confirmation_email(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)

    assert len(sent_emails) == 1
    assert sent_emails[0]["template"] == "email_confirmation"
    assert sent_emails[0]["to"] == "anna@example.pl"
    async with get_sessionmaker()() as session:
        stored = await session.scalar(select(OneTimeToken))
    assert stored is not None
    assert stored.token_hash != token_from(sent_emails[0]).encode()  # only a hash is stored


async def test_valid_link_confirms_the_account(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    session = await register(client)

    status = await confirm(client, token_from(sent_emails[0]))
    me = await client.get("/api/v1/me", headers=auth(session))

    assert status == 204
    assert me.json()["emailConfirmed"] is True


async def test_same_link_clicked_twice_still_succeeds(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)
    token = token_from(sent_emails[0])

    assert await confirm(client, token) == 204
    assert await confirm(client, token) == 204


async def test_expired_link_is_rejected(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    await register(client)
    async with get_sessionmaker()() as session:
        stored = await session.scalar(select(OneTimeToken))
        assert stored is not None
        stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()

    response = await client.post(
        "/api/v1/auth/email-confirmations/confirm", json={"token": token_from(sent_emails[0])}
    )

    assert response.status_code == 410
    assert response.json()["code"] == "token_expired"
    assert not await is_confirmed()


async def test_unknown_link_is_rejected(client: AsyncClient) -> None:
    await register(client)

    assert await confirm(client, "x" * 43) == 410
    assert not await is_confirmed()


async def test_resend_invalidates_earlier_links(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    session = await register(client)
    first = token_from(sent_emails[0])

    response = await client.post("/api/v1/auth/email-confirmations", headers=auth(session))

    assert response.status_code == 202
    assert len(sent_emails) == 2
    assert await confirm(client, first) == 410
    assert await confirm(client, token_from(sent_emails[1])) == 204


async def test_second_resend_within_a_minute_is_refused(client: AsyncClient) -> None:
    session = await register(client)
    await client.post("/api/v1/auth/email-confirmations", headers=auth(session))

    second = await client.post("/api/v1/auth/email-confirmations", headers=auth(session))

    assert second.status_code == 429
    assert int(second.headers["retry-after"]) > 0


async def test_resend_is_capped_per_hour(client: AsyncClient) -> None:
    from app.core.valkey import get_valkey

    session = await register(client)
    statuses = []
    for _ in range(6):
        await get_valkey().delete(f"rl:confirm_resend:{session['account']['id']}")  # skip 1/min
        response = await client.post("/api/v1/auth/email-confirmations", headers=auth(session))
        statuses.append(response.status_code)

    assert statuses == [202] * 5 + [429]


async def test_confirm_is_rate_limited_per_ip(client: AsyncClient) -> None:
    from app.modules.accounts import confirmation

    await register(client)
    for _ in range(confirmation.CONFIRM_PER_IP.max_hits):
        await confirm(client, "y" * 43)

    assert await confirm(client, "y" * 43) == 429


async def test_resend_requires_login_and_unconfirmed_email(
    client: AsyncClient, sent_emails: list[dict[str, Any]]
) -> None:
    session = await register(client)
    await confirm(client, token_from(sent_emails[0]))

    anonymous = await client.post("/api/v1/auth/email-confirmations")
    confirmed = await client.post("/api/v1/auth/email-confirmations", headers=auth(session))

    assert anonymous.status_code == 401
    assert confirmed.status_code == 409
    assert confirmed.json()["code"] == "email_already_confirmed"


async def test_registration_succeeds_when_the_queue_is_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from app.modules.notifications.tasks import send_email

    def broker_down(*_: Any, **__: Any) -> None:
        raise ConnectionError("valkey down")

    monkeypatch.setattr(send_email, "apply_async", broker_down)

    await register(client)

    assert '"event": "email_enqueue_failed"' in capsys.readouterr().out
