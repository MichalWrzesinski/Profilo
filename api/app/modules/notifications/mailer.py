"""SMTP adapter. Provider-specific settings come only from configuration (ADR 0005)."""

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr

from app.core.settings import get_settings
from app.modules.notifications.templates import RenderedEmail


def build_message(to: str, email: RenderedEmail) -> EmailMessage:
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = to
    message["Subject"] = email.subject
    message["Date"] = formatdate(usegmt=True)
    sender_domain = parseaddr(settings.mail_from)[1].rpartition("@")[2] or "profilo.pl"
    message["Message-ID"] = make_msgid(domain=sender_domain)
    message.set_content(email.text)
    message.add_alternative(email.html, subtype="html")
    return message


def _connect() -> smtplib.SMTP:
    settings = get_settings()
    if settings.smtp_ssl:  # implicit TLS from the first byte (usually port 465)
        return smtplib.SMTP_SSL(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
            context=ssl.create_default_context(),
        )
    return smtplib.SMTP(
        settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
    )


def send(message: EmailMessage) -> None:
    settings = get_settings()
    with _connect() as smtp:
        if settings.smtp_starttls and not settings.smtp_ssl:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
        smtp.send_message(message)
