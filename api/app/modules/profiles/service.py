"""Profiles: the owner's draft, nick assignment (PRF-BR-1…7), publishing (PRF-BR-8, 15-17)
and the public read path (PUB-BR-6). Public interface for other modules: `create_profile_for`."""

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit

import phonenumbers
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.errors import ProblemError
from app.core.logging import log
from app.core.settings import get_settings
from app.core.valkey import get_valkey
from app.modules.media import service as media
from app.modules.profiles import links as link_rules
from app.modules.profiles import nicks, og_image
from app.modules.profiles.models import Profile, ProfileLink, PublishedProfile, ReservedNick
from app.modules.profiles.schemas import (
    DraftPatch,
    ImageRefOut,
    LinkInput,
    LinkOut,
    LinkPatch,
    NickAvailabilityOut,
    OwnerProfileOut,
    ProfileContentOut,
    PublicProfileOut,
    SitemapEntryOut,
    SitemapOut,
)
from app.modules.qr import Format as QrFormat
from app.modules.qr import render as render_qr

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


async def _links(session: AsyncSession, profile: Profile) -> list[ProfileLink]:
    return list(
        await session.scalars(
            select(ProfileLink)
            .where(ProfileLink.profile_id == profile.id)
            .order_by(ProfileLink.position)
        )
    )


def _image(image_id: uuid.UUID | None, kind: media.Kind) -> ImageRefOut | None:
    return ImageRefOut(id=image_id, urls=media.urls_for(image_id, kind)) if image_id else None


def _content(profile: Profile, links: list[ProfileLink]) -> ProfileContentOut:
    return ProfileContentOut(
        avatar=_image(profile.avatar_image_id, "avatar"),
        background=_image(profile.background_image_id, "background"),
        links=[
            LinkOut(id=link.id, url=link.url, label=link.label, service=link.service)
            for link in links
        ],
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
    )


def _public_url(nick: str) -> str:
    return f"{get_settings().public_base_url}/user/{nick}"


async def owner_out(session: AsyncSession, profile: Profile) -> OwnerProfileOut:
    snapshot = await session.get(PublishedProfile, profile.id)
    published = profile.status == "published" and profile.blocked_at is None
    return OwnerProfileOut(
        nick=profile.nick,
        nick_locked=profile.nick_locked,
        status="blocked" if profile.blocked_at else profile.status,
        has_unpublished_changes=snapshot is not None and snapshot.draft_version != profile.version,
        published_at=snapshot.published_at if snapshot else None,
        version=profile.version,
        draft_updated_at=profile.draft_updated_at,
        public_url=_public_url(profile.nick) if published and profile.nick else None,
        draft=_content(profile, await _links(session, profile)),
    )


# --- draft ---------------------------------------------------------------------------


async def _draft_conflict(session: AsyncSession, profile: Profile) -> ProblemError:
    current = (await owner_out(session, profile)).model_dump(mode="json", by_alias=True)
    return ProblemError(
        409, "draft_conflict", "Szkic zmienił się w innym oknie — odśwież.", current=current
    )


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
        raise await _draft_conflict(session, profile)
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


# --- publishing (ADR 0002) -----------------------------------------------------------

SNAPSHOT_SCHEMA_VERSION = 1  # PublishedProfileV1 = ProfileContentOut


async def publish(
    session: AsyncSession, account_id: uuid.UUID, email_confirmed: bool, version: int
) -> Profile:
    """Copy the whole draft to the published snapshot in one transaction (PRF-BR-15).
    Idempotent: an unchanged, already published draft keeps its `published_at`."""
    profile = await get_own_profile(session, account_id, lock=True)
    if profile.blocked_at:
        raise ProblemError(403, "profile_blocked", "Strona jest zablokowana — napisz do nas.")
    if not email_confirmed:
        raise ProblemError(
            403, "email_not_confirmed", "Potwierdź adres e-mail, żeby opublikować stronę."
        )
    if version != profile.version:
        raise await _draft_conflict(session, profile)
    if not profile.nick:
        raise ProblemError(
            422,
            "profile_incomplete",
            errors=[{"field": "nick", "code": "required", "message": "Wybierz adres strony."}],
        )
    snapshot = await session.get(PublishedProfile, profile.id, with_for_update=True)
    unchanged = (
        snapshot is not None
        and profile.status == "published"
        and snapshot.draft_version == profile.version
    )
    if not unchanged:
        content = _content(profile, await _links(session, profile)).model_dump(
            mode="json", by_alias=True
        )
        now = datetime.now(UTC)
        if snapshot is None:
            snapshot = PublishedProfile(profile_id=profile.id)
            session.add(snapshot)
        snapshot.content = content
        snapshot.schema_version = SNAPSHOT_SCHEMA_VERSION
        snapshot.draft_version = profile.version
        snapshot.published_at = now
        profile.status = "published"
        profile.nick_locked = True  # PRF-BR-7: permanent after the first publication
        log.info("profile_published", account_id=str(account_id))
    await session.flush()  # the new snapshot decides which images are still used
    unused = await _unused_images(session, profile)
    await session.commit()
    await media.delete_files(unused)
    return profile


async def unpublish(session: AsyncSession, account_id: uuid.UUID) -> Profile:
    """Hide the public page at once; the snapshot is kept (PRF-BR-17). Idempotent."""
    profile = await get_own_profile(session, account_id, lock=True)
    if profile.status == "published":
        profile.status = "unpublished"
        log.info("profile_unpublished", account_id=str(account_id))
    await session.commit()
    return profile


async def get_public_profile(session: AsyncSession, nick: str) -> PublicProfileOut:
    """The published snapshot, or the same 404 for unknown, unpublished and blocked nicks
    (PUB-BR-6). Never reads the draft or the account."""
    page = await _visible(session, nick)
    return PublicProfileOut(
        nick=page.nick,
        canonical_url=_public_url(page.nick),
        og_image_url=_og_image_url(page.nick, page.snapshot.draft_version),
        published_at=page.snapshot.published_at,
        content=ProfileContentOut.model_validate(page.snapshot.content),
    )


# --- link previews and search engines (PUB-BR-7) ---------------------------------------

# Cards are small (about 50 kB) and change only when the page is published again.
_OG_CACHE_SECONDS = 7 * 24 * 3600
# Rendering takes ~50 ms of CPU: at most two at a time, off the event loop.
_RENDERING = ThreadPoolExecutor(max_workers=2, thread_name_prefix="og-image")
OG_RENDERS = rate_limit.Limit("og_render", max_hits=60, window_seconds=60)
SITEMAP_LIMIT = 50_000  # one sitemap file holds at most 50 000 addresses


def _og_image_url(nick: str, draft_version: int) -> str:
    """Versioned by the published draft, so messengers fetch a new card after a change."""
    base = get_settings().public_base_url
    return f"{base}/api/v1/public/profiles/{nick}/og-image.jpg?v={draft_version}"


@dataclass(frozen=True)
class _Visible:
    profile_id: uuid.UUID
    account_id: uuid.UUID
    nick: str
    snapshot: PublishedProfile


async def _visible(session: AsyncSession, nick: str) -> _Visible:
    row = (
        await session.execute(
            select(Profile.id, Profile.account_id, Profile.nick, PublishedProfile)
            .join(PublishedProfile, PublishedProfile.profile_id == Profile.id)
            .where(
                Profile.nick == nick,
                Profile.status == "published",
                Profile.blocked_at.is_(None),
            )
        )
    ).one_or_none()
    if row is None:
        raise ProblemError(404, "not_found", headers={"Cache-Control": "no-store"})
    return _Visible(row[0], row[1], str(row[2]), row[3])


async def _cache_get(key: str) -> bytes | None:
    try:
        cached = await get_valkey().get(key)
    except Exception as exc:  # a cache outage only costs a render
        log.error("og_cache_unavailable", error=type(exc).__name__)
        return None
    return cached if isinstance(cached, bytes) else None


async def _cache_set(key: str, value: bytes) -> None:
    try:
        await get_valkey().set(key, value, ex=_OG_CACHE_SECONDS)
    except Exception as exc:
        log.error("og_cache_unavailable", error=type(exc).__name__)


async def og_card(session: AsyncSession, nick: str, client_ip: str) -> bytes:
    """The Open Graph card of a visible published page as JPEG; the same 404 as the page
    otherwise. Cached per published draft version, so crawlers do not cost a render each."""
    page = await _visible(session, nick)  # before the cache: hidden pages never get a card
    content = ProfileContentOut.model_validate(page.snapshot.content)
    # A draft version always has the same content and the images never change; the renderer
    # version changes the key when the card design changes.
    key = f"og:{og_image.VERSION}:{page.profile_id}:{page.snapshot.draft_version}"
    if (cached := await _cache_get(key)) is not None:
        return cached
    await rate_limit.hit(OG_RENDERS, client_ip)  # only renders cost CPU
    avatar: bytes | None = None
    if content.avatar:
        image = await media.get_image(session, content.avatar.id)
        if image is not None and image.account_id == page.account_id:
            avatar = await media.read_variant(image, 512)
    # Nothing more to read: give the connection back before queueing for a render thread.
    await session.commit()
    base = urlsplit(get_settings().public_base_url)
    card = await asyncio.get_running_loop().run_in_executor(
        _RENDERING,
        lambda: og_image.render(
            name=content.display_name,
            headline=content.headline,
            address=f"{base.netloc}{base.path.rstrip('/')}/user/{page.nick}",
            accent=content.accent,
            avatar=avatar,
        ),
    )
    await _cache_set(key, card)
    return card


async def qr_code(
    session: AsyncSession, account_id: uuid.UUID, format: QrFormat
) -> tuple[bytes, str]:
    """QR code of the owner's page address and the nick (PUB-BR-12). Available from the
    first publication on: the address is fixed from then (PRF-BR-7)."""
    profile = await get_own_profile(session, account_id)
    if not profile.nick_locked or not profile.nick:
        raise ProblemError(
            409, "not_published", "Kod QR będzie dostępny po pierwszej publikacji strony."
        )
    if profile.blocked_at is not None:  # its address shows the 404 page (PUB-BR-10)
        raise ProblemError(
            409, "page_blocked", "Strona jest zablokowana — napisz do nas, jeśli to pomyłka."
        )
    return render_qr(_public_url(profile.nick), format), profile.nick


async def sitemap(session: AsyncSession) -> SitemapOut:
    """Addresses of the visible published pages, newest publication first (PUB-BR-7)."""
    rows = await session.execute(
        select(Profile.nick, PublishedProfile.published_at)
        .join(PublishedProfile, PublishedProfile.profile_id == Profile.id)
        .where(Profile.status == "published", Profile.blocked_at.is_(None))
        .order_by(PublishedProfile.published_at.desc(), Profile.nick)
        .limit(SITEMAP_LIMIT)
    )
    return SitemapOut(
        items=[
            SitemapEntryOut(url=_public_url(str(nick)), last_modified=published_at)
            for nick, published_at in rows
        ]
    )


# --- links (PRF-BR-11) ----------------------------------------------------------------


def _invalid_url() -> ProblemError:
    return ProblemError(
        422,
        "validation_error",
        errors=[{"field": "url", "code": "invalid_url", "message": link_rules.INVALID_URL}],
    )


def _url(raw: str) -> tuple[str, str]:
    try:
        url = link_rules.normalise_url(raw)
    except link_rules.InvalidUrlError:
        raise _invalid_url() from None
    return url, link_rules.detect_service(url)


def _touch(profile: Profile) -> None:
    """A link change is a draft change: new version, unpublished changes (ADR 0002)."""
    profile.version += 1
    profile.draft_updated_at = datetime.now(UTC)


async def add_link(session: AsyncSession, account_id: uuid.UUID, data: LinkInput) -> Profile:
    profile = await get_own_profile(session, account_id, lock=True)
    existing = await _links(session, profile)
    if len(existing) >= link_rules.MAX_LINKS:
        raise ProblemError(
            409,
            "links_limit_reached",
            "Możesz dodać najwyżej 20 linków. Usuń któryś, aby dodać nowy.",
        )
    url, service = _url(data.url)
    session.add(
        ProfileLink(
            profile_id=profile.id,
            position=max((link.position for link in existing), default=-1) + 1,
            url=url,
            service=service,
            label=data.label or link_rules.default_label(url, service),
        )
    )
    _touch(profile)
    await session.commit()
    return profile


async def update_link(
    session: AsyncSession, account_id: uuid.UUID, link_id: uuid.UUID, patch: LinkPatch
) -> Profile:
    profile = await get_own_profile(session, account_id, lock=True)
    link = await session.scalar(
        select(ProfileLink).where(ProfileLink.id == link_id, ProfileLink.profile_id == profile.id)
    )
    if link is None:
        raise ProblemError(404, "not_found")
    changes = patch.model_dump(exclude_unset=True)
    if "label" in changes and not changes["label"]:
        raise ProblemError(
            422,
            "validation_error",
            errors=[{"field": "label", "code": "required", "message": "Wpisz etykietę."}],
        )
    changed = False
    if changes.get("url") is not None:
        url, service = _url(changes["url"])
        if (url, service) != (link.url, link.service):
            link.url, link.service = url, service
            changed = True
    if changes.get("label") and changes["label"] != link.label:
        link.label = changes["label"]
        changed = True
    if changed:
        _touch(profile)
    await session.commit()
    return profile


async def delete_link(session: AsyncSession, account_id: uuid.UUID, link_id: uuid.UUID) -> None:
    """Idempotent: deleting a missing (or someone else's) link does nothing."""
    profile = await get_own_profile(session, account_id, lock=True)
    link = await session.scalar(
        select(ProfileLink).where(ProfileLink.id == link_id, ProfileLink.profile_id == profile.id)
    )
    if link is not None:
        await session.delete(link)
        _touch(profile)
    await session.commit()


async def reorder_links(
    session: AsyncSession, account_id: uuid.UUID, link_ids: list[uuid.UUID]
) -> Profile:
    profile = await get_own_profile(session, account_id, lock=True)
    existing = {link.id: link for link in await _links(session, profile)}
    if len(link_ids) != len(set(link_ids)) or set(link_ids) != set(existing):
        raise ProblemError(
            422,
            "link_order_mismatch",
            "Lista linków się zmieniła — odśwież stronę.",
            errors=[],
        )
    changed = False
    for position, link_id in enumerate(link_ids):
        if existing[link_id].position != position:
            existing[link_id].position = position  # unique check deferred to commit
            changed = True
    if changed:
        _touch(profile)
    await session.commit()
    return profile


# --- images (PRF-BR-13) -----------------------------------------------------------------

_IMAGE_COLUMN = {"avatar": "avatar_image_id", "background": "background_image_id"}


async def _unused_images(session: AsyncSession, profile: Profile) -> list[str]:
    """Delete the rows of images neither the draft nor the published snapshot shows (ADR 0002).
    Called while the profile row is locked, before the commit, so a concurrent upload or
    publish cannot be pruned by a stale view. Returns storage keys to delete after commit."""
    keep = {i for i in (profile.avatar_image_id, profile.background_image_id) if i}
    snapshot = await session.get(PublishedProfile, profile.id)
    if snapshot is not None:
        for kind in ("avatar", "background"):
            ref = snapshot.content.get(kind)
            if ref:
                keep.add(uuid.UUID(ref["id"]))
    return await media.prune_rows(session, profile.account_id, keep)


async def set_image(
    session: AsyncSession, account_id: uuid.UUID, kind: media.Kind, data: bytes
) -> Profile:
    """Store the upload and use it in the draft; the previous image is kept only while the
    published page still shows it. A refused file leaves the previous image in place."""
    image = await media.store_upload(session, account_id, kind, data)
    try:
        profile = await get_own_profile(session, account_id, lock=True)
        setattr(profile, _IMAGE_COLUMN[kind], image.id)
        _touch(profile)
        unused = await _unused_images(session, profile)
        await session.commit()
    except BaseException:
        await session.rollback()
        await media.delete_files([image.storage_key])
        raise
    await media.delete_files(unused)
    return profile


async def remove_image(session: AsyncSession, account_id: uuid.UUID, kind: media.Kind) -> Profile:
    profile = await get_own_profile(session, account_id, lock=True)
    if getattr(profile, _IMAGE_COLUMN[kind]) is not None:
        setattr(profile, _IMAGE_COLUMN[kind], None)
        _touch(profile)
    unused = await _unused_images(session, profile)
    await session.commit()
    await media.delete_files(unused)
    return profile


async def is_image_public(
    session: AsyncSession, account_id: uuid.UUID, image_id: uuid.UUID
) -> bool:
    """True when the account's visible published page shows the image (PUB-BR-6 rules).
    One primary-key lookup: the snapshot of the image owner's profile."""
    snapshot = await session.scalar(
        select(PublishedProfile.content)
        .join(Profile, Profile.id == PublishedProfile.profile_id)
        .where(
            Profile.account_id == account_id,
            Profile.status == "published",
            Profile.blocked_at.is_(None),
        )
    )
    if not snapshot:
        return False
    ref = str(image_id)
    return any((snapshot.get(kind) or {}).get("id") == ref for kind in ("avatar", "background"))


# --- account deletion (ACC-BR-10) -------------------------------------------------------

QUARANTINE = timedelta(days=30)


async def quarantine_nick_of(session: AsyncSession, account_id: uuid.UUID) -> uuid.UUID | None:
    """Reserve the deleted account's nick for 30 days, so nobody takes over an address that
    was shared recently (in the caller's transaction, before the account is deleted).
    Returns the profile id, for `forget_cards` after the commit."""
    row = (
        await session.execute(
            select(Profile.id, Profile.nick).where(Profile.account_id == account_id)
        )
    ).one_or_none()
    if row is None:  # pragma: no cover - every account gets a profile at registration
        return None
    profile_id, nick = row
    if not nick:
        return profile_id
    expires = datetime.now(UTC) + QUARANTINE
    await session.execute(
        pg_insert(ReservedNick)
        .values(nick=nick, reason="quarantine", expires_at=expires)
        .on_conflict_do_update(
            index_elements=[ReservedNick.nick],
            set_={"reason": "quarantine", "expires_at": expires},
            # A system or offensive reservation (no expiry) is never weakened.
            where=ReservedNick.reason == "quarantine",
        )
    )
    return profile_id


async def forget_cards(profile_id: uuid.UUID) -> None:
    """Drop the cached Open Graph cards of a deleted profile (they hold the name and photo).
    Fails open like the rest of the cache: they would expire within 7 days anyway."""
    try:
        client = get_valkey()
        keys = [key async for key in client.scan_iter(match=f"og:*:{profile_id}:*")]
        if keys:
            await client.delete(*keys)
    except Exception as exc:
        log.error("og_cache_unavailable", error=type(exc).__name__)
