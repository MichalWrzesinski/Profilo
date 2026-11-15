"""Every ORM model, so the mapper can resolve foreign keys in any entry point (API, Celery,
operator CLI). Import this module wherever the app is not started through `app.main`."""

from app.modules.accounts import models as accounts  # noqa: F401
from app.modules.media import models as media  # noqa: F401
from app.modules.profiles import models as profiles  # noqa: F401
