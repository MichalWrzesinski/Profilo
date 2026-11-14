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
        ("https://www.studiowisniewska.pl/blog", "other", "studiowisniewska.pl"),
    ],
)
def test_service_and_default_label(url: str, service: str, label: str) -> None:
    assert links.detect_service(url) == service
    assert links.default_label(url, service) == label
