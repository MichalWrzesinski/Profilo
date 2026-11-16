"""Accounts: registration, login, session refresh with rotation, logout."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import proof_of_work, rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.modules.accounts import confirmation, password_reset, passwords, tokens
from app.modules.accounts.models import Account, RefreshToken
from app.modules.accounts.sessions import end_all_sessions
from app.modules.media import service as media
from app.modules.notifications import service as notifications
from app.modules.profiles.service import create_profile_for, forget_cards, quarantine_nick_of

REGISTER_PER_IP = rate_limit.Limit("register_ip", max_hits=10, window_seconds=3600)
# Every attempt, counted atomically before anything else: from the 4th one per IP within
# the hour a solved proof of work is required (only the counter, it never refuses itself).
REGISTER_ATTEMPTS = rate_limit.Limit("register_attempt_ip", max_hits=2**31, window_seconds=3600)
CHALLENGE_AFTER = 3  # registration attempts per IP per hour without a challenge
REGISTER_PER_EMAIL = rate_limit.Limit("register_email", max_hits=5, window_seconds=3600)
LOGIN_PER_IP = rate_limit.Limit("login_ip", max_hits=30, window_seconds=900)
# 5 failed logins per account in 15 minutes; the 6th attempt is refused (429).
LOGIN_FAILURES = rate_limit.Limit("login_fail", max_hits=5, window_seconds=900)
# A refresh token used again within this window (parallel tabs, a response lost on
# reload) gets a sibling token instead of being treated as reuse (ACC-BR-8).
REFRESH_REUSE_GRACE = timedelta(seconds=30)

EMAIL_TAKEN_DETAIL = "Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło"
INVALID_CREDENTIALS_DETAIL = "Nieprawidłowy e-mail lub hasło"


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
    session: AsyncSession,
    display_name: str,
    email: str,
    password: str,
    client_ip: str,
    challenge: str | None = None,
) -> IssuedSession:
    # After CHALLENGE_AFTER attempts from one IP within the hour, each further attempt must
    # carry a solved proof-of-work challenge (mass address checking, ACC edge cases).
    subject = rate_limit.ip_subject(client_ip)
    # INCR first and decide on its result: parallel requests cannot all see a low count.
    attempt = await rate_limit.hit(REGISTER_ATTEMPTS, subject)
    if attempt > CHALLENGE_AFTER and not await proof_of_work.verify(challenge):
        log.warning("registration_challenge_required")
        raise ProblemError(
            428,
            "challenge_required",
            "Potwierdzamy, że nie jesteś automatem. To potrwa chwilę",
            challenge=proof_of_work.create_challenge(),
        )
    await rate_limit.hit(REGISTER_PER_IP, subject)
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
    confirmation_token = await confirmation.issue_token(session, account)
    await session.commit()
    await session.refresh(account)
    log.info("account_registered", account_id=str(account.id))
    # After the commit: a queue failure must not undo the registration (TASK-005 S5).
    await confirmation.send_email(account, confirmation_token)
    return issued


async def login(session: AsyncSession, email: str, password: str, client_ip: str) -> IssuedSession:
    await rate_limit.hit(LOGIN_PER_IP, rate_limit.ip_subject(client_ip))
    if retry_after := await rate_limit.is_blocked(LOGIN_FAILURES, _key(email)):
        log.warning("login_locked")
        raise ProblemError(
            429,
            "rate_limited",
            "Za dużo nieudanych prób logowania. Spróbuj ponownie później",
            headers={"Retry-After": str(retry_after)},
        )
    # FOR SHARE: a password reset (FOR UPDATE on the account) waits for this login, or this
    # login waits for the reset and then checks the new password (no session can slip past
    # the reset's revocation, ACC-BR-7).
    account = await session.scalar(
        select(Account).where(Account.email == email).with_for_update(read=True)
    )
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
    digest = tokens.hash_refresh_token(raw_token)
    account_id = await session.scalar(
        select(RefreshToken.account_id).where(RefreshToken.token_hash == digest)
    )
    if account_id is None:
        raise _unauthorized()
    # Lock order account → token, as in a password reset: a reset either sees the rotated
    # token (and revokes it) or runs first, and then this token is already revoked.
    await session.scalar(
        select(Account.id).where(Account.id == account_id).with_for_update(read=True)
    )
    now = datetime.now(UTC)
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == digest).with_for_update()
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


async def reset_password(
    session: AsyncSession, raw_token: str, new_password: str, client_ip: str
) -> IssuedSession:
    """Set a new password from a reset link and log this browser in (ACC-BR-7)."""
    account = await password_reset.confirm(session, raw_token, new_password, client_ip)
    await rate_limit.reset(LOGIN_FAILURES, _key(account.email))
    issued = await _new_session(session, account)
    await session.commit()
    await password_reset.send_notice(account)
    return issued


# --- account settings (ACC-US-5, ACC-US-6) ----------------------------------------------

# Wrong current passwords per account: the 6th attempt within 15 minutes is refused (429),
# as for login, so a stolen session cannot guess the password needed to delete the account.
PASSWORD_CHECKS = rate_limit.Limit("password_check", max_hits=5, window_seconds=900)
INVALID_PASSWORD_DETAIL = "Hasło jest nieprawidłowe"  # noqa: S105 - a message, not a secret


async def _locked(session: AsyncSession, account_id: uuid.UUID) -> Account:
    account = await session.get(Account, account_id, with_for_update=True, populate_existing=True)
    if account is None:  # pragma: no cover - the caller is authenticated as this account
        raise _unauthorized()
    return account


async def _check_password(account: Account, password: str) -> None:
    if retry_after := await rate_limit.is_blocked(PASSWORD_CHECKS, str(account.id)):
        raise ProblemError(
            429,
            "rate_limited",
            "Za dużo prób z nieprawidłowym hasłem. Spróbuj ponownie później",
            headers={"Retry-After": str(retry_after)},
        )
    if not await passwords.verify_password(password, account.password_hash):
        await rate_limit.hit(PASSWORD_CHECKS, str(account.id))
        log.warning("password_check_failed", account_id=str(account.id))
        raise ProblemError(403, "invalid_password", INVALID_PASSWORD_DETAIL)
    await rate_limit.reset(PASSWORD_CHECKS, str(account.id))


async def change_password(
    session: AsyncSession, account_id: uuid.UUID, current: str, new: str
) -> IssuedSession:
    """New password for a confirmed account; every session ends and this browser gets a
    new one (its access token would be refused otherwise)."""
    account = await _locked(session, account_id)
    if account.email_confirmed_at is None:
        raise ProblemError(403, "email_not_confirmed", "Potwierdź adres e-mail, żeby zmienić hasło")
    await _check_password(account, current)
    if errors := [{**error, "field": "newPassword"} for error in passwords.policy_errors(new)]:
        raise ProblemError(422, "validation_error", errors=errors)
    if new == current:
        raise ProblemError(
            422,
            "validation_error",
            errors=[
                {
                    "field": "newPassword",
                    "code": "same_password",
                    "message": "Nowe hasło musi być inne niż obecne",
                }
            ],
        )
    account.password_hash = await passwords.hash_password(new)
    now = datetime.now(UTC)
    await end_all_sessions(session, account, now)
    # A reset link asked for before the change (maybe by someone else) stops working.
    await password_reset.use_open_tokens(session, account, now)
    issued = await _new_session(session, account)
    await session.commit()
    log.info("password_changed", account_id=str(account.id))
    await password_reset.send_notice(account)
    return issued


async def delete_account(session: AsyncSession, account_id: uuid.UUID, password: str) -> None:
    """Delete the account at once (ACC-BR-9): the profile, links, snapshot, image rows and
    tokens go with it (ON DELETE CASCADE), the nick is quarantined for 30 days (ACC-BR-10),
    the image files are removed by a task and a confirmation e-mail is sent."""
    account = await _locked(session, account_id)
    await _check_password(account, password)
    email = account.email
    profile_id = await quarantine_nick_of(session, account.id)
    await session.delete(account)
    await session.commit()
    log.info("account_deleted", account_id=str(account_id))
    # After the commit; failures are logged, never undo the deletion.
    await media.delete_files_of(account_id)
    if profile_id:
        await forget_cards(profile_id)
    await notifications.send("account_deleted", email, {})
