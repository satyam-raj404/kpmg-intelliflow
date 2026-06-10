import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_connection
from routers import upload, kpi, p2p, events


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Pre-warm 8 worker-thread DB connections so all early requests skip the ~2s cold-start
    loop = asyncio.get_event_loop()
    await asyncio.gather(*[loop.run_in_executor(None, get_connection) for _ in range(8)])
    yield


app = FastAPI(
    title="IntelliSource P2P API",
    version="1.0.0",
    lifespan=lifespan,
)

import os as _os

_EXTRA_ORIGINS = [o.strip() for o in _os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        *_EXTRA_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(kpi.router,    prefix="/api")
app.include_router(p2p.router,    prefix="/api")
app.include_router(events.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "IntelliSource P2P API"}
