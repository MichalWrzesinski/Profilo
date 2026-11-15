"""QR code of the page address (TASK-014)."""

import io
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

import pytest
import segno
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import update

from app.core.db import get_sessionmaker
from app.modules.profiles.models import Profile
from app.modules.qr import codes
from tests.test_publishing import owner, publish

pytestmark = pytest.mark.usefixtures("clean_state")

QR = "/api/v1/me/profile/qr"
URL = "http://localhost:8080/user/anna-wisniewska"


def symbol() -> list[list[bool]]:
    """The expected modules of the page address, quiet zone included."""
    code = segno.make_qr(URL, error=codes.ERROR_LEVEL, boost_error=False)
    return [[bool(value) for value in row] for row in code.matrix_iter(scale=1, border=4)]


def sampled(png: bytes, count: int) -> list[list[bool]]:
    """Dark/light at the centre of every module of the picture."""
    image = Image.open(io.BytesIO(png)).convert("L")
    step = image.width / count
    return [
        [image.getpixel((int((x + 0.5) * step), int((y + 0.5) * step))) < 128 for x in range(count)]  # type: ignore[operator]
        for y in range(count)
    ]


async def test_png_is_1024_px_with_a_quiet_zone_and_encodes_the_address(
    client: AsyncClient,
) -> None:
    auth = await owner(client)
    await publish(client, auth)

    response = await client.get(QR, params={"format": "png"}, headers=auth)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["content-disposition"] == (
        'attachment; filename="profilo-anna-wisniewska.png"'
    )
    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    assert image.size == (1024, 1024)
    expected = symbol()
    grid = sampled(response.content, len(expected))
    assert grid == expected  # the same symbol: it encodes the canonical address
    assert not any(any(row) for row in grid[:4])  # 4-module quiet zone
    assert not any(any(row[:4]) for row in grid)
    assert image.getpixel((0, 0)) == (255, 255, 255)
    assert image.getpixel((1023, 1023)) == (255, 255, 255)


async def test_svg_is_scalable_with_the_same_symbol(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)

    response = await client.get(QR, params={"format": "svg"}, headers=auth)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert response.headers["content-disposition"].endswith('profilo-anna-wisniewska.svg"')
    root = ET.fromstring(response.content)  # noqa: S314 - our own output in a test
    size = len(symbol())
    assert root.get("viewBox") == f"0 0 {size} {size}"
    assert (root.get("width"), root.get("height")) == ("1024", "1024")
    assert URL in response.text  # in the <title>


async def test_svg_is_the_default(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)

    response = await client.get(QR, headers=auth)

    assert response.headers["content-type"] == "image/svg+xml"


async def test_the_code_stays_available_after_unpublishing(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)
    await client.post("/api/v1/me/profile/unpublish", headers=auth)

    assert (await client.get(QR, headers=auth)).status_code == 200


async def test_never_published_page_has_no_code(client: AsyncClient) -> None:
    auth = await owner(client)

    response = await client.get(QR, headers=auth)

    assert response.status_code == 409
    assert response.json()["code"] == "not_published"


async def test_blocked_page_has_no_code(client: AsyncClient) -> None:
    auth = await owner(client)
    await publish(client, auth)
    async with get_sessionmaker()() as session:
        await session.execute(update(Profile).values(blocked_at=datetime.now(UTC)))
        await session.commit()

    response = await client.get(QR, headers=auth)

    assert response.status_code == 409
    assert response.json()["code"] == "page_blocked"


@pytest.mark.parametrize("params", [{"format": "gif"}, {"format": ""}])
async def test_unknown_format_is_refused(client: AsyncClient, params: dict[str, str]) -> None:
    auth = await owner(client)
    await publish(client, auth)

    assert (await client.get(QR, params=params, headers=auth)).status_code == 422


async def test_code_needs_login(client: AsyncClient) -> None:
    assert (await client.get(QR)).status_code == 401
