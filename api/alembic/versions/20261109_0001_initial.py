"""Initial empty schema

Revision ID: 0001
Revises:
Create Date: 2026-11-09
"""

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Extensions used by later migrations (case-insensitive e-mail and nick columns).
    from alembic import op

    op.execute("CREATE EXTENSION IF NOT EXISTS citext")


def downgrade() -> None:
    from alembic import op

    op.execute("DROP EXTENSION IF EXISTS citext")
