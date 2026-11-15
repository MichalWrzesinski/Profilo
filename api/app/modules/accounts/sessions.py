"""Ending every session of an account (password reset and change, ACC-BR-7, ACC-US-5)."""

from datetime import datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts.models import Account, RefreshToken


async def end_all_sessions(session: AsyncSession, account: Account, now: datetime) -> None:
    """Revoke every refresh token; access tokens issued before `password_changed_at` are
    refused by `app.core.auth` (set it to `now` first). The account row must be locked
    FOR UPDATE (lock order: account → refresh tokens, see `refresh`)."""
    account.password_changed_at = now
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.account_id == account.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
