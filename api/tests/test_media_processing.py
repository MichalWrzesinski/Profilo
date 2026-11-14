import io

import pytest
from PIL import Image

from app.modules.media import processing
from tests import images


def _open(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_avatar_variants_are_square_webp_without_metadata() -> None:
    result = processing.process(images.jpeg(800, 600), "avatar")

    assert sorted(result.variants) == [128, 256, 512]
    assert (result.width, result.height) == (600, 600)
    for size, data in result.variants.items():
        variant = _open(data)
        assert (variant.format, variant.size) == ("WEBP", (size, size))
        assert not variant.getexif()
        assert "icc_profile" not in variant.info
        assert "xmp" not in variant.info
        assert b"Aparat Anny" not in data


def test_exif_orientation_is_applied_before_it_is_removed() -> None:
    # Orientation 6: the camera was turned; the image must be rotated to stand upright.
    result = processing.process(images.jpeg(900, 640, orientation=6), "background")

    assert (result.width, result.height) == (640, 900)


def test_background_keeps_proportions_and_is_never_upscaled() -> None:
    result = processing.process(images.jpeg(1200, 600), "background")

    sizes = {width: _open(data).size for width, data in result.variants.items()}
    assert sizes == {960: (960, 480), 1600: (1200, 600), 2400: (1200, 600)}


def test_transparency_is_kept() -> None:
    result = processing.process(images.png(), "avatar")

    assert _open(result.variants[128]).mode == "RGBA"


@pytest.mark.parametrize("mode", ["P", "L", "CMYK"])
def test_other_colour_modes_are_converted(mode: str) -> None:
    out = io.BytesIO()
    Image.new(mode, (300, 300)).save(out, format="JPEG" if mode == "CMYK" else "PNG")

    result = processing.process(out.getvalue(), "avatar")

    assert _open(result.variants[128]).mode == "RGB"


def test_animated_image_uses_the_first_frame() -> None:
    result = processing.process(images.animated_webp(), "avatar")

    variant = _open(result.variants[128])
    assert getattr(variant, "n_frames", 1) == 1
    pixel = variant.convert("RGB").getpixel((64, 64))
    assert isinstance(pixel, tuple)
    assert pixel == pytest.approx((255, 0, 0), abs=8)


@pytest.mark.parametrize(
    "data",
    [
        images.PDF,
        b"GIF89a" + b"\x00" * 100,
        b"",
        images.jpeg()[:200],  # cut off
        b"\x89PNG\r\n\x1a\n" + b"\x00" * 64,  # PNG header, garbage after
    ],
)
def test_other_or_broken_files_are_refused(data: bytes) -> None:
    with pytest.raises(processing.UnsupportedImageError):
        processing.process(data, "avatar")


def test_decompression_bomb_is_refused_before_decoding() -> None:
    out = io.BytesIO()
    Image.new("1", (9000, 5000)).save(out, format="PNG")  # 45 Mpx, a few kB on disk

    with pytest.raises(processing.UnsupportedImageError):
        processing.process(out.getvalue(), "background")


def test_more_than_ten_megabytes_is_refused() -> None:
    with pytest.raises(processing.UnsupportedImageError):
        processing.process(b"\xff" * (processing.MAX_BYTES + 1), "avatar")


@pytest.mark.parametrize(("kind", "size"), [("avatar", (100, 100)), ("background", (600, 400))])
def test_too_small_images_are_refused(kind: processing.Kind, size: tuple[int, int]) -> None:
    with pytest.raises(processing.ImageTooSmallError):
        processing.process(images.jpeg(*size), kind)
