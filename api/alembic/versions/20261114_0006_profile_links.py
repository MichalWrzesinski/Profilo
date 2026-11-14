"""Profile links (PRF-BR-11)

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SERVICES = (
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
)


def upgrade() -> None:
    op.create_table(
        "profile_links",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "profile_id",
            sa.Uuid(),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(40), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("service", sa.String(16), nullable=False),
        sa.UniqueConstraint(
            "profile_id",
            "position",
            name="uq_profile_links_profile_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        sa.CheckConstraint(
            "char_length(label) BETWEEN 1 AND 40", name="ck_profile_links_label_length"
        ),
        sa.CheckConstraint(
            "char_length(url) <= 2000 AND url ~ '^https?://'", name="ck_profile_links_url_value"
        ),
        sa.CheckConstraint(
            f"service IN ({', '.join(repr(s) for s in SERVICES)})",
            name="ck_profile_links_service_value",
        ),
    )


def downgrade() -> None:
    op.drop_table("profile_links")
