"""E-mail confirmation (ACC-US-2, ACC-US-7, ACC-BR-5)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.modules.accounts import tokens
from app.modules.accounts.models import Account, OneTimeToken
from app.modules.notifications import service as notifications

PURPOSE = "email_confirmation"
VALIDITY = timedelta(hours=48)
# Protect the e-mail quota (Brevo free plan: 300/day) and recipients from mail bombing.
RESEND_PER_MINUTE = rate_limit.Limit("confirm_resend", max_hits=1, window_seconds=60)
RESEND_PER_HOUR = rate_limit.Limit("confirm_resend_hour", max_hits=5, window_seconds=3600)
RESEND_PER_IP = rate_limit.Limit("confirm_resend_ip", max_hits=20, window_seconds=3600)
CONFIRM_PER_IP = rate_limit.Limit("confirm_ip", max_hits=30, window_seconds=900)


async def issue_token(session: AsyncSession, account: Account) -> str:
    """Create a new confirmation token and invalidate earlier unused ones (caller commits)."""
    now = datetime.now(UTC)
    await session.execute(
        update(OneTimeToken)
        .where(
            OneTimeToken.account_id == account.id,
            OneTimeToken.purpose == PURPOSE,
            OneTimeToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw, digest = tokens.new_refresh_token()
    session.add(
        OneTimeToken(
            account_id=account.id, purpose=PURPOSE, token_hash=digest, expires_at=now + VALIDITY
        )
    )
    await session.flush()
    return raw


def confirmation_link(raw_token: str) -> str:
    return f"{get_settings().public_base_url}/potwierdz-email?token={raw_token}"


async def send_email(account: Account, raw_token: str) -> None:
    await notifications.send(
        "email_confirmation", account.email, {"link": confirmation_link(raw_token)}
    )


async def resend(session: AsyncSession, account: Account, client_ip: str) -> None:
    if account.email_confirmed_at is not None:
        raise ProblemError(409, "email_already_confirmed", "Adres e-mail jest już potwierdzony.")
    await rate_limit.hit(RESEND_PER_IP, client_ip)
    await rate_limit.hit(RESEND_PER_MINUTE, str(account.id))
    await rate_limit.hit(RESEND_PER_HOUR, str(account.id))
    raw = await issue_token(session, account)
    await session.commit()
    await send_email(account, raw)
    log.info("email_confirmation_resent", account_id=str(account.id))


async def confirm(session: AsyncSession, raw_token: str, client_ip: str) -> None:
    """Confirm the e-mail. A used token is accepted again only if it confirmed the account
    (repeated click on the same link); expired, superseded or unknown tokens → 410."""
    await rate_limit.hit(CONFIRM_PER_IP, client_ip)
    now = datetime.now(UTC)
    stored = await session.scalar(
        select(OneTimeToken)
        .where(
            OneTimeToken.token_hash == tokens.hash_refresh_token(raw_token),
            OneTimeToken.purpose == PURPOSE,
        )
        .with_for_update()
    )
    expired = ProblemError(410, "token_expired", "Link wygasł albo został już użyty.")
    if stored is None or stored.expires_at <= now:
        raise expired
    account = await session.get(Account, stored.account_id, with_for_update=True)
    if account is None:  # pragma: no cover - tokens are deleted with the account
        raise expired
    if stored.used_at is not None:
        # Same link clicked again after it confirmed the account: still a success.
        if account.email_confirmed_at is not None and stored.used_at == account.email_confirmed_at:
            return
        raise expired
    if account.email_confirmed_at is None:
        account.email_confirmed_at = now
    stored.used_at = account.email_confirmed_at
    await session.commit()
    log.info("email_confirmed", account_id=str(account.id))
