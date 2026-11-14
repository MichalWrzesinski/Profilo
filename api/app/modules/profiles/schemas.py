import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.core.schemas import ApiModel

Layout = Literal["classic", "split", "card"]
Accent = Literal["granat", "niebieski", "blekit", "morski", "zielen", "bordo", "miedz", "fiolet"]
Status = Literal["never_published", "published", "unpublished", "blocked"]
LinkService = Literal[
    "linkedin",
    "github",
    "x",
    "instagram",
    "facebook",
    "youtube",
    "behance",
    "dribbble",
    "tiktok",
    "other",
]


class ImageRefOut(ApiModel):
    id: uuid.UUID
    urls: dict[str, str]


class LinkOut(ApiModel):
    id: uuid.UUID
    url: str
    label: str
    service: LinkService


class ProfileContentOut(ApiModel):
    display_name: str
    headline: str | None
    bio: str | None
    city: str | None
    company: str | None
    position: str | None
    public_email: str | None
    public_phone: str | None
    layout: Layout
    accent: Accent
    avatar: ImageRefOut | None = None  # images: TASK-010
    background: ImageRefOut | None = None
    links: list[LinkOut] = Field(default_factory=list)  # links: TASK-009


class OwnerProfileOut(ApiModel):
    nick: str | None
    nick_locked: bool
    status: Status
    has_unpublished_changes: bool
    published_at: datetime | None
    version: int
    draft_updated_at: datetime
    public_url: str | None
    draft: ProfileContentOut


class DraftPatch(ApiModel):
    """Partial update; `null` or an empty string clears an optional field. E-mail and phone
    are validated by the service (Polish messages, phone normalised to E.164)."""

    version: int = Field(ge=1)
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    headline: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=60)
    company: str | None = Field(default=None, max_length=60)
    position: str | None = Field(default=None, max_length=60)
    public_email: str | None = Field(default=None, max_length=254)
    public_phone: str | None = Field(default=None, max_length=32)
    layout: Layout | None = None
    accent: Accent | None = None


class NickRequest(ApiModel):
    nick: str = Field(max_length=60)


class NickAvailabilityOut(ApiModel):
    nick: str
    available: bool
    reason: Literal["taken", "reserved", "invalid_format"] | None = None
    suggestions: list[str] = Field(default_factory=list, max_length=3)


class NickSuggestionOut(ApiModel):
    nick: str | None


class PublishRequest(ApiModel):
    version: int = Field(ge=1)


class PublicProfileOut(ApiModel):
    nick: str
    canonical_url: str
    published_at: datetime
    content: ProfileContentOut


class LinkInput(ApiModel):
    url: str = Field(max_length=2000)
    label: str | None = Field(default=None, min_length=1, max_length=40)


class LinkPatch(ApiModel):
    """At least one field (contract: minProperties 1); `url` cannot be cleared."""

    url: str | None = Field(default=None, max_length=2000)
    label: str | None = Field(default=None, min_length=1, max_length=40)

    @field_validator("url")
    @classmethod
    def _url_not_null(cls, value: str | None) -> str | None:
        if value is None:
            raise PydanticCustomError("invalid_url", "Wpisz adres strony.")
        return value

    @model_validator(mode="after")
    def _has_a_change(self) -> LinkPatch:
        if not self.model_fields_set:
            raise PydanticCustomError("missing", "Podaj adres albo etykietę.")
        return self


class LinkOrder(ApiModel):
    link_ids: list[uuid.UUID] = Field(max_length=20)
