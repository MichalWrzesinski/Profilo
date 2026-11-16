"""Error reporting to Sentry (TASK-023, deployment standard: no personal data, passwords or
tokens in reports).

Enabled only when `SENTRY_DSN` is set (servers; the deploy workflow delivers it). Release =
the deployed commit (`SENTRY_RELEASE`), environment = `ENVIRONMENT`. Every event passes
`scrub_event` — also events from the browser, which reach Sentry only through the API
(`modules/monitoring`). Error-level log entries become Sentry events (`report_errors`), so
fail-open situations (rate limits without Valkey, failed e-mails) are alerted too.
"""

import re
import sys
from collections.abc import MutableMapping
from contextvars import ContextVar
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

from app.core.settings import get_settings

# Keys whose values are never sent, wherever they appear in an event.
SENSITIVE_KEY = re.compile(
    r"pass|secret|token|auth|cookie|session|e-?mail|phone|dsn|csrf|jwt|api[-_]?key|signature",
    re.IGNORECASE,
)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
# JWTs and long opaque strings (one-time tokens, refresh tokens, keys).
JWT = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
OPAQUE = re.compile(r"(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])")
QUERY_SECRET = re.compile(r"((?:token|code|password|email|key)=)[^&#\s]+", re.IGNORECASE)
# Nine or more digits, optionally separated (phone numbers; dates have eight).
# SQLAlchemy error messages carry the statement's parameters (e-mail, password hash).
SQL_PARAMETERS = re.compile(r"\[parameters: [^\]]*\]")
ARGON2_HASH = re.compile(r"\$argon2[A-Za-z0-9$=,./+]*")
PHONE = re.compile(r"(?<!\d)\+?\d(?:[ -]?\d){8,14}(?!\d)")
FILTERED = "[Filtered]"
# Event fields that are identifiers, not user data (the release is a 40-character SHA).
STRUCTURAL = frozenset(
    {
        "release",
        "event_id",
        "trace_id",
        "span_id",
        "parent_span_id",
        "debug_id",
        "debug_meta",
        "sdk",
        "platform",
        "timestamp",
        "start_timestamp",
        "dist",
        "fingerprint",
        "server_name",
        "request_id",
    }
)
SAFE_HEADERS = frozenset({"user-agent", "content-type", "accept", "accept-language"})


# Plain-text secrets of the current request (passwords from the request models): no pattern
# can recognise them in an exception message, so their exact values are removed.
_REQUEST_SECRETS: ContextVar[tuple[str, ...]] = ContextVar("request_secrets", default=())


def redact(value: str) -> str:
    """Marks a value of the current request (task) as secret; pydantic validator."""
    if len(value) >= 4:
        _REQUEST_SECRETS.set((*_REQUEST_SECRETS.get(), value))
    return value


def forget_request_secrets() -> None:
    _REQUEST_SECRETS.set(())


def scrub_text(value: str) -> str:
    for secret in _REQUEST_SECRETS.get():
        value = value.replace(secret, FILTERED)
    value = SQL_PARAMETERS.sub(f"[parameters: {FILTERED}]", value)
    value = ARGON2_HASH.sub(FILTERED, value)
    value = QUERY_SECRET.sub(rf"\1{FILTERED}", value)
    value = EMAIL.sub(FILTERED, value)
    value = JWT.sub(FILTERED, value)
    value = OPAQUE.sub(FILTERED, value)
    return PHONE.sub(FILTERED, value)


def _scrub(value: Any) -> Any:
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, MutableMapping):
        for key in list(value):
            if key in STRUCTURAL:
                continue
            if isinstance(key, str) and SENSITIVE_KEY.search(key):
                value[key] = FILTERED
            else:
                value[key] = _scrub(value[key])
        return value
    if isinstance(value, list):
        return [_scrub(item) for item in value]
    return value


def scrub_event(event: Any, _hint: Any = None) -> Any:
    """Removes personal data from a Sentry event (used as `before_send`)."""
    event.pop("user", None)
    request = event.get("request")
    if isinstance(request, MutableMapping):
        for field in ("data", "cookies", "env"):
            request.pop(field, None)
        headers = request.get("headers")
        if isinstance(headers, MutableMapping):
            request["headers"] = {
                k: v for k, v in headers.items() if str(k).lower() in SAFE_HEADERS
            }
    return _scrub(event)


def scrub_breadcrumb(crumb: Any, _hint: Any = None) -> Any:
    return _scrub(crumb)


def init_sentry(service: str) -> bool:
    """Starts the Sentry SDK when a DSN is configured; returns whether it did."""
    settings = get_settings()
    if settings.sentry_dsn is None:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn.get_secret_value(),
        environment=settings.environment,
        release=settings.sentry_release,
        # No user data, request bodies, frame variables (locals may hold e-mails and
        # passwords) or database parameters; scrub_event removes the rest.
        data_collection={
            "user_info": False,
            "http_bodies": [],
            "stack_frame_variables": False,
            "database_query_data": False,
        },
        max_request_body_size="never",
        traces_sample_rate=0,  # performance tracing is out of scope
        max_breadcrumbs=30,
        before_send=scrub_event,
        before_breadcrumb=scrub_breadcrumb,
        # Events come from report_errors (our structured log) and the framework
        # integrations; plain stdlib error logs would duplicate them.
        integrations=[LoggingIntegration(event_level=None)],
    )
    sentry_sdk.get_global_scope().set_tag("service", service)  # every scope, every request
    return True


def report_errors(
    _logger: Any, _method: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """structlog processor: error-level entries are sent to Sentry (scrubbed in before_send)."""
    if event_dict.get("level") not in ("error", "critical") or not sentry_sdk.is_initialized():
        return event_dict
    exc = event_dict.get("exc_info")
    if exc is True:
        exc = sys.exc_info()[1]
    with sentry_sdk.new_scope() as scope:
        for key, value in event_dict.items():
            if key not in ("event", "level", "timestamp", "exc_info"):
                scope.set_extra(key, value)
        if isinstance(exc, BaseException):
            scope.set_extra("log_event", event_dict.get("event"))
            sentry_sdk.capture_exception(exc)
        else:
            sentry_sdk.capture_message(str(event_dict.get("event")), level="error")
    return event_dict
