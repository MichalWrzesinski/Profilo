"""Test images built in memory."""

import io
import os

from PIL import Image, ImageCms, PngImagePlugin


def jpeg(
    width: int = 800, height: int = 600, *, noise: bool = False, orientation: int = 1
) -> bytes:
    if noise:
        image = Image.frombytes("RGB", (width, height), os.urandom(width * height * 3))
    else:
        image = Image.new("RGB", (width, height), (200, 30, 30))
        image.paste((30, 30, 200), (0, 0, width // 2, height))  # left half blue
    exif = Image.Exif()
    exif[0x0112] = orientation  # Orientation
    exif[0x010F] = "Aparat Anny"  # Make
    exif[0x8825] = {2: (50.0, 3.0, 0.0), 1: "N"}  # GPS: latitude
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=95 if not noise else 100, exif=exif)
    return out.getvalue()


def png(width: int = 400, height: int = 400, mode: str = "RGBA") -> bytes:
    out = io.BytesIO()
    Image.new(mode, (width, height), 0).save(out, format="PNG")
    return out.getvalue()


def animated_webp() -> bytes:
    frames = [Image.new("RGB", (300, 300), color) for color in ((255, 0, 0), (0, 255, 0))]
    out = io.BytesIO()
    frames[0].save(out, format="WEBP", save_all=True, append_images=frames[1:])
    return out.getvalue()


PDF = b"%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"


def jpeg_with_profile(icc: bytes | None = None) -> bytes:
    """A JPEG carrying an ICC profile (sRGB unless given) and XMP metadata with a location."""
    profile = icc or ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    out = io.BytesIO()
    Image.new("RGB", (300, 300), (255, 0, 0)).save(
        out,
        format="JPEG",
        icc_profile=profile,
        xmp=b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><GPS>50.06,19.94</GPS></x:xmpmeta>',
    )
    return out.getvalue()


def png_with_text() -> bytes:
    info = PngImagePlugin.PngInfo()
    info.add_text("Comment", "Adres: ul. Długa 1, Kraków")
    info.add_itxt("Author", "Anna Wiśniewska", zip=True)
    out = io.BytesIO()
    Image.new("RGB", (300, 300), (10, 120, 200)).save(out, format="PNG", pnginfo=info)
    return out.getvalue()
