"""Operator commands in the api image (PUB-BR-10; no admin panel in v1):

    profilo block-profile <nick>     hide a page reported as illegal (404 at once)
    profilo unblock-profile <nick>   show its last published version again

On a server: `dc exec api profilo block-profile anna` (docs/runbook.md).
"""

import argparse
import asyncio
import sys
from collections.abc import Sequence

import app.models  # noqa: F401 - all models: a standalone process otherwise lacks some
from app.core.db import dispose_engine
from app.core.valkey import close_valkey
from app.modules.profiles import service

MESSAGES = {
    ("block-profile", "changed"): "Zablokowano stronę {nick}. Adres zwraca teraz 404.",
    ("block-profile", "unchanged"): "Strona {nick} była już zablokowana.",
    (
        "unblock-profile",
        "changed",
    ): "Odblokowano stronę {nick}. Widać ostatnią opublikowaną wersję.",
    ("unblock-profile", "unchanged"): "Strona {nick} nie była zablokowana.",
}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="profilo", description="Polecenia operatora Profilo.")
    commands = parser.add_subparsers(dest="command", required=True)
    for name, text in (
        ("block-profile", "Zablokuj stronę zgłoszoną jako niezgodna z prawem."),
        ("unblock-profile", "Odblokuj stronę."),
    ):
        command = commands.add_parser(name, help=text, description=text)
        command.add_argument("nick", help="adres strony, np. anna-wisniewska")
    return parser


async def _run(command: str, nick: str) -> int:
    try:
        result = await service.set_blocked(nick, blocked=command == "block-profile")
    finally:
        await dispose_engine()
        await close_valkey()
    if result == "unknown":
        print(f"Nie ma strony o adresie {nick}.", file=sys.stderr)
        return 1
    print(MESSAGES[(command, result)].format(nick=nick.strip().lower()))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    return asyncio.run(_run(args.command, args.nick))


if __name__ == "__main__":  # pragma: no cover - `python -m app.cli`
    sys.exit(main())
