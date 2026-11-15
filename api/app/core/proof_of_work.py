"""Proof-of-work challenges in the ALTCHA format (self-hosted, no third party).

The server picks a secret number below `MAX_NUMBER` and publishes SHA-256(salt + number)
together with an HMAC signature; the browser finds the number by trying them all. The
salt carries the expiry (`?expires=…`), the signature proves the challenge came from us,
and a solved challenge is accepted once (kept in Valkey until it expires).
"""

import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs

from app.core.logging import log
from app.core.settings import get_settings
from app.core.valkey import get_valkey

ALGORITHM = "SHA-256"
# About 1 to 2 s of hashing in a web worker on a phone on average, a few on old devices.
MAX_NUMBER = 200_000
VALIDITY = timedelta(minutes=10)


def _key() -> bytes:
    """Signing key derived from the application secret (no extra secret to manage)."""
    secret = get_settings().jwt_secret.get_secret_value().encode()
    return hmac.new(secret, b"profilo:altcha", hashlib.sha256).digest()


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _sign(challenge: str) -> str:
    return hmac.new(_key(), challenge.encode(), hashlib.sha256).hexdigest()


def create_challenge(now: datetime | None = None) -> dict[str, Any]:
    expires = int(((now or datetime.now(UTC)) + VALIDITY).timestamp())
    salt = f"{secrets.token_hex(12)}?expires={expires}"
    challenge = _sha256(f"{salt}{secrets.randbelow(MAX_NUMBER + 1)}")
    return {
        "algorithm": ALGORITHM,
        "challenge": challenge,
        "maxnumber": MAX_NUMBER,
        "salt": salt,
        "signature": _sign(challenge),
    }


def _expiry(salt: str) -> int | None:
    _, _, query = salt.partition("?")
    values = parse_qs(query).get("expires")
    try:
        return int(values[0]) if values else None
    except ValueError:
        return None


def _decode(payload: str) -> dict[str, Any] | None:
    try:
        data = json.loads(base64.b64decode(payload, validate=True))
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


async def verify(payload: str | None, now: datetime | None = None) -> bool:
    """True for a correct, unexpired solution of one of our challenges, used for the first
    time. Every reason for a refusal is logged without personal data."""
    reason = _check(payload, now)
    if reason is None:
        return await _first_use(payload or "")
    log.warning("proof_of_work_rejected", reason=reason)
    return False


def _check(payload: str | None, now: datetime | None) -> str | None:
    data = _decode(payload) if payload else None
    if data is None:
        return "missing" if not payload else "malformed"
    number, salt = data.get("number"), data.get("salt")
    challenge, signature = data.get("challenge"), data.get("signature")
    if (
        data.get("algorithm") != ALGORITHM
        or not isinstance(number, int)
        or isinstance(number, bool)
        or not 0 <= number <= MAX_NUMBER
        or not isinstance(salt, str)
        or not isinstance(challenge, str)
        or not isinstance(signature, str)
    ):
        return "malformed"
    expires = _expiry(salt)
    if expires is None or expires <= (now or datetime.now(UTC)).timestamp():
        return "expired"
    if not hmac.compare_digest(_sign(challenge), signature):
        return "bad_signature"
    if not hmac.compare_digest(_sha256(f"{salt}{number}"), challenge):
        return "wrong_number"
    return None


async def _first_use(payload: str) -> bool:
    data = _decode(payload) or {}
    expires = _expiry(str(data.get("salt", ""))) or 0
    ttl = max(int(expires - datetime.now(UTC).timestamp()), 1)
    try:
        fresh = await get_valkey().set(f"pow:{data.get('challenge')}", "1", nx=True, ex=ttl)
    except Exception as exc:  # fail open, like the rate limits
        log.error("proof_of_work_store_unavailable", error=type(exc).__name__)
        return True
    if not fresh:
        log.warning("proof_of_work_rejected", reason="reused")
    return bool(fresh)
