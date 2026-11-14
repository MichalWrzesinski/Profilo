import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile

from app.core.auth import CurrentAccount
from app.core.db import get_session
from app.core.errors import ProblemError
from app.modules.media import processing
from app.modules.media import service as media
from app.modules.profiles import service
from app.modules.profiles.schemas import (
    DraftPatch,
    LinkInput,
    LinkOrder,
    LinkPatch,
    NickAvailabilityOut,
    NickRequest,
    NickSuggestionOut,
    OwnerProfileOut,
    PublicProfileOut,
    PublishRequest,
)

router = APIRouter(prefix="/api/v1")

DbSession = Annotated[AsyncSession, Depends(get_session)]
LinkId = Annotated[uuid.UUID, Path(alias="linkId")]


@router.get("/me/profile", tags=["profile"])
async def get_profile(account: CurrentAccount, session: DbSession) -> OwnerProfileOut:
    return await service.owner_out(session, await service.get_own_profile(session, account.id))


@router.patch("/me/profile", tags=["profile"])
async def update_draft(
    payload: DraftPatch, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    profile = await service.update_draft(session, account.id, payload)
    return await service.owner_out(session, profile)


@router.put("/me/profile/nick", tags=["profile"])
async def set_nick(
    payload: NickRequest, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    profile = await service.set_nick(session, account.id, payload.nick)
    return await service.owner_out(session, profile)


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


@router.post("/me/profile/publish", tags=["profile"])
async def publish(
    payload: PublishRequest, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    confirmed = account.email_confirmed_at is not None
    profile = await service.publish(session, account.id, confirmed, payload.version)
    return await service.owner_out(session, profile)


@router.post("/me/profile/unpublish", tags=["profile"])
async def unpublish(account: CurrentAccount, session: DbSession) -> OwnerProfileOut:
    return await service.owner_out(session, await service.unpublish(session, account.id))


@router.get("/public/profiles/{nick}", tags=["public"])
async def get_public_profile(nick: str, session: DbSession, response: Response) -> PublicProfileOut:
    # PUB-BR-6/PRF-BR-17: unpublishing must take effect on the next request.
    response.headers["Cache-Control"] = "no-store"
    return await service.get_public_profile(session, nick[:60])


@router.post("/me/profile/links", tags=["links"], status_code=status.HTTP_201_CREATED)
async def add_link(
    payload: LinkInput, account: CurrentAccount, session: DbSession, response: Response
) -> OwnerProfileOut:
    out = await service.owner_out(session, await service.add_link(session, account.id, payload))
    response.headers["Location"] = f"/api/v1/me/profile/links/{out.draft.links[-1].id}"
    return out


@router.put("/me/profile/links/order", tags=["links"])
async def reorder_links(
    payload: LinkOrder, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    profile = await service.reorder_links(session, account.id, payload.link_ids)
    return await service.owner_out(session, profile)


@router.patch("/me/profile/links/{linkId}", tags=["links"])
async def update_link(
    link_id: LinkId, payload: LinkPatch, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    profile = await service.update_link(session, account.id, link_id, payload)
    return await service.owner_out(session, profile)


@router.delete("/me/profile/links/{linkId}", tags=["links"], status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(link_id: LinkId, account: CurrentAccount, session: DbSession) -> None:
    await service.delete_link(session, account.id, link_id)


ImageKind = Literal["avatar", "background"]
# Multipart overhead on top of the 10 MB file (boundaries, headers).
_MAX_REQUEST = processing.MAX_BYTES + 64 * 1024


async def _read_upload(request: Request) -> bytes:
    """The uploaded file, refusing big requests before the form is parsed (Caddy also
    limits the body)."""
    length = request.headers.get("content-length")
    if length is None or not length.isdigit() or int(length) > _MAX_REQUEST:
        raise media.too_large()
    form = await request.form(max_files=1, max_fields=1)
    try:
        upload = form.get("file")
        if not isinstance(upload, UploadFile):
            raise ProblemError(
                422,
                "validation_error",
                errors=[{"field": "file", "code": "required", "message": "Wybierz plik."}],
            )
        data = await upload.read(processing.MAX_BYTES + 1)
    finally:
        await form.close()
    if len(data) > processing.MAX_BYTES:
        raise media.too_large()
    return data


@router.put(
    "/me/profile/images/{kind}",
    tags=["images"],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {
                            "file": {
                                "type": "string",
                                "contentMediaType": "application/octet-stream",
                            }
                        },
                    }
                }
            },
        }
    },
)
async def upload_image(
    kind: ImageKind, request: Request, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    data = await _read_upload(request)
    profile = await service.set_image(session, account.id, kind, data)
    return await service.owner_out(session, profile)


@router.delete("/me/profile/images/{kind}", tags=["images"])
async def remove_image(
    kind: ImageKind, account: CurrentAccount, session: DbSession
) -> OwnerProfileOut:
    profile = await service.remove_image(session, account.id, kind)
    return await service.owner_out(session, profile)
