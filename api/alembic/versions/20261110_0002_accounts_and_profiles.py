"""Accounts, refresh tokens and profiles

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LAYOUTS = "('classic', 'split', 'card')"
ACCENTS = "('granat', 'niebieski', 'blekit', 'morski', 'zielen', 'bordo', 'miedz', 'fiolet')"
STATUSES = "('never_published', 'published', 'unpublished')"


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", postgresql.CITEXT(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("email_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "password_changed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("token_hash", sa.LargeBinary(32), nullable=False, unique=True),
        sa.Column("family_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("nick", postgresql.CITEXT(), unique=True),
        sa.Column("nick_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("display_name", sa.String(60), nullable=False),
        sa.Column("headline", sa.String(80)),
        sa.Column("bio", sa.String(500)),
        sa.Column("city", sa.String(60)),
        sa.Column("company", sa.String(60)),
        sa.Column("position", sa.String(60)),
        sa.Column("public_email", sa.String(254)),
        sa.Column("public_phone", sa.String(16)),
        sa.Column("layout", sa.String(16), nullable=False, server_default="classic"),
        sa.Column("accent", sa.String(16), nullable=False, server_default="granat"),
        sa.Column("status", sa.String(20), nullable=False, server_default="never_published"),
        sa.Column("blocked_at", sa.DateTime(timezone=True)),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "draft_updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "char_length(display_name) BETWEEN 1 AND 60", name="ck_profiles_display_name_length"
        ),
        sa.CheckConstraint(
            "nick IS NULL OR (nick ~ '^[a-z0-9]+(-[a-z0-9]+)*$' "
            "AND char_length(nick) BETWEEN 3 AND 40)",
            name="ck_profiles_nick_format",
        ),
        sa.CheckConstraint(f"layout IN {LAYOUTS}", name="ck_profiles_layout_value"),
        sa.CheckConstraint(f"accent IN {ACCENTS}", name="ck_profiles_accent_value"),
        sa.CheckConstraint(f"status IN {STATUSES}", name="ck_profiles_status_value"),
        sa.CheckConstraint("char_length(headline) <= 80", name="ck_profiles_headline_length"),
        sa.CheckConstraint("char_length(bio) <= 500", name="ck_profiles_bio_length"),
        sa.CheckConstraint("char_length(city) <= 60", name="ck_profiles_city_length"),
        sa.CheckConstraint("char_length(company) <= 60", name="ck_profiles_company_length"),
        sa.CheckConstraint("char_length(position) <= 60", name="ck_profiles_position_length"),
    )


def downgrade() -> None:
    op.drop_table("profiles")
    op.drop_table("refresh_tokens")
    op.drop_table("accounts")
