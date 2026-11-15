"""QR code of a URL as PNG or SVG (PUB-BR-12): dark modules on a light background with the
4-module quiet zone the standard requires, so printers and phone cameras read it reliably.
"""

import io
import re
from typing import Literal

import segno
from PIL import Image, ImageDraw

Format = Literal["png", "svg"]

PNG_SIZE = 1024
QUIET_ZONE = 4  # modules (ISO/IEC 18004)
DARK = "#0F2747"  # brand navy: contrast with white about 15:1, reads like black
LIGHT = "#FFFFFF"
# M recovers ~15 % of damage (a crease or smudge on a printed card) and keeps the code small.
ERROR_LEVEL = "m"


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
    svg = re.sub(
        r"<svg ",
        f'<svg width="{PNG_SIZE}" height="{PNG_SIZE}" shape-rendering="crispEdges" ',
        svg,
        count=1,
    )
    return svg.encode()


def render(url: str, format: Format) -> bytes:
    code = _code(url)
    return _png(code) if format == "png" else _svg(code, url)
