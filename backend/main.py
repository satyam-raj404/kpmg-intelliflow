import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from repo root if python-dotenv available, else manual parse
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        for _line in _env_file.read_text().splitlines():
            if "=" in _line and not _line.startswith("#"):
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

from database import init_db, get_connection
from routers import upload, kpi, p2p, events, actions, auth, chat, profit_center


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Pre-warm DB connections
    loop = asyncio.get_event_loop()
    await asyncio.gather(*[loop.run_in_executor(None, get_connection) for _ in range(8)])
    # Fire seed in background — does NOT block startup
    loop.run_in_executor(None, _run_seed)
    yield


def _run_seed() -> None:
    """Load sample CSVs on first startup (idempotent — skips if data exists)."""
    try:
        import seed as _seed
        _seed.main()
    except Exception as exc:
        print(f"[seed] startup seed error: {exc}")


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
        "https://kpmg-intelliflow.vercel.app",
        *_EXTRA_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router,   prefix="/api")
app.include_router(kpi.router,      prefix="/api")
app.include_router(p2p.router,      prefix="/api")
app.include_router(events.router,   prefix="/api")
app.include_router(actions.router,  prefix="/api")
app.include_router(auth.router,     prefix="/api")
app.include_router(chat.router,          prefix="/api")
app.include_router(profit_center.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "IntelliSource P2P API"}
