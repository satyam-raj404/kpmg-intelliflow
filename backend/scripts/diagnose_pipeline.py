"""Diagnostic: runs the post-CSV-load pipeline steps one at a time, printing
a full traceback for whichever one fails, instead of the silent swallow
main.py's startup path does. Doesn't touch the raw staging tables — safe to
run against a DB that already has pr_dump/po_dump/etc. populated.

Usage:
    Intl\\Scripts\\python.exe backend\\scripts\\diagnose_pipeline.py
(run from the project root, or adjust sys.path below if run from elsewhere)
"""
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import database
from services.fact_builder import build_facts, build_entity_hierarchy
from services.event_generator import generate_events
from services.kpi_engine import compute_all

conn = database.get_connection()

steps = [
    ("build_entity_hierarchy", lambda: build_entity_hierarchy(conn)),
    ("build_facts", lambda: build_facts(conn)),
    ("generate_events", lambda: generate_events(conn)),
    ("compute_all", lambda: compute_all(conn)),
]

for name, fn in steps:
    print(f"=== {name} ===")
    try:
        fn()
        conn.commit()
        print(f"=== {name} OK ===")
    except Exception:
        print(f"=== {name} FAILED ===")
        traceback.print_exc()
        conn.rollback()
        break
