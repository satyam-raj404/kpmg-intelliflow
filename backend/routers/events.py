"""SSE event stream router."""
import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

_clients: list[asyncio.Queue] = []


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


def broadcast(event: dict) -> None:
    """Called from background ETL thread via asyncio.run_coroutine_threadsafe."""
    for q in list(_clients):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


async def broadcast_async(event: dict) -> None:
    for q in list(_clients):
        await q.put(event)
