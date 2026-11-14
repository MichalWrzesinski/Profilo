"""File storage through fsspec (a local volume on servers, memory:// in tests).
Keys are random and never derived from user input; files are only served by the API."""

import asyncio
from functools import lru_cache

import fsspec
from fsspec import AbstractFileSystem

from app.core.settings import get_settings


@lru_cache
def _fs() -> tuple[AbstractFileSystem, str]:
    fs, root = fsspec.core.url_to_fs(get_settings().media_url)
    return fs, root.rstrip("/")


def _path(key: str) -> str:
    _, root = _fs()
    return f"{root}/{key}"


async def put(key: str, data: bytes) -> None:
    fs, _ = _fs()
    path = _path(key)
    await asyncio.to_thread(fs.makedirs, path.rsplit("/", 1)[0], exist_ok=True)
    await asyncio.to_thread(fs.pipe_file, path, data)


async def get(key: str) -> bytes | None:
    fs, _ = _fs()
    try:
        return bytes(await asyncio.to_thread(fs.cat_file, _path(key)))
    except FileNotFoundError:
        return None


async def delete_prefix(prefix: str) -> None:
    fs, _ = _fs()
    path = _path(prefix)
    if await asyncio.to_thread(fs.exists, path):
        await asyncio.to_thread(fs.rm, path, recursive=True)
