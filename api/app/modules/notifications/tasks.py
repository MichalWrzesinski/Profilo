"""Celery task sending a templated e-mail with retries (backend standard)."""

import smtplib
from typing import Any

from celery import Task

from app.core.logging import log
from app.modules.notifications import mailer, templates
from app.worker import celery_app

# Exponential backoff with full jitter, capped at 10 min per wait: at most ~8 min of
# retries in total (often less because of the jitter).
MAX_RETRIES = 9


class TransientEmailError(Exception):
    """Worth retrying (4xx, connection problems). Carries only the SMTP code: provider
    messages may contain the recipient address (no personal data in logs)."""


class PermanentEmailError(Exception):
    """Not worth retrying (5xx, authentication). Carries only the SMTP code."""


def _classify(exc: Exception) -> Exception:
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        codes = [code for code, _ in exc.recipients.values()]
        code = min(codes) if codes else 550
    elif isinstance(exc, smtplib.SMTPAuthenticationError):
        return PermanentEmailError(f"smtp {exc.smtp_code} (authentication)")
    elif isinstance(exc, smtplib.SMTPResponseException):
        code = exc.smtp_code
    elif isinstance(exc, smtplib.SMTPServerDisconnected):
        return TransientEmailError(type(exc).__name__)
    elif isinstance(exc, smtplib.SMTPException):  # SMTPException is an OSError subclass
        return PermanentEmailError(type(exc).__name__)
    else:  # connection refused, DNS, timeout
        return TransientEmailError(type(exc).__name__)
    if 400 <= code < 500:
        return TransientEmailError(f"smtp {code}")
    return PermanentEmailError(f"smtp {code}")


class EmailTask(Task):  # type: ignore[misc]
    def on_failure(
        self, exc: BaseException, task_id: str, args: Any, kwargs: Any, einfo: Any
    ) -> None:
        # Retries exhausted or a permanent error: visible in logs and monitoring.
        log.error(
            "email_failed",
            template=kwargs.get("template"),
            task_id=task_id,
            error=type(exc).__name__,
            reason=str(exc),
        )


@celery_app.task(  # type: ignore[untyped-decorator]
    base=EmailTask,
    name="notifications.send_email",
    autoretry_for=(TransientEmailError,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=MAX_RETRIES,
    acks_late=True,
)
def send_email(*, template: str, to: str, params: dict[str, Any]) -> None:
    email = templates.render(template, params)
    try:
        mailer.send(mailer.build_message(to, email))
    except (smtplib.SMTPException, OSError) as exc:
        # `from None`: the original exception (with the address) is not chained into logs.
        raise _classify(exc) from None
    log.info("email_sent", template=template)
