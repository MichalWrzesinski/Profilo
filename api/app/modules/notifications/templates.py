"""E-mail templates (Polish). Each template has .html.j2 and .txt.j2 and a subject."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

SUBJECTS = {
    "email_confirmation": "Potwierdź adres e-mail w Profilo",
}

_env = Environment(
    loader=FileSystemLoader(Path(__file__).parent / "templates"),
    autoescape=select_autoescape(enabled_extensions=("html", "html.j2"), default_for_string=True),
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


def render(template: str, params: dict[str, Any]) -> RenderedEmail:
    subject = SUBJECTS[template]
    context = {**params, "subject": subject}
    return RenderedEmail(
        subject=subject,
        html=_env.get_template(f"{template}.html.j2").render(context),
        text=_env.get_template(f"{template}.txt.j2").render(context),
    )
