"""Deleting accounts whose e-mail was not confirmed within 7 days (ACC-BR-6)."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.core.db import get_sessionmaker
from app.core.logging import log
from app.modules.accounts.models import Account
from app.modules.media import storage
from app.modules.profiles.service import forget_cards, profile_ids_of

UNCONFIRMED_FOR = timedelta(days=7)
BATCH = 100
MAX_BATCHES = 50  # 5 000 per run; the rest waits for the next hour


async def delete_unconfirmed(now: datetime | None = None) -> dict[str, int]:
    """Delete them with the draft (cascade); the nick is released at once, no quarantine.
    Rows locked elsewhere (e.g. a confirmation in progress) are skipped: SKIP LOCKED."""
    cutoff = (now or datetime.now(UTC)) - UNCONFIRMED_FOR
    deleted = 0
    for _ in range(MAX_BATCHES):
        async with get_sessionmaker()() as session:
            ids = list(
                await session.scalars(
                    select(Account.id)
                    .where(Account.email_confirmed_at.is_(None), Account.created_at < cutoff)
                    .order_by(Account.created_at)
                    .limit(BATCH)
                    .with_for_update(skip_locked=True)
                )
            )
            if not ids:
                break
            profiles = await profile_ids_of(session, ids)
            await session.execute(delete(Account).where(Account.id.in_(ids)))
            await session.commit()
        deleted += len(ids)
        for account_id in ids:
            log.info("unconfirmed_account_deleted", account_id=str(account_id))
        await _forget_files_and_cards(ids, profiles)
    return {"deleted": deleted}


async def _forget_files_and_cards(ids: list[uuid.UUID], profiles: list[uuid.UUID]) -> None:
    """After the commit; a failure leaves orphans for `media.remove_orphaned_files`."""
    for account_id in ids:
        try:
            await storage.delete_prefix(str(account_id))
        except Exception as exc:
            log.error("media_delete_failed", error=type(exc).__name__)
    for profile_id in profiles:
        await forget_cards(profile_id)
