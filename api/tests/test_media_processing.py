import io

import pytest
from PIL import Image, ImageCms

from app.modules.media import processing
from tests import images


def _open(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_avatar_variants_are_square_webp() -> None:
    result = processing.process(images.jpeg(800, 600), "avatar")

    assert sorted(result.variants) == [128, 256, 512]
    assert (result.width, result.height) == (600, 600)
    for size, data in result.variants.items():
        variant = _open(data)
        assert (variant.format, variant.size) == ("WEBP", (size, size))


@pytest.mark.parametrize(
    "data",
    [images.jpeg(800, 600), images.jpeg_with_profile(), images.png_with_text()],
    ids=["exif-gps", "icc-xmp", "png-text"],
)
def test_no_metadata_survives(data: bytes) -> None:
    source = Image.open(io.BytesIO(data))
    assert source.getexif() or "icc_profile" in source.info or source.info.get("Comment")

    result = processing.process(data, "avatar")

    for variant_bytes in result.variants.values():
        variant = _open(variant_bytes)
        assert variant.format == "WEBP"
        assert not variant.getexif()
        assert "icc_profile" not in variant.info
        assert "xmp" not in variant.info
        for secret in ("Aparat Anny", "GPS", "Kraków", "Długa", "Wiśniewska"):
            assert secret.encode() not in variant_bytes


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


def test_colour_profiles_are_converted_to_srgb(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    original = ImageCms.profileToProfile

    def spy(*args: object, **kwargs: object) -> object:
        calls.append("converted")
        return original(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(ImageCms, "profileToProfile", spy)

    result = processing.process(images.jpeg_with_profile(), "avatar")

    assert calls == ["converted"]
    assert _open(result.variants[128]).getpixel((64, 64)) == pytest.approx((255, 0, 0), abs=10)


def test_broken_colour_profile_is_ignored() -> None:
    result = processing.process(images.jpeg_with_profile(icc=b"not a profile"), "avatar")

    assert "icc_profile" not in _open(result.variants[128]).info


def test_big_inputs_are_reduced_before_resizing() -> None:
    avatar = processing.process(images.jpeg(4000, 3000), "avatar")
    background = processing.process(images.png(6000, 1000, mode="RGB"), "background")

    assert _open(avatar.variants[512]).size == (512, 512)
    assert _open(background.variants[2400]).size == (2400, 400)
    assert (background.width, background.height) == (6000, 1000)


def test_pixel_limit_is_24_megapixels() -> None:
    out = io.BytesIO()
    Image.new("1", (6000, 4001)).save(out, format="PNG")  # 24.006 Mpx

    with pytest.raises(processing.UnsupportedImageError):
        processing.process(out.getvalue(), "background")
