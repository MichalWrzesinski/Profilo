"""Reserved nicks of deleted blocked pages (TASK-020): reason `blocked`, no expiry

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-15
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_reserved_nicks_reason_value", "reserved_nicks", type_="check")
    op.create_check_constraint(
        "ck_reserved_nicks_reason_value",
        "reserved_nicks",
        "reason IN ('system', 'offensive', 'quarantine', 'blocked')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM reserved_nicks WHERE reason = 'blocked'")
    op.drop_constraint("ck_reserved_nicks_reason_value", "reserved_nicks", type_="check")
    op.create_check_constraint(
        "ck_reserved_nicks_reason_value",
        "reserved_nicks",
        "reason IN ('system', 'offensive', 'quarantine')",
    )
