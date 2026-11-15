"""Password reset by e-mail (ACC-US-4, ACC-BR-7).

The request answers the same whether or not the account exists, so it cannot be used to
find out who has an account. The link is valid for one hour and once; setting the new
password ends every session (refresh tokens revoked, older access tokens refused through
`password_changed_at`) and logs this browser in.
"""

import ipaddress
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.db import get_sessionmaker
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.modules.accounts import one_time, passwords, tokens
from app.modules.accounts.models import Account, OneTimeToken
from app.modules.accounts.sessions import end_all_sessions
from app.modules.notifications import service as notifications

PURPOSE = "password_reset"
VALIDITY = timedelta(hours=1)
# Scenario 4: the 6th request from one IP within an hour gets 429.
REQUEST_PER_IP = rate_limit.Limit("reset_request_ip", max_hits=5, window_seconds=3600)
# Per address the extra requests are dropped silently (same 202): a 429 here would tell
# whether someone asked for this address, and the mailbox is protected either way.
REQUEST_PER_EMAIL = rate_limit.Limit("reset_request_email", max_hits=3, window_seconds=3600)
# Protects the e-mail quota (Brevo free plan: 300/day) shared with confirmation e-mails.
MAILS_PER_DAY = rate_limit.Limit("reset_mail_day", max_hits=150, window_seconds=86400)
CONFIRM_PER_IP = rate_limit.Limit("reset_confirm_ip", max_hits=30, window_seconds=900)

EXPIRED_DETAIL = "Link wygasł albo został już użyty."


def reset_link(raw_token: str) -> str:
    return f"{get_settings().public_base_url}/nowe-haslo?token={raw_token}"


def _key(email: str) -> str:
    return email.strip().lower()


def ip_key(client_ip: str) -> str:
    """The limit's subject: an IPv4 address, or the /64 network of an IPv6 address (one
    connection usually gets a whole /64, so single IPv6 addresses are free to change)."""
    try:
        address = ipaddress.ip_address(client_ip)
    except ValueError:
        return client_ip
    if address.version == 6:
        return str(ipaddress.ip_network(f"{address}/64", strict=False))
    return client_ip


async def accept_request(email: str, client_ip: str) -> bool:
    """Rate limits of a reset request. False: drop it silently (still 202)."""
    await rate_limit.hit(REQUEST_PER_IP, ip_key(client_ip))
    try:
        await rate_limit.hit(REQUEST_PER_EMAIL, _key(email))
    except ProblemError:
        log.warning("password_reset_dropped")
        return False
    return True


async def send_link(email: str) -> None:
    """Send a reset link if the account exists. Runs after the 202 has been sent (a
    background task with its own database session), so the response time does not tell
    whether the account exists. Never raises: the visitor already has the answer."""
    try:
        async with get_sessionmaker()() as session:
            account = await session.scalar(select(Account).where(Account.email == email))
            if account is None:
                log.info("password_reset_unknown_email")
                return
            # Counted only for real accounts, so made-up addresses cannot use up the cap.
            try:
                await rate_limit.hit(MAILS_PER_DAY, "all")
            except ProblemError:
                log.error("password_reset_daily_cap_reached")
                return
            now = datetime.now(UTC)
            await use_open_tokens(session, account, now)  # a new link replaces older ones
            raw, digest = tokens.new_refresh_token()
            session.add(
                OneTimeToken(
                    account_id=account.id,
                    purpose=PURPOSE,
                    token_hash=digest,
                    expires_at=now + VALIDITY,
                )
            )
            await session.commit()
            await notifications.send("password_reset", account.email, {"link": reset_link(raw)})
            log.info("password_reset_requested", account_id=str(account.id))
    except Exception as exc:
        log.error("password_reset_request_failed", error=type(exc).__name__)


async def use_open_tokens(session: AsyncSession, account: Account, now: datetime) -> None:
    await session.execute(
        update(OneTimeToken)
        .where(
            OneTimeToken.account_id == account.id,
            OneTimeToken.purpose == PURPOSE,
            OneTimeToken.used_at.is_(None),
        )
        .values(used_at=now)
    )


def _field_errors(new_password: str) -> list[dict[str, str]]:
    return [{**error, "field": "newPassword"} for error in passwords.policy_errors(new_password)]


async def confirm(
    session: AsyncSession, raw_token: str, new_password: str, client_ip: str
) -> Account:
    """Set the new password, end every session, mark the token used. Returns the account,
    for which the caller starts a new session in this browser (still uncommitted)."""
    await rate_limit.hit(CONFIRM_PER_IP, client_ip)
    now = datetime.now(UTC)
    locked = await one_time.lock_with_account(session, raw_token, PURPOSE)
    if locked is None:
        raise ProblemError(410, "token_expired", EXPIRED_DETAIL)
    account, stored = locked
    if stored.used_at is not None or stored.expires_at <= now:
        raise ProblemError(410, "token_expired", EXPIRED_DETAIL)
    # Checked after the token, so a stale link says „wygasł” before asking for a new password.
    if errors := _field_errors(new_password):
        raise ProblemError(422, "validation_error", errors=errors)

    account.password_hash = await passwords.hash_password(new_password)
    # Taken after hashing: tokens issued while the hash was computed are older than this.
    now = datetime.now(UTC)
    # The link proves the owner reads this mailbox.
    if account.email_confirmed_at is None:
        account.email_confirmed_at = now
    await use_open_tokens(session, account, now)
    await end_all_sessions(session, account, now)
    log.info("password_reset_completed", account_id=str(account.id))
    return account


async def send_notice(account: Account) -> None:
    """Security notice after the change (after the commit, like every e-mail)."""
    await notifications.send(
        "password_changed",
        account.email,
        {"reset_link": f"{get_settings().public_base_url}/nie-pamietam-hasla"},
    )
