"""Public interface of the profiles module for other modules."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.profiles.models import Profile


async def create_profile_for(
    session: AsyncSession, account_id: uuid.UUID, display_name: str
) -> Profile:
    """Create the empty draft profile of a new account (in the caller's transaction)."""
    profile = Profile(account_id=account_id, display_name=display_name)
    session.add(profile)
    await session.flush()
    return profile
