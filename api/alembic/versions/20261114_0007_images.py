"""Images and their use as avatar / background (PRF-BR-13)

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "images",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("storage_key", sa.String(80), nullable=False, unique=True),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("kind IN ('avatar', 'background')", name="ck_images_kind_value"),
    )
    for column in ("avatar_image_id", "background_image_id"):
        op.add_column(
            "profiles",
            sa.Column(column, sa.Uuid(), sa.ForeignKey("images.id", ondelete="SET NULL")),
        )


def downgrade() -> None:
    op.drop_column("profiles", "background_image_id")
    op.drop_column("profiles", "avatar_image_id")
    op.drop_table("images")
