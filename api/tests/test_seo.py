"""Link previews and search engines: Open Graph card and sitemap (TASK-013)."""

import io
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import delete, update

from app.core.db import get_sessionmaker
from app.modules.media.models import Image as ImageRow
from app.modules.profiles import og_image
from app.modules.profiles import service as profiles
from app.modules.profiles.models import Profile
from tests import images
from tests.test_images import owner, publish, upload

pytestmark = pytest.mark.usefixtures("clean_state")

CARD = "/api/v1/public/profiles/anna/og-image.jpg"


async def edit(client: AsyncClient, auth: dict[str, str], **fields: Any) -> None:
    version = (await client.get("/api/v1/me/profile", headers=auth)).json()["version"]
    response = await client.patch(
        "/api/v1/me/profile", json={"version": version, **fields}, headers=auth
    )
    assert response.status_code == 200, response.text


def decode(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGB")


def close(pixel: object, expected: tuple[int, int, int], tolerance: int = 12) -> bool:
    assert isinstance(pixel, tuple)
    return all(abs(a - b) <= tolerance for a, b in zip(pixel, expected, strict=True))


async def test_card_shows_the_avatar_and_is_cached_for_a_day(client: AsyncClient) -> None:
    auth = await owner(client, "anna@example.pl")
    await upload(client, auth, images.jpeg(600, 600))  # left half blue, right half red
    await edit(client, auth, headline="Projektantka UX", accent="morski")
    await publish(client, auth)

    page = (await client.get("/api/v1/public/profiles/anna")).json()
    response = await client.get(page["ogImageUrl"].removeprefix("http://localhost:8080"))

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "public, max-age=86400"
    card = decode(response.content)
    assert card.size == (1200, 630)
    assert close(card.getpixel((10, 10)), (0x0F, 0x6B, 0x6B))  # accent background
    assert close(card.getpixel((140, 315)), (30, 30, 200), 30)  # photo: blue half
    assert close(card.getpixel((320, 315)), (200, 30, 30), 30)  # photo: red half


async def test_card_url_changes_with_each_publication(client: AsyncClient) -> None:
    auth = await owner(client, "anna@example.pl")
    await publish(client, auth)
    first = (await client.get("/api/v1/public/profiles/anna")).json()["ogImageUrl"]
    first_card = decode((await client.get(CARD)).content)

    await edit(client, auth, accent="bordo")
    await publish(client, auth)
    second = (await client.get("/api/v1/public/profiles/anna")).json()["ogImageUrl"]
    second_card = decode((await client.get(CARD)).content)

    assert first.startswith("http://localhost:8080/api/v1/public/profiles/anna/og-image.jpg?v=")
    assert first != second
    assert close(first_card.getpixel((10, 10)), (0x0F, 0x27, 0x47))  # granat
    assert close(second_card.getpixel((10, 10)), (0x8E, 0x24, 0x42))  # bordo
    # Initials on a white disc when there is no photo.
    assert close(first_card.getpixel((100, 315)), (255, 255, 255))


async def test_card_is_rendered_once_per_publication(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth = await owner(client, "anna@example.pl")
    await publish(client, auth)
    calls = 0
    real = og_image.render

    def counting(**kwargs: Any) -> bytes:
        nonlocal calls
        calls += 1
        return real(**kwargs)

    monkeypatch.setattr(og_image, "render", counting)

    first = await client.get(CARD)
    second = await client.get(CARD)

    assert first.content == second.content
    assert calls == 1


async def test_card_works_when_valkey_is_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth = await owner(client, "anna@example.pl")
    await publish(client, auth)

    class Down:
        async def get(self, *_: object) -> None:
            raise ConnectionError

        async def set(self, *_: object, **__: object) -> None:
            raise ConnectionError

    monkeypatch.setattr(profiles, "get_valkey", lambda: Down())

    assert (await client.get(CARD)).status_code == 200


async def test_card_falls_back_to_initials_when_the_photo_is_gone(client: AsyncClient) -> None:
    auth = await owner(client, "anna@example.pl")
    await upload(client, auth, images.jpeg(600, 600))
    await publish(client, auth)
    async with get_sessionmaker()() as session:
        await session.execute(delete(ImageRow))
        await session.commit()

    response = await client.get(CARD)

    assert response.status_code == 200
    assert close(decode(response.content).getpixel((100, 315)), (255, 255, 255))


async def test_hidden_pages_have_no_card(client: AsyncClient) -> None:
    auth = await owner(client, "anna@example.pl")
    draft_only = await client.get(CARD)
    await publish(client, auth)
    await client.post("/api/v1/me/profile/unpublish", headers=auth)
    unpublished = await client.get(CARD)
    unknown = await client.get("/api/v1/public/profiles/nie-ma/og-image.jpg")

    for response in (draft_only, unpublished, unknown):
        assert response.status_code == 404
        assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("hide", ["unpublish", "block"])
async def test_a_cached_card_is_gone_once_the_page_is_hidden(
    client: AsyncClient, hide: str
) -> None:
    auth = await owner(client, "anna@example.pl")
    await publish(client, auth)
    assert (await client.get(CARD)).status_code == 200  # now cached

    if hide == "unpublish":
        await client.post("/api/v1/me/profile/unpublish", headers=auth)
    else:
        async with get_sessionmaker()() as session:
            await session.execute(update(Profile).values(blocked_at=datetime.now(UTC)))
            await session.commit()
    response = await client.get(CARD)

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"


async def test_renders_are_rate_limited_but_cached_cards_are_not(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core import rate_limit

    auth = await owner(client, "anna@example.pl")
    await publish(client, auth)
    monkeypatch.setattr(profiles, "OG_RENDERS", rate_limit.Limit("og_render", 1, 60))
    assert (await client.get(CARD)).status_code == 200
    assert (await client.get(CARD)).status_code == 200  # from the cache

    await edit(client, auth, headline="Nowy nagłówek")
    await publish(client, auth)
    response = await client.get(CARD)

    assert response.status_code == 429


async def test_sitemap_lists_visible_pages_newest_first(client: AsyncClient) -> None:
    for email in ("anna@example.pl", "bartek@example.pl", "cezary@example.pl", "dorota@example.pl"):
        auth = await owner(client, email)
        if email != "cezary@example.pl":  # never published
            await publish(client, auth)
    async with get_sessionmaker()() as session:
        await session.execute(
            update(Profile).where(Profile.nick == "dorota").values(blocked_at=datetime.now(UTC))
        )
        await session.commit()
    auth = await owner(client, "ewa@example.pl")
    await publish(client, auth)
    await client.post("/api/v1/me/profile/unpublish", headers=auth)

    response = await client.get("/api/v1/public/sitemap")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    items = response.json()["items"]
    assert [item["url"] for item in items] == [
        "http://localhost:8080/user/bartek",
        "http://localhost:8080/user/anna",
    ]
    assert items[0]["lastModified"] >= items[1]["lastModified"]


def test_long_text_wraps_and_ends_with_an_ellipsis() -> None:
    font = og_image._font(40, 500)

    lines = og_image.wrap("słowo " * 60, font, 400, 2)
    split = og_image.wrap("a" * 80, font, 400, 3)

    assert len(lines) == 2
    assert lines[-1].endswith("…")
    assert all(font.getlength(line) <= 400 for line in lines)
    assert len(split) == 3
    assert "".join(split).rstrip("…").startswith("a" * 40)


def test_very_long_names_get_the_smallest_size() -> None:
    font, lines = og_image._fit_name("Bardzo " * 30)

    assert font.size == 52
    assert len(lines) == 2


@pytest.mark.parametrize(
    ("name", "expected"),
    [("Anna Wiśniewska", "AW"), ("kasia", "K"), ("Jan Maria Rokita", "JR"), ("  ", "")],
)
def test_initials(name: str, expected: str) -> None:
    assert og_image.initials(name) == expected


def test_empty_name_does_not_break_the_layout() -> None:
    font, lines = og_image._fit_name("")

    assert lines == [""]
    assert font.size == 76


def test_unknown_accent_uses_the_default() -> None:
    card = decode(
        og_image.render(
            name="Anna", headline=None, address="profilo.pl/user/anna", accent="?", avatar=None
        )
    )

    assert close(card.getpixel((10, 10)), (0x0F, 0x27, 0x47))
