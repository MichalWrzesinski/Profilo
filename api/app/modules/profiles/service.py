"""Profiles: the owner's draft, nick assignment (PRF-BR-1…7). Public interface for other
modules: `create_profile_for`."""

import uuid
from datetime import UTC, datetime
from typing import Any

import phonenumbers
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.modules.profiles import nicks
from app.modules.profiles.models import Profile, ReservedNick
from app.modules.profiles.schemas import (
    DraftPatch,
    NickAvailabilityOut,
    OwnerProfileOut,
    ProfileContentOut,
)

# Shared by availability, suggestion and save: all of them tell whether a nick is free.
NICK_CHECKS = rate_limit.Limit("nick_check", max_hits=120, window_seconds=60)
MAX_SUGGESTIONS = 3


async def create_profile_for(
    session: AsyncSession, account_id: uuid.UUID, display_name: str
) -> Profile:
    """Create the empty draft profile of a new account (in the caller's transaction)."""
    profile = Profile(account_id=account_id, display_name=display_name)
    session.add(profile)
    await session.flush()
    return profile


async def get_own_profile(
    session: AsyncSession, account_id: uuid.UUID, lock: bool = False
) -> Profile:
    query = select(Profile).where(Profile.account_id == account_id)
    profile = await session.scalar(query.with_for_update() if lock else query)
    if profile is None:  # pragma: no cover - every account gets a profile at registration
        raise ProblemError(404, "not_found")
    return profile


def to_owner_out(profile: Profile) -> OwnerProfileOut:
    published = profile.status == "published"
    return OwnerProfileOut(
        nick=profile.nick,
        nick_locked=profile.nick_locked,
        status="blocked" if profile.blocked_at else profile.status,
        has_unpublished_changes=False,  # published snapshots: TASK-007
        published_at=None,
        version=profile.version,
        draft_updated_at=profile.draft_updated_at,
        public_url=f"{get_settings().public_base_url}/user/{profile.nick}" if published else None,
        draft=ProfileContentOut(
            display_name=profile.display_name,
            headline=profile.headline,
            bio=profile.bio,
            city=profile.city,
            company=profile.company,
            position=profile.position,
            public_email=profile.public_email,
            public_phone=profile.public_phone,
            layout=profile.layout,
            accent=profile.accent,
        ),
    )


# --- draft ---------------------------------------------------------------------------


def _normalise_phone(value: str) -> str:
    try:
        number = phonenumbers.parse(value, "PL")
    except phonenumbers.NumberParseException:
        number = None
    if number is None or not phonenumbers.is_valid_number(number):
        raise ProblemError(
            422,
            "validation_error",
            errors=[
                {
                    "field": "publicPhone",
                    "code": "invalid_phone",
                    "message": "To nie wygląda na numer telefonu. Sprawdź cyfry i kierunkowy.",
                }
            ],
        )
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def _normalise_email(value: str) -> str:
    try:
        return validate_email(value, check_deliverability=False).normalized
    except EmailNotValidError:
        raise ProblemError(
            422,
            "validation_error",
            errors=[
                {
                    "field": "publicEmail",
                    "code": "invalid_email",
                    "message": "To nie wygląda na adres e-mail. Sprawdź, czy jest w nim @.",
                }
            ],
        ) from None


async def update_draft(session: AsyncSession, account_id: uuid.UUID, patch: DraftPatch) -> Profile:
    """Apply a partial draft update with optimistic locking (PRF-BR-14)."""
    profile = await get_own_profile(session, account_id, lock=True)
    if patch.version != profile.version:
        current = to_owner_out(profile).model_dump(mode="json", by_alias=True)
        raise ProblemError(
            409,
            "draft_conflict",
            "Szkic zmienił się w innym oknie — odśwież.",
            current=current,
        )
    changes: dict[str, Any] = patch.model_dump(exclude_unset=True, exclude={"version"})
    if "display_name" in changes and not changes["display_name"]:
        raise ProblemError(
            422,
            "validation_error",
            errors=[{"field": "displayName", "code": "required", "message": "Wpisz nazwę."}],
        )
    for empty_to_null in (
        "headline",
        "bio",
        "city",
        "company",
        "position",
        "public_email",
        "public_phone",
    ):
        if changes.get(empty_to_null) == "":
            changes[empty_to_null] = None
    if changes.get("public_email"):
        changes["public_email"] = _normalise_email(changes["public_email"])
    if changes.get("public_phone"):
        changes["public_phone"] = _normalise_phone(changes["public_phone"])
    # Values equal to the current ones are not changes: they must not bump the version,
    # or an autosave in one window would make another window's save conflict.
    changes = {field: value for field, value in changes.items() if getattr(profile, field) != value}
    for field, value in changes.items():
        setattr(profile, field, value)
    if changes:
        profile.version += 1
        profile.draft_updated_at = datetime.now(UTC)
    await session.commit()
    return profile


# --- nicks ---------------------------------------------------------------------------


async def _unavailable(
    session: AsyncSession, candidates: list[str], account_id: uuid.UUID
) -> dict[str, str]:
    """Map of unavailable candidates → reason ('taken' or 'reserved'). An offensive word
    blocks every nick that contains it as a part (`word`, `word-2`, `anna-word`)."""
    if not candidates:
        return {}
    now = datetime.now(UTC)
    parts = {part for candidate in candidates for part in candidate.split("-")}
    taken = await session.scalars(
        select(Profile.nick).where(Profile.nick.in_(candidates), Profile.account_id != account_id)
    )
    reserved = (
        await session.execute(
            select(ReservedNick.nick, ReservedNick.reason).where(
                or_(
                    ReservedNick.nick.in_(candidates),
                    (ReservedNick.reason == "offensive") & ReservedNick.nick.in_(parts),
                ),
                or_(ReservedNick.expires_at.is_(None), ReservedNick.expires_at > now),
            )
        )
    ).all()
    exact = {str(nick).lower() for nick, _ in reserved}
    offensive = {str(nick).lower() for nick, reason in reserved if reason == "offensive"}
    result = {
        candidate: "reserved"
        for candidate in candidates
        if candidate in exact or offensive.intersection(candidate.split("-"))
    }
    result.update({str(nick).lower(): "taken" for nick in taken})
    return result


async def suggestions_for(session: AsyncSession, nick: str, profile: Profile) -> list[str]:
    """Up to 3 available variants (PRF-BR-5): {nick}-{city} first if a city is set, then -2, -3 …"""
    base = nick if nicks.format_error(nick) is None else nicks.propose(nick) or ""
    if not base:
        return []
    candidates: list[str] = []
    if profile.city and (with_city := nicks.with_suffix(base, profile.city)):
        candidates.append(with_city)
    candidates += [c for n in range(2, 30) if (c := nicks.with_suffix(base, str(n)))]
    unavailable = await _unavailable(session, candidates, profile.account_id)
    return [c for c in candidates if c not in unavailable][:MAX_SUGGESTIONS]


async def check_availability(
    session: AsyncSession, account_id: uuid.UUID, raw: str
) -> NickAvailabilityOut:
    await rate_limit.hit(NICK_CHECKS, str(account_id))
    profile = await get_own_profile(session, account_id)
    nick = nicks.normalise_input(raw)
    if nicks.format_error(nick):
        return NickAvailabilityOut(nick=nick, available=False, reason="invalid_format")
    reason = (await _unavailable(session, [nick], account_id)).get(nick)
    if reason:
        return NickAvailabilityOut(
            nick=nick,
            available=False,
            reason=reason,
            suggestions=await suggestions_for(session, nick, profile),
        )
    return NickAvailabilityOut(nick=nick, available=True)


async def suggest(session: AsyncSession, account_id: uuid.UUID, display_name: str) -> str | None:
    """An available nick proposed from the display name (PRF-BR-2), or None."""
    await rate_limit.hit(NICK_CHECKS, str(account_id))
    proposal = nicks.propose(display_name)
    if proposal is None:
        return None
    profile = await get_own_profile(session, account_id)
    if not await _unavailable(session, [proposal], account_id):
        return proposal
    alternatives = await suggestions_for(session, proposal, profile)
    return alternatives[0] if alternatives else None


def _nick_problem(code: str, detail: str, suggestions: list[str]) -> ProblemError:
    return ProblemError(409, code, detail, suggestions=suggestions)


async def set_nick(session: AsyncSession, account_id: uuid.UUID, raw: str) -> Profile:
    """Assign the nick (PRF-BR-6). Uniqueness is guaranteed by the unique index; the
    reserved list is checked in the same transaction (PRF-BR-4)."""
    await rate_limit.hit(NICK_CHECKS, str(account_id))
    profile = await get_own_profile(session, account_id, lock=True)
    nick = nicks.normalise_input(raw)
    if profile.nick_locked:
        if nick == profile.nick:
            return profile
        raise _nick_problem("nick_locked", "Adresu nie można zmienić po pierwszej publikacji.", [])
    if error := nicks.format_error(nick):
        raise ProblemError(
            422,
            "validation_error",
            errors=[{"field": "nick", "code": error, "message": nicks.RULE}],
        )
    if nick == profile.nick:
        return profile
    reason = (await _unavailable(session, [nick], account_id)).get(nick)
    if reason:
        raise _nick_problem(
            "nick_reserved" if reason == "reserved" else "nick_taken",
            "Ten adres jest już zajęty.",
            await suggestions_for(session, nick, profile),
        )
    try:
        await session.execute(
            update(Profile)
            .where(Profile.id == profile.id)
            .values(nick=nick, version=Profile.version + 1, draft_updated_at=func.now())
        )
        await session.commit()
    except IntegrityError as exc:  # another account took it at the same moment
        await session.rollback()
        profile = await get_own_profile(session, account_id)
        raise _nick_problem(
            "nick_taken",
            "Ten adres jest już zajęty.",
            await suggestions_for(session, nick, profile),
        ) from exc
    await session.refresh(profile)
    log.info("nick_assigned", account_id=str(account_id))
    return profile
