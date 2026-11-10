"""Accounts: registration, login, session refresh with rotation, logout."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.modules.accounts import passwords, tokens
from app.modules.accounts.models import Account, RefreshToken
from app.modules.profiles.service import create_profile_for

REGISTER_PER_IP = rate_limit.Limit("register_ip", max_hits=10, window_seconds=3600)
REGISTER_PER_EMAIL = rate_limit.Limit("register_email", max_hits=5, window_seconds=3600)
LOGIN_PER_IP = rate_limit.Limit("login_ip", max_hits=30, window_seconds=900)
# 5 failed logins per account in 15 minutes; the 6th attempt is refused (429).
LOGIN_FAILURES = rate_limit.Limit("login_fail", max_hits=5, window_seconds=900)
# A refresh token used again within this window (parallel tabs, a response lost on
# reload) gets a sibling token instead of being treated as reuse (ACC-BR-8).
REFRESH_REUSE_GRACE = timedelta(seconds=30)

EMAIL_TAKEN_DETAIL = "Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło."
INVALID_CREDENTIALS_DETAIL = "Nieprawidłowy e-mail lub hasło."


@dataclass(frozen=True)
class IssuedSession:
    account: Account
    access_token: str
    refresh_token: str


def _unauthorized(detail: str | None = None) -> ProblemError:
    return ProblemError(401, "unauthorized", detail)


def _invalid_credentials() -> ProblemError:
    return ProblemError(401, "invalid_credentials", INVALID_CREDENTIALS_DETAIL)


def _key(email: str) -> str:
    return email.strip().lower()


async def _issue_refresh_token(
    session: AsyncSession, account_id: uuid.UUID, family_id: uuid.UUID
) -> str:
    raw, digest = tokens.new_refresh_token()
    expires = datetime.now(UTC) + timedelta(days=get_settings().refresh_token_ttl_days)
    session.add(
        RefreshToken(
            account_id=account_id, token_hash=digest, family_id=family_id, expires_at=expires
        )
    )
    await session.flush()
    return raw


async def _new_session(session: AsyncSession, account: Account) -> IssuedSession:
    refresh = await _issue_refresh_token(session, account.id, uuid.uuid7())
    return IssuedSession(account, tokens.issue_access_token(account.id), refresh)


async def register(
    session: AsyncSession, display_name: str, email: str, password: str, client_ip: str
) -> IssuedSession:
    await rate_limit.hit(REGISTER_PER_IP, client_ip)
    await rate_limit.hit(REGISTER_PER_EMAIL, _key(email))
    if errors := passwords.policy_errors(password):
        raise ProblemError(422, "validation_error", errors=errors)
    if await session.scalar(select(Account.id).where(Account.email == email)):
        raise ProblemError(409, "email_taken", EMAIL_TAKEN_DETAIL)

    account = Account(email=email, password_hash=await passwords.hash_password(password))
    session.add(account)
    try:
        await session.flush()
    except IntegrityError as exc:  # concurrent registration with the same e-mail
        await session.rollback()
        raise ProblemError(409, "email_taken", EMAIL_TAKEN_DETAIL) from exc
    await create_profile_for(session, account.id, display_name)
    issued = await _new_session(session, account)
    await session.commit()
    await session.refresh(account)
    log.info("account_registered", account_id=str(account.id))
    return issued


async def login(session: AsyncSession, email: str, password: str, client_ip: str) -> IssuedSession:
    await rate_limit.hit(LOGIN_PER_IP, client_ip)
    if retry_after := await rate_limit.is_blocked(LOGIN_FAILURES, _key(email)):
        log.warning("login_locked")
        raise ProblemError(
            429,
            "rate_limited",
            "Za dużo nieudanych prób logowania. Spróbuj ponownie później.",
            headers={"Retry-After": str(retry_after)},
        )
    account = await session.scalar(select(Account).where(Account.email == email))
    if not await passwords.verify_password(password, account.password_hash if account else None):
        await rate_limit.hit(LOGIN_FAILURES, _key(email))
        log.warning("login_failed", account_id=str(account.id) if account else None)
        raise _invalid_credentials()
    assert account is not None  # verify_password returns False without an account  # noqa: S101
    await rate_limit.reset(LOGIN_FAILURES, _key(email))
    issued = await _new_session(session, account)
    await session.commit()
    log.info("login_succeeded", account_id=str(account.id))
    return issued


async def refresh(session: AsyncSession, raw_token: str | None) -> IssuedSession:
    """Rotate a refresh token. Reusing an already used token revokes its whole family."""
    if not raw_token:
        raise _unauthorized()
    now = datetime.now(UTC)
    stored = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == tokens.hash_refresh_token(raw_token))
        .with_for_update()
    )
    if stored is None or stored.revoked_at is not None or stored.expires_at <= now:
        raise _unauthorized()
    if stored.used_at is not None and now - stored.used_at > REFRESH_REUSE_GRACE:
        await _revoke_family(session, stored.family_id, now)
        await session.commit()
        log.warning("refresh_token_reuse", account_id=str(stored.account_id))
        raise _unauthorized()

    stored.used_at = stored.used_at or now
    account = await session.get(Account, stored.account_id)
    if account is None:  # pragma: no cover - cascade deletes tokens with the account
        raise _unauthorized()
    new_refresh = await _issue_refresh_token(session, account.id, stored.family_id)
    await session.commit()
    return IssuedSession(account, tokens.issue_access_token(account.id), new_refresh)


async def logout(session: AsyncSession, raw_token: str | None) -> None:
    """End the current session (its token family). Idempotent."""
    if not raw_token:
        return
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == tokens.hash_refresh_token(raw_token))
    )
    if stored is not None:
        await _revoke_family(session, stored.family_id, datetime.now(UTC))
        await session.commit()


async def _revoke_family(session: AsyncSession, family_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


async def get_account(session: AsyncSession, account_id: uuid.UUID) -> Account | None:
    return await session.get(Account, account_id)
