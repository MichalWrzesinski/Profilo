"""QR codes of page addresses (PUB-BR-12). Public interface: `render(url, format)`."""

from app.modules.qr.codes import Format, render

__all__ = ["Format", "render"]
