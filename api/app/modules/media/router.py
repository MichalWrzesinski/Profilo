import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import OptionalAccount
from app.core.db import get_session
from app.core.errors import ProblemError
from app.modules.media import service
from app.modules.profiles import service as profiles

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_session)]
Size = Literal["128", "256", "512", "960", "1600", "2400"]
ImageId = Annotated[uuid.UUID, Path(alias="imageId")]


@router.get(
    "/media/{imageId}/{size}.webp",
    tags=["public"],
    response_class=Response,
    responses={200: {"content": {"image/webp": {}}}},
)
async def get_image(
    image_id: ImageId, size: Size, account: OptionalAccount, session: DbSession
) -> Response:
    """Image variant for its owner (draft preview) or for a visible published page; the same
    404 otherwise, so hidden pages reveal nothing (PUB-BR-6)."""
    not_found = ProblemError(404, "not_found", headers={"Cache-Control": "no-store"})
    image = await service.get_image(session, image_id)
    if image is None:
        raise not_found
    public = await profiles.is_image_public(session, image.id)
    if not public and (account is None or account.id != image.account_id):
        raise not_found
    data = await service.read_variant(image, int(size))
    if data is None:
        raise not_found
    # A new upload gets a new id, so a URL never changes content. Draft images are private:
    # they must not be kept by shared caches, and unpublishing must hide them at once.
    cache = "public, max-age=31536000, immutable" if public else "private, no-store"
    return Response(
        data,
        media_type="image/webp",
        headers={
            "Cache-Control": cache,
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
        },
    )
