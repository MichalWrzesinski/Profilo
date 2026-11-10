"""Reserved nicks with the system list (PRF-BR-4)

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM = [
    # application paths and technical names
    "about",
    "abuse",
    "admin",
    "administrator",
    "api",
    "app",
    "assets",
    "auth",
    "blog",
    "contact",
    "docs",
    "health",
    "help",
    "kontakt",
    "konto",
    "kreator",
    "login",
    "logowanie",
    "logout",
    "mail",
    "media",
    "moderator",
    "null",
    "o-nas",
    "panel",
    "pomoc",
    "potwierdz-email",
    "privacy",
    "profil",
    "profilo",
    "prywatnosc",
    "ready",
    "regulamin",
    "rejestracja",
    "root",
    "security",
    "settings",
    "staff",
    "static",
    "status",
    "support",
    "system",
    "terms",
    "undefined",
    "user",
    "users",
    "ustawienia",
    "www",
]
# Common offensive words: also blocked as a part of a nick (e.g. `word-2`), see the service.
OFFENSIVE = [
    "chuj",
    "cipa",
    "dziwka",
    "fuck",
    "hitler",
    "huj",
    "jebac",
    "kurwa",
    "nazi",
    "pedal",
    "pizda",
    "shit",
    "szmata",
]


def upgrade() -> None:
    table = op.create_table(
        "reserved_nicks",
        sa.Column("nick", postgresql.CITEXT(), primary_key=True),
        sa.Column("reason", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "reason IN ('system', 'offensive', 'quarantine')", name="ck_reserved_nicks_reason_value"
        ),
    )
    op.bulk_insert(
        table,
        [{"nick": nick, "reason": "system"} for nick in SYSTEM]
        + [{"nick": nick, "reason": "offensive"} for nick in OFFENSIVE],
    )


def downgrade() -> None:
    op.drop_table("reserved_nicks")
