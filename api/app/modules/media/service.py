"""Media public interface: `store_upload`, `urls_for`, `read_variant`, `prune`."""

import asyncio
import secrets
import uuid
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.valkey import get_valkey
from app.modules.media import processing, storage
from app.modules.media.models import Image

Kind = Literal["avatar", "background"]
UPLOADS = rate_limit.Limit("image_upload", max_hits=30, window_seconds=3600)
# Decoding takes up to ~100 MB and a second of CPU per image: at most two at a time per API
# process, in their own threads, so uploads cannot starve image serving (default pool).
_PROCESSING = ThreadPoolExecutor(max_workers=2, thread_name_prefix="image")
_SLOT_SECONDS = 120


@asynccontextmanager
async def upload_slot(account_id: uuid.UUID) -> AsyncIterator[None]:
    """One upload per account at a time: queued uploads each hold up to 10 MB in memory.
    Taken before the body is read. Fails open when Valkey is down (like rate limits)."""
    key = f"upload:{account_id}"
    try:
        acquired = await get_valkey().set(key, "1", nx=True, ex=_SLOT_SECONDS)
    except Exception as exc:  # fail open, as in app.core.rate_limit
        log.error("upload_slot_unavailable", error=type(exc).__name__)
        acquired = None
        yield
        return
    if not acquired:
        raise ProblemError(
            429,
            "rate_limited",
            "Poczekaj, aż poprzedni obraz się wgra.",
            headers={"Retry-After": "5"},
        )
    try:
        yield
    finally:
        try:
            await get_valkey().delete(key)
        except Exception as exc:  # the key expires on its own
            log.error("upload_slot_release_failed", error=type(exc).__name__)


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
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(_PROCESSING, processing.process, data, kind)
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
    try:
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
    except BaseException:
        await storage.delete_prefix(key)  # no row points at these files
        raise
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


async def prune_rows(
    session: AsyncSession, account_id: uuid.UUID, keep: set[uuid.UUID]
) -> list[str]:
    """Delete (in the caller's transaction) the account's images that nothing references any
    more; returns their storage keys for `delete_files` once the transaction has committed."""
    unused = list(
        await session.scalars(
            select(Image).where(Image.account_id == account_id, Image.id.not_in(keep))
        )
    )
    for image in unused:
        await session.delete(image)
    return [image.storage_key for image in unused]


async def delete_files(keys: list[str]) -> None:
    for key in keys:
        await storage.delete_prefix(key)


def too_large() -> ProblemError:
    return _too_large()
