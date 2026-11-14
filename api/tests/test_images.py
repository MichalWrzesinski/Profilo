"""Avatar and background images (TASK-010)."""

import io
import time
from datetime import UTC, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import func, select, update

from app.core.db import get_sessionmaker
from app.modules.accounts.models import Account
from app.modules.media import storage
from app.modules.media.models import Image as ImageRow
from app.modules.profiles.models import Profile
from tests import images

pytestmark = pytest.mark.usefixtures("clean_state")

AVATAR = "/api/v1/me/profile/images/avatar"
BACKGROUND = "/api/v1/me/profile/images/background"


async def owner(client: AsyncClient, email: str = "anna@example.pl") -> dict[str, str]:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "displayName": "Anna Wiśniewska",
            "email": email,
            "password": "jasne-niebo-nad-krakowem",
            "acceptTerms": True,
        },
    )
    assert response.status_code == 201, response.text
    client.cookies.clear()
    auth = {"Authorization": f"Bearer {response.json()['accessToken']}"}
    async with get_sessionmaker()() as session:
        await session.execute(
            update(Account)
            .where(Account.email == email)
            .values(email_confirmed_at=datetime.now(UTC))
        )
        await session.commit()
    nick = email.split("@")[0].replace(".", "-")
    await client.put("/api/v1/me/profile/nick", json={"nick": nick}, headers=auth)
    return auth


async def upload(
    client: AsyncClient, auth: dict[str, str], data: bytes, path: str = AVATAR, name: str = "a.jpg"
) -> Any:
    return await client.put(path, files={"file": (name, data, "image/jpeg")}, headers=auth)


async def publish(client: AsyncClient, auth: dict[str, str]) -> Any:
    version = (await client.get("/api/v1/me/profile", headers=auth)).json()["version"]
    return await client.post("/api/v1/me/profile/publish", json={"version": version}, headers=auth)


async def image_count() -> int:
    async with get_sessionmaker()() as session:
        return int(await session.scalar(select(func.count()).select_from(ImageRow)) or 0)


async def test_large_photo_is_stored_as_variants_without_exif(client: AsyncClient) -> None:
    auth = await owner(client)
    data = images.jpeg(1900, 1900, noise=True)
    assert 6 * 1024 * 1024 < len(data) < 10 * 1024 * 1024

    started = time.monotonic()
    response = await upload(client, auth, data)
    elapsed = time.monotonic() - started

    assert response.status_code == 200, response.text
    avatar = response.json()["draft"]["avatar"]
    assert set(avatar["urls"]) == {"128", "256", "512"}
    assert response.json()["version"] == 3  # nick, then the image
    assert elapsed < 5  # target < 2 s on the server; CI machines vary
    for size, url in avatar["urls"].items():
        got = await client.get(url, headers=auth)
        variant = Image.open(io.BytesIO(got.content))
        assert got.headers["content-type"] == "image/webp"
        assert variant.size == (int(size), int(size))
        assert not variant.getexif()


async def test_draft_images_are_visible_only_to_their_owner(client: AsyncClient) -> None:
    auth = await owner(client)
    url = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["256"]
    other = await owner(client, "jan@example.pl")

    as_owner = await client.get(url, headers=auth)
    anonymous = await client.get(url)
    as_other = await client.get(url, headers=other)

    assert as_owner.status_code == 200
    assert as_owner.headers["cache-control"] == "private, no-store"
    assert as_owner.headers["x-content-type-options"] == "nosniff"
    assert (anonymous.status_code, as_other.status_code) == (404, 404)
    assert anonymous.headers["cache-control"] == "no-store"


async def test_published_images_are_public_until_the_page_is_hidden(client: AsyncClient) -> None:
    auth = await owner(client)
    url = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]
    await publish(client, auth)

    public = await client.get(url)
    page = (await client.get("/api/v1/public/profiles/anna")).json()
    await client.post("/api/v1/me/profile/unpublish", headers=auth)
    hidden = await client.get(url)
    as_owner = await client.get(url, headers=auth)

    assert public.status_code == 200
    assert public.headers["cache-control"] == "public, max-age=86400"
    assert page["content"]["avatar"]["urls"]["128"] == url
    assert hidden.status_code == 404
    assert as_owner.status_code == 200


async def test_blocked_page_hides_its_images_from_visitors(client: AsyncClient) -> None:
    auth = await owner(client)
    url = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]
    await publish(client, auth)
    async with get_sessionmaker()() as session:
        await session.execute(update(Profile).values(blocked_at=datetime.now(UTC)))
        await session.commit()

    assert (await client.get(url)).status_code == 404
    assert (await client.get(url, headers=auth)).status_code == 200


async def test_files_are_removed_when_saving_fails(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.profiles import service

    auth = await owner(client)
    stored: list[str] = []
    original_put = storage.put

    async def put(key: str, data: bytes) -> None:
        stored.append(key)
        await original_put(key, data)

    async def broken(*_: object, **__: object) -> None:
        raise RuntimeError("database gone")

    monkeypatch.setattr(storage, "put", put)
    monkeypatch.setattr(service, "_unused_images", broken)

    response = await upload(client, auth, images.jpeg())

    assert response.status_code == 500
    assert stored
    assert [await storage.get(key) for key in stored] == [None] * len(stored)
    assert await image_count() == 0


async def test_renamed_pdf_is_refused_and_the_previous_image_stays(client: AsyncClient) -> None:
    auth = await owner(client)
    first = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]

    refused = await upload(client, auth, images.PDF, name="zdjecie.jpg")
    draft = (await client.get("/api/v1/me/profile", headers=auth)).json()["draft"]

    assert refused.status_code == 415
    assert refused.json()["code"] == "unsupported_image"
    assert draft["avatar"] == first


async def test_more_than_ten_megabytes_is_refused(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await upload(client, auth, b"\xff\xd8" + b"\x00" * (10 * 1024 * 1024))

    assert response.status_code == 413
    assert response.json()["code"] == "file_too_large"


async def test_request_without_length_or_file_is_refused(client: AsyncClient) -> None:
    auth = await owner(client)

    async def body() -> Any:
        yield b"--x--\r\n"

    no_length = await client.put(
        AVATAR,
        content=body(),
        headers={**auth, "Content-Type": "multipart/form-data; boundary=x"},
    )
    no_file = await client.put(AVATAR, data={"other": "1"}, files={}, headers=auth)

    assert no_length.status_code == 413
    assert no_file.status_code == 422


async def test_too_small_image_has_a_field_message(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await upload(client, auth, images.jpeg(600, 300), path=BACKGROUND)

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "image_too_small"


async def test_replaced_images_are_deleted_unless_the_page_shows_them(client: AsyncClient) -> None:
    auth = await owner(client)
    first = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]
    second = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]
    assert await image_count() == 1  # the first one was never published
    assert (await client.get(first, headers=auth)).status_code == 404

    await publish(client, auth)
    third = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]
    still_public = await client.get(second)  # the published page still shows it
    assert await image_count() == 2

    await publish(client, auth)

    assert (await client.get(second)).status_code == 404
    assert (await client.get(third)).status_code == 200
    assert still_public.status_code == 200
    assert await image_count() == 1


async def test_remove_image_and_background(client: AsyncClient) -> None:
    auth = await owner(client)
    background = await upload(client, auth, images.jpeg(1200, 600), path=BACKGROUND)
    urls = background.json()["draft"]["background"]["urls"]

    removed = await client.delete(BACKGROUND, headers=auth)
    again = await client.delete(BACKGROUND, headers=auth)

    assert set(urls) == {"960", "1600", "2400"}
    assert removed.json()["draft"]["background"] is None
    assert again.json()["version"] == removed.json()["version"]
    assert await image_count() == 0


@pytest.mark.parametrize("size", ["960", "64"])
async def test_wrong_size_returns_404(client: AsyncClient, size: str) -> None:
    auth = await owner(client)
    url = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]

    response = await client.get(url.replace("/128.webp", f"/{size}.webp"), headers=auth)

    assert response.status_code in (404, 422)


async def test_unknown_image_and_missing_file_return_404(client: AsyncClient) -> None:
    auth = await owner(client)
    url = (await upload(client, auth, images.jpeg())).json()["draft"]["avatar"]["urls"]["128"]
    async with get_sessionmaker()() as session:
        key = await session.scalar(select(ImageRow.storage_key))
    await storage.delete_prefix(str(key))

    missing = await client.get(url, headers=auth)
    unknown = await client.get("/media/00000000-0000-7000-8000-000000000001/128.webp")

    assert (missing.status_code, unknown.status_code) == (404, 404)


async def test_uploads_are_rate_limited(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core import rate_limit
    from app.modules.media import service

    monkeypatch.setattr(service, "UPLOADS", rate_limit.Limit("image_upload", 1, 3600))
    auth = await owner(client)
    await upload(client, auth, images.jpeg())

    response = await upload(client, auth, images.jpeg())

    assert response.status_code == 429


async def test_upload_needs_login(client: AsyncClient) -> None:
    response = await client.put(AVATAR, files={"file": ("a.jpg", images.jpeg(), "image/jpeg")})

    assert response.status_code == 401


async def test_partly_written_variants_are_removed(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth = await owner(client)
    stored: list[str] = []
    original_put = storage.put

    async def flaky(key: str, data: bytes) -> None:
        if stored:
            raise OSError("disk full")
        stored.append(key)
        await original_put(key, data)

    monkeypatch.setattr(storage, "put", flaky)

    response = await upload(client, auth, images.jpeg())

    assert response.status_code == 500
    assert await storage.get(stored[0]) is None
    assert await image_count() == 0


async def test_one_upload_per_account_at_a_time(client: AsyncClient) -> None:
    from app.core.valkey import get_valkey

    auth = await owner(client)
    me = (await client.get("/api/v1/me", headers=auth)).json()
    await get_valkey().set(f"upload:{me['id']}", "1", ex=60)  # another upload is running

    busy = await upload(client, auth, images.jpeg())
    await get_valkey().delete(f"upload:{me['id']}")
    free = await upload(client, auth, images.jpeg())

    assert busy.status_code == 429
    assert busy.json()["detail"] == "Poczekaj, aż poprzedni obraz się wgra."
    assert free.status_code == 200
    assert await get_valkey().get(f"upload:{me['id']}") is None  # released


async def test_uploads_work_when_valkey_is_down(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.modules.media import service

    auth = await owner(client)

    class Down:
        async def set(self, *_: object, **__: object) -> None:
            raise ConnectionError

    monkeypatch.setattr(service, "get_valkey", lambda: Down())

    assert (await upload(client, auth, images.jpeg())).status_code == 200


async def test_slot_release_failure_is_only_logged(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.valkey import get_valkey
    from app.modules.media import service

    auth = await owner(client)
    real = get_valkey()

    class Flaky:
        async def set(self, *args: object, **kwargs: object) -> object:
            return await real.set(*args, **kwargs)  # type: ignore[arg-type]

        async def delete(self, *_: object) -> None:
            raise ConnectionError

    monkeypatch.setattr(service, "get_valkey", lambda: Flaky())

    assert (await upload(client, auth, images.jpeg())).status_code == 200
