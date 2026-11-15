"""Open Graph card (PUB-BR-7): a 1200 x 630 JPEG with the photo, name and headline.

A pure function, run in a worker thread. One card for every page (with the avatar when there
is one, initials otherwise): messengers and social sites crop a square photo badly, and the
card also shows the name and headline in previews that print no text.

Known limitation: Pillow here has no raqm, so right-to-left scripts are drawn in logical
order, and emoji (not in the brand font) appear as empty boxes.
"""

import io
from functools import cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

VERSION = 1  # part of the cache key: raise it when the card design changes
WIDTH, HEIGHT = 1200, 630
JPEG_QUALITY = 88
# Owner accent palette (docs/design/tokens.css, PUB-BR-3): white text passes AA on each.
ACCENTS = {
    "granat": "#0F2747",
    "niebieski": "#1F4E8C",
    "blekit": "#1D63C4",
    "morski": "#0F6B6B",
    "zielen": "#2D6A3E",
    "bordo": "#8E2442",
    "miedz": "#B3461C",
    "fiolet": "#5B3FA6",
}
BRAND_DOT = "#E0592A"
WHITE = (255, 255, 255)
SOFT_WHITE = (255, 255, 255, 220)  # headline: still above 4.5:1 on every accent
MUTED_WHITE = (255, 255, 255, 190)

_FONT = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "PlusJakartaSans.ttf"
_PAD = 80
_AVATAR = 300
_TEXT_X = _PAD + _AVATAR + 64
_TEXT_WIDTH = WIDTH - _TEXT_X - _PAD


# Shared by the render threads: FreeType calls run under the GIL in Pillow.
@cache
def _font(size: int, weight: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(_FONT), size)
    font.set_variation_by_axes([weight])
    return font


def _width(font: ImageFont.FreeTypeFont, text: str) -> float:
    return font.getlength(text)


def _split_long(word: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    """A word wider than the line (a long nick or URL) is cut into pieces that fit."""
    pieces, current = [], ""
    for char in word:
        if current and _width(font, current + char) > width:
            pieces.append(current)
            current = char
        else:
            current += char
    return [*pieces, current]


def wrap(text: str, font: ImageFont.FreeTypeFont, width: int, max_lines: int) -> list[str]:
    """Greedy word wrap; the last line ends with an ellipsis when the text does not fit."""
    words = [piece for word in text.split() for piece in _split_long(word, font, width)]
    lines: list[str] = []
    for word in words:
        candidate = f"{lines[-1]} {word}" if lines else word
        if lines and _width(font, candidate) <= width:
            lines[-1] = candidate
        else:
            lines.append(word)
    if len(lines) <= max_lines:
        return lines
    last = lines[max_lines - 1]
    while last and _width(font, f"{last}…") > width:
        last = last[:-1].rstrip()
    return [*lines[: max_lines - 1], f"{last}…"]


def _fit_name(name: str) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """The largest size at which the name fits in two lines (long names get smaller)."""
    for size in (76, 68, 60, 52):
        font = _font(size, 800)
        lines = wrap(name, font, _TEXT_WIDTH, 2) or [""]
        if not lines[-1].endswith("…"):
            return font, lines
    return font, lines


def initials(name: str) -> str:
    """Initials: "AW" for "Anna Wiśniewska", "K" for "Kasia" (as `initials` in the client)."""
    words = name.split()
    if not words:
        return ""
    return (words[0][0] + (words[-1][0] if len(words) > 1 else "")).upper()


def _initials_avatar(name: str, accent: str) -> Image.Image:
    avatar = Image.new("RGB", (_AVATAR, _AVATAR), WHITE)
    draw = ImageDraw.Draw(avatar)
    draw.text(
        (_AVATAR / 2, _AVATAR / 2), initials(name), font=_font(120, 800), fill=accent, anchor="mm"
    )
    return avatar


def _circle(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    """The image cropped to a square and a smooth circular mask (drawn at 4x, downscaled)."""
    square = ImageOps.fit(image.convert("RGB"), (_AVATAR, _AVATAR), Image.Resampling.LANCZOS)
    big = Image.new("L", (_AVATAR * 4, _AVATAR * 4), 0)
    ImageDraw.Draw(big).ellipse((0, 0, _AVATAR * 4 - 1, _AVATAR * 4 - 1), fill=255)
    return square, big.resize((_AVATAR, _AVATAR), Image.Resampling.LANCZOS)


def render(
    *,
    name: str,
    headline: str | None,
    address: str,
    accent: str,
    avatar: bytes | None,
) -> bytes:
    """The card as JPEG. `address` is the page address without the scheme, e.g.
    `profilo.pl/user/anna`; `avatar` is an already processed (trusted) WebP variant."""
    colour = ACCENTS.get(accent, ACCENTS["granat"])
    card = Image.new("RGB", (WIDTH, HEIGHT), colour)
    draw = ImageDraw.Draw(card, "RGBA")

    # Photo (or initials) in a white ring, vertically centred.
    photo = Image.open(io.BytesIO(avatar)) if avatar else _initials_avatar(name, colour)
    square, mask = _circle(photo)
    top = (HEIGHT - _AVATAR) // 2
    ring = 8
    draw.ellipse((_PAD - ring, top - ring, _PAD + _AVATAR + ring, top + _AVATAR + ring), fill=WHITE)
    card.paste(square, (_PAD, top), mask)

    # Name and headline, the block centred against the photo.
    name_font, name_lines = _fit_name(name)
    head_font = _font(38, 500)
    head_lines = wrap(headline, head_font, _TEXT_WIDTH, 2) if headline else []
    name_step, head_step, gap = int(name_font.size * 1.12), 50, 24
    block = len(name_lines) * name_step + (gap + len(head_lines) * head_step if head_lines else 0)
    y = (HEIGHT - block) // 2
    for line in name_lines:
        draw.text((_TEXT_X, y), line, font=name_font, fill=WHITE)
        y += name_step
    y += gap
    for line in head_lines:
        draw.text((_TEXT_X, y), line, font=head_font, fill=SOFT_WHITE)
        y += head_step

    # Footer: the page address and the wordmark with its dot.
    footer_y = HEIGHT - 56
    small = _font(28, 600)
    shown = wrap(address, small, _TEXT_WIDTH - 190, 1)[0]
    draw.text((_TEXT_X, footer_y), shown, font=small, fill=MUTED_WHITE, anchor="ls")
    mark = _font(36, 800)
    right = WIDTH - _PAD
    draw.ellipse((right - 12, footer_y - 12, right, footer_y), fill=BRAND_DOT)
    draw.text((right - 18, footer_y), "Profilo", font=mark, fill=WHITE, anchor="rs")

    out = io.BytesIO()
    card.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()
