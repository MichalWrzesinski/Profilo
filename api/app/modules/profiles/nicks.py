"""Nick rules (docs/product/areas/profile.md, PRF-BR-1, PRF-BR-2). Pure functions."""

import re
import unicodedata

MIN_LENGTH = 3
MAX_LENGTH = 40
PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
# En dash is intended (Polish typography in a user-facing message).
RULE = "3–40 znaków: małe litery, cyfry i pojedyncze myślniki, bez myślnika na początku i końcu."  # noqa: RUF001

# Polish letters first (ł has no Unicode decomposition); other diacritics via NFKD.
_POLISH = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
_SEPARATORS = re.compile(r"[\s\-_./\\,;:+&|]+")
_INVALID = re.compile(r"[^a-z0-9-]")
_HYPHENS = re.compile(r"-{2,}")


def _ascii_lower(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text.translate(_POLISH))
    return "".join(ch for ch in ascii_text if not unicodedata.combining(ch)).lower()


def normalise(text: str) -> str:
    """Turn free text (a display name) into a clean nick (PRF-BR-2; no length rules)."""
    hyphenated = _SEPARATORS.sub("-", _ascii_lower(text))
    cleaned = _INVALID.sub("", hyphenated)
    return _HYPHENS.sub("-", cleaned).strip("-")


_INPUT_SEPARATORS = re.compile(r"[\s_./\\,;:+&|]+")


def normalise_input(text: str) -> str:
    """Normalisation applied to what the owner types (PRF-BR-3): as PRF-BR-2, but hyphens
    typed by the owner are kept as they are (leading, trailing, doubled) so the owner sees
    the rule (TASK-006 scenario 4). Only leading whitespace is trimmed, like the client,
    which must let the owner type a space before the next word."""
    return _INVALID.sub("", _INPUT_SEPARATORS.sub("-", _ascii_lower(text.lstrip())))


def propose(display_name: str) -> str | None:
    """Nick proposed from a display name, or None when it gives fewer than 3 characters."""
    nick = normalise(display_name)
    if len(nick) > MAX_LENGTH:
        cut = nick[:MAX_LENGTH]
        # Trim at a word boundary when the cut falls inside a word.
        if nick[MAX_LENGTH] != "-" and "-" in cut:
            cut = cut.rsplit("-", 1)[0]
        nick = cut.strip("-")
    return nick if len(nick) >= MIN_LENGTH else None


def format_error(nick: str) -> str | None:
    """Error code for a nick that breaks PRF-BR-1, or None when the format is valid."""
    if len(nick) < MIN_LENGTH:
        return "too_short"
    if len(nick) > MAX_LENGTH:
        return "too_long"
    if not PATTERN.match(nick):
        return "invalid_format"
    return None


def with_suffix(nick: str, suffix: str) -> str | None:
    """`{nick}-{suffix}` shortened to fit 40 characters; None if nothing sensible is left."""
    suffix = normalise(suffix)
    if not suffix:
        return None
    room = MAX_LENGTH - len(suffix) - 1
    base = nick[:room].strip("-")
    candidate = f"{base}-{suffix}"
    return candidate if base and format_error(candidate) is None else None
