"""Link rules (docs/product/areas/profile.md, PRF-BR-11). Pure functions."""

import re
from urllib.parse import urlsplit

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


def _host_is_valid(host: str) -> bool:
    try:
        ascii_host = host.encode("idna").decode("ascii")
    except UnicodeError:
        return False
    labels = ascii_host.split(".")
    return (
        len(labels) >= 2
        and len(ascii_host) <= 253
        and all(_LABEL.match(label) for label in labels)
        and not labels[-1].isdigit()
    )


def normalise_url(raw: str) -> str:
    """http(s) URL with `https://` added when the scheme is missing; anything else raises.
    Rejected: spaces and control characters, other schemes (javascript:, mailto:, data:),
    user:password@ (used to disguise the real host), hosts without a domain."""
    text = raw.strip()
    if not text or len(text) > MAX_URL_LENGTH or any(ch.isspace() or ord(ch) < 32 for ch in text):
        raise InvalidUrlError
    scheme = _SCHEME.match(text)
    if scheme and scheme.group(1).lower() not in ("http", "https"):
        raise InvalidUrlError
    if not scheme:
        text = f"https://{text.lstrip('/')}"
    try:
        parts = urlsplit(text)
        host = parts.hostname or ""
        _ = parts.port  # raises for a bad port
    except ValueError:
        raise InvalidUrlError from None
    if parts.scheme.lower() not in ("http", "https") or "@" in parts.netloc:
        raise InvalidUrlError
    if not _host_is_valid(host):
        raise InvalidUrlError
    # Lower-case scheme and host; path, query and fragment stay as typed.
    netloc = parts.netloc.lower()
    url = f"{parts.scheme.lower()}://{netloc}{text[len(parts.scheme) + 3 + len(netloc) :]}"
    if len(url) > MAX_URL_LENGTH:
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
