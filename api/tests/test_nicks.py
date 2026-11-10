import json
import os
from pathlib import Path

import pytest

from app.modules.profiles import nicks

# Shared with client/src/lib/nick.test.ts so both sides apply the same rules.
CASES = json.loads(Path(os.environ.get("NICK_CASES_PATH", "/contract/nick-cases.json")).read_text())


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Anna Wiśniewska", "anna-wisniewska"),
        ("Łukasz Żółć", "lukasz-zolc"),
        ("ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż", "acelnoszz-acelnoszz"),
        ("José Müller-Lüdenscheidt", "jose-muller-ludenscheidt"),
        ("Anna  --  Maria", "anna-maria"),
        ("O'Brien & Syn", "obrien-syn"),
        ("  -Studio_Projektowe.pl- ", "studio-projektowe-pl"),
        ("Kowalski 2", "kowalski-2"),
    ],
)
def test_proposal_follows_prf_br_2(name: str, expected: str) -> None:
    assert nicks.propose(name) == expected


@pytest.mark.parametrize("name", ["Al", "ąę", "!!!", "  ", "李"])
def test_no_proposal_below_three_characters(name: str) -> None:
    assert nicks.propose(name) is None


def test_long_name_is_cut_at_a_word_boundary() -> None:
    nick = nicks.propose("Konstanty Ildefons Gałczyński Poeta Polski Wielki")

    assert nick == "konstanty-ildefons-galczynski-poeta"
    assert len(nick) <= 40


def test_long_single_word_is_cut_at_forty_characters() -> None:
    assert nicks.propose("a" * 50) == "a" * 40


@pytest.mark.parametrize(("nick", "error"), CASES["format"])
def test_format_rules_prf_br_1(nick: str, error: str | None) -> None:
    assert nicks.format_error(nick) == error


def test_suffix_keeps_the_nick_within_forty_characters() -> None:
    assert nicks.with_suffix("anna-wisniewska", "Kraków") == "anna-wisniewska-krakow"
    long = nicks.with_suffix("a" * 40, "2")
    assert long == "a" * 38 + "-2"
    assert nicks.with_suffix("anna", "!!!") is None


@pytest.mark.parametrize(("typed", "expected"), CASES["input"])
def test_typed_input_keeps_hyphen_errors_visible(typed: str, expected: str) -> None:
    assert nicks.normalise_input(typed) == expected
