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
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.logging import log
from app.core.settings import get_settings
from app.core.valkey import get_valkey

ALGORITHM = "SHA-256"
# Half of it on average: about 1 s in a desktop browser and a few seconds on a phone with
# the synchronous SHA-256 in the web worker; a bot with native code pays far less, so the
# per-IP limit stays the hard stop (REGISTER_PER_IP).
MAX_NUMBER = 500_000
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


# Exactly what create_challenge makes. Without the strict form, digits could move from the
# number to the end of the salt (the hash input is salt + number) and extend the expiry.
_SALT = re.compile(r"[0-9a-f]{24}\?expires=(\d{10})")


def _expiry(salt: str) -> int | None:
    match = _SALT.fullmatch(salt)
    return int(match.group(1)) if match else None


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
        return await _first_use(_decode(payload or "") or {})
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
    moment = (now or datetime.now(UTC)).timestamp()
    if expires is None or expires > moment + VALIDITY.total_seconds() + 60:
        return "malformed"
    if expires <= moment:
        return "expired"
    if not hmac.compare_digest(_sign(challenge), signature):
        return "bad_signature"
    if not hmac.compare_digest(_sha256(f"{salt}{number}"), challenge):
        return "wrong_number"
    return None


async def _first_use(data: dict[str, Any]) -> bool:
    expires = _expiry(str(data.get("salt", ""))) or 0
    remaining = int(expires - datetime.now(UTC).timestamp())
    ttl = min(max(remaining, 1), int(VALIDITY.total_seconds()) + 60)
    try:
        fresh = await get_valkey().set(f"pow:{data.get('challenge')}", "1", nx=True, ex=ttl)
    except Exception as exc:  # fail open, like the rate limits
        log.error("proof_of_work_store_unavailable", error=type(exc).__name__)
        return True
    if not fresh:
        log.warning("proof_of_work_rejected", reason="reused")
    return bool(fresh)
