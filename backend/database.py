import os
import sqlite3
import threading
from pathlib import Path

# INTELLISOURCE_DB env var lets Vercel serverless point to /tmp/intellisource.db
DB_PATH = Path(os.environ.get("INTELLISOURCE_DB", str(Path(__file__).parent / "intellisource.db")))
_local = threading.local()


def get_connection() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        _local.conn = conn
    return _local.conn


def init_db():
    sql = (Path(__file__).parent / "schema.sql").read_text()
    conn = get_connection()
    conn.executescript(sql)
    conn.commit()
    print("[DB] Schema initialised.")
