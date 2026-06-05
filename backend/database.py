import os
import threading
from pathlib import Path

import psycopg

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:1234@localhost:5432/intellisource"
)

_local = threading.local()


class HybridRow(dict):
    """Dict subclass supporting both row['col'] and row[0] access (sqlite3 compat)."""

    def __init__(self, items):
        data = list(items)
        super().__init__(data)
        self._values = [v for _, v in data]

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)

    def __iter__(self):
        return iter(self._values)

    def __contains__(self, key):
        return dict.__contains__(self, key)


def _hybrid_factory(cursor):
    cols = [col.name for col in cursor.description] if cursor.description else []
    def make_row(values):
        return HybridRow(zip(cols, values))
    return make_row


class _PGConnection:
    """Wraps psycopg3 connection to mimic sqlite3 connection interface."""

    def __init__(self, raw: psycopg.Connection):
        self._raw = raw
        self._raw.row_factory = _hybrid_factory

    def execute(self, sql: str, params=None):
        clean_sql = sql.replace("?", "%s")
        # Use savepoint so a single failed statement doesn't abort the whole transaction
        try:
            self._raw.execute("SAVEPOINT _sp")
            result = self._raw.execute(clean_sql, params)
            self._raw.execute("RELEASE SAVEPOINT _sp")
            return result
        except Exception:
            try:
                self._raw.execute("ROLLBACK TO SAVEPOINT _sp")
                self._raw.execute("RELEASE SAVEPOINT _sp")
            except Exception:
                pass
            raise

    def executemany(self, sql: str, params_list):
        with self._raw.cursor() as cur:
            cur.executemany(sql.replace("?", "%s"), params_list)

    def commit(self):
        self._raw.commit()

    def rollback(self):
        self._raw.rollback()


def get_connection() -> _PGConnection:
    if not hasattr(_local, "conn") or _local.conn is None:
        raw = psycopg.connect(DATABASE_URL)
        raw.autocommit = False
        _local.conn = _PGConnection(raw)
    else:
        # Reset broken transaction from previous request on this thread
        try:
            _local.conn._raw.rollback()
        except Exception:
            pass
    return _local.conn


def init_db():
    sql = (Path(__file__).parent / "schema.sql").read_text()
    conn = get_connection()
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)
    conn.commit()
    print("[DB] Schema initialised.")
