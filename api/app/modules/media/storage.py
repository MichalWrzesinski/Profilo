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


async def stored_keys() -> dict[str, float]:
    """Image keys (`{account}/{token}`) in storage → time of their newest file (Unix)."""
    fs, root = _fs()

    def scan() -> dict[str, float]:
        if not fs.exists(root):
            return {}
        keys: dict[str, float] = {}
        for path, info in fs.find(root, detail=True).items():
            parts = path[len(root) :].strip("/").split("/")
            if len(parts) < 3:  # not `{account}/{token}/{size}.webp`
                continue
            key = f"{parts[0]}/{parts[1]}"
            keys[key] = max(keys.get(key, 0.0), _stamp(info))
        return keys

    return await asyncio.to_thread(scan)


def _stamp(info: dict[str, object]) -> float:
    """Last change (Unix time); unknown counts as now, so nothing is removed on a guess."""
    changed = info.get("mtime") or info.get("created")
    if changed is None:
        return float("inf")
    timestamp = getattr(changed, "timestamp", None)
    return float(timestamp()) if callable(timestamp) else float(changed)  # type: ignore[arg-type]


async def remove_empty_folders(older_than: float) -> int:
    """Remove account folders without any file, changed before `older_than` (Unix time:
    an upload may be creating one right now); returns how many."""
    fs, root = _fs()

    def sweep() -> int:
        if not fs.exists(root):
            return 0
        removed = 0
        for entry in fs.ls(root, detail=True):
            if (
                entry["type"] == "directory"
                and _stamp(entry) < older_than
                and not fs.find(entry["name"])
            ):
                fs.rm(entry["name"], recursive=True)
                removed += 1
        return removed

    return await asyncio.to_thread(sweep)
