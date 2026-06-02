from pydantic import BaseModel
from typing import Optional


class UploadResponse(BaseModel):
    batch_id: str
    status: str


class BatchRejection(BaseModel):
    row: int
    field: str
    reason: str


class BatchStatus(BaseModel):
    batch_id: str
    filename: Optional[str] = None
    status: str
    dataset_type: Optional[str] = None
    rows_accepted: Optional[int] = None
    rows_rejected: Optional[int] = None
    rejection_sample: Optional[list[BatchRejection]] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
