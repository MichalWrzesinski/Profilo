"""QR code of a URL as PNG or SVG (PUB-BR-12): dark modules on a light background with the
4-module quiet zone the standard requires, so printers and phone cameras read it reliably.
"""

import io
from typing import Literal

import segno
from PIL import Image, ImageDraw

Format = Literal["png", "svg"]

PNG_SIZE = 1024
QUIET_ZONE = 4  # modules (ISO/IEC 18004)
DARK = "#0F2747"  # brand navy: contrast with white about 15:1, reads like black
LIGHT = "#FFFFFF"
# High correction leaves room for the small central brand mark and printing damage.
ERROR_LEVEL = "h"


def _logo_box(code: segno.QRCode) -> tuple[int, int]:
    """An odd, module-aligned square, about a sixth of the symbol's width."""
    width = len(code.matrix)
    size = (width // 6) | 1
    return QUIET_ZONE + (width - size) // 2, size


def _logo_png(image: Image.Image, code: segno.QRCode, edges: list[int]) -> None:
    start, size = _logo_box(code)
    left, right = edges[start], edges[start + size]
    ImageDraw.Draw(image).rectangle((left, left, right - 1, right - 1), fill=LIGHT)
    inset = edges[start + 1]
    pixels = edges[start + size - 1] - inset
    # Draw only the logo at a larger size for smooth curves; QR modules stay pixel-sharp.
    logo = Image.new("RGB", (pixels * 4, pixels * 4), LIGHT)
    draw = ImageDraw.Draw(logo)
    scale = logo.width / 44

    def box(values: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        a, b, c, d = values
        return a * scale, b * scale, c * scale, d * scale

    draw.rounded_rectangle(box((0, 0, 44, 44)), radius=11 * scale, fill=DARK)
    stroke = round(3.6 * scale)
    draw.line(
        [(15 * scale, 32 * scale), (15 * scale, 12 * scale), (23.5 * scale, 12 * scale)],
        fill=LIGHT,
        width=stroke,
    )
    draw.arc(box((17, 12, 30, 25)), -90, 90, fill=LIGHT, width=stroke)
    draw.line([(23.5 * scale, 25 * scale), (15 * scale, 25 * scale)], fill=LIGHT, width=stroke)
    for x, y in [(15, 32), (15, 12), (15, 25)]:
        draw.ellipse(box((x - 1.8, y - 1.8, x + 1.8, y + 1.8)), fill=LIGHT)
    draw.ellipse(box((27.6, 27.6, 34.4, 34.4)), fill="#E0592A")
    image.paste(logo.resize((pixels, pixels), Image.Resampling.LANCZOS), (inset, inset))


def _code(url: str) -> segno.QRCode:
    return segno.make_qr(url, error=ERROR_LEVEL, boost_error=False)


def _png(code: segno.QRCode) -> bytes:
    """Exactly PNG_SIZE px square. Module edges are rounded to whole pixels, so modules differ
    by at most one pixel instead of the picture being resampled (blurry edges)."""
    rows = [list(row) for row in code.matrix_iter(scale=1, border=QUIET_ZONE)]
    count = len(rows)
    edges = [round(i * PNG_SIZE / count) for i in range(count + 1)]
    image = Image.new("RGB", (PNG_SIZE, PNG_SIZE), LIGHT)
    draw = ImageDraw.Draw(image)
    for y, row in enumerate(rows):
        for x, dark in enumerate(row):
            if dark:
                box = (edges[x], edges[y], edges[x + 1] - 1, edges[y + 1] - 1)
                draw.rectangle(box, fill=DARK)
    out = io.BytesIO()
    _logo_png(image, code, edges)
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _svg(code: segno.QRCode, url: str) -> bytes:
    """Scalable for print: a viewBox in modules plus a nominal size, crisp module edges."""
    out = io.BytesIO()
    code.save(
        out,
        kind="svg",
        border=QUIET_ZONE,
        dark=DARK,
        light=LIGHT,
        xmldecl=True,
        omitsize=True,
        title=f"Kod QR: {url}",
    )
    svg = out.getvalue().decode()
    svg = svg.replace(
        "<svg ", f'<svg width="{PNG_SIZE}" height="{PNG_SIZE}" shape-rendering="crispEdges" ', 1
    )
    start, size = _logo_box(code)
    logo = f'''<g id="profilo-logo" shape-rendering="geometricPrecision">
<rect x="{start}" y="{start}" width="{size}" height="{size}" fill="{LIGHT}"/>
<svg x="{start + 1}" y="{start + 1}" width="{size - 2}" height="{size - 2}" viewBox="0 0 44 44">
<rect width="44" height="44" rx="11" fill="{DARK}"/>
<path d="M15 32V12h8.5a6.5 6.5 0 0 1 0 13H15" fill="none" stroke="#fff"
stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="31" cy="31" r="3.4" fill="#E0592A"/>
</svg></g>'''
    svg = svg.replace("</svg>", logo + "</svg>")
    return svg.encode()


def render(url: str, format: Format) -> bytes:
    code = _code(url)
    return _png(code) if format == "png" else _svg(code, url)
