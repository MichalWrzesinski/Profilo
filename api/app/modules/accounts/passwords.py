"""Password hashing (Argon2id via pwdlib) and the password policy (ACC-BR-3)."""

from functools import lru_cache

from anyio import to_thread
from pwdlib import PasswordHash
from zxcvbn.frequency_lists import FREQUENCY_LISTS

MIN_LENGTH = 10
MAX_LENGTH = 128

_hasher = PasswordHash.recommended()  # Argon2id with library defaults


@lru_cache
def _common_passwords() -> frozenset[str]:
    # ~30 000 most common passwords bundled with zxcvbn (no external call).
    return frozenset(FREQUENCY_LISTS["passwords"])


@lru_cache
def _dummy_hash() -> str:
    return _hasher.hash("timing-equaliser-not-a-password")


# Argon2 takes tens of milliseconds of CPU: run it in a worker thread so the event loop
# keeps serving other requests (including /ready) during login bursts.


async def hash_password(password: str) -> str:
    return await to_thread.run_sync(_hasher.hash, password)


async def verify_password(password: str, password_hash: str | None) -> bool:
    """Verify; with no hash (unknown account) spend the same time and return False."""
    if password_hash is None:
        await to_thread.run_sync(_hasher.verify, password, _dummy_hash())
        return False
    return await to_thread.run_sync(_hasher.verify, password, password_hash)


def policy_errors(password: str) -> list[dict[str, str]]:
    """Field errors in the API format; empty list when the password is acceptable."""
    if len(password) < MIN_LENGTH:
        return [
            _error("too_short", f"Hasło jest za krótkie. Użyj co najmniej {MIN_LENGTH} znaków.")
        ]
    if len(password) > MAX_LENGTH:
        return [_error("too_long", f"Hasło może mieć najwyżej {MAX_LENGTH} znaków.")]
    if password.lower() in _common_passwords():
        return [_error("password_too_common", "To hasło jest zbyt popularne. Wybierz inne.")]
    return []


def _error(code: str, message: str) -> dict[str, str]:
    return {"field": "password", "code": code, "message": message}
