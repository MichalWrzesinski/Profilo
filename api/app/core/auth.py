"""Authentication dependency: Bearer access token → current account."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import ProblemError
from app.modules.accounts import service, tokens
from app.modules.accounts.models import Account

_bearer = HTTPBearer(auto_error=False)


async def current_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Account:
    unauthorized = ProblemError(401, "unauthorized", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise unauthorized
    try:
        account_id = tokens.read_access_token(credentials.credentials)
    except tokens.InvalidTokenError:
        raise unauthorized from None
    account = await service.get_account(session, account_id)
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
    try:
        account_id = tokens.read_access_token(credentials.credentials)
    except tokens.InvalidTokenError:
        return None
    return await service.get_account(session, account_id)


OptionalAccount = Annotated[Account | None, Depends(optional_account)]
