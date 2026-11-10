"""Celery task sending a templated e-mail with retries (backend standard)."""

import smtplib
from typing import Any

from celery import Task

from app.core.logging import log
from app.modules.notifications import mailer, templates
from app.worker import celery_app

MAX_RETRIES = 6  # with exponential backoff: ~1 s … ~1 min, about 2 minutes in total


class EmailTask(Task):  # type: ignore[misc]
    def on_failure(
        self, exc: BaseException, task_id: str, args: Any, kwargs: Any, einfo: Any
    ) -> None:
        # Retries exhausted (or a permanent error): visible in logs and monitoring.
        log.error(
            "email_failed",
            template=kwargs.get("template"),
            task_id=task_id,
            error=type(exc).__name__,
        )


@celery_app.task(  # type: ignore[untyped-decorator]
    base=EmailTask,
    name="notifications.send_email",
    autoretry_for=(OSError, smtplib.SMTPException),
    dont_autoretry_for=(smtplib.SMTPRecipientsRefused,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def send_email(*, template: str, to: str, params: dict[str, Any]) -> None:
    email = templates.render(template, params)
    mailer.send(mailer.build_message(to, email))
    log.info("email_sent", template=template)
