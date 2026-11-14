"""Image processing (PRF-BR-13): pure functions, run in a worker thread.

The input is untrusted. The type is detected from the content, the pixel count is limited
before decoding (decompression bombs), only the first frame is used, the orientation from
EXIF is applied and every variant is re-encoded as WebP without EXIF, ICC or XMP data.
"""

import io
import warnings
from dataclasses import dataclass
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError

Kind = Literal["avatar", "background"]

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 40_000_000  # e.g. 8000 x 5000; larger images are refused before decoding
FORMATS = {"JPEG", "PNG", "WEBP"}
SIZES: dict[Kind, tuple[int, ...]] = {"avatar": (128, 256, 512), "background": (960, 1600, 2400)}
MIN_SIZE: dict[Kind, tuple[int, int]] = {"avatar": (128, 128), "background": (640, 200)}
WEBP_QUALITY = 82


class UnsupportedImageError(ValueError):
    """Not a JPEG, PNG or WebP image (or a broken / too large one)."""


class ImageTooSmallError(ValueError):
    pass


@dataclass(frozen=True)
class Processed:
    width: int
    height: int
    variants: dict[int, bytes]


def _open(data: bytes) -> Image.Image:
    with warnings.catch_warnings():
        # Pillow warns between MAX_PIXELS and twice MAX_PIXELS: refuse those too.
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            image = Image.open(io.BytesIO(data), formats=sorted(FORMATS))
            if image.format not in FORMATS:  # pragma: no cover - `formats` restricts it
                raise UnsupportedImageError
            if image.width * image.height > MAX_PIXELS:
                raise UnsupportedImageError
            image.seek(0)  # animated WebP/PNG: first frame only
            image.load()
        except (
            UnidentifiedImageError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            OSError,
            SyntaxError,
            ValueError,
            EOFError,
        ) as exc:
            if isinstance(exc, UnsupportedImageError):
                raise
            raise UnsupportedImageError from None
    return image


def _normalise(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    has_alpha = image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )
    return image.convert("RGBA" if has_alpha else "RGB")


def _encode(image: Image.Image) -> bytes:
    out = io.BytesIO()
    # No exif/icc_profile/xmp arguments: the variant carries pixels only.
    image.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
    return out.getvalue()


def process(data: bytes, kind: Kind) -> Processed:
    if len(data) > MAX_BYTES:
        raise UnsupportedImageError
    image = _normalise(_open(data))
    min_width, min_height = MIN_SIZE[kind]
    if image.width < min_width or image.height < min_height:
        raise ImageTooSmallError
    variants: dict[int, bytes] = {}
    if kind == "avatar":
        # The browser crops to a square; the server enforces it (centre crop).
        side = min(image.width, image.height)
        square = ImageOps.fit(image, (side, side), method=Image.Resampling.LANCZOS)
        for size in SIZES["avatar"]:
            variants[size] = _encode(square.resize((size, size), Image.Resampling.LANCZOS))
        return Processed(width=side, height=side, variants=variants)
    for width in SIZES["background"]:
        # Never upscale: a small background is served at its own width.
        target = min(width, image.width)
        height = max(1, round(image.height * target / image.width))
        variants[width] = _encode(image.resize((target, height), Image.Resampling.LANCZOS))
    return Processed(width=image.width, height=image.height, variants=variants)
