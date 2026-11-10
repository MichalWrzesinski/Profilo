"""One-time tokens (e-mail confirmation, password reset)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "one_time_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(32), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "purpose IN ('email_confirmation', 'password_reset')",
            name="ck_one_time_tokens_purpose_value",
        ),
    )


def downgrade() -> None:
    op.drop_table("one_time_tokens")
