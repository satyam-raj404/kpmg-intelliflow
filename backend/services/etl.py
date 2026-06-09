"""ETL orchestrator: parse → validate → load → facts → events → KPIs."""
from typing import Callable

from database import get_connection
from services.parser import parse_file
from services.validator import validate
from services.loader import load
from services.fact_builder import build_facts, build_entity_hierarchy
from services.event_generator import generate_events
from services.kpi_engine import compute_all


def run_etl(
    file_bytes: bytes,
    filename: str,
    batch_id: str,
    progress_cb: Callable[[int, str], None] | None = None,
) -> dict:
    def _progress(pct: int, msg: str) -> None:
        if progress_cb:
            progress_cb(pct, msg)

    _progress(5, "Parsing file…")
    df, dataset_type = parse_file(file_bytes, filename)

    _progress(20, f"Validating {len(df)} rows as {dataset_type}…")
    conn = get_connection()
    valid_df, rejection_log = validate(df, dataset_type, conn)

    rows_accepted = len(valid_df)
    rows_rejected = len(rejection_log)

    _progress(40, f"Loading {rows_accepted} rows into {dataset_type}…")
    load(valid_df, dataset_type, conn, batch_id)

    _progress(55, "Rebuilding entity hierarchy…")
    build_entity_hierarchy(conn)

    _progress(60, "Rebuilding fact table…")
    build_facts(conn)

    _progress(75, "Generating process mining events…")
    generate_events(conn)

    _progress(90, "Computing KPIs…")
    compute_all(conn)

    # Update batch record
    import json
    rejection_sample = rejection_log[:20]
    conn.execute("""
        UPDATE upload_batches
        SET status = 'COMPLETED',
            dataset_type = ?,
            rows_accepted = ?,
            rows_rejected = ?,
            rejection_sample = ?,
            completed_at = NOW()::TEXT
        WHERE batch_id = ?
    """, (
        dataset_type, rows_accepted, rows_rejected,
        json.dumps(rejection_sample), batch_id,
    ))
    conn.commit()

    _progress(100, "Done.")

    return {
        "batch_id": batch_id,
        "dataset_type": dataset_type,
        "rows_accepted": rows_accepted,
        "rows_rejected": rows_rejected,
        "rejection_sample": rejection_sample,
        "dashboards_refreshed": ["procurement", "financial", "leadership", "vendor", "utilization"],
    }
