"""SSE event stream router."""
import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

_clients: list[asyncio.Queue] = []
_loop: asyncio.AbstractEventLoop | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Store the main event loop so broadcast() can schedule work thread-safely."""
    global _loop
    _loop = loop


async def _event_stream(queue: asyncio.Queue) -> AsyncGenerator[str, None]:
    try:
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                yield "event: ping\ndata: {}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        if queue in _clients:
            _clients.remove(queue)


@router.get("/stream")
async def stream():
    queue: asyncio.Queue = asyncio.Queue()
    _clients.append(queue)
    return StreamingResponse(
        _event_stream(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _put_nowait_safe(q: asyncio.Queue, event: dict) -> None:
    try:
        q.put_nowait(event)
    except Exception:
        pass


def broadcast(event: dict) -> None:
    """Thread-safe broadcast: schedule put_nowait on the main event loop."""
    if not _clients:
        return
    if _loop is not None and _loop.is_running():
        for q in list(_clients):
            _loop.call_soon_threadsafe(_put_nowait_safe, q, event)
    else:
        for q in list(_clients):
            _put_nowait_safe(q, event)


async def broadcast_async(event: dict) -> None:
    for q in list(_clients):
        await q.put(event)
