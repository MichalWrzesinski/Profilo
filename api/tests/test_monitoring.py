"""Error reporting (TASK-023): scrubbing, the API and worker setup, the browser tunnel."""

import json
import pathlib
import urllib.request
from collections.abc import Iterator
from typing import Any

import pytest
import sentry_sdk
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sentry_sdk.envelope import Envelope
from sentry_sdk.transport import Transport

from app.core import monitoring
from app.core.logging import log
from app.core.settings import get_settings
from app.main import app
from app.modules.monitoring import tunnel

DSN = "https://publickey@o1.ingest.de.sentry.io/4242"
RELEASE = "0123456789abcdef0123456789abcdef01234567"
EMAIL = "anna.kowalska@example.com"
PASSWORD = "ciche-jezioro-pod-tatrami"
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ"


class CaptureTransport(Transport):
    def __init__(self) -> None:
        super().__init__()
        self.events: list[dict[str, Any]] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        for item in envelope.items:
            if item.type == "event" and item.payload.json is not None:
                self.events.append(item.payload.json)


@pytest.fixture
def sentry(monkeypatch: pytest.MonkeyPatch) -> Iterator[CaptureTransport]:
    """Sentry on, with a transport that keeps the events in memory."""
    settings = get_settings()
    monkeypatch.setattr(settings, "sentry_dsn", SecretStr(DSN))
    monkeypatch.setattr(settings, "sentry_release", RELEASE)
    assert monitoring.init_sentry("api") is True
    transport = CaptureTransport()
    sentry_sdk.get_client().transport = transport
    yield transport
    sentry_sdk.get_client().close()
    sentry_sdk.get_global_scope().set_client(None)
    sentry_sdk.get_global_scope().remove_tag("service")


def no_personal_data(event: dict[str, Any]) -> None:
    dumped = json.dumps(event)
    for secret in (EMAIL, PASSWORD, JWT, "kowalska"):
        assert secret not in dumped


# --- Scrubbing -------------------------------------------------------------------------


def test_scrub_text_removes_emails_tokens_phones_and_query_secrets() -> None:
    text = (
        f"user {EMAIL} jwt {JWT} reset /nowe-haslo?token=abc123&x=1 "
        "tel +48 600 700 800 opaque Zx9_-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa date 2026-11-16"
    )
    scrubbed = monitoring.scrub_text(text)
    assert EMAIL not in scrubbed
    assert JWT not in scrubbed
    assert "token=[Filtered]&x=1" in scrubbed
    assert "600 700 800" not in scrubbed
    assert "Zx9_-aaaa" not in scrubbed
    assert "2026-11-16" in scrubbed  # dates are not phone numbers


def test_scrub_event_drops_request_body_cookies_user_and_sensitive_keys() -> None:
    event = {
        "release": RELEASE,
        "event_id": "a" * 32,
        "user": {"email": EMAIL, "ip_address": "203.0.113.9"},
        "request": {
            "url": "https://profilo.pl/api/v1/accounts",
            "data": {"email": EMAIL, "password": PASSWORD},
            "cookies": {"profilo_rt": JWT},
            "env": {"REMOTE_ADDR": "203.0.113.9"},
            "headers": {"Authorization": f"Bearer {JWT}", "User-Agent": "Firefox", "Cookie": "x"},
        },
        "extra": {"password": PASSWORD, "accountEmail": EMAIL, "count": 3, "items": [EMAIL]},
        "exception": {"values": [{"type": "RuntimeError", "value": f"failed for {EMAIL}"}]},
    }
    scrubbed = monitoring.scrub_event(event)
    no_personal_data(scrubbed)
    assert scrubbed["release"] == RELEASE  # identifiers stay
    assert scrubbed["event_id"] == "a" * 32
    assert "user" not in scrubbed
    assert scrubbed["request"]["headers"] == {"User-Agent": "Firefox"}
    assert {"data", "cookies", "env"}.isdisjoint(scrubbed["request"])
    assert scrubbed["extra"]["password"] == "[Filtered]"
    assert scrubbed["extra"]["count"] == 3
    assert scrubbed["extra"]["items"] == ["[Filtered]"]


def test_scrub_text_removes_request_secrets_sql_parameters_and_hashes() -> None:
    monitoring.redact(PASSWORD)
    monitoring.redact("abc")  # too short to be worth hunting for
    text = (
        f"login failed with {PASSWORD}; (psycopg.IntegrityError) duplicate key "  # noqa: S608
        "[SQL: INSERT INTO accounts (email, password_hash) VALUES (%s, %s)] "
        "[parameters: ('x', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA')] "
        "hash $argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA abc"
    )
    scrubbed = monitoring.scrub_text(text)
    assert PASSWORD not in scrubbed
    assert "argon2" not in scrubbed
    assert "[parameters: [Filtered]]" in scrubbed
    assert scrubbed.endswith("abc")
    monitoring.forget_request_secrets()
    assert monitoring.scrub_text(PASSWORD) == PASSWORD


def test_scrub_breadcrumb() -> None:
    crumb = monitoring.scrub_breadcrumb({"message": f"sent to {EMAIL}", "data": {"token": "x"}})
    assert crumb == {"message": "sent to [Filtered]", "data": {"token": "[Filtered]"}}


def test_sentry_is_off_without_a_dsn() -> None:
    assert get_settings().sentry_dsn is None
    assert monitoring.init_sentry("api") is False
    assert not sentry_sdk.is_initialized()


# --- Scenarios 1 and 3: an unhandled error during registration ---------------------------


async def test_unhandled_error_reaches_sentry_without_personal_data(
    sentry: CaptureTransport, clean_state: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.accounts import passwords

    async def broken_hash(password: str) -> str:
        raise RuntimeError(f"hashing failed for {password} of {EMAIL}, session {JWT}")

    monkeypatch.setattr(passwords, "hash_password", broken_hash)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/accounts",
            json={
                "displayName": "Anna Kowalska",
                "email": EMAIL,
                "password": PASSWORD,
                "acceptTerms": True,
            },
            headers={"Authorization": f"Bearer {JWT}", "Cookie": f"profilo_rt={JWT}"},
        )
    assert response.status_code == 500
    sentry_sdk.flush()
    assert len(sentry.events) == 1
    event = sentry.events[0]
    assert event["release"] == RELEASE
    assert event["environment"] == get_settings().environment
    assert event["tags"]["service"] == "api"
    assert event["tags"]["request_id"] == response.headers["X-Request-ID"]
    assert event["exception"]["values"][-1]["type"] == "RuntimeError"
    no_personal_data(event)


async def test_error_log_without_exception_becomes_a_message(sentry: CaptureTransport) -> None:
    log.error("email_failed", code=550, recipient=EMAIL)
    log.warning("not_reported")
    sentry_sdk.flush()
    assert [e["message"] for e in sentry.events] == ["email_failed"]
    assert sentry.events[0]["extra"]["code"] == 550
    no_personal_data(sentry.events[0])


async def test_error_log_with_exc_info_true(sentry: CaptureTransport) -> None:
    try:
        raise ValueError(f"bad value {EMAIL}")
    except ValueError:
        log.error("job_failed", exc_info=True)
    sentry_sdk.flush()
    assert sentry.events[0]["exception"]["values"][-1]["type"] == "ValueError"
    assert sentry.events[0]["extra"]["log_event"] == "job_failed"
    no_personal_data(sentry.events[0])


def test_worker_reports_with_its_own_service_tag(sentry: CaptureTransport) -> None:
    assert monitoring.init_sentry("worker") is True
    sentry_sdk.get_client().transport = sentry
    sentry_sdk.capture_message("task failed")
    sentry_sdk.flush()
    assert sentry.events[-1]["tags"]["service"] == "worker"


# --- Browser tunnel ----------------------------------------------------------------------


def browser_envelope(*items: tuple[dict[str, Any], dict[str, Any] | bytes]) -> bytes:
    lines = [json.dumps({"dsn": "https://public@sentry.invalid/1", "sent_at": "now"}).encode()]
    for header, payload in items:
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        lines += [json.dumps(header).encode(), body]
    return b"\n".join(lines) + b"\n"


BROWSER_EVENT: dict[str, Any] = {
    "event_id": "b" * 32,
    "release": "browser-says-something-else",
    "environment": "browser",
    "exception": {"values": [{"type": "TypeError", "value": f"x is undefined for {EMAIL}"}]},
    "request": {
        "url": "https://profilo.pl/nowe-haslo?token=abcdef",
        "headers": {"User-Agent": "Firefox", "Referer": "https://mail.example/inbox"},
    },
    "user": {"ip_address": "{{auto}}"},
    "contexts": {"browser": {"name": "Firefox"}, "culture": {"locale": "pl-PL"}},
    "extra": {"draft": {"publicEmail": EMAIL}},
    "tags": {"page": "editor"},
}


def test_error_events_keeps_only_events_and_handles_lengths() -> None:
    event = json.dumps(BROWSER_EVENT).encode()
    body = browser_envelope(
        ({"type": "session"}, {"status": "ok"}),
        ({"type": "event", "length": len(event)}, event),
        ({"type": "client_report"}, {"discarded": []}),
        ({"type": "event"}, b"not json"),
        ({"type": "event"}, {"no": "error"}),
    )
    assert [e["event_id"] for e in tunnel.error_events(body)] == ["b" * 32]
    assert tunnel.error_events(b"header only") == []
    assert tunnel.error_events(b"{}\nnot json\n{}") == []
    assert tunnel.error_events(b"{}\n[1]\n{}") == []
    assert tunnel.error_events(b"{}\n\n" + json.dumps({"type": "event"}).encode()) == []


def test_reads_an_envelope_made_by_the_browser_sdk() -> None:
    """browser_envelope.txt: serialised by @sentry/core 11.10 (createEventEnvelope +
    serializeEnvelope) with an attachment item whose payload has a length and a newline."""
    body = (pathlib.Path(__file__).parent / "browser_envelope.txt").read_bytes()
    events = tunnel.error_events(body)
    assert [e["event_id"] for e in events] == ["0f1e2d3c4b5a69788796a5b4c3d2e1f0"]
    prepared = tunnel.prepare(events[0])
    assert "kowalska" not in json.dumps(prepared)
    assert prepared["request"]["url"] == "https://profilo.pl/nowe-haslo?token=[Filtered]"


def test_prepare_sets_server_release_and_scrubs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "sentry_release", RELEASE)
    event = tunnel.prepare(json.loads(json.dumps(BROWSER_EVENT)))
    assert event["release"] == RELEASE
    assert event["environment"] == get_settings().environment
    assert event["tags"] == {"page": "editor", "service": "browser"}
    assert event["contexts"] == {"browser": {"name": "Firefox"}}
    assert event["request"] == {
        "url": "https://profilo.pl/nowe-haslo?token=[Filtered]",
        "headers": {"User-Agent": "Firefox"},
    }
    assert "user" not in event
    assert "extra" not in event
    no_personal_data(event)
    odd = tunnel.prepare({"message": "x", "tags": "x", "contexts": "x", "request": {"headers": 1}})
    assert odd["contexts"] == {}
    assert odd["request"]["headers"] == {}


def test_parse_dsn() -> None:
    dsn = tunnel.parse_dsn(DSN)
    assert dsn is not None
    assert dsn.envelope_url == "https://o1.ingest.de.sentry.io/api/4242/envelope/"
    assert dsn.public_key == "publickey"
    for bad in ("http://k@host/1", "https://host/1", "https://k@host/"):
        assert tunnel.parse_dsn(bad) is None


def test_envelope_carries_the_server_dsn() -> None:
    dsn = tunnel.parse_dsn(DSN)
    assert dsn is not None
    header, item, body = tunnel.envelope(dsn, {"event_id": "c" * 32, "message": "x"}).split(b"\n")[
        :3
    ]
    assert json.loads(header) == {"event_id": "c" * 32, "dsn": DSN}
    assert json.loads(item)["length"] == len(body)


async def test_forward_posts_scrubbed_events(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "sentry_dsn", SecretStr(DSN))
    sent: list[bytes] = []
    monkeypatch.setattr(tunnel, "_post", lambda dsn, data: sent.append(data))
    await tunnel.forward([json.loads(json.dumps(BROWSER_EVENT))])
    assert len(sent) == 1
    assert EMAIL.encode() not in sent[0]
    assert DSN.encode() in sent[0]


async def test_forward_failure_is_a_warning(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(get_settings(), "sentry_dsn", SecretStr(DSN))

    def fail(dsn: tunnel.Dsn, data: bytes) -> None:
        raise OSError("network down")

    monkeypatch.setattr(tunnel, "_post", fail)
    await tunnel.forward([{"message": "x"}])
    assert '"event": "sentry_forward_failed"' in capsys.readouterr().out


async def test_forward_without_a_valid_dsn_does_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tunnel, "_post", lambda dsn, data: pytest.fail("posted"))
    await tunnel.forward([{"message": "x"}])  # no DSN
    monkeypatch.setattr(get_settings(), "sentry_dsn", SecretStr("not a dsn"))
    await tunnel.forward([{"message": "x"}])


def test_post_sends_the_envelope_with_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[Any] = []

    class Response:
        def __enter__(self) -> Response:
            return self

        def __exit__(self, *args: object) -> None:
            return None

    def urlopen(request: Any, timeout: float) -> Response:
        requests.append((request, timeout))
        return Response()

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    dsn = tunnel.parse_dsn(DSN)
    assert dsn is not None
    tunnel._post(dsn, b"data")
    request, timeout = requests[0]
    assert request.full_url == "https://o1.ingest.de.sentry.io/api/4242/envelope/"
    assert "sentry_key=publickey" in request.get_header("X-sentry-auth")
    assert timeout == tunnel.FORWARD_TIMEOUT_SECONDS


async def test_tunnel_drops_reports_when_reporting_is_off(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(tunnel, "forward", lambda events: pytest.fail("forwarded"))
    r = await client.post("/api/v1/monitoring/sentry", content=browser_envelope())
    assert r.status_code == 204


async def test_tunnel_forwards_one_event(
    client: AsyncClient, clean_state: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "sentry_dsn", SecretStr(DSN))
    forwarded: list[list[dict[str, Any]]] = []

    async def fake_forward(events: list[dict[str, Any]]) -> None:
        forwarded.append(events)

    monkeypatch.setattr(tunnel, "forward", fake_forward)
    event = ({"type": "event"}, BROWSER_EVENT)
    r = await client.post("/api/v1/monitoring/sentry", content=browser_envelope(event, event))
    assert r.status_code == 204
    assert [len(events) for events in forwarded] == [1]
    r = await client.post(
        "/api/v1/monitoring/sentry", content=browser_envelope(({"type": "session"}, {}))
    )
    assert r.status_code == 204
    assert len(forwarded) == 1


async def test_tunnel_limits(
    client: AsyncClient, clean_state: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "sentry_dsn", SecretStr(DSN))
    monkeypatch.setattr(tunnel, "forward", lambda events: None)
    too_big = b"x" * (tunnel.MAX_ENVELOPE_BYTES + 1)
    r = await client.post("/api/v1/monitoring/sentry", content=too_big)
    assert r.status_code == 413
    assert r.json()["code"] == "payload_too_large"
    codes = [
        (await client.post("/api/v1/monitoring/sentry", content=browser_envelope())).status_code
        for _ in range(31)
    ]
    assert codes[:30] == [204] * 30
    assert codes[30] == 429
