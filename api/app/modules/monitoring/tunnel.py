"""Browser errors reach Sentry through the API (TASK-023).

The browser cannot talk to Sentry: CSP allows only our own origin (`connect-src 'self'`),
and the browser SDK has no real DSN (the client image is the same everywhere). It posts
envelopes here; only error events are kept, scrubbed with the server's rules, given the
server's release and environment, and forwarded with the server's DSN. Everything else
(sessions, replays, transactions, client reports) is dropped.
"""

import asyncio
import json
import time
import urllib.request
from collections import deque
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from app.core.logging import log
from app.core.monitoring import scrub_event
from app.core.settings import get_settings

MAX_ENVELOPE_BYTES = 200 * 1024
FORWARD_TIMEOUT_SECONDS = 5.0
# Per process and independent of Valkey (the per-IP limit fails open without it): at most
# this many browser events are forwarded per window, whoever sends them.
MAX_FORWARDED_PER_WINDOW = 60
FORWARD_WINDOW_SECONDS = 600.0
_forwarded: deque[float] = deque()


@dataclass(frozen=True)
class Dsn:
    public_key: str
    host: str
    project_id: str
    raw: str

    @property
    def envelope_url(self) -> str:
        return f"https://{self.host}/api/{self.project_id}/envelope/"


def parse_dsn(raw: str) -> Dsn | None:
    parts = urlsplit(raw)
    project_id = parts.path.strip("/")
    if parts.scheme != "https" or not parts.username or not parts.hostname or not project_id:
        return None
    return Dsn(parts.username, parts.netloc.split("@", 1)[1], project_id, raw)


def _line(body: bytes, pos: int) -> tuple[bytes, int]:
    end = body.find(b"\n", pos)
    end = len(body) if end < 0 else end
    return body[pos:end], end + 1


def error_events(body: bytes) -> list[dict[str, Any]]:
    """Error events of an envelope: a header line, then items — an item header line and a
    payload of `length` bytes (or up to the next newline when no length is given)."""
    events: list[dict[str, Any]] = []
    _, pos = _line(body, 0)  # envelope header: its DSN is the browser's placeholder
    while pos < len(body):
        header, pos = _line(body, pos)
        if not header.strip():
            continue
        try:
            item = json.loads(header)
        except ValueError, RecursionError:  # RecursionError: deeply nested input
            break
        if not isinstance(item, dict):
            break
        length = item.get("length")
        if isinstance(length, int) and length >= 0:
            payload = body[pos : pos + length]
            pos += length + 1  # the newline after the payload
        else:
            payload, pos = _line(body, pos)
        if item.get("type") != "event":
            continue
        try:
            event = json.loads(payload)
        except ValueError, RecursionError:
            continue
        if isinstance(event, dict) and ("exception" in event or "message" in event):
            events.append(event)
    return events


def prepare(event: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    event["environment"] = settings.environment
    if settings.sentry_release:
        event["release"] = settings.sentry_release
    # Anyone can post here: the browser does not choose grouping, level or tags.
    event["tags"] = {"service": "browser"}
    event["level"] = "error"
    for field in ("user", "extra", "modules", "fingerprint"):
        event.pop(field, None)
    contexts = event.get("contexts")
    # Browser, OS and device are useful; nothing else from the visitor's machine.
    event["contexts"] = (
        {k: v for k, v in contexts.items() if k in ("browser", "os", "device")}
        if isinstance(contexts, dict)
        else {}
    )
    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        event["request"] = {
            "url": request.get("url"),
            "headers": {"User-Agent": headers.get("User-Agent")}
            if isinstance(headers, dict) and "User-Agent" in headers
            else {},
        }
    scrubbed: dict[str, Any] = scrub_event(event)
    return scrubbed


def envelope(dsn: Dsn, event: dict[str, Any]) -> bytes:
    body = json.dumps(event, separators=(",", ":")).encode()
    header = {"event_id": event.get("event_id"), "dsn": dsn.raw}
    item = {"type": "event", "length": len(body), "content_type": "application/json"}
    return b"\n".join([json.dumps(header).encode(), json.dumps(item).encode(), body]) + b"\n"


def _post(dsn: Dsn, data: bytes) -> None:
    request = urllib.request.Request(  # noqa: S310 - https URL built from the configured DSN
        dsn.envelope_url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-sentry-envelope",
            "X-Sentry-Auth": (
                f"Sentry sentry_version=7, sentry_key={dsn.public_key}, "
                "sentry_client=profilo-tunnel/1.0"
            ),
        },
    )
    with urllib.request.urlopen(request, timeout=FORWARD_TIMEOUT_SECONDS):  # noqa: S310
        pass


async def forward(events: list[dict[str, Any]]) -> None:
    """Sends the events to Sentry; a failure is logged as a warning (never an error: that
    would itself be reported to Sentry)."""
    settings = get_settings()
    dsn = parse_dsn(settings.sentry_dsn.get_secret_value()) if settings.sentry_dsn else None
    if dsn is None:
        return
    for event in events:
        now = time.monotonic()
        while _forwarded and now - _forwarded[0] > FORWARD_WINDOW_SECONDS:
            _forwarded.popleft()
        if len(_forwarded) >= MAX_FORWARDED_PER_WINDOW:
            return
        _forwarded.append(now)
        try:
            await asyncio.to_thread(_post, dsn, envelope(dsn, prepare(event)))
        except Exception as exc:  # network, HTTP error, Sentry rate limit
            log.warning("sentry_forward_failed", error=type(exc).__name__)
