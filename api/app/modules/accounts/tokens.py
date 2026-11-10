"""Access tokens (JWT, PyJWT) and opaque refresh tokens (stored as SHA-256 hashes)."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.core.settings import get_settings

ALGORITHM = "HS256"
ISSUER = "profilo"
AUDIENCE = "profilo-api"


class InvalidTokenError(Exception):
    pass


def issue_access_token(account_id: uuid.UUID, now: datetime | None = None) -> str:
    settings = get_settings()
    now = now or datetime.now(UTC)
    claims = {
        "sub": str(account_id),
        "iat": now,
        "exp": now + timedelta(seconds=settings.access_token_ttl_seconds),
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    return jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm=ALGORITHM)


def read_access_token(token: str) -> uuid.UUID:
    """Return the account id; reject wrong signature, algorithm, expiry, issuer or audience."""
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[ALGORITHM],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        return uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError) as exc:
        raise InvalidTokenError from exc


def new_refresh_token() -> tuple[str, bytes]:
    """Return (token for the cookie, hash for the database)."""
    token = secrets.token_urlsafe(32)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()
