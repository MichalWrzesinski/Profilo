from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentAccount
from app.core.db import get_session
from app.modules.profiles import service
from app.modules.profiles.schemas import (
    DraftPatch,
    NickAvailabilityOut,
    NickRequest,
    NickSuggestionOut,
    OwnerProfileOut,
)

router = APIRouter(prefix="/api/v1")

DbSession = Annotated[AsyncSession, Depends(get_session)]


@router.get("/me/profile", tags=["profile"])
async def get_profile(account: CurrentAccount, session: DbSession) -> OwnerProfileOut:
    return service.to_owner_out(await service.get_own_profile(session, account.id))


@router.patch("/me/profile", tags=["profile"])
async def update_draft(
    payload: DraftPatch, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    return service.to_owner_out(await service.update_draft(session, account.id, payload))


@router.put("/me/profile/nick", tags=["profile"])
async def set_nick(
    payload: NickRequest, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    return service.to_owner_out(await service.set_nick(session, account.id, payload.nick))


@router.get("/nicks/suggestion", tags=["profile"])
async def suggest_nick(
    account: CurrentAccount,
    session: DbSession,
    display_name: Annotated[str, Query(alias="displayName", min_length=1, max_length=60)],
) -> NickSuggestionOut:
    return NickSuggestionOut(nick=await service.suggest(session, account.id, display_name))


@router.get("/nicks/{nick}/availability", tags=["profile"])
async def check_nick(nick: str, account: CurrentAccount, session: DbSession) -> NickAvailabilityOut:
    return await service.check_availability(session, account.id, nick[:60])
