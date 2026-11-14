"""Media public interface: `store_upload`, `urls_for`, `read_variant`, `prune`."""

import asyncio
import secrets
import uuid
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.modules.media import processing, storage
from app.modules.media.models import Image

Kind = Literal["avatar", "background"]
UPLOADS = rate_limit.Limit("image_upload", max_hits=30, window_seconds=3600)


def urls_for(image_id: uuid.UUID, kind: Kind) -> dict[str, str]:
    """Size → URL. A new upload gets a new id, so the URLs never change content."""
    return {str(size): f"/media/{image_id}/{size}.webp" for size in processing.SIZES[kind]}


async def store_upload(
    session: AsyncSession, account_id: uuid.UUID, kind: Kind, data: bytes
) -> Image:
    """Process and store an upload (in the caller's transaction for the row)."""
    await rate_limit.hit(UPLOADS, str(account_id))
    if len(data) > processing.MAX_BYTES:
        raise _too_large()
    try:
        result = await asyncio.to_thread(processing.process, data, kind)
    except processing.ImageTooSmallError:
        min_width, min_height = processing.MIN_SIZE[kind]
        raise ProblemError(
            422,
            "validation_error",
            errors=[
                {
                    "field": "file",
                    "code": "image_too_small",
                    # The multiplication sign is intended (Polish typography for dimensions).
                    "message": (
                        f"Obraz jest za mały. Użyj co najmniej {min_width} × {min_height} px."  # noqa: RUF001
                    ),
                }
            ],
        ) from None
    except processing.UnsupportedImageError:
        raise ProblemError(
            415, "unsupported_image", "To nie jest obraz JPG, PNG ani WebP. Wybierz inny plik."
        ) from None
    key = f"{account_id}/{secrets.token_urlsafe(18)}"
    for size, content in result.variants.items():
        await storage.put(f"{key}/{size}.webp", content)
    image = Image(
        account_id=account_id,
        kind=kind,
        storage_key=key,
        width=result.width,
        height=result.height,
    )
    session.add(image)
    await session.flush()
    log.info("image_stored", account_id=str(account_id), kind=kind, bytes=len(data))
    return image


def _too_large() -> ProblemError:
    return ProblemError(413, "file_too_large", "Plik jest za duży. Wybierz obraz do 10 MB.")


async def get_image(session: AsyncSession, image_id: uuid.UUID) -> Image | None:
    return await session.get(Image, image_id)


async def read_variant(image: Image, size: int) -> bytes | None:
    if size not in processing.SIZES[image.kind]:  # type: ignore[index]
        return None
    return await storage.get(f"{image.storage_key}/{size}.webp")


async def prune(session: AsyncSession, account_id: uuid.UUID, keep: set[uuid.UUID]) -> None:
    """Delete the account's images that nothing references any more (draft or published
    snapshot). Rows go in the caller's transaction; files after it commits."""
    unused = list(
        await session.scalars(
            select(Image).where(Image.account_id == account_id, Image.id.not_in(keep))
        )
    )
    for image in unused:
        await session.delete(image)
    await session.commit()
    for image in unused:
        await storage.delete_prefix(image.storage_key)


def too_large() -> ProblemError:
    return _too_large()
