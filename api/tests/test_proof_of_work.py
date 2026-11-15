"""Registration bot protection: ALTCHA-format proof of work (TASK-018)."""

import base64
import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient

from app.core import proof_of_work
from app.modules.accounts import service

pytestmark = pytest.mark.usefixtures("clean_state")


@pytest.fixture(autouse=True)
def threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "CHALLENGE_AFTER", 3)
    monkeypatch.setattr(proof_of_work, "MAX_NUMBER", 2_000)  # quick to solve in tests


def solve(challenge: dict[str, Any], **overrides: Any) -> str:
    """What the browser's web worker does: try every number."""
    for number in range(challenge["maxnumber"] + 1):
        digest = hashlib.sha256(f"{challenge['salt']}{number}".encode()).hexdigest()
        if digest == challenge["challenge"]:
            payload = {
                "algorithm": challenge["algorithm"],
                "challenge": challenge["challenge"],
                "number": number,
                "salt": challenge["salt"],
                "signature": challenge["signature"],
                **overrides,
            }
            return base64.b64encode(json.dumps(payload).encode()).decode()
    raise AssertionError("unsolvable")


async def register(client: AsyncClient, number: int, challenge: str | None = None) -> Any:
    client.cookies.clear()
    return await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Anna",
            "email": f"anna{number}@example.pl",
            "password": "jasne-niebo-nad-krakowem",
            "acceptTerms": True,
            "challenge": challenge,
        },
    )


async def test_first_registrations_need_no_challenge(client: AsyncClient) -> None:
    statuses = [(await register(client, number)).status_code for number in range(3)]

    assert statuses == [201, 201, 201]


async def test_fourth_attempt_needs_a_solved_challenge(client: AsyncClient) -> None:
    for number in range(3):
        await register(client, number)

    required = await register(client, 3)
    solved = await register(client, 3, solve(required.json()["challenge"]))

    assert required.status_code == 428
    body = required.json()
    assert body["code"] == "challenge_required"
    assert set(body["challenge"]) == {"algorithm", "challenge", "maxnumber", "salt", "signature"}
    assert "expires=" in body["challenge"]["salt"]
    assert solved.status_code == 201


async def test_failed_attempts_count_too(client: AsyncClient) -> None:
    """Checking addresses (409 email_taken) is what the challenge slows down."""
    await register(client, 0)
    for _ in range(2):
        assert (await register(client, 0)).status_code == 409

    assert (await register(client, 0)).status_code == 428


@pytest.mark.parametrize(
    "forge",
    [
        lambda c: solve(c, number=(json.loads(base64.b64decode(solve(c)))["number"] + 1) % 2_000),
        lambda c: solve(c, signature="0" * 64),
        lambda c: solve(c, algorithm="SHA-1"),
        lambda c: solve(c, number="7"),
        lambda c: solve(c, number=True),
        lambda c: solve(c, number=-1),
        lambda c: solve(c, salt=None),
        lambda c: solve(c, salt="abc"),  # no expiry
        lambda c: solve(c, salt="abc?expires=jutro"),
        lambda _: "nie-base64!",
        lambda _: base64.b64encode(b"[1, 2]").decode(),
        lambda _: base64.b64encode(b"{zepsute").decode(),
    ],
)
async def test_forged_solutions_are_rejected(client: AsyncClient, forge: Any) -> None:
    for number in range(3):
        await register(client, number)
    challenge = (await register(client, 3)).json()["challenge"]

    response = await register(client, 3, forge(challenge))

    assert response.status_code == 428
    assert response.json()["challenge"]["challenge"] != challenge["challenge"]  # a new one


async def test_a_solution_works_once(client: AsyncClient) -> None:
    for number in range(3):
        await register(client, number)
    solution = solve((await register(client, 3)).json()["challenge"])

    first = await register(client, 3, solution)
    again = await register(client, 4, solution)

    assert (first.status_code, again.status_code) == (201, 428)


async def test_an_expired_challenge_is_rejected() -> None:
    old = proof_of_work.create_challenge(now=datetime.now(UTC) - timedelta(minutes=11))

    assert await proof_of_work.verify(solve(old)) is False


async def test_a_challenge_of_another_server_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    challenge = proof_of_work.create_challenge()
    monkeypatch.setattr(proof_of_work, "_key", lambda: b"inny-klucz")

    assert await proof_of_work.verify(solve(challenge)) is False


async def test_without_valkey_a_correct_solution_is_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Down:
        async def set(self, *_: object, **__: object) -> None:
            raise ConnectionError

    challenge = proof_of_work.create_challenge()
    monkeypatch.setattr(proof_of_work, "get_valkey", lambda: Down())

    assert await proof_of_work.verify(solve(challenge)) is True


async def test_rate_limit_count_without_valkey_is_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import rate_limit

    class Down:
        async def get(self, *_: object) -> None:
            raise ConnectionError

    monkeypatch.setattr(rate_limit, "get_valkey", lambda: Down())

    assert await rate_limit.count(service.REGISTER_PER_IP, "203.0.113.1") == 0


def test_the_number_is_within_the_published_range() -> None:
    challenge = proof_of_work.create_challenge()

    assert solve(challenge)  # always solvable within maxnumber
    assert challenge["maxnumber"] == proof_of_work.MAX_NUMBER
