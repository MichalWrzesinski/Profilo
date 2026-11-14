"""Link rules (docs/product/areas/profile.md, PRF-BR-11). Pure functions."""

import re
import unicodedata
from urllib.parse import urlsplit, urlunsplit

MAX_LINKS = 20
MAX_URL_LENGTH = 2000
MAX_LABEL_LENGTH = 40
INVALID_URL = "To nie wygląda na adres strony. Sprawdź, czy nie ma w nim spacji."

# Domain → service; subdomains (pl.linkedin.com, m.youtube.com) match too.
SERVICES: dict[str, str] = {
    "linkedin.com": "linkedin",
    "github.com": "github",
    "x.com": "x",
    "twitter.com": "x",
    "instagram.com": "instagram",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "behance.net": "behance",
    "dribbble.com": "dribbble",
    "tiktok.com": "tiktok",
}
SERVICE_NAMES: dict[str, str] = {
    "linkedin": "LinkedIn",
    "github": "GitHub",
    "x": "X",
    "instagram": "Instagram",
    "facebook": "Facebook",
    "youtube": "YouTube",
    "behance": "Behance",
    "dribbble": "Dribbble",
    "tiktok": "TikTok",
}

# "mailto:", "javascript:", "data:" … — a scheme, unlike "example.com:8080".
_SCHEME = re.compile(r"^([a-z][a-z0-9+.\-]*):(?!\d)", re.IGNORECASE)
_LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")


class InvalidUrlError(ValueError):
    pass


# Control, format (zero-width, bidi overrides), separator, private-use and unassigned
# characters: invisible or misleading in a link shown to visitors.
_FORBIDDEN_CATEGORIES = {"Cc", "Cf", "Zs", "Zl", "Zp", "Co", "Cn"}


def _has_forbidden_characters(text: str) -> bool:
    return any(unicodedata.category(ch) in _FORBIDDEN_CATEGORIES for ch in text)


def _canonical_host(host: str) -> str | None:
    """The host as stored, or None when it is not a valid domain. Hosts with letters from
    scripts other than Latin are kept in ASCII (punycode) so a look-alike such as Cyrillic
    „a” in „apple.com” cannot pass for the real one on the page."""
    try:
        ascii_host = host.encode("idna").decode("ascii").lower()
        unicode_host = ascii_host.encode("ascii").decode("idna")
    except UnicodeError:
        return None
    labels = ascii_host.split(".")
    if (
        len(labels) < 2
        or len(ascii_host) > 253
        or not all(_LABEL.match(label) for label in labels)
        or labels[-1].isdigit()
    ):
        return None
    latin = all(ch.isascii() or unicodedata.name(ch, "").startswith("LATIN") for ch in unicode_host)
    return unicode_host if latin else ascii_host


def normalise_url(raw: str) -> str:
    """http(s) URL with `https://` added when the scheme is missing; anything else raises.
    Rejected: whitespace, control and invisible characters, other schemes (javascript:,
    mailto:, data:), user:password@ (used to disguise the real host), hosts without a domain,
    port 0. The result is built from the parsed parts and parsed again, so the stored host
    is exactly the one that was checked."""
    text = raw.strip()
    if not text or len(text) > MAX_URL_LENGTH or _has_forbidden_characters(text):
        raise InvalidUrlError
    scheme = _SCHEME.match(text)
    if scheme and scheme.group(1).lower() not in ("http", "https"):
        raise InvalidUrlError
    if not scheme:
        text = f"https://{text.lstrip('/')}"
    try:
        parts = urlsplit(text)
        port = parts.port  # raises for a bad port
    except ValueError:
        raise InvalidUrlError from None
    if parts.scheme.lower() not in ("http", "https") or "@" in parts.netloc or port == 0:
        raise InvalidUrlError
    host = _canonical_host(parts.hostname or "")
    if host is None:
        raise InvalidUrlError
    netloc = host if port is None else f"{host}:{port}"
    url = urlunsplit((parts.scheme.lower(), netloc, parts.path, parts.query, parts.fragment))
    check = urlsplit(url)
    if check.hostname != host or "@" in check.netloc or len(url) > MAX_URL_LENGTH:
        raise InvalidUrlError
    return url


def _domain(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def detect_service(url: str) -> str:
    host = _domain(url)
    for domain, service in SERVICES.items():
        if host == domain or host.endswith(f".{domain}"):
            return service
    return "other"


def default_label(url: str, service: str) -> str:
    """Service name for known services, otherwise the domain (PRF-BR-11)."""
    if service != "other":
        return SERVICE_NAMES[service]
    return _domain(url)[:MAX_LABEL_LENGTH]
