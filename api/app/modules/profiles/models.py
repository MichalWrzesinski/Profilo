import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

LAYOUTS = ("classic", "split", "card")
ACCENTS = ("granat", "niebieski", "blekit", "morski", "zielen", "bordo", "miedz", "fiolet")
STATUSES = ("never_published", "published", "unpublished")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class Profile(Base):
    """The owner's page draft (docs/product/areas/profile.md). Published snapshots,
    links and images are added by later tasks."""

    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("char_length(display_name) BETWEEN 1 AND 60", name="display_name_length"),
        CheckConstraint(
            "nick IS NULL OR (nick ~ '^[a-z0-9]+(-[a-z0-9]+)*$' "
            "AND char_length(nick) BETWEEN 3 AND 40)",
            name="nick_format",
        ),
        CheckConstraint(_in("layout", LAYOUTS), name="layout_value"),
        CheckConstraint(_in("accent", ACCENTS), name="accent_value"),
        CheckConstraint(_in("status", STATUSES), name="status_value"),
        CheckConstraint("char_length(headline) <= 80", name="headline_length"),
        CheckConstraint("char_length(bio) <= 500", name="bio_length"),
        CheckConstraint("char_length(city) <= 60", name="city_length"),
        CheckConstraint("char_length(company) <= 60", name="company_length"),
        CheckConstraint("char_length(position) <= 60", name="position_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid7)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), unique=True
    )
    nick: Mapped[str | None] = mapped_column(CITEXT, unique=True)
    nick_locked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    display_name: Mapped[str] = mapped_column(String(60))
    headline: Mapped[str | None] = mapped_column(String(80))
    bio: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(60))
    company: Mapped[str | None] = mapped_column(String(60))
    position: Mapped[str | None] = mapped_column(String(60))
    public_email: Mapped[str | None] = mapped_column(String(254))
    public_phone: Mapped[str | None] = mapped_column(String(16))
    layout: Mapped[str] = mapped_column(String(16), default="classic", server_default="classic")
    accent: Mapped[str] = mapped_column(String(16), default="granat", server_default="granat")
    status: Mapped[str] = mapped_column(
        String(20), default="never_published", server_default="never_published"
    )
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    draft_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ReservedNick(Base):
    """System words and nicks in quarantine after account deletion (PRF-BR-4, ACC-BR-10)."""

    __tablename__ = "reserved_nicks"
    __table_args__ = (CheckConstraint("reason IN ('system', 'quarantine')", name="reason_value"),)

    nick: Mapped[str] = mapped_column(CITEXT, primary_key=True)
    reason: Mapped[str] = mapped_column(String(16))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
