"""Locking a one-time e-mail token together with its account (confirmation, reset)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts import tokens
from app.modules.accounts.models import Account, OneTimeToken


async def lock_with_account(
    session: AsyncSession, raw_token: str, purpose: str
) -> tuple[Account, OneTimeToken] | None:
    """The token and its account, both locked FOR UPDATE, in the project's lock order:
    the account first (as login, refresh, password change and deletion do), then the token.
    The other way round, a link clicked while the account is being deleted deadlocks."""
    digest = tokens.hash_refresh_token(raw_token)
    matching = (OneTimeToken.token_hash == digest, OneTimeToken.purpose == purpose)
    account_id = await session.scalar(select(OneTimeToken.account_id).where(*matching))
    if account_id is None:
        return None
    account = await session.get(Account, account_id, with_for_update=True, populate_existing=True)
    stored = await session.scalar(select(OneTimeToken).where(*matching).with_for_update())
    if account is None or stored is None:  # deleted meanwhile
        return None
    return account, stored
