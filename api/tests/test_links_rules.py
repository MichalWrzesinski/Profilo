from urllib.parse import urlsplit

import pytest

from app.modules.profiles import links


@pytest.mark.parametrize(
    ("raw", "url"),
    [
        ("linkedin.com/in/anna-wisniewska", "https://linkedin.com/in/anna-wisniewska"),
        ("  https://GitHub.com/Anna  ", "https://github.com/Anna"),
        ("http://studio.pl", "http://studio.pl"),
        ("HTTPS://Example.PL/Ścieżka?q=1#x", "https://example.pl/Ścieżka?q=1#x"),
        ("example.com:8080/a", "https://example.com:8080/a"),
        ("//example.com/a", "https://example.com/a"),
        ("żółw.pl", "https://żółw.pl"),
        ("Żółw.PL/Ala", "https://żółw.pl/Ala"),
        ("https://\u0430pple.com/x", "https://xn--pple-43d.com/x"),
        ("https://example.com/#", "https://example.com/"),
    ],
)
def test_urls_are_normalised(raw: str, url: str) -> None:
    assert links.normalise_url(raw) == url


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "mój portfolio.pl",
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "mailto:anna@example.pl",
        "data:text/html,x",
        "ftp://example.com",
        "https://user:pass@example.com",
        "https://example.com@evil.pl",
        "localhost",
        "https://192.168.0.1",
        "https://-bad-.pl",
        "https://example.com:99999",
        "https://exa mple.com",
        "https://example.com/\x00",
        "https://" + "a" * 2000 + ".pl",
        "https://" + "x" * 64 + ".pl",
        "a.pl/" + "x" * 1995,
        "https://example.com:0/",
        "https://example.com/\u202egnp.exe",
        "https://a.com\u2060b",
        "https://example.com/\u200b",
        "https://example.com/\x7f",
        "https://example.com/\x85a",
        "https://example.com/\u00a0a",
    ],
)
def test_invalid_urls_are_rejected(raw: str) -> None:
    with pytest.raises(links.InvalidUrlError):
        links.normalise_url(raw)


@pytest.mark.parametrize(
    ("url", "service", "label"),
    [
        ("https://www.linkedin.com/in/anna", "linkedin", "LinkedIn"),
        ("https://pl.linkedin.com/in/anna", "linkedin", "LinkedIn"),
        ("https://twitter.com/anna", "x", "X"),
        ("https://youtu.be/abc", "youtube", "YouTube"),
        ("https://m.facebook.com/anna", "facebook", "Facebook"),
        ("https://www.behance.net/anna", "behance", "Behance"),
        ("https://notlinkedin.com/anna", "other", "notlinkedin.com"),
        ("https://linkedin.com.evil.pl/in/anna", "other", "linkedin.com.evil.pl"),
        ("https://evil.pl/.linkedin.com", "other", "evil.pl"),
        ("https://www.studiowisniewska.pl/blog", "other", "studiowisniewska.pl"),
    ],
)
def test_service_and_default_label(url: str, service: str, label: str) -> None:
    assert links.detect_service(url) == service
    assert links.default_label(url, service) == label


@pytest.mark.parametrize(
    ("raw", "host", "path"),
    [
        ("https://İexample.pl/x", "xn--iexample-o0e.pl", "/x"),
        ("https://İ.com/@evil.com", "xn--i-9bb.com", "/@evil.com"),
    ],
)
def test_lowercasing_never_moves_text_between_host_and_path(raw: str, host: str, path: str) -> None:
    parts = urlsplit(links.normalise_url(raw))

    assert (parts.hostname, parts.path, parts.username) == (host, path, None)
