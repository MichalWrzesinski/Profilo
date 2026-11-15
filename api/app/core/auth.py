"""Authentication dependency: Bearer access token → current account."""

from datetime import timedelta
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import ProblemError
from app.modules.accounts import service, tokens
from app.modules.accounts.models import Account

_bearer = HTTPBearer(auto_error=False)
_SLACK = timedelta(milliseconds=1)


async def _account_for(session: AsyncSession, token: str) -> Account | None:
    """The token's account, or None. Access tokens issued before the last password change
    or reset are refused, so a reset ends every session at once, not only after their
    15 minutes (ACC-BR-7). 1 ms of slack for float rounding of `iat`."""
    try:
        claims = tokens.read_access_token(token)
    except tokens.InvalidTokenError:
        return None
    account = await service.get_account(session, claims.account_id)
    if account is None or claims.issued_at < account.password_changed_at - _SLACK:
        return None
    return account


async def current_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Account:
    unauthorized = ProblemError(401, "unauthorized", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise unauthorized
    account = await _account_for(session, credentials.credentials)
    if account is None:
        raise unauthorized
    return account


CurrentAccount = Annotated[Account, Depends(current_account)]


async def optional_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Account | None:
    """The signed-in account, or None for anonymous requests and invalid tokens."""
    if credentials is None:
        return None
    return await _account_for(session, credentials.credentials)


OptionalAccount = Annotated[Account | None, Depends(optional_account)]
