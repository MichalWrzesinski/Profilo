import smtplib
from email.message import EmailMessage
from typing import Any, ClassVar

import pytest

from app.modules.notifications import mailer, tasks, templates
from app.worker import celery_app


def test_confirmation_template_renders_html_and_text_with_escaping() -> None:
    email = templates.render("email_confirmation", {"link": "https://profilo.pl/x?a=1&b=<2>"})

    assert email.subject == "Potwierdź adres e-mail w Profilo"
    assert "https://profilo.pl/x?a=1&amp;b=&lt;2&gt;" in email.html
    assert "https://profilo.pl/x?a=1&b=<2>" in email.text
    assert "48 godzin" in email.text


def test_message_has_text_and_html_parts() -> None:
    message = mailer.build_message(
        "anna@example.pl", templates.render("email_confirmation", {"link": "L"})
    )

    assert message["To"] == "anna@example.pl"
    assert message["From"] == "Profilo <no-reply@profilo.pl>"
    assert [part.get_content_type() for part in message.iter_parts()] == ["text/plain", "text/html"]


class FakeSMTP:
    instances: ClassVar[list[FakeSMTP]] = []

    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.host, self.port, self.timeout = host, port, timeout
        self.sent: list[EmailMessage] = []
        self.tls = False
        self.login_args: tuple[str, str] | None = None
        FakeSMTP.instances.append(self)

    def __enter__(self) -> FakeSMTP:
        return self

    def __exit__(self, *_: Any) -> None:
        pass

    def starttls(self, context: Any) -> None:
        self.tls = True

    def login(self, user: str, password: str) -> None:
        self.login_args = (user, password)

    def send_message(self, message: EmailMessage) -> None:
        self.sent.append(message)


def test_send_uses_configured_smtp_with_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeSMTP.instances.clear()
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)

    tasks.send_email.run(template="email_confirmation", to="anna@example.pl", params={"link": "L"})

    smtp = FakeSMTP.instances[0]
    assert (smtp.host, smtp.port, smtp.timeout) == ("mailpit", 1025, 10.0)
    assert smtp.tls is False
    assert smtp.login_args is None
    assert smtp.sent[0]["Subject"] == "Potwierdź adres e-mail w Profilo"


def test_send_with_starttls_and_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    from pydantic import SecretStr

    from app.core.settings import get_settings

    FakeSMTP.instances.clear()
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_starttls", True)
    monkeypatch.setattr(settings, "smtp_username", "user")
    monkeypatch.setattr(settings, "smtp_password", SecretStr("secret"))

    mailer.send(
        mailer.build_message("a@b.pl", templates.render("email_confirmation", {"link": "L"}))
    )

    assert FakeSMTP.instances[0].tls is True
    assert FakeSMTP.instances[0].login_args == ("user", "secret")


def test_task_retries_transient_smtp_errors_with_backoff() -> None:
    task = tasks.send_email

    assert OSError in task.autoretry_for
    assert smtplib.SMTPException in task.autoretry_for
    assert task.max_retries == tasks.MAX_RETRIES
    assert task.retry_backoff is True
    assert task.retry_jitter is True


def test_provider_down_retries_then_logs_error(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def refuse(*_: Any, **__: Any) -> None:
        raise ConnectionRefusedError

    monkeypatch.setattr(smtplib, "SMTP", refuse)
    monkeypatch.setattr(tasks.send_email, "max_retries", 2)
    monkeypatch.setattr(tasks.send_email, "retry_backoff", False)
    monkeypatch.setattr(tasks.send_email, "default_retry_delay", 0)
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = False
    try:
        result = tasks.send_email.apply(
            kwargs={"template": "email_confirmation", "to": "a@b.pl", "params": {"link": "L"}}
        )
    finally:
        celery_app.conf.task_always_eager = False

    assert result.failed()
    assert isinstance(result.result, ConnectionRefusedError)
    out = capsys.readouterr().out
    assert '"event": "email_failed"' in out
    assert "a@b.pl" not in out  # no personal data in logs
