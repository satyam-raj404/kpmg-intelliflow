"""Upload router — POST /api/upload, GET /api/upload/{batch_id}."""
import asyncio
import json
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from database import get_connection
from services.etl import run_etl
from routers.events import broadcast

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=2)

MAX_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXT = {".csv", ".xlsx", ".xls"}


def _etl_worker(file_bytes: bytes, filename: str, batch_id: str) -> None:
    loop = asyncio.new_event_loop()

    def _progress(pct: int, msg: str) -> None:
        broadcast({"type": "UPLOAD_PROGRESS", "batch_id": batch_id, "pct": pct, "message": msg})

    try:
        run_etl(file_bytes, filename, batch_id, progress_cb=_progress)
        broadcast({
            "type": "KPI_REFRESH",
            "batch_id": batch_id,
            "dashboards": ["procurement", "financial", "leadership", "vendor", "utilization"],
        })
    except Exception as exc:
        conn = get_connection()
        conn.execute(
            "UPDATE upload_batches SET status='FAILED', error_message=? WHERE batch_id=?",
            (str(exc), batch_id),
        )
        conn.commit()
        broadcast({"type": "UPLOAD_ERROR", "batch_id": batch_id, "error": str(exc)})
    finally:
        loop.close()


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    filename = file.filename or "upload"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported file type '{ext}'. Use CSV or Excel.")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 50 MB limit.")
    if not content:
        raise HTTPException(400, "Empty file.")

    batch_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute(
        "INSERT INTO upload_batches (batch_id, filename, status) VALUES (?, ?, 'PROCESSING')",
        (batch_id, filename),
    )
    conn.commit()

    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _etl_worker, content, filename, batch_id)

    return {"batch_id": batch_id, "status": "PROCESSING"}


@router.get("/upload/{batch_id}")
def get_batch(batch_id: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM upload_batches WHERE batch_id = ?", (batch_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Batch not found.")
    data = dict(row)
    if data.get("rejection_sample") and isinstance(data["rejection_sample"], str):
        try:
            data["rejection_sample"] = json.loads(data["rejection_sample"])
        except Exception:
            pass
    return data
