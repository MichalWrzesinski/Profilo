"""Public interface of the notifications module."""

from typing import Any

from anyio import to_thread

from app.core.logging import log


async def send(template: str, to: str, params: dict[str, Any]) -> bool:
    """Queue an e-mail (after the caller's commit). Returns False and logs when the queue
    is unavailable, so the caller's operation still succeeds; the user can ask again."""
    from app.modules.notifications.tasks import send_email

    def enqueue() -> None:
        send_email.apply_async(
            kwargs={"template": template, "to": to, "params": params},
            retry=True,
            retry_policy={"max_retries": 2, "interval_start": 0, "interval_step": 0.5},
        )

    try:
        await to_thread.run_sync(enqueue)
    except Exception as exc:
        log.error("email_enqueue_failed", template=template, error=type(exc).__name__)
        return False
    return True
